/**
 * fetch-dump.ts — build an export-0.11 dump from a live MediaWiki through its Action API, read-only.
 *
 * Every request is a throttled GET (at least `delayMs` apart, one second by default) sent with the
 * allowlisted `User-Agent: IxStats-Builder`. The wiki's pages are listed per namespace with
 * `list=allpages` (redirects included); then either
 *   - current revisions: `export=1&exportnowrap=1` in batches of 50 titles (MediaWiki writes the
 *     XML itself; it is read back and re-written so the output is one document), or
 *   - full history (`history: true`): `prop=revisions` per page with continuation, oldest first.
 * Everything goes out through `createExportWriter`, so the file is the same format WikiOS imports.
 */

import { z } from "zod/v4";
import { isBlank, skipBlanks } from "../wikitext/blank";
import { createExportWriter, type ExportSink, type ExportWriter } from "./export-writer";
import { chunksOfStream, readExport } from "./import-reader";
import { sha1HexToBase36 } from "./sha1";
import type { Contributor, SiteInfo, XmlRevision } from "./types";

export interface FetchDumpOptions {
  /** The wiki's `api.php` URL (http or https). */
  api: string;
  /** Receives the dump, a piece at a time. */
  write: ExportSink;
  /** Every revision of every page instead of the current one. */
  history: boolean;
  /** Namespace ids to dump, or every content namespace the wiki has. */
  namespaces: number[] | "all";
  /** Minimum milliseconds between requests (default 1000). */
  delayMs?: number;
  /** For tests: the `fetch` to use, a clock and a sleep. */
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (message: string) => void;
}

const USER_AGENT = "IxStats-Builder";
const TITLE_BATCH = 50;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 2000;

const continuation = z.record(z.string(), z.string()).optional();

const siteInfoResponse = z.object({
  query: z.object({
    general: z.object({
      sitename: z.string(),
      wikiid: z.string().default(""),
      base: z.string(),
      generator: z.string(),
      case: z.string().default("first-letter"),
    }),
    namespaces: z.record(
      z.string(),
      z.object({ id: z.number(), case: z.string().default("first-letter"), name: z.string() })
    ),
  }),
});

const allPagesResponse = z.object({
  continue: continuation,
  query: z.object({
    allpages: z.array(z.object({ pageid: z.number(), ns: z.number(), title: z.string() })),
  }),
});

const apiRevision = z.object({
  revid: z.number(),
  parentid: z.number().default(0),
  minor: z.boolean().default(false),
  user: z.string().optional(),
  userid: z.number().optional(),
  anon: z.boolean().optional(),
  userhidden: z.boolean().optional(),
  timestamp: z.string(),
  size: z.number().default(0),
  sha1: z.string().optional(),
  comment: z.string().optional(),
  commenthidden: z.boolean().optional(),
  slots: z
    .object({
      main: z.object({
        contentmodel: z.string().optional(),
        contentformat: z.string().optional(),
        content: z.string().optional(),
        texthidden: z.boolean().optional(),
      }),
    })
    .optional(),
});
type ApiRevision = z.infer<typeof apiRevision>;

const revisionsResponse = z.object({
  continue: continuation,
  query: z
    .object({
      pages: z.array(
        z.object({
          title: z.string(),
          missing: z.boolean().optional(),
          revisions: z.array(apiRevision).optional(),
        })
      ),
    })
    .optional(),
});

function contributorOf(revision: ApiRevision): Contributor {
  if (revision.userhidden || revision.user === undefined) return { deleted: true };
  if (revision.anon) return { ip: revision.user };
  return { username: revision.user, id: revision.userid || null };
}

/** One revision from `prop=revisions` (formatversion 2) as a dump revision. */
export function apiRevisionToXml(revision: ApiRevision): XmlRevision {
  const main = revision.slots?.main;
  const text = main && !main.texthidden ? (main.content ?? null) : null;
  return {
    id: revision.revid,
    parentId: revision.parentid || null,
    timestamp: revision.timestamp,
    contributor: contributorOf(revision),
    minor: revision.minor,
    comment: revision.commenthidden ? null : (revision.comment ?? null),
    commentDeleted: revision.commenthidden === true,
    model: main?.contentmodel ?? "wikitext",
    format: main?.contentformat ?? "text/x-wiki",
    text,
    textDeleted: main?.texthidden === true,
    bytes: revision.size,
    sha1: revision.sha1 ? sha1HexToBase36(revision.sha1) : null,
  };
}

const REDIRECT_WORD = "#redirect";

/** Whether `[[…]]` closes at `at`, the first `#`, `|` or `]` of its target: `#Section`, `|label`, then `]]`. */
function closesRedirectLink(text: string, at: number): boolean {
  let end = at;
  if (text.charCodeAt(end) === 35) {
    end++;
    while (end < text.length && text.charCodeAt(end) !== 93 && text.charCodeAt(end) !== 124) end++;
  }
  if (text.charCodeAt(end) === 124) {
    end++;
    while (end < text.length && text.charCodeAt(end) !== 93) end++;
  }
  return text.startsWith("]]", end);
}

/**
 * The target of `#REDIRECT [[Target#Section|label]]` wikitext, or null when it is not a redirect. It answers what
 * `/^\s*#REDIRECT\s*:?\s*\[\[\s*:?([^\]|#]+?)\s*(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/i` captured (trimmed), in one
 * scan: the target ends at the first `]`, `|` or `#`, less the blanks before it, and the rest of the link must
 * close from there. (A target of nothing but a `:` or a blank is what the expression gave back to itself.)
 */
export function redirectTargetOf(wikitext: string): string | null {
  let at = skipBlanks(wikitext, 0);
  for (let i = 0; i < REDIRECT_WORD.length; i++, at++) {
    const code = wikitext.charCodeAt(at);
    if ((code >= 65 && code <= 90 ? code + 32 : code) !== REDIRECT_WORD.charCodeAt(i)) return null;
  }
  at = skipBlanks(wikitext, at);
  if (wikitext.charCodeAt(at) === 58) at++;
  at = skipBlanks(wikitext, at);
  if (!wikitext.startsWith("[[", at)) return null;

  const open = at + 2;
  let end = open;
  while (end < wikitext.length && !"]|#".includes(wikitext.charAt(end))) end++;
  if (!closesRedirectLink(wikitext, end)) return null;

  const afterBlanks = skipBlanks(wikitext, open);
  const colon = wikitext.charCodeAt(afterBlanks) === 58;
  const start = colon ? afterBlanks + 1 : afterBlanks;
  if (start < end) {
    let nameEnd = end;
    while (nameEnd > 0 && isBlank(wikitext.charCodeAt(nameEnd - 1))) nameEnd--;
    return wikitext.slice(start, Math.max(start + 1, nameEnd)).trim();
  }
  // The target would be empty: the expression gives back the colon, or else the last blank.
  if (colon) return ":";
  return afterBlanks > open ? "" : null;
}

const chunked = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );

/** A response that is not a success: retried when the wiki is overloaded or failing. */
class HttpError extends Error {
  constructor(
    readonly status: number,
    /** Milliseconds the wiki asked us to wait (`Retry-After`), or 0. */
    readonly retryAfterMs: number
  ) {
    super(`MediaWiki returned HTTP ${status}`);
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

/** The wait before retry number `attempt` (1-based): the wiki's own request, else doubling from 2 s. */
const backoffMs = (attempt: number, requestedMs: number): number =>
  requestedMs > 0 ? requestedMs : RETRY_BASE_MS * 2 ** (attempt - 1);

/** How long to wait before trying again after `failure`, or null when it is final. */
function retryDelay(failure: Error, attempt: number): number | null {
  if (attempt >= MAX_ATTEMPTS) return null;
  if (!(failure instanceof HttpError)) return backoffMs(attempt, 0); // dropped connection, timeout
  return failure.retryable ? backoffMs(attempt, failure.retryAfterMs) : null;
}

/** A client that paces, retries and parses: every request the dump makes goes through it. */
function createClient(options: FetchDumpOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delayMs = options.delayMs ?? 1000;
  const endpoint = new URL(options.api);
  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    throw new Error(`Not an http(s) URL: ${options.api}`);
  }
  let lastRequestAt = Number.NEGATIVE_INFINITY;

  /** Wait until `delayMs` has passed since the previous request. */
  async function pace(): Promise<void> {
    const wait = lastRequestAt + delayMs - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
  }

  async function get(params: Record<string, string>): Promise<Response> {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    for (let attempt = 1; ; attempt++) {
      await pace();
      try {
        const res = await fetchImpl(url, {
          method: "GET",
          headers: { "User-Agent": USER_AGENT, Accept: "application/json, application/xml" },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.ok) return res;
        throw new HttpError(res.status, Number(res.headers.get("retry-after")) * 1000 || 0);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error("Request failed");
        const delay = retryDelay(failure, attempt);
        if (delay === null) throw failure;
        await sleep(delay);
      }
    }
  }

  async function json<T>(schema: z.ZodType<T>, params: Record<string, string>): Promise<T> {
    const body: unknown = await (
      await get({ ...params, format: "json", formatversion: "2" })
    ).json();
    return schema.parse(body);
  }

  return {
    async siteInfo(): Promise<SiteInfo> {
      const { query } = await json(siteInfoResponse, {
        action: "query",
        meta: "siteinfo",
        siprop: "general|namespaces",
      });
      return {
        sitename: query.general.sitename,
        dbname: query.general.wikiid,
        base: query.general.base,
        generator: query.general.generator,
        case: query.general.case,
        namespaces: Object.values(query.namespaces)
          .map((ns) => ({ key: ns.id, case: ns.case, name: ns.name }))
          .sort((a, b) => a.key - b.key),
      };
    },

    /** Every page of a namespace (`filter` "redirects": only the redirects), following continuation. */
    async allPages(namespace: number, filter: "all" | "redirects") {
      const pages: Array<{ pageid: number; ns: number; title: string }> = [];
      let next: Record<string, string> = {};
      do {
        const response = await json(allPagesResponse, {
          action: "query",
          list: "allpages",
          apnamespace: String(namespace),
          apfilterredir: filter,
          aplimit: "max",
          ...next,
        });
        pages.push(...response.query.allpages);
        next = response.continue ?? {};
      } while (Object.keys(next).length > 0);
      return pages;
    },

    /** MediaWiki's own export of up to 50 titles' current revisions, as a byte stream. */
    async exportStream(titles: string[]): Promise<ReadableStream<Uint8Array>> {
      const res = await get({
        action: "query",
        titles: titles.join("|"),
        export: "1",
        exportnowrap: "1",
      });
      if (!res.body) throw new Error("MediaWiki returned an empty export");
      return res.body;
    },

    /** The redirect target of each listed redirect page, from its current wikitext. */
    async redirectTargets(titles: string[]): Promise<Map<string, string>> {
      const targets = new Map<string, string>();
      for (const batch of chunked(titles, TITLE_BATCH)) {
        const response = await json(revisionsResponse, {
          action: "query",
          prop: "revisions",
          rvprop: "ids|timestamp|content",
          rvslots: "main",
          titles: batch.join("|"),
        });
        for (const page of response.query?.pages ?? []) {
          const target = redirectTargetOf(page.revisions?.[0]?.slots?.main.content ?? "");
          if (target) targets.set(page.title, target);
        }
      }
      return targets;
    },

    /** Every revision of one page, oldest first, fetched lazily with continuation. */
    async *revisionsOf(title: string): AsyncGenerator<XmlRevision> {
      let next: Record<string, string> = {};
      do {
        const response = await json(revisionsResponse, {
          action: "query",
          prop: "revisions",
          rvprop: "ids|timestamp|user|userid|comment|size|sha1|content|flags",
          rvslots: "main",
          rvlimit: "max",
          rvdir: "newer",
          titles: title,
          ...next,
        });
        for (const revision of response.query?.pages[0]?.revisions ?? []) {
          yield apiRevisionToXml(revision);
        }
        next = response.continue ?? {};
      } while (Object.keys(next).length > 0);
    },
  };
}

type Client = ReturnType<typeof createClient>;
type ListedPage = { pageid: number; ns: number; title: string };

/** Full history: each page with every revision, fetched lazily as the writer consumes them. */
async function writeHistories(
  writer: ExportWriter,
  client: Client,
  listed: ListedPage[],
  redirects: Map<string, string>
): Promise<number> {
  for (const page of listed) {
    await writer.page({
      title: page.title,
      ns: page.ns,
      pageId: page.pageid,
      redirectTitle: redirects.get(page.title) ?? null,
      revisions: client.revisionsOf(page.title),
    });
  }
  return listed.length;
}

/** Current revisions: MediaWiki's own export of 50 titles at a time, read back and re-written. */
async function writeCurrent(
  writer: ExportWriter,
  client: Client,
  listed: ListedPage[],
  namespace: number
): Promise<number> {
  let written = 0;
  for (const batch of chunked(listed, TITLE_BATCH)) {
    const stream = await client.exportStream(batch.map((page) => page.title));
    for await (const event of readExport(chunksOfStream(stream))) {
      if (event.type !== "page") continue;
      const { page } = event;
      await writer.page({
        title: page.title,
        ns: page.ns ?? namespace,
        pageId: page.id,
        redirectTitle: page.redirectTitle,
        revisions: page.revisions,
      });
      written += 1;
    }
  }
  return written;
}

/**
 * Write a dump of the wiki at `options.api` through `options.write`; resolves to the number of
 * pages written. Rejects on the first request that cannot be completed (after retries).
 */
export async function fetchDump(options: FetchDumpOptions): Promise<number> {
  const client = createClient(options);
  const siteinfo = await client.siteInfo();
  const namespaces =
    options.namespaces === "all"
      ? siteinfo.namespaces.map((ns) => ns.key).filter((key) => key >= 0)
      : options.namespaces;
  const writer = createExportWriter(options.write, siteinfo);
  await writer.start();

  let written = 0;
  for (const namespace of namespaces) {
    const listed = await client.allPages(namespace, "all");
    options.onProgress?.(`namespace ${namespace}: ${listed.length} pages`);
    if (options.history) {
      const redirectPages = await client.allPages(namespace, "redirects");
      const redirects = await client.redirectTargets(redirectPages.map((page) => page.title));
      written += await writeHistories(writer, client, listed, redirects);
    } else {
      written += await writeCurrent(writer, client, listed, namespace);
    }
    options.onProgress?.(`namespace ${namespace} done (${written} pages so far)`);
  }

  await writer.end();
  return written;
}
