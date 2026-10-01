/**
 * inbound-mediawiki.ts — the MediaWiki Action API reads of the inbound sync.
 *
 * Every response is parsed against a schema: a shape MediaWiki should never send is an error the
 * sync counts and retries, not a field read off an `any`. Reads only; the one write path to
 * MediaWiki is the export mirror.
 */

import { z } from "zod";
import { DEFAULT_USER_AGENT } from "../config";
import { mwSha1Base36, sha1HexToBase36 } from "../xml/sha1";

const MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php`;
const REQUEST_TIMEOUT_MS = 12_000;

/** Postgres text cannot hold a NUL. */
export function sanitize(str: string | null | undefined): string {
  return str ? str.replace(/\0/g, "") : "";
}

/** A title as the API reports it: spaces, no NUL, trimmed. */
export function plainTitle(raw: string): string {
  return sanitize(raw.replace(/_/g, " ")).trim();
}

export type JsonValue = z.infer<ReturnType<typeof z.json>>;

const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), info: z.string().optional() }),
});

/** One GET of api.php (`format=json&formatversion=2`), parsed by `schema`. Throws on HTTP, API or shape errors. */
export async function mediaWikiGet<T>(
  params: Record<string, string>,
  schema: z.ZodType<T>
): Promise<T> {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries({ format: "json", formatversion: "2", ...params })) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`MediaWiki returned HTTP ${res.status}`);

  const body = await res.json();
  const apiError = apiErrorSchema.safeParse(body);
  if (apiError.success) {
    throw new Error(`MediaWiki API error ${apiError.data.error.code}: ${apiError.data.error.info ?? ""}`);
  }
  return schema.parse(body);
}

// ---------------------------------------------------------------------------
// Revisions
// ---------------------------------------------------------------------------

const REVISION_PROPS = "ids|timestamp|user|comment|size|sha1|content|flags";

const revisionSchema = z.looseObject({
  revid: z.number(),
  parentid: z.number().optional(),
  timestamp: z.string().optional(),
  user: z.string().optional(),
  comment: z.string().optional(),
  minor: z.boolean().optional(),
  userhidden: z.boolean().optional(),
  commenthidden: z.boolean().optional(),
  texthidden: z.boolean().optional(),
  slots: z
    .looseObject({
      main: z
        .looseObject({ content: z.string().optional(), contentmodel: z.string().optional() })
        .optional(),
    })
    .optional(),
});

const pageSchema = z.looseObject({
  pageid: z.number().optional(),
  ns: z.number().optional(),
  title: z.string(),
  missing: z.boolean().optional(),
  invalid: z.boolean().optional(),
  revisions: z.array(revisionSchema).optional(),
});

const revisionQuerySchema = z.object({
  query: z.looseObject({ pages: z.array(pageSchema).optional() }).optional(),
});

/** A MediaWiki revision with everything the sync needs, its text read and hashed. */
export interface MediaWikiRevision {
  pageId: number;
  namespace: number;
  /** The page's title now (spaces, not canonicalized). */
  title: string;
  revid: number;
  /** 0 for the revision that created the page. */
  parentid: number;
  timestamp: Date;
  /** null when the contributor is hidden. */
  user: string | null;
  comment: string;
  commentHidden: boolean;
  minor: boolean;
  wikitext: string;
  /** `rev_sha1` (base 36) of `wikitext`, computed from the text. */
  sha1: string;
  contentModel: string;
}

/** The revision of `page` the sync can import, or null (page missing, text or timestamp hidden or absent). */
function toMediaWikiRevision(page: z.infer<typeof pageSchema>): MediaWikiRevision | null {
  const rev = page.revisions?.[0];
  const main = rev?.slots?.main;
  if (!rev || page.missing || page.invalid || rev.texthidden || main?.content === undefined) {
    return null;
  }
  if (!rev.timestamp || page.pageid === undefined) return null;

  const timestamp = new Date(rev.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`MediaWiki revision ${rev.revid} has an invalid timestamp "${rev.timestamp}"`);
  }
  const wikitext = sanitize(main.content);
  return {
    pageId: page.pageid,
    namespace: page.ns ?? 0,
    title: plainTitle(page.title),
    revid: rev.revid,
    parentid: rev.parentid ?? 0,
    timestamp,
    user: rev.userhidden || rev.user === undefined ? null : sanitize(rev.user),
    comment: rev.commenthidden ? "" : sanitize(rev.comment),
    commentHidden: rev.commenthidden ?? false,
    minor: rev.minor ?? false,
    wikitext,
    sha1: mwSha1Base36(wikitext),
    contentModel: main.contentmodel ?? "wikitext",
  };
}

/** One revision by id; null when MediaWiki no longer has it (deleted) or hides its text. */
export async function fetchRevision(revid: number): Promise<MediaWikiRevision | null> {
  const data = await mediaWikiGet(
    {
      action: "query",
      revids: String(revid),
      prop: "revisions|info",
      rvprop: REVISION_PROPS,
      rvslots: "main",
    },
    revisionQuerySchema
  );
  const page = data.query?.pages?.[0];
  return page ? toMediaWikiRevision(page) : null;
}

/** The newest revision of a page; null when the page does not exist. */
export async function fetchLatestRevision(title: string): Promise<MediaWikiRevision | null> {
  const data = await mediaWikiGet(
    {
      action: "query",
      titles: title,
      prop: "revisions|info",
      rvprop: REVISION_PROPS,
      rvslots: "main",
    },
    revisionQuerySchema
  );
  const page = data.query?.pages?.[0];
  return page ? toMediaWikiRevision(page) : null;
}

const hashQuerySchema = z.object({
  query: z
    .looseObject({
      pages: z
        .array(
          z.looseObject({
            revisions: z.array(z.looseObject({ sha1: z.string().optional() })).optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

const HEX_SHA1 = /^[0-9a-f]{40}$/i;

/** `rev_sha1` (base 36) of revision `revid`, read without its text; null when MediaWiki has no usable hash. */
export async function fetchRevisionSha1(revid: number): Promise<string | null> {
  const data = await mediaWikiGet(
    { action: "query", revids: String(revid), prop: "revisions", rvprop: "ids|sha1" },
    hashQuerySchema
  );
  const hex = data.query?.pages?.[0]?.revisions?.[0]?.sha1;
  return hex !== undefined && HEX_SHA1.test(hex) ? sha1HexToBase36(hex) : null;
}

// ---------------------------------------------------------------------------
// Recent changes and log events (both are read oldest first from a high-water mark)
// ---------------------------------------------------------------------------

/** What the next page of a continued list asks for (`rccontinue`, `lecontinue`, `continue`). */
export type ListContinuation = Record<string, string>;

export interface ListPage<T> {
  entries: T[];
  next: ListContinuation | null;
}

const continueSchema = z.record(z.string(), z.string());

const recentChangesSchema = z.object({
  query: z
    .object({
      recentchanges: z.array(
        z.looseObject({
          title: z.string().optional(),
          revid: z.number().optional(),
          timestamp: z.string().optional(),
          user: z.string().optional(),
        })
      ),
    })
    .optional(),
  continue: continueSchema.optional(),
});

export interface RecentChange {
  title: string;
  revid: number;
  timestamp: string;
  user: string | null;
}

/** One `list=recentchanges` request over every namespace, edits and page creations only. */
export async function fetchRecentChangesPage(
  params: Record<string, string>
): Promise<ListPage<RecentChange>> {
  const data = await mediaWikiGet(
    {
      action: "query",
      list: "recentchanges",
      rcprop: "title|user|timestamp|comment|sizes|flags|ids",
      rctype: "edit|new",
      ...params,
    },
    recentChangesSchema
  );
  return {
    entries: (data.query?.recentchanges ?? []).map((rc) => ({
      title: plainTitle(rc.title ?? ""),
      revid: rc.revid ?? 0,
      timestamp: rc.timestamp ?? "",
      user: rc.user === undefined ? null : sanitize(rc.user),
    })),
    next: data.continue ?? null,
  };
}

const logEventsSchema = z.object({
  query: z
    .object({
      logevents: z.array(
        z.looseObject({
          logid: z.number(),
          type: z.string().optional(),
          action: z.string().optional(),
          title: z.string().optional(),
          user: z.string().optional(),
          timestamp: z.string().optional(),
          comment: z.string().optional(),
          // PHP encodes an empty parameter list as [] rather than {}.
          params: z.union([z.record(z.string(), z.json()), z.array(z.json())]).optional(),
        })
      ),
    })
    .optional(),
  continue: continueSchema.optional(),
});

export interface LogEvent {
  logid: number;
  type: string;
  action: string;
  /** The page the event is about (`User:Name` for blocks and rights changes). */
  title: string;
  user: string | null;
  timestamp: string;
  comment: string;
  params: Record<string, JsonValue>;
}

/** One `list=logevents` request (all log types: the sync picks the ones it applies). */
export async function fetchLogEventsPage(
  params: Record<string, string>
): Promise<ListPage<LogEvent>> {
  const data = await mediaWikiGet(
    {
      action: "query",
      list: "logevents",
      leprop: "ids|title|type|user|timestamp|comment|details",
      ...params,
    },
    logEventsSchema
  );
  return {
    entries: (data.query?.logevents ?? []).map((event) => ({
      logid: event.logid,
      type: event.type ?? "",
      action: event.action ?? "",
      title: plainTitle(event.title ?? ""),
      user: event.user === undefined ? null : sanitize(event.user),
      timestamp: event.timestamp ?? "",
      comment: sanitize(event.comment),
      params: event.params === undefined || Array.isArray(event.params) ? {} : event.params,
    })),
    next: data.continue ?? null,
  };
}
