/**
 * query-prop.ts — `action=query&prop=info|revisions|categories|links|pageprops` (plan 410).
 *
 * A prop module decorates the pages of the page set (`query.pages`). `revisions` is the one bots
 * read most: with a single page it lists history (`rvlimit`, `rvstart`, `rvdir`, ...), with several it
 * answers each page's newest revision, and `rvslots` picks MediaWiki's slot shape for the content.
 */

import { Continuation, encodeCursor, optionalCursor, takePage } from "../continuation";
import { ApiError, badContinue, badValues } from "../errors";
import { mwTimestamp, type JsonObject, type JsonValue } from "../format";
import type { PageEntry, PageSet } from "../pages";
import type {
  PageRestrictionRow,
  PerPageQuery,
  PerPageResult,
  RevisionBound,
  RevisionCursor,
  RevisionRow,
} from "../store-types";
import type { ApiContext } from "../types";
import { contentModelFor } from "~/lib/wiki-os/xml/content-model";
import { canonicalizeTitle, NAMESPACE_CANONICAL_NAMES } from "~/lib/wiki-os/core/title";
import { talkTitleOf } from "~/lib/wiki-os/core/page-management-service";
import { SCRIPT_PATH } from "./query-meta";

export interface PropContext {
  rc: ApiContext;
  pageSet: PageSet;
  /** `query.pages` objects by page key; a prop module adds its fields. */
  out: Map<number, JsonObject>;
  continuation: Continuation;
}

export type PropModule = (pc: PropContext) => Promise<void>;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const existingEntries = (pageSet: PageSet): PageEntry[] =>
  pageSet.entries.filter((entry) => entry.state === "exists" && entry.row);

const fieldsOf = (pc: PropContext, entry: PageEntry): JsonObject => {
  const fields = pc.out.get(entry.key);
  if (!fields) throw new Error(`no output slot for page ${entry.key}`);
  return fields;
};

// ---------------------------------------------------------------------------
// info
// ---------------------------------------------------------------------------

const INFO_PROPS = [
  "protection",
  "talkid",
  "watched",
  "watchers",
  "visitingwatchers",
  "notificationtimestamp",
  "subjectid",
  "associatedpage",
  "url",
  "readable",
  "preload",
  "displaytitle",
  "varianttitles",
  "testactions",
  "testactionsdetail",
] as const;
type InfoProp = (typeof INFO_PROPS)[number];

/** The title of the subject page of a talk page (`Talk:Foo` is about `Foo`), or null. */
function subjectTitleOf(title: string): string | null {
  const canon = canonicalizeTitle(title);
  if (!canon || canon.namespaceId < 1 || canon.namespaceId % 2 === 0) return null;
  const prefix = canon.namespaceId === 1 ? "" : NAMESPACE_CANONICAL_NAMES[canon.namespaceId - 1];
  return prefix === undefined ? null : prefix ? `${prefix}:${canon.base}` : canon.base;
}

const expiryOf = (expiresAt: Date | null) => (expiresAt ? mwTimestamp(expiresAt) : "infinity");

function protectionOf(restrictions: readonly PageRestrictionRow[]): JsonValue[] {
  return restrictions.map((r) => ({ type: r.action, level: r.level, expiry: expiryOf(r.expiresAt) }));
}

function restrictionTypes(entry: PageEntry): string[] {
  if (entry.state === "missing") return ["create"];
  return entry.ns === 6 ? ["edit", "move", "upload"] : ["edit", "move"];
}

const urlOf = (siteUrl: string, title: string) =>
  `${siteUrl}/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2F/g, "/")}`;

/** What `prop=info` says of one page, for the props the request asked for. */
function pageInfo(
  entry: PageEntry,
  props: ReadonlySet<InfoProp>,
  lookups: {
    siteUrl: string;
    restrictions: Map<string, PageRestrictionRow[]>;
    related: Map<string, { pageId: number }>;
  }
): JsonObject {
  const info: JsonObject = {
    contentmodel: contentModelFor(entry.title).model,
    pagelanguage: "en",
    pagelanguagehtmlcode: "en",
    pagelanguagedir: "ltr",
  };
  const { row } = entry;
  if (row) {
    info.touched = mwTimestamp(row.touched);
    info.lastrevid = row.headRevId ?? 0;
    info.length = row.length;
    info.redirect = row.isRedirect;
  }
  if (props.has("protection")) {
    info.protection = protectionOf(lookups.restrictions.get(entry.title) ?? []);
    info.restrictiontypes = restrictionTypes(entry);
  }
  const talk = props.has("talkid") ? talkTitleOf(entry.title) : null;
  const talkRow = talk ? lookups.related.get(talk) : undefined;
  if (talkRow) info.talkid = talkRow.pageId;
  const subject = props.has("subjectid") ? subjectTitleOf(entry.title) : null;
  const subjectRow = subject ? lookups.related.get(subject) : undefined;
  if (subjectRow) info.subjectid = subjectRow.pageId;
  if (props.has("url")) {
    const url = urlOf(lookups.siteUrl, entry.title);
    info.fullurl = url;
    info.editurl = `${lookups.siteUrl}${SCRIPT_PATH}/index.php?title=${encodeURIComponent(entry.title.replace(/ /g, "_"))}&action=edit`;
    info.canonicalurl = url;
  }
  if (props.has("readable")) info.readable = true;
  if (props.has("displaytitle")) info.displaytitle = escapeHtml(entry.title);
  return info;
}

export async function propInfo(pc: PropContext): Promise<void> {
  const { rc, pageSet } = pc;
  const props = new Set<InfoProp>(rc.params.scope("in", "info").listOf("prop", INFO_PROPS));
  const entries = pageSet.entries.filter((e) => e.state === "exists" || e.state === "missing");
  const { store, siteUrl } = rc.deps;

  const restrictions = props.has("protection")
    ? await store.restrictionsByTitle(entries.map((entry) => entry.title))
    : new Map<string, PageRestrictionRow[]>();
  const relatedTitles = entries.flatMap((entry) => [
    ...(props.has("talkid") ? [talkTitleOf(entry.title)] : []),
    ...(props.has("subjectid") ? [subjectTitleOf(entry.title)] : []),
  ]);
  const related = new Map(
    (await store.pagesByTitle(relatedTitles.filter((t): t is string => t !== null))).map((row) => [row.title, row])
  );
  for (const entry of entries) {
    Object.assign(fieldsOf(pc, entry), pageInfo(entry, props, { siteUrl, restrictions, related }));
  }
}

// ---------------------------------------------------------------------------
// revisions
// ---------------------------------------------------------------------------

const REV_PROPS = [
  "ids",
  "flags",
  "timestamp",
  "user",
  "userid",
  "size",
  "slotsize",
  "sha1",
  "slotsha1",
  "contentmodel",
  "comment",
  "parsedcomment",
  "content",
  "tags",
  "roles",
] as const;
type RevProp = (typeof REV_PROPS)[number];
const DEFAULT_REV_PROPS: readonly RevProp[] = ["ids", "flags", "timestamp", "comment", "user"];

/** Params that only make sense for one page's history. */
const SINGLE_PAGE_PARAMS = ["limit", "startid", "endid", "start", "end", "user", "excludeuser", "continue"] as const;

const IP_NAME = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]+:[0-9a-f:]*)$/i;
const isAnonymousName = (name: string) => IP_NAME.test(name);

const LEGACY_SLOTS_WARNING =
  'Because "rvslots" was not specified, a legacy format has been used for the output. This has been deprecated, and in the future, the default will change so the "rvslots" parameter will always be used.';

interface RevisionOptions {
  props: ReadonlySet<RevProp>;
  slots: boolean;
  version: ApiContext["version"];
}

function slotJson(rev: RevisionRow, { props, version }: RevisionOptions): JsonObject | undefined {
  const wantsModel = props.has("contentmodel") || props.has("content");
  if (!wantsModel && !props.has("slotsize") && !props.has("slotsha1")) return undefined;
  const { model, format } = contentModelFor(rev.title);
  const slot: JsonObject = {};
  if (wantsModel) {
    slot.contentmodel = model;
    slot.contentformat = format;
  }
  if (props.has("slotsize")) slot.size = rev.size;
  if (props.has("slotsha1") && !rev.textHidden) slot.sha1 = rev.sha1;
  if (props.has("content")) {
    if (rev.textHidden) slot.texthidden = true;
    else Object.assign(slot, version === 1 ? { "*": rev.content ?? "" } : { content: rev.content ?? "" });
  }
  return slot;
}

function revisionIds(rev: RevisionRow, props: ReadonlySet<RevProp>): JsonObject {
  const out: JsonObject = {};
  if (props.has("ids")) {
    out.revid = rev.revId;
    out.parentid = rev.parentId;
  }
  if (props.has("flags")) out.minor = rev.minor;
  if (props.has("timestamp")) out.timestamp = mwTimestamp(rev.timestamp);
  if (props.has("size")) out.size = rev.size;
  if (props.has("tags")) out.tags = [];
  return out;
}

/** The revision's author, honouring a revision deletion of the user name. */
function revisionAuthor(rev: RevisionRow, props: ReadonlySet<RevProp>): JsonObject {
  const out: JsonObject = {};
  if (props.has("user")) {
    if (rev.userHidden) out.userhidden = true;
    else {
      out.user = rev.user ?? "";
      if (rev.user && isAnonymousName(rev.user)) out.anon = true;
    }
  }
  if (props.has("userid") && !rev.userHidden) out.userid = rev.userId;
  return out;
}

/** The comment and the hash, honouring revision deletion of the comment and of the text. */
function revisionDescribed(rev: RevisionRow, props: ReadonlySet<RevProp>): JsonObject {
  const out: JsonObject = {};
  if (props.has("sha1")) {
    if (rev.textHidden) out.sha1hidden = true;
    else out.sha1 = rev.sha1;
  }
  if (props.has("comment") || props.has("parsedcomment")) {
    if (rev.commentHidden) out.commenthidden = true;
    else {
      if (props.has("comment")) out.comment = rev.comment ?? "";
      if (props.has("parsedcomment")) out.parsedcomment = escapeHtml(rev.comment ?? "");
    }
  }
  return out;
}

/** The text as the revision itself carries it (no `rvslots`): MediaWiki's legacy shape. */
function legacyContent(rev: RevisionRow, { props, version }: RevisionOptions): JsonObject {
  const out: JsonObject = {};
  const { model, format } = contentModelFor(rev.title);
  if (props.has("contentmodel") || props.has("content")) out.contentmodel = model;
  if (props.has("content")) {
    out.contentformat = format;
    if (rev.textHidden) out.texthidden = true;
    else if (version === 1) out["*"] = rev.content ?? "";
    else out.content = rev.content ?? "";
  }
  return out;
}

export function revisionJson(rev: RevisionRow, options: RevisionOptions): JsonObject {
  const { props, slots } = options;
  const slot = slots ? slotJson(rev, options) : undefined;
  return {
    ...revisionIds(rev, props),
    ...revisionAuthor(rev, props),
    ...revisionDescribed(rev, props),
    ...(slots ? (slot ? { slots: { main: slot } } : {}) : legacyContent(rev, options)),
  };
}

function decodeRevisionCursor(raw: string | undefined): RevisionCursor | undefined {
  const parts = optionalCursor(raw, ["s", "n"] as const);
  if (!parts) return undefined;
  const timestamp = new Date(parts[0]);
  if (Number.isNaN(timestamp.getTime())) throw badContinue();
  return { timestamp, revId: parts[1] };
}

/** A start/end bound given as a timestamp or as a revision id (the id wins). */
async function revisionBound(
  rc: ApiContext,
  p: ApiContext["params"],
  which: "start" | "end"
): Promise<RevisionBound | undefined> {
  const id = p.optionalInteger(`${which}id`, 1);
  if (id !== undefined) {
    const [rev] = await rc.deps.store.revisionsById([id], false);
    if (!rev) throw new ApiError("nosuchrevid", `There is no revision with ID ${id}.`);
    return { timestamp: rev.timestamp, revId: rev.revId };
  }
  const timestamp = p.timestamp(which, rc.now);
  return timestamp ? { timestamp } : undefined;
}

export async function propRevisions(pc: PropContext): Promise<void> {
  const { rc, pageSet } = pc;
  const p = rc.params.scope("rv", "revisions");
  const props = new Set<RevProp>(p.listOf("prop", REV_PROPS, DEFAULT_REV_PROPS));
  const slotValues = p.has("slots") ? p.list("slots") : null;
  if (slotValues?.some((slot) => slot !== "main" && slot !== "*")) {
    throw badValues(p.fullName("slots"), slotValues.filter((slot) => slot !== "main" && slot !== "*"));
  }
  const slots = slotValues !== null;
  const withContent = props.has("content");
  if (withContent && !slots) p.addWarning(LEGACY_SLOTS_WARNING);
  const options: RevisionOptions = { props, slots, version: rc.version };

  const pages = existingEntries(pageSet);
  const byRevisionId = pages.some((entry) => entry.revisionIds.length > 0);
  const singlePage = pages.length === 1 && !byRevisionId;
  const usedSingle: string[] = SINGLE_PAGE_PARAMS.filter((name) => p.has(name));
  if (p.raw("dir") === "newer") usedSingle.push("dir");
  if (usedSingle.length > 0 && !singlePage) {
    throw new ApiError(
      "multpages",
      `titles, pageids or a generator was used to supply multiple pages, but the parameters ${usedSingle.map((n) => p.fullName(n)).join(", ")} can only be used on a single page.`
    );
  }

  if (singlePage) {
    await singlePageRevisions(pc, pages[0]!, p, options);
    return;
  }

  // Several pages (or revids): the newest revision of each page, or exactly the revisions asked for.
  const wanted = pages.flatMap((entry) =>
    byRevisionId ? entry.revisionIds : entry.row?.headRevId ? [entry.row.headRevId] : []
  );
  const revisions = wanted.length > 0 ? await rc.deps.store.revisionsById(wanted, withContent) : [];
  for (const entry of pages) {
    const mine = revisions.filter((rev) => rev.pageId === entry.key);
    fieldsOf(pc, entry).revisions = mine.map((rev) => revisionJson(rev, options));
  }
}

async function singlePageRevisions(
  pc: PropContext,
  entry: PageEntry,
  p: ApiContext["params"],
  options: RevisionOptions
): Promise<void> {
  const { rc, continuation } = pc;
  const { store } = rc.deps;
  const withContent = options.props.has("content");
  // Revisions with their text are limited to 50 per request (500 with apihighlimits).
  const contentCap = rc.highLimits ? 500 : 50;
  const limit = withContent
    ? Math.min(contentCap, p.limit("limit", { fallback: 1, high: rc.highLimits }))
    : p.limit("limit", { fallback: 1, high: rc.highLimits });
  const dir = p.oneOf("dir", ["older", "newer"], "older");

  const fetched = await store.findRevisions({
    articleId: entry.row!.articleId,
    dir,
    from: await revisionBound(rc, p, "start"),
    to: await revisionBound(rc, p, "end"),
    users: p.has("user") ? [p.required("user")] : undefined,
    excludeUser: p.string("excludeuser"),
    cursor: decodeRevisionCursor(p.raw("continue")),
    limit,
    withContent,
  });
  const { page, more } = takePage(fetched, limit);
  fieldsOf(pc, entry).revisions = page.map((rev) => revisionJson(rev, options));
  const next = more ? fetched[limit] : undefined;
  if (next) {
    continuation.addProp(p.fullName("continue"), encodeCursor([next.timestamp.toISOString(), next.revId]));
  }
}

// ---------------------------------------------------------------------------
// categories and links: listings across pages with one limit
// ---------------------------------------------------------------------------

interface PerPageSpec<T> {
  module: string;
  prefix: string;
  field: string;
  fetch: (query: PerPageQuery) => Promise<PerPageResult<T>>;
  pageIdOf: (row: T) => number;
  toJson: (row: T) => JsonObject;
}

async function perPage<T>(pc: PropContext, spec: PerPageSpec<T>, titles?: readonly string[], namespaces?: readonly number[]): Promise<void> {
  const { rc, continuation } = pc;
  const p = rc.params.scope(spec.prefix, spec.module);
  const pages = existingEntries(pc.pageSet);
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const cursor = optionalCursor(p.raw("continue"), ["n", "s"] as const);
  const { rows, next } = await spec.fetch({
    articleIds: pages.map((entry) => entry.row!.articleId),
    titles,
    namespaces,
    dir: p.oneOf("dir", ["ascending", "descending"], "ascending"),
    limit,
    cursor: cursor ? { pageId: cursor[0], key: cursor[1] } : undefined,
  });
  for (const entry of pages) {
    const mine = rows.filter((row) => spec.pageIdOf(row) === entry.key);
    if (mine.length > 0) fieldsOf(pc, entry)[spec.field] = mine.map((row) => spec.toJson(row));
  }
  if (next) continuation.addProp(p.fullName("continue"), encodeCursor([next.pageId, next.key]));
}

const hexOf = (text: string) => Buffer.from(text, "utf8").toString("hex");

export async function propCategories(pc: PropContext): Promise<void> {
  const { rc } = pc;
  const p = rc.params.scope("cl", "categories");
  const props = new Set(p.listOf("prop", ["sortkey", "timestamp", "hidden"] as const));
  const show = p.listOf("show", ["hidden", "!hidden"] as const);
  const hidden = show.includes("hidden") ? true : show.includes("!hidden") ? false : undefined;
  const titles = p.has("categories") ? p.list("categories").flatMap((raw) => canonicalizeTitle(raw)?.title ?? []) : undefined;
  await perPage(
    pc,
    {
      module: "categories",
      prefix: "cl",
      field: "categories",
      fetch: (query) => rc.deps.store.categoriesOf({ ...query, hidden }),
      pageIdOf: (row) => row.pageId,
      toJson: (row) => ({
        ns: 14,
        title: row.title,
        ...(props.has("sortkey")
          ? { sortkey: hexOf((row.sortKey ?? row.title.slice("Category:".length)).toUpperCase()), sortkeyprefix: row.sortKey ?? "" }
          : {}),
        ...(props.has("timestamp") ? { timestamp: mwTimestamp(row.timestamp) } : {}),
        ...(props.has("hidden") ? { hidden: row.hidden } : {}),
      }),
    },
    titles
  );
}

export async function propLinks(pc: PropContext): Promise<void> {
  const { rc } = pc;
  const p = rc.params.scope("pl", "links");
  const namespaces = p.has("namespace") ? p.list("namespace").map(Number).filter(Number.isInteger) : undefined;
  const titles = p.has("titles") ? p.list("titles").flatMap((raw) => canonicalizeTitle(raw)?.title ?? []) : undefined;
  await perPage(
    pc,
    {
      module: "links",
      prefix: "pl",
      field: "links",
      fetch: (query) => rc.deps.store.linksFrom(query),
      pageIdOf: (row) => row.pageId,
      toJson: (row) => ({ ns: row.namespace, title: row.title }),
    },
    titles,
    namespaces
  );
}

// ---------------------------------------------------------------------------
// pageprops
// ---------------------------------------------------------------------------

const MAGIC_PROPS: ReadonlyArray<readonly [string, string]> = [
  ["__HIDDENCAT__", "hiddencat"],
  ["__NOINDEX__", "noindex"],
  ["__INDEX__", "index"],
  ["__NEWSECTIONLINK__", "newsectionlink"],
  ["__NONEWSECTIONLINK__", "nonewsectionlink"],
  ["__STATICREDIRECT__", "staticredirect"],
];

/** The page properties a page's own wikitext sets: DISPLAYTITLE, DEFAULTSORT and the behaviour switches. */
export function pagePropsOf(wikitext: string): JsonObject {
  const props: JsonObject = {};
  const display = /\{\{\s*DISPLAYTITLE\s*:([^{}|]*)\}\}/i.exec(wikitext)?.[1]?.trim();
  if (display) props.displaytitle = display;
  const sort = /\{\{\s*DEFAULTSORT(?:KEY)?\s*:([^{}|]*)\}\}/i.exec(wikitext)?.[1]?.trim();
  if (sort) props.defaultsort = sort;
  for (const [word, name] of MAGIC_PROPS) if (wikitext.includes(word)) props[name] = "";
  return props;
}

export async function propPageprops(pc: PropContext): Promise<void> {
  const p = pc.rc.params.scope("pp", "pageprops");
  const wanted = p.has("prop") ? new Set(p.list("prop")) : null;
  const pages = existingEntries(pc.pageSet);
  const texts = await pc.rc.deps.store.wikitextByArticle(pages.map((entry) => entry.row!.articleId));
  for (const entry of pages) {
    const all = pagePropsOf(texts.get(entry.row!.articleId) ?? "");
    const props = Object.fromEntries(Object.entries(all).filter(([name]) => !wanted || wanted.has(name)));
    if (Object.keys(props).length > 0) fieldsOf(pc, entry).pageprops = props;
  }
}
