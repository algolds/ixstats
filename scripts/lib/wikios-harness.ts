/**
 * scripts/lib/wikios-harness.ts — shared helpers for the WikiOS measurement scripts
 * (scripts/bench/wikios-bench.ts, scripts/audit/wikios-render-parity.ts,
 * scripts/audit/wikios-roundtrip.ts).
 *
 * Deliberately free of app imports: only Node/Bun built-ins, `jsdom` and `zod`, so the scripts keep
 * working as the application changes.
 */

import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { JSDOM } from "jsdom";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Throttled fetch
// ---------------------------------------------------------------------------

/** Minimum spacing between two requests to the same host. One request per second is at most 60/min. */
const MIN_INTERVAL_MS = 1000;
const REQUEST_TIMEOUT_MS = 20_000;
const IXWIKI_USER_AGENT = "IxStats-Builder";

export interface FetchResult {
  url: string;
  /** HTTP status; 0 when the request failed before a response (timeout, DNS, refused). */
  status: number;
  /** Time until `fetch` resolved, i.e. the response headers arrived. */
  ttfbMs: number;
  /** Time until the body was fully read. */
  totalMs: number;
  /** Decoded body size in bytes. */
  bytes: number;
  body: string;
  headers: Record<string, string>;
  error?: string;
}

export interface ThrottleOptions {
  /** Spacing between same-host requests. Hosts under ixwiki.com never go below 1000 ms. */
  minIntervalMs?: number;
  timeoutMs?: number;
}

export function isIxwikiHost(hostname: string): boolean {
  return hostname === "ixwiki.com" || hostname.endsWith(".ixwiki.com");
}

const hostTail = new Map<string, Promise<void>>();
const hostLastEnd = new Map<string, number>();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `task` after every earlier task for `host`, and no sooner than `intervalMs` after the last one finished. */
function inHostQueue<T>(host: string, intervalMs: number, task: () => Promise<T>): Promise<T> {
  const previous = hostTail.get(host) ?? Promise.resolve();
  const run = previous.then(async () => {
    const wait = (hostLastEnd.get(host) ?? Number.NEGATIVE_INFINITY) + intervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      hostLastEnd.set(host, Date.now());
    }
  });
  hostTail.set(
    host,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

function failedResult(url: string, elapsedMs: number, error: unknown): FetchResult {
  return {
    url,
    status: 0,
    ttfbMs: elapsedMs,
    totalMs: elapsedMs,
    bytes: 0,
    body: "",
    headers: {},
    error: error instanceof Error ? error.message : String(error),
  };
}

async function timedFetch(
  url: string,
  init: RequestInit,
  userAgent: string | null,
  timeoutMs: number
): Promise<FetchResult> {
  const started = performance.now();
  try {
    const headers = new Headers(init.headers);
    if (userAgent !== null) headers.set("User-Agent", userAgent);
    const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
    const ttfbMs = performance.now() - started;
    const buffer = await response.arrayBuffer();
    const totalMs = performance.now() - started;
    return {
      url,
      status: response.status,
      ttfbMs,
      totalMs,
      bytes: buffer.byteLength,
      body: new TextDecoder().decode(buffer),
      headers: Object.fromEntries(response.headers),
    };
  } catch (error) {
    return failedResult(url, performance.now() - started, error);
  }
}

/**
 * `fetch` with a per-host queue (>= 1 s between the end of one request and the start of the next to the
 * same host), a 20 s timeout and the allowlisted `IxStats-Builder` User-Agent for ixwiki.com hosts.
 * Never throws: a failed request or an invalid URL resolves with `status: 0` and an `error` message.
 */
export async function throttledFetch(
  url: string,
  init: RequestInit = {},
  options: ThrottleOptions = {}
): Promise<FetchResult> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return failedResult(url, 0, `invalid URL: ${url}`);
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return failedResult(url, 0, `unsupported URL protocol: ${target.protocol}`);
  }
  const ixwiki = isIxwikiHost(target.hostname);
  const requested = options.minIntervalMs ?? MIN_INTERVAL_MS;
  const intervalMs = ixwiki ? Math.max(requested, MIN_INTERVAL_MS) : requested;
  return inHostQueue(target.host, intervalMs, () =>
    timedFetch(url, init, ixwiki ? IXWIKI_USER_AGENT : null, options.timeoutMs ?? REQUEST_TIMEOUT_MS)
  );
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Nearest-rank percentile (`p` in 0..100). NaN for an empty list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((x, y) => x - y);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p * sorted.length) / 100)));
  return sorted[rank - 1];
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// ---------------------------------------------------------------------------
// HTML normalisation and similarity
// ---------------------------------------------------------------------------

export interface NormalizedDoc {
  /** Whitespace-collapsed text content. */
  text: string;
  headings: string[];
  /** Link targets reduced to a canonical page title (unique, document order). */
  links: string[];
  /** Image file names (unique, document order). */
  images: string[];
  tables: number;
  /** True when any element's original class contained "infobox". */
  infobox: boolean;
  refs: number;
}

/** Chrome that is not article content: code, MediaWiki section-edit links and the legacy in-page TOC. */
const NON_CONTENT_SELECTOR = "script, style, noscript, template, .mw-editsection, #toc, .toc, .mw-toc";
const FILE_NAMESPACE = /^(?:file|image|media):/i;
const PIXEL_PREFIX = /^\d+px-/;

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toCanonicalTitle(raw: string): string {
  return collapse(safeDecode(raw).replace(/_/g, " "));
}

const WIKI_PATH = /(?:^|\/)wiki\/(.+)$/;

/**
 * The page title a link points at: the `title=` query of `index.php` links, else everything after
 * `/wiki/` (so subpages keep their path), else the last path segment.
 */
export function canonicalLinkTitle(href: string): string | null {
  if (href.startsWith("#") || /^(?:javascript|mailto|tel|data):/i.test(href)) return null;
  let url: URL;
  try {
    url = new URL(href, "http://wiki.invalid/");
  } catch {
    return null;
  }
  const fromQuery = url.searchParams.get("title");
  const fromWikiPath = WIKI_PATH.exec(url.pathname)?.[1];
  const segment = url.pathname.split("/").filter(Boolean).pop();
  const raw = fromQuery ?? fromWikiPath ?? segment ?? (url.hostname === "wiki.invalid" ? "" : url.hostname);
  const title = toCanonicalTitle(raw.replace(/\/+$/, ""));
  return title === "" ? null : title;
}

/** The file name behind an image `src`: thumbnail path or size prefix stripped. */
export function imageFileName(src: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(src, "http://wiki.invalid/").pathname;
  } catch {
    return null;
  }
  const segments = pathname.split("/").filter(Boolean);
  const isThumb = segments.includes("thumb") && segments.length >= 2;
  const raw = isThumb ? segments[segments.length - 2] : (segments.pop() ?? "").replace(PIXEL_PREFIX, "");
  const name = toCanonicalTitle(raw);
  return name === "" ? null : name;
}

function uniquePush(target: string[], seen: Set<string>, value: string | null): void {
  if (value === null || seen.has(value)) return;
  seen.add(value);
  target.push(value);
}

function collectLinks(root: ParentNode): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  for (const anchor of root.querySelectorAll("a[href]")) {
    const title = canonicalLinkTitle(anchor.getAttribute("href") ?? "");
    // File pages are represented by the `images` field.
    uniquePush(links, seen, title !== null && FILE_NAMESPACE.test(title) ? null : title);
  }
  return links;
}

function collectImages(root: ParentNode): string[] {
  const images: string[] = [];
  const seen = new Set<string>();
  for (const img of root.querySelectorAll("img[src]")) {
    uniquePush(images, seen, imageFileName(img.getAttribute("src") ?? ""));
  }
  return images;
}

function hasInfoboxClass(root: ParentNode): boolean {
  for (const element of root.querySelectorAll("[class]")) {
    if ((element.getAttribute("class") ?? "").toLowerCase().includes("infobox")) return true;
  }
  return false;
}

/**
 * Elements a reader sees as their own line or cell. WikiOS stores its render without the whitespace between them
 * (`slim-html.ts` drops it: no reader can see it), and MediaWiki's has a line feed there, so the text is read with a
 * break at each one, as `innerText` would, and "Name</th><td>Elfin" is two words on both sides.
 */
const TEXT_BREAK_SELECTOR =
  "address, article, aside, blockquote, br, caption, dd, details, div, dl, dt, figcaption, figure, footer, h1, h2, " +
  "h3, h4, h5, h6, header, hr, li, nav, ol, p, pre, section, summary, table, tbody, td, tfoot, th, thead, tr, ul";

/** The visible words of `body`, with a break at each line or cell; the inline spaces are the page's own. */
function blockText(body: HTMLElement): string {
  for (const element of body.querySelectorAll(TEXT_BREAK_SELECTOR)) {
    element.after(" ");
    element.before(" ");
  }
  return collapse(body.textContent ?? "");
}

/**
 * Reduces rendered article HTML to the parts that must survive a change of renderer. Scripts, styles,
 * section-edit links and the TOC are dropped; comments never reach `textContent`; class/id/style/data-*
 * attributes are only read (infobox detection) and never compared. The text is read last: it adds breaks.
 */
export function normalizeHtml(html: string): NormalizedDoc {
  const dom = new JSDOM(html);
  try {
    const { body } = dom.window.document;
    const infobox = hasInfoboxClass(body);
    for (const element of body.querySelectorAll(NON_CONTENT_SELECTOR)) element.remove();
    const doc = {
      headings: [...body.querySelectorAll("h1, h2, h3, h4, h5, h6")]
        .map((heading) => collapse(heading.textContent ?? ""))
        .filter(Boolean),
      links: collectLinks(body),
      images: collectImages(body),
      tables: body.querySelectorAll("table").length,
      infobox,
      refs: body.querySelectorAll("sup.reference, .mw-ref").length,
    };
    return { text: blockText(body), ...doc };
  } finally {
    dom.window.close();
  }
}

export interface AssetRefs {
  /** Absolute URLs of `<script src>`. */
  scripts: string[];
  /** Absolute URLs of `<link rel=stylesheet>`. */
  stylesheets: string[];
  images: number;
}

function resolveUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
}

/** The script, stylesheet and image references of a page, for the page-weight metrics. */
export function extractAssetRefs(html: string, pageUrl: string): AssetRefs {
  const dom = new JSDOM(html);
  try {
    const { document } = dom.window;
    const resolved = (selector: string, attribute: string): string[] =>
      [...document.querySelectorAll(selector)]
        .map((element) => resolveUrl(element.getAttribute(attribute), pageUrl))
        .filter((url): url is string => url !== null);
    return {
      scripts: resolved("script[src]", "src"),
      stylesheets: resolved("link[rel~='stylesheet'][href]", "href"),
      images: document.querySelectorAll("img").length,
    };
  } finally {
    dom.window.close();
  }
}

const WORD = /[\p{L}\p{N}]+/gu;

function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(WORD) ?? []) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

/** Jaccard over word multisets: sum of min counts over sum of max counts. Two empty texts are identical. */
function wordJaccard(a: string, b: string): number {
  const countsA = countWords(a);
  const countsB = countWords(b);
  let shared = 0;
  let total = 0;
  for (const [word, n] of countsA) {
    const m = countsB.get(word) ?? 0;
    shared += Math.min(n, m);
    total += Math.max(n, m);
  }
  for (const [word, m] of countsB) {
    if (!countsA.has(word)) total += m;
  }
  return total === 0 ? 1 : shared / total;
}

function setJaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;
  for (const item of setA) if (setB.has(item)) shared += 1;
  const total = setA.size + setB.size - shared;
  return total === 0 ? 1 : shared / total;
}

/** Table-count and infobox agreement, 0..1. */
function structureScore(a: NormalizedDoc, b: NormalizedDoc): number {
  const tableRatio = a.tables === b.tables ? 1 : Math.min(a.tables, b.tables) / Math.max(a.tables, b.tables);
  const infoboxMatch = a.infobox === b.infobox ? 1 : 0;
  return (tableRatio + infoboxMatch) / 2;
}

export interface SimilarityScores {
  /** Field scores are 0..100, or null when the field is empty on both sides and so is not compared. */
  text: number | null;
  links: number | null;
  images: number | null;
  headings: number | null;
  structure: number | null;
  /** Weighted mean over the fields that are not null, with the weights re-normalised; 100 when none is. */
  overall: number;
}

/** Weights of the overall score, in percent. */
const WEIGHTS = { text: 50, links: 20, images: 15, headings: 10, structure: 5 } as const;

const emptyBothSides = (a: { length: number }, b: { length: number }): boolean => a.length === 0 && b.length === 0;

/**
 * Per-field similarity (0..100) and the weighted overall score: text 50, links 20, images 15, headings 10,
 * tables+infobox 5. A field that is empty on both sides says nothing about fidelity, so it is excluded
 * (null) and the remaining weights are re-normalised rather than scoring it 100.
 */
export function similarity(a: NormalizedDoc, b: NormalizedDoc): SimilarityScores {
  const noStructure = a.tables === 0 && b.tables === 0 && !a.infobox && !b.infobox;
  const scores = {
    text: emptyBothSides(a.text, b.text) ? null : wordJaccard(a.text, b.text) * 100,
    links: emptyBothSides(a.links, b.links) ? null : setJaccard(a.links, b.links) * 100,
    images: emptyBothSides(a.images, b.images) ? null : setJaccard(a.images, b.images) * 100,
    headings: emptyBothSides(a.headings, b.headings) ? null : setJaccard(a.headings, b.headings) * 100,
    structure: noStructure ? null : structureScore(a, b) * 100,
  };
  let weighted = 0;
  let totalWeight = 0;
  for (const field of Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>) {
    const score = scores[field];
    if (score === null) continue;
    weighted += score * WEIGHTS[field];
    totalWeight += WEIGHTS[field];
  }
  return { ...scores, overall: totalWeight === 0 ? 100 : weighted / totalWeight };
}

/** The first `limit` items of `from` that `other` lacks. */
export function missingFrom(from: readonly string[], other: readonly string[], limit: number): string[] {
  const present = new Set(other);
  return from.filter((item) => !present.has(item)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Page lists, URLs and tRPC envelopes
// ---------------------------------------------------------------------------

const pageListSchema = z.array(z.string().min(1)).min(1);

export function parsePageList(json: string): string[] {
  return pageListSchema.parse(JSON.parse(json));
}

export function loadPageList(path: string): string[] {
  return parsePageList(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// Parity by revision
// ---------------------------------------------------------------------------

/** A revisions file: `{ "<title>": <MediaWiki rev id WikiOS holds> }` (the proof CLI writes it from Postgres). */
const revisionMapSchema = z.record(z.string(), z.number().int().positive());

export function parseRevisionMap(json: string): Map<string, number> {
  return new Map(Object.entries(revisionMapSchema.parse(JSON.parse(json))));
}

/**
 * The `action=parse` query for MediaWiki's side of a page: the revision WikiOS holds (`oldid`) when it is known, so
 * an edit on classic since WikiOS's copy is not scored as a render difference; else the current page, with redirects
 * followed as WikiOS does.
 */
export function mediaWikiParseQuery(title: string, revid: number | undefined): Record<string, string> {
  const target: Record<string, string> =
    revid === undefined ? { page: title, redirects: "1" } : { oldid: String(revid) };
  return {
    action: "parse",
    ...target,
    prop: "text|categories|templates|images|displaytitle",
    formatversion: "2",
    format: "json",
    disableeditsection: "1",
  };
}

/** Errors that mean MediaWiki no longer has the revision WikiOS holds to show: deleted, or its text hidden. */
const REVISION_GONE_CODES: ReadonlySet<string> = new Set(["nosuchrevid", "missingtitle", "permissiondenied"]);

/**
 * The report's error for a failed parse. A revision MediaWiki refuses is corpus drift, so it carries the
 * `nosuchrevid` code the proof gate counts as drift, never as a parity failure.
 */
export function mediaWikiParseError(code: string, info: string, revid: number | undefined): string {
  if (revid !== undefined && REVISION_GONE_CODES.has(code)) {
    return `MediaWiki: nosuchrevid: revision ${revid} is gone or hidden (${code}: ${info})`;
  }
  return `MediaWiki: ${code}: ${info}`;
}

const revisionModelsSchema = z.object({
  query: z
    .object({
      pages: z
        .array(
          z.object({
            revisions: z
              .array(
                z.object({
                  revid: z.number(),
                  slots: z.object({ main: z.object({ contentmodel: z.string() }) }).optional(),
                  contentmodel: z.string().optional(),
                })
              )
              .default([]),
          })
        )
        .default([]),
    })
    .default({ pages: [] }),
});

/**
 * The content model of each revision in an `action=query&prop=revisions&revids=…&rvprop=ids|contentmodel&rvslots=main`
 * answer, by rev id. A revision the answer leaves out (deleted, hidden) is not in the map.
 */
export function revisionContentModels(json: string): Map<number, string> {
  const models = new Map<number, string>();
  for (const page of revisionModelsSchema.parse(JSON.parse(json)).query.pages) {
    for (const revision of page.revisions) {
      const model = revision.slots?.main.contentmodel ?? revision.contentmodel;
      if (model) models.set(revision.revid, model);
    }
  }
  return models;
}

/** `items` in slices of `size` (the API takes at most 50 rev ids a request). */
export function chunked<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/** `count` titles spread evenly over the list (all of it when `count` is not smaller than the list). */
export function samplePages(titles: readonly string[], count: number): string[] {
  if (count >= titles.length) return [...titles];
  return Array.from({ length: count }, (_, i) => titles[Math.floor((i * titles.length) / count)]);
}

/** A page title as a `/wiki/<title>` path segment: underscores for spaces, `:` and `/` left readable. */
export function encodeWikiTitle(title: string): string {
  return encodeURIComponent(title.trim().replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2F/g, "/");
}

export function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

/** A command-line URL option: must be an absolute http(s) URL. Returns it without trailing slashes. */
export function parseHttpUrl(value: string | undefined, flag: string): string {
  if (value === undefined || value === "") throw new Error(`${flag} is required`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${flag} must be an absolute http(s) URL, got "${value}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${flag} must be an http(s) URL, got "${value}"`);
  }
  return stripTrailingSlashes(url.href);
}

/** Last-resort handler for a script's `main()`: print the message (no stack, no secrets) and exit 1. */
export function exitWithError(error: Error | string): never {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

/** Creates the parent directory of `file` so default outputs under `.bench-out/` can be written. */
export function ensureParentDir(file: string): void {
  mkdirSync(dirname(file), { recursive: true });
}

/** A non-batched tRPC query over HTTP: `GET <base>/api/trpc/<procedure>?input={"json":<input>}` (superjson). */
export function trpcQueryUrl(base: string, procedure: string, input: Record<string, string | number>): string {
  return `${stripTrailingSlashes(base)}/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; error: string };

const trpcErrorSchema = z.object({
  error: z.object({ json: z.object({ message: z.string() }) }),
});

/** Reads `{"result":{"data":{"json":<output>}}}` (or the error envelope) from a tRPC response body. */
export function parseTrpcData<T>(body: string, output: z.ZodType<T>): Parsed<T> {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return { ok: false, error: "response is not JSON" };
  }
  const failure = trpcErrorSchema.safeParse(payload);
  if (failure.success) return { ok: false, error: failure.data.error.json.message };
  const envelope = z.object({ result: z.object({ data: z.object({ json: output }) }) }).safeParse(payload);
  if (!envelope.success) return { ok: false, error: "unexpected tRPC response shape" };
  return { ok: true, data: envelope.data.result.data.json };
}

/**
 * Port 15433 on this machine is the SSH `LocalForward` to production Postgres (scripts/dev-local.sh opens it),
 * so a localhost URL on that port is production, not a local database.
 */
const PRODUCTION_TUNNEL_PORT = "15433";

/**
 * True when a `DATABASE_URL` points at a database on this machine, the only kind the harness may read. A
 * localhost URL on port 15433 is false: that port is the SSH `LocalForward` to production Postgres.
 */
export function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const { hostname, port } = new URL(databaseUrl);
    const localHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    return localHost && port !== PRODUCTION_TUNNEL_PORT;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Round-trip namespaces and parity settling
// ---------------------------------------------------------------------------

const NAMESPACE_LIST = /^\d+(?:,\d+)*$/;

/**
 * The round trip's `--namespaces` option: `undefined` is `[0]` (articles only), `"all"` is every namespace,
 * and a comma list such as `"0,10,14"` is those namespace numbers.
 */
export function parseNamespaces(value: string | undefined): number[] | "all" {
  if (value === undefined) return [0];
  if (value === "all") return "all";
  if (!NAMESPACE_LIST.test(value)) throw new Error("--namespaces must be all or a comma list of namespace numbers");
  return value.split(",").map(Number);
}

/** The render state `wikios.getArticleHtml` reports with a view. */
export interface SettleView {
  renderQuality?: string;
  stale?: boolean;
}

/**
 * True when a WikiOS view is not yet MediaWiki's render: a locally compiled fallback (the reader stopped
 * waiting for the renderer) or a stale bundle served while a background render replaces it.
 */
export function needsSettling(view: SettleView): boolean {
  return view.renderQuality === "fallback" || view.stale === true;
}

export interface SettleOptions {
  /** Wait before each refetch. */
  settleMs: number;
  /** Refetches after the first fetch, at most. */
  settleTries: number;
  /** Injected for tests; defaults to a real timer. */
  wait?: (ms: number) => Promise<void>;
}

/**
 * Fetches a view, then refetches it while it `needsSettling`, waiting `settleMs` before each of at most
 * `settleTries` refetches. Returns the last result: a failure as soon as one happens, else the last view, which
 * the caller records as unsettled when it still `needsSettling`.
 */
export async function fetchUntilSettled<T extends SettleView>(
  fetchOnce: () => Promise<Parsed<T>>,
  options: SettleOptions
): Promise<Parsed<T>> {
  const wait = options.wait ?? sleep;
  let result = await fetchOnce();
  for (let tries = 0; tries < options.settleTries && result.ok && needsSettling(result.data); tries += 1) {
    await wait(options.settleMs);
    result = await fetchOnce();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Line diff and construct classification (round-trip report)
// ---------------------------------------------------------------------------

export interface DiffLine {
  kind: "-" | "+";
  /** 1-based line number in the input (`-`) or output (`+`). */
  lineNo: number;
  line: string;
}

/** Above this many LCS cells the middle of the diff is reported as wholly replaced. */
const MAX_LCS_CELLS = 4_000_000;

function replaceWhole(a: readonly string[], b: readonly string[], aOffset: number, bOffset: number): DiffLine[] {
  return [
    ...a.map((line, i): DiffLine => ({ kind: "-", lineNo: aOffset + i + 1, line })),
    ...b.map((line, i): DiffLine => ({ kind: "+", lineNo: bOffset + i + 1, line })),
  ];
}

/** Lengths of the longest common subsequences of every suffix pair, row-major `(n + 1) x (m + 1)`. */
function lcsTable(a: readonly string[], b: readonly string[]): Uint32Array {
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  return table;
}

function walkLcs(a: readonly string[], b: readonly string[], aOffset: number, bOffset: number): DiffLine[] {
  const width = b.length + 1;
  const table = lcsTable(a, b);
  const changes: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (j >= b.length || (i < a.length && table[(i + 1) * width + j] >= table[i * width + j + 1])) {
      changes.push({ kind: "-", lineNo: aOffset + i + 1, line: a[i] });
      i += 1;
    } else {
      changes.push({ kind: "+", lineNo: bOffset + j + 1, line: b[j] });
      j += 1;
    }
  }
  return changes;
}

export interface LineDiffResult {
  changes: DiffLine[];
  /** True when the middle of the diff exceeded the LCS cap and was reported as wholly replaced. */
  truncated: boolean;
}

/** The changed lines between two texts, in order: common head and tail trimmed, then a longest-common-subsequence diff. */
export function lineDiff(input: string, output: string): LineDiffResult {
  const a = input.split("\n");
  const b = output.split("\n");
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) {
    tail += 1;
  }
  const middleA = a.slice(head, a.length - tail);
  const middleB = b.slice(head, b.length - tail);
  if (middleA.length * middleB.length > MAX_LCS_CELLS) {
    return { changes: replaceWhole(middleA, middleB, head, head), truncated: true };
  }
  return { changes: walkLcs(middleA, middleB, head, head), truncated: false };
}

export const CONSTRUCTS = [
  "template",
  "file",
  "link",
  "table",
  "list",
  "heading",
  "bold-italic",
  "ref",
  "html",
  "blank",
  "other",
] as const;

export type Construct = (typeof CONSTRUCTS)[number];

/**
 * First match wins. Line-leading markers decide before inline ones: `|name = value` is a template
 * parameter, `{|`/`|-`/`|}`/`|+` and cells with attributes are table syntax.
 */
const CONSTRUCT_RULES: ReadonlyArray<readonly [Construct, RegExp]> = [
  ["blank", /^\s*$/],
  ["table", /^\s*(?:\{\||\|\}|\|-|\|\+)/],
  ["template", /^\s*\|\s*[^=|"'\s][^=|"']*=(?!["'])/],
  ["table", /^\s*[|!]/],
  ["list", /^\s*[*#:;]/],
  ["heading", /^\s*(={1,6}).*\1\s*$/],
  ["file", /\[\[\s*(?:file|image|media)\s*:/i],
  ["template", /\{\{|\}\}/],
  ["link", /\[\[/],
  ["ref", /<ref\b/i],
  ["bold-italic", /''/],
  ["html", /<\/?[a-z][^>]*>/i],
];

export function classifyLine(line: string): Construct {
  for (const [construct, pattern] of CONSTRUCT_RULES) {
    if (pattern.test(line)) return construct;
  }
  return "other";
}
