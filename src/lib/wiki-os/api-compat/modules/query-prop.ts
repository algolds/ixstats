/**
 * query-prop.ts — `action=query&prop=info|categories|links|pageprops` (plan 410); `revisions` is
 * in prop-revisions.ts.
 *
 * A prop module decorates the pages of the page set (`query.pages`).
 */

import { encodeCursor, optionalCursor } from "../continuation";
import { mwTimestamp, type JsonObject, type JsonValue } from "../format";
import type { PageEntry } from "../pages";
import type { PageRestrictionRow, PerPageQuery, PerPageResult } from "../store-types";
import { escapeHtml, existingEntries, fieldsOf, type PropContext } from "./prop-common";
import { contentModelFor } from "~/lib/wiki-os/xml/content-model";
import { canonicalizeTitle, NAMESPACE_CANONICAL_NAMES } from "~/lib/wiki-os/core/title";
import { talkTitleOf } from "~/lib/wiki-os/core/page-management-service";
import { SCRIPT_PATH } from "./query-meta";

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
  if (props.has("displaytitle")) info.displaytitle = row?.displayTitle ?? escapeHtml(entry.title);
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

/** `prop=templates`: what the pages transclude (templates, and Lua modules through #invoke), from each page's last render. */
export async function propTemplates(pc: PropContext): Promise<void> {
  const { rc } = pc;
  const p = rc.params.scope("tl", "templates");
  const namespaces = p.has("namespace") ? p.list("namespace").map(Number).filter(Number.isInteger) : undefined;
  const titles = p.has("templates") ? p.list("templates").flatMap((raw) => canonicalizeTitle(raw)?.title ?? []) : undefined;
  await perPage(
    pc,
    {
      module: "templates",
      prefix: "tl",
      field: "templates",
      fetch: (query) => rc.deps.store.templatesOf(query),
      pageIdOf: (row) => row.pageId,
      toJson: (row) => ({ ns: row.namespace, title: row.title }),
    },
    titles,
    namespaces
  );
}

/** `prop=images`: the files the pages use, from each page's last render. */
export async function propImages(pc: PropContext): Promise<void> {
  const { rc } = pc;
  const p = rc.params.scope("im", "images");
  const titles = p.has("images") ? p.list("images").flatMap((raw) => canonicalizeTitle(raw)?.title ?? []) : undefined;
  await perPage(
    pc,
    {
      module: "images",
      prefix: "im",
      field: "images",
      fetch: (query) => rc.deps.store.imagesOf(query),
      pageIdOf: (row) => row.pageId,
      toJson: (row) => ({ ns: row.namespace, title: row.title }),
    },
    titles
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

/** Inline tags a display title may keep, written without attributes: `{{DISPLAYTITLE:<i>Foo</i>}}`. */
const DISPLAY_TITLE_TAGS = /&lt;(\/?)(i|b|em|strong|sub|sup|u|s|small|big|span)&gt;/gi;
/** A display title is a title: nothing like this many characters is one. */
const MAX_DISPLAY_TITLE_CHARS = 1_000;

/**
 * A `{{DISPLAYTITLE}}` taken from raw wikitext, as HTML safe to hand to any client: everything is
 * escaped except a few inline tags with no attributes (a rendered page's comes from MediaWiki, which
 * restricts it the same way). `<img onerror=...>`, `<script>`, links and attributes stay text.
 */
export function displayTitleHtml(raw: string): string {
  const escaped = escapeHtml(raw.slice(0, MAX_DISPLAY_TITLE_CHARS)).replace(/'/g, "&#39;");
  return escaped.replace(DISPLAY_TITLE_TAGS, (_tag, slash: string, name: string) => `<${slash}${name.toLowerCase()}>`);
}

/**
 * The page properties a page's own wikitext sets: DISPLAYTITLE (sanitized as HTML), DEFAULTSORT and the
 * behaviour switches. Only for a page MediaWiki never rendered: a rendered page's are MediaWiki's.
 */
export function pagePropsOf(wikitext: string): JsonObject {
  const props: JsonObject = {};
  const display = /\{\{\s*DISPLAYTITLE\s*:([^{}|]*)\}\}/i.exec(wikitext)?.[1]?.trim();
  if (display) props.displaytitle = displayTitleHtml(display);
  const sort = /\{\{\s*DEFAULTSORT(?:KEY)?\s*:([^{}|]*)\}\}/i.exec(wikitext)?.[1]?.trim();
  if (sort) props.defaultsort = sort;
  for (const [word, name] of MAGIC_PROPS) if (wikitext.includes(word)) props[name] = "";
  return props;
}

/** How much of each page's text `prop=pageprops` reads: the switches and DISPLAYTITLE are at the top of a page. */
const PAGEPROPS_TEXT_CHARS = 100_000;

/**
 * `prop=pageprops`: the properties MediaWiki reported for the page's last render (stored with it),
 * else, for a page that was never rendered, those its own wikitext sets (one query for the first
 * characters of just those pages).
 */
export async function propPageprops(pc: PropContext): Promise<void> {
  const p = pc.rc.params.scope("pp", "pageprops");
  const wanted = p.has("prop") ? new Set(p.list("prop")) : null;
  const pages = existingEntries(pc.pageSet);
  const unrendered = pages.filter((entry) => entry.row!.pageProps === null);
  const texts = await pc.rc.deps.store.wikitextByArticle(
    unrendered.map((entry) => entry.row!.articleId),
    PAGEPROPS_TEXT_CHARS
  );
  for (const entry of pages) {
    const { row } = entry;
    const all: JsonObject = row!.pageProps ?? pagePropsOf(texts.get(row!.articleId) ?? "");
    const props = Object.fromEntries(Object.entries(all).filter(([name]) => !wanted || wanted.has(name)));
    if (Object.keys(props).length > 0) fieldsOf(pc, entry).pageprops = props;
  }
}
