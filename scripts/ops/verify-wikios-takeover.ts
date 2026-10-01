#!/usr/bin/env bun
/**
 * scripts/ops/verify-wikios-takeover.ts (plan 417)
 *
 * Verifies the ixwiki.com/wiki/* takeover end to end: WikiOS answers /wiki/*, classic MediaWiki is
 * reachable under /classic/, index.php page views redirect to WikiOS while edit/history stay on PHP,
 * and the private render engine answers action=parse on loopback. Read-only: it only issues GET
 * requests, never follows redirects, and needs no dependencies.
 *
 * Usage:
 *   bun scripts/ops/verify-wikios-takeover.ts --base https://ixwiki.com \
 *     --ixstates "$NEXT_PUBLIC_IXSTATES_URL" [--internal http://127.0.0.1:8081] \
 *     [--file Some_Real_File.png] [--image /images/a/ab/Some_Real_File.png] \
 *     [--page Main_Page] [--revid 1] [--subpage Template:Infobox_country/doc] [--category Category:Countries] \
 *     [--article Some_Long_Article --article-text "a plain sentence from its body"]
 *   bun scripts/ops/verify-wikios-takeover.ts --base http://127.0.0.1:3560 --ixstates "$URL" --standalone
 *
 * Exit code 1 when any expectation fails.
 *
 * Notes:
 * - --ixstates is the NEXT_PUBLIC_IXSTATES_URL of the WikiOS build (also read from that environment
 *   variable). There is no default: the IxStates path differs per server.
 * - --page, --revid, --subpage and --category must name things that exist: a page and one of its
 *   revisions, a template subpage and a category page. The defaults are guesses.
 * - /api.php is MediaWiki's on the public host; WikiOS's own MediaWiki-compatible api.php is /w/api.php
 *   (two rows below: siteinfo, and a login token, which answers `sessionsecretmissing`, so the row fails,
 *   while WIKIOS_API_SESSION_SECRET is not set).
 * - --standalone keeps only the rows that do not need the nginx takeover or classic MediaWiki on --base:
 *   WikiOS itself, plus the render engine when --internal is given.
 * - --article-text is a plain sentence (no quotes, ampersands or links) from the body of --article (default:
 *   --page), asked for as an anonymous page load (`Accept: text/html`, no cookie). The row catches an SSR
 *   stash miss of lean-flight mode (WIKIOS_LEAN_FLIGHT=1), where the article's HTML is swapped for a marker in
 *   the page data and read back from the server-rendered DOM: a miss serves the page with no article body.
 *   Lean mode only applies to an article of 20,000 or more characters of HTML, so name a long one. Without
 *   --article-text the row is left out.
 * - --image is a real upload path (for example one listed under /ixwiki/shared/images); without it
 *   the /images/ row is reported as skipped rather than guessed.
 */

export type Via = "public" | "internal";

/** An exact status, any of several statuses, or anything except one status. */
export type StatusExpectation = number | readonly number[] | { readonly not: number };

export interface Expectation {
  readonly name: string;
  readonly path: string;
  readonly via: Via;
  readonly expectStatus: StatusExpectation;
  /** Checked only on 3xx responses: exact path+query, or a prefix when it ends with "*". */
  readonly expectLocation?: string;
  readonly expectBodyIncludes?: string;
  /** The Content-Type header must include this text (case-insensitive). */
  readonly expectContentType?: string;
  /** The body must parse as JSON. */
  readonly expectJson?: boolean;
  /** True when the row holds before the nginx takeover, against a lone WikiOS process on --base. */
  readonly standalone?: boolean;
  /** Fetched from this absolute URL instead of the origin of `via` (the configured IxStates URL). */
  readonly url?: string;
  /** Request headers sent on top of the user agent (e.g. `accept` for an anonymous page load). */
  readonly headers?: Readonly<Record<string, string>>;
}

export interface Observation {
  readonly status: number;
  readonly location: string | null;
  readonly contentType: string | null;
  readonly body: string;
}

export interface Evaluation {
  readonly ok: boolean;
  readonly failures: readonly string[];
}

export interface Options {
  readonly base: string;
  readonly ixstates: string;
  readonly internal: string | null;
  readonly file: string;
  readonly image: string | null;
  readonly page: string;
  readonly revid: string;
  readonly subpage: string;
  readonly category: string;
  /** The article whose body text is checked in the page HTML (default: `page`). */
  readonly article: string;
  /** A plain sentence from that article's body; null leaves the row out. */
  readonly articleText: string | null;
  readonly standalone: boolean;
}

export type ChecklistOptions = Pick<
  Options,
  "file" | "image" | "ixstates" | "page" | "revid" | "subpage" | "category"
> &
  Partial<Pick<Options, "article" | "articleText">>;

const DEFAULT_BASE = "https://ixwiki.com";
const DEFAULT_FILE = "Example.png";
const DEFAULT_PAGE = "Main_Page";
const DEFAULT_REVID = "1";
const DEFAULT_SUBPAGE = "Template:Infobox_country/doc";
const DEFAULT_CATEGORY = "Category:Countries";
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "IxStats-WikiOS-Verify/1.0";

function statusMatches(expected: StatusExpectation, actual: number): boolean {
  if (typeof expected === "number") return actual === expected;
  if ("not" in expected) return actual !== expected.not;
  return expected.includes(actual);
}

function describeStatus(expected: StatusExpectation): string {
  if (typeof expected === "number") return String(expected);
  if ("not" in expected) return `anything but ${expected.not}`;
  return expected.join(" or ");
}

/** A Location header reduced to path + query, so absolute and relative redirects compare equal. */
function locationPath(location: string): string {
  return location.replace(/^https?:\/\/[^/]+/i, "");
}

function locationMatches(expected: string, location: string | null): boolean {
  if (location === null) return false;
  const actual = locationPath(location);
  return expected.endsWith("*") ? actual.startsWith(expected.slice(0, -1)) : actual === expected;
}

function isJson(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

type Check = (expectation: Expectation, observed: Observation) => string | null;

function statusFailure(expectation: Expectation, observed: Observation): string | null {
  return statusMatches(expectation.expectStatus, observed.status)
    ? null
    : `status ${observed.status}, expected ${describeStatus(expectation.expectStatus)}`;
}

function locationFailure(expectation: Expectation, observed: Observation): string | null {
  const isRedirect = observed.status >= 300 && observed.status < 400;
  if (expectation.expectLocation === undefined || !isRedirect) return null;
  return locationMatches(expectation.expectLocation, observed.location)
    ? null
    : `Location ${observed.location ?? "(none)"}, expected ${expectation.expectLocation}`;
}

function bodyFailure(expectation: Expectation, observed: Observation): string | null {
  const needle = expectation.expectBodyIncludes;
  if (needle === undefined || observed.body.includes(needle)) return null;
  return `body does not include ${JSON.stringify(needle)}`;
}

function contentTypeFailure(expectation: Expectation, observed: Observation): string | null {
  const needle = expectation.expectContentType;
  if (needle === undefined) return null;
  if (observed.contentType?.toLowerCase().includes(needle.toLowerCase())) return null;
  return `Content-Type ${observed.contentType ?? "(none)"}, expected ${needle}`;
}

function jsonFailure(expectation: Expectation, observed: Observation): string | null {
  return expectation.expectJson && !isJson(observed.body) ? "body is not JSON" : null;
}

const CHECKS: readonly Check[] = [
  statusFailure,
  locationFailure,
  bodyFailure,
  contentTypeFailure,
  jsonFailure,
];

/** Pure check of one observed response against one expectation. */
export function evaluateExpectation(expectation: Expectation, observed: Observation): Evaluation {
  const failures = CHECKS.map((check) => check(expectation, observed)).filter(
    (failure): failure is string => failure !== null
  );
  return { ok: failures.length === 0, failures };
}

/** Path of the IxStates URL without a trailing slash ("/projects/ixstates"; "" for a bare host). */
export function ixstatesPath(ixstates: string): string {
  return new URL(ixstates).pathname.replace(/\/+$/, "");
}

/** Rows for the paths that only WikiOS can answer: they hold on a lone WikiOS process too. */
function wikiosRows(options: ChecklistOptions): Expectation[] {
  const ixPath = ixstatesPath(options.ixstates);
  return [
    {
      name: "root redirects to the Main Page",
      path: "/",
      via: "public",
      expectStatus: 302,
      expectLocation: "/wiki/Main_Page",
      standalone: true,
    },
    {
      name: "WikiOS serves /wiki/Main_Page",
      path: "/wiki/Main_Page",
      via: "public",
      expectStatus: 200,
      expectBodyIncludes: "__next",
      standalone: true,
    },
    {
      name: "robots.txt comes from WikiOS",
      path: "/robots.txt",
      via: "public",
      expectStatus: 200,
      expectBodyIncludes: "User-agent",
      standalone: true,
    },
    {
      name: "sitemap comes from WikiOS",
      path: "/wiki-sitemap",
      via: "public",
      expectStatus: 200,
      standalone: true,
    },
    {
      name: "template subpage (slash in the title)",
      path: `/wiki/${options.subpage}`,
      via: "public",
      expectStatus: 200,
      standalone: true,
    },
    {
      name: "category page (namespace with a colon)",
      path: `/wiki/${options.category}`,
      via: "public",
      expectStatus: 200,
      standalone: true,
    },
    {
      name: "Special:Search is served by WikiOS",
      path: "/wiki/Special:Search?search=x",
      via: "public",
      expectStatus: 200,
      standalone: true,
    },
    {
      name: "action=raw is served by WikiOS as wikitext",
      path: `/wiki/${options.page}?action=raw`,
      via: "public",
      expectStatus: 200,
      expectContentType: "text/x-wiki",
      standalone: true,
    },
    {
      name: "old revision is served by WikiOS",
      path: `/wiki/${options.page}?oldid=${options.revid}`,
      via: "public",
      expectStatus: 200,
      standalone: true,
    },
    {
      name: "api.php (plan 410) answers siteinfo from WikiOS at /w/api.php",
      path: "/w/api.php?action=query&meta=siteinfo&siprop=general&format=json",
      via: "public",
      expectStatus: 200,
      expectContentType: "application/json",
      expectBodyIncludes: '"sitename"',
      expectJson: true,
      standalone: true,
    },
    {
      name: "api.php hands out a login token (the session secret is set)",
      path: "/w/api.php?action=query&meta=tokens&type=login&format=json",
      via: "public",
      expectStatus: 200,
      expectBodyIncludes: '"logintoken"',
      expectJson: true,
      standalone: true,
    },
    {
      name: "IxTime store endpoint answers (every page fetches it)",
      path: "/api/ixtime/current",
      via: "public",
      expectStatus: 200,
      expectJson: true,
      standalone: true,
    },
    {
      name: "map embed iframe goes to IxStates",
      path: "/maps?embed=true",
      via: "public",
      expectStatus: 302,
      expectLocation: `${ixPath}/maps?embed=true`,
      standalone: true,
    },
    {
      name: "MapLibre worker served by WikiOS",
      path: "/maplibre/maplibre-gl-worker.mjs",
      via: "public",
      expectStatus: 200,
      standalone: true,
    },
    {
      name: "flag files served by WikiOS",
      path: "/flags/metadata.json",
      via: "public",
      expectStatus: 200,
      standalone: true,
    },
    {
      name: "flag placeholder served by WikiOS",
      path: "/images/flags/placeholder.svg",
      via: "public",
      expectStatus: 200,
      standalone: true,
    },
    {
      name: "fonts served by WikiOS",
      path: "/fonts/National-Book.otf",
      via: "public",
      expectStatus: 200,
      standalone: true,
    },
    {
      name: "IxStates still reachable at the configured URL",
      path: ixPath || "/",
      via: "public",
      url: options.ixstates,
      expectStatus: { not: 404 },
      standalone: true,
    },
    {
      name: "render engine parses wikitext on loopback",
      path: "/api.php?action=parse&text=x&contentmodel=wikitext&format=json",
      via: "internal",
      expectStatus: 200,
      expectJson: true,
      standalone: true,
    },
  ];
}

/** Rows that need the nginx takeover and classic MediaWiki behind it. */
function takeoverRows(options: ChecklistOptions): Expectation[] {
  return [
    {
      name: "classic MediaWiki under /classic/",
      path: "/classic/Main_Page",
      via: "public",
      expectStatus: 200,
      expectBodyIncludes: "mw-",
    },
    {
      name: "index.php view redirects to WikiOS",
      path: "/index.php?title=Foo",
      via: "public",
      expectStatus: 301,
      expectLocation: "/wiki/Foo",
    },
    {
      name: "index.php action=edit stays on classic (403 for a protected page)",
      path: "/index.php?title=Foo&action=edit",
      via: "public",
      expectStatus: [200, 403],
    },
    {
      name: "index.php oldid view redirects to WikiOS",
      path: "/index.php?title=Foo&oldid=1",
      via: "public",
      expectStatus: 301,
      expectLocation: "/wiki/Foo?oldid=1*",
    },
    {
      name: "Special:FilePath stays on MediaWiki and redirects to the upload",
      path: `/wiki/Special:FilePath/${options.file}`,
      via: "public",
      expectStatus: 302,
      expectLocation: "/images/*",
    },
    {
      name: "public api.php (MediaWiki) still answers",
      path: "/api.php?action=query&meta=siteinfo&format=json",
      via: "public",
      expectStatus: 200,
      expectBodyIncludes: "sitename",
    },
  ];
}

/**
 * The anonymous page-load row of lean-flight mode: the article's HTML must be in the first HTML response.
 * A stash miss leaves the page with no article body, which every other row here would still call a 200.
 */
function articleBodyRow(options: ChecklistOptions): Expectation[] {
  if (!options.articleText) return [];
  return [
    {
      name: "anonymous article page load carries the article body text (lean-flight stash miss check)",
      path: `/wiki/${options.article ?? options.page}`,
      via: "public",
      expectStatus: 200,
      expectBodyIncludes: options.articleText,
      headers: { accept: "text/html" },
      standalone: true,
    },
  ];
}

/** The takeover checklist. `image` is optional: without a real upload path the row is left out. */
export function buildExpectations(options: ChecklistOptions): Expectation[] {
  const rows = [...wikiosRows(options), ...articleBodyRow(options), ...takeoverRows(options)];
  if (options.image) {
    rows.push({
      name: "upload served from /images/",
      path: options.image,
      via: "public",
      expectStatus: 200,
    });
  }
  return rows;
}

type Env = Readonly<Record<string, string | undefined>>;

function readFlag(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
}

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function requireIxstates(argv: readonly string[], env: Env): string {
  const value = readFlag(argv, "--ixstates") ?? env.NEXT_PUBLIC_IXSTATES_URL?.trim();
  if (!value) {
    throw new Error(
      "--ixstates is required (the NEXT_PUBLIC_IXSTATES_URL of the WikiOS build; there is no default)"
    );
  }
  if (!URL.canParse(value)) {
    throw new Error(`--ixstates must be an absolute URL, got ${JSON.stringify(value)}`);
  }
  return stripTrailingSlashes(value);
}

export function parseArgs(argv: readonly string[], env: Env = process.env): Options {
  const internal = readFlag(argv, "--internal");
  const image = readFlag(argv, "--image");
  if (image !== null && !image.startsWith("/")) throw new Error("--image must be an absolute path");
  const page = readFlag(argv, "--page") ?? DEFAULT_PAGE;
  return {
    base: stripTrailingSlashes(readFlag(argv, "--base") ?? DEFAULT_BASE),
    ixstates: requireIxstates(argv, env),
    internal: internal === null ? null : stripTrailingSlashes(internal),
    file: readFlag(argv, "--file") ?? DEFAULT_FILE,
    image,
    page,
    revid: readFlag(argv, "--revid") ?? DEFAULT_REVID,
    subpage: readFlag(argv, "--subpage") ?? DEFAULT_SUBPAGE,
    category: readFlag(argv, "--category") ?? DEFAULT_CATEGORY,
    article: readFlag(argv, "--article") ?? page,
    articleText: readFlag(argv, "--article-text"),
    standalone: argv.includes("--standalone"),
  };
}

function urlFor(expectation: Expectation, options: Options): string | null {
  if (expectation.url) return expectation.url;
  const origin = expectation.via === "internal" ? options.internal : options.base;
  return origin === null ? null : `${origin}${expectation.path}`;
}

/** Rows to run for these options, each with the URL it is fetched from (null = skipped). */
export function planChecks(options: Options): { expectation: Expectation; url: string | null }[] {
  return buildExpectations(options)
    .filter((expectation) => !options.standalone || expectation.standalone)
    .map((expectation) => ({ expectation, url: urlFor(expectation, options) }));
}

async function observe(
  url: string,
  headers: Readonly<Record<string, string>> = {}
): Promise<Observation> {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "user-agent": USER_AGENT, ...headers },
  });
  return {
    status: response.status,
    location: response.headers.get("location"),
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
}

async function runCheck(expectation: Expectation, url: string): Promise<Evaluation> {
  try {
    return evaluateExpectation(expectation, await observe(url, expectation.headers));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, failures: [`request failed: ${message}`] };
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const options = parseArgs(argv);
  console.log(
    `WikiOS takeover verification against ${options.base} (IxStates ${options.ixstates})`
  );
  if (!options.internal) console.log("(no --internal: render-engine rows are skipped)");
  if (!options.image) console.log("(no --image: the /images/ row is skipped)");
  if (!options.articleText) {
    console.log("(no --article-text: the article body text row, the lean-flight check, is skipped)");
  }

  let failed = 0;
  for (const { expectation, url } of planChecks(options)) {
    if (url === null) {
      console.log(`SKIP  ${expectation.name}`);
      continue;
    }
    const result = await runCheck(expectation, url);
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${expectation.name}  [${expectation.path}]`);
    for (const failure of result.failures) console.log(`        ${failure}`);
    if (!result.ok) failed += 1;
  }

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
  return failed === 0 ? 0 : 1;
}

const isMain =
  Boolean(import.meta.main) ||
  (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) ||
  Boolean(process.argv[1]?.endsWith("verify-wikios-takeover.ts"));

if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: Error) => {
      console.error(error.message);
      process.exit(1);
    }
  );
}
