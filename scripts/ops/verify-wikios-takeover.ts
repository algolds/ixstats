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
 *     [--internal http://127.0.0.1:8081] [--file Some_Real_File.png] [--image /images/a/ab/Some_Real_File.png]
 *   bun scripts/ops/verify-wikios-takeover.ts --base http://127.0.0.1:3560 --standalone   # pre-cutover
 *
 * Exit code 1 when any expectation fails.
 *
 * Notes:
 * - /api.php is still MediaWiki's on the public host; when WikiOS serves its own api.php subset the
 *   expected body here changes.
 * - --standalone keeps only the rows that do not need the nginx takeover or classic MediaWiki on --base:
 *   WikiOS itself, plus the render engine when --internal is given.
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
  /** The body must parse as JSON. */
  readonly expectJson?: boolean;
  /** True when the row holds before the nginx takeover, against a lone WikiOS process on --base. */
  readonly standalone?: boolean;
}

export interface Observation {
  readonly status: number;
  readonly location: string | null;
  readonly body: string;
}

export interface Evaluation {
  readonly ok: boolean;
  readonly failures: readonly string[];
}

export interface Options {
  readonly base: string;
  readonly internal: string | null;
  readonly file: string;
  readonly image: string | null;
  readonly standalone: boolean;
}

const DEFAULT_BASE = "https://ixwiki.com";
const DEFAULT_FILE = "Example.png";
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

/** Pure check of one observed response against one expectation. */
export function evaluateExpectation(expectation: Expectation, observed: Observation): Evaluation {
  const failures: string[] = [];
  if (!statusMatches(expectation.expectStatus, observed.status)) {
    failures.push(
      `status ${observed.status}, expected ${describeStatus(expectation.expectStatus)}`
    );
  }
  const isRedirect = observed.status >= 300 && observed.status < 400;
  if (
    expectation.expectLocation !== undefined &&
    isRedirect &&
    !locationMatches(expectation.expectLocation, observed.location)
  ) {
    failures.push(
      `Location ${observed.location ?? "(none)"}, expected ${expectation.expectLocation}`
    );
  }
  if (
    expectation.expectBodyIncludes !== undefined &&
    !observed.body.includes(expectation.expectBodyIncludes)
  ) {
    failures.push(`body does not include ${JSON.stringify(expectation.expectBodyIncludes)}`);
  }
  if (expectation.expectJson && !isJson(observed.body)) {
    failures.push("body is not JSON");
  }
  return { ok: failures.length === 0, failures };
}

/** The takeover checklist. `image` is optional: without a real upload path the row is left out. */
export function buildExpectations(options: Pick<Options, "file" | "image">): Expectation[] {
  const rows: Expectation[] = [
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
      name: "index.php action=edit stays on classic",
      path: "/index.php?title=Foo&action=edit",
      via: "public",
      expectStatus: 200,
    },
    {
      name: "index.php oldid view redirects to WikiOS",
      path: "/index.php?title=Foo&oldid=1",
      via: "public",
      expectStatus: 301,
      expectLocation: "/wiki/Foo?oldid=1*",
    },
    {
      name: "Special:FilePath stays on MediaWiki",
      path: `/wiki/Special:FilePath/${options.file}`,
      via: "public",
      expectStatus: [200, 302],
      expectLocation: "/images/*",
    },
    {
      name: "public api.php (MediaWiki) still answers",
      path: "/api.php?action=query&meta=siteinfo&format=json",
      via: "public",
      expectStatus: 200,
      expectBodyIncludes: "sitename",
    },
    {
      name: "IxStates still reachable",
      path: "/projects/ixstats",
      via: "public",
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

export function parseArgs(argv: readonly string[]): Options {
  const base = stripTrailingSlashes(readFlag(argv, "--base") ?? DEFAULT_BASE);
  const internal = readFlag(argv, "--internal");
  const image = readFlag(argv, "--image");
  if (image !== null && !image.startsWith("/")) throw new Error("--image must be an absolute path");
  return {
    base,
    internal: internal === null ? null : stripTrailingSlashes(internal),
    file: readFlag(argv, "--file") ?? DEFAULT_FILE,
    image,
    standalone: argv.includes("--standalone"),
  };
}

/** Rows to run for these options, each with the origin it is fetched from (null = skipped). */
export function planChecks(
  options: Options
): { expectation: Expectation; origin: string | null }[] {
  return buildExpectations(options)
    .filter((expectation) => !options.standalone || expectation.standalone)
    .map((expectation) => ({
      expectation,
      origin: expectation.via === "internal" ? options.internal : options.base,
    }));
}

async function observe(url: string): Promise<Observation> {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "user-agent": USER_AGENT },
  });
  return {
    status: response.status,
    location: response.headers.get("location"),
    body: await response.text(),
  };
}

async function runCheck(expectation: Expectation, url: string): Promise<Evaluation> {
  try {
    return evaluateExpectation(expectation, await observe(url));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, failures: [`request failed: ${message}`] };
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const options = parseArgs(argv);
  console.log(`WikiOS takeover verification against ${options.base}`);
  if (!options.internal) console.log("(no --internal: render-engine rows are skipped)");
  if (!options.image) console.log("(no --image: the /images/ row is skipped)");

  let failed = 0;
  for (const { expectation, origin } of planChecks(options)) {
    if (origin === null) {
      console.log(`SKIP  ${expectation.name}`);
      continue;
    }
    const result = await runCheck(expectation, `${origin}${expectation.path}`);
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
