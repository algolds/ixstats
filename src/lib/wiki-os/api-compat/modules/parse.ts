/**
 * parse.ts — `action=parse` (plan 410).
 *
 * `page=`/`pageid=` serves the page's stored rendering when it is fresh (no MediaWiki call; a stale
 * page is re-rendered through the render service, which is single-flight and capped). `text=` renders
 * the given wikitext through the private renderer, storing nothing; it needs a bot-password login
 * and at most 200,000 characters, because it is the one request an anonymous caller could use to
 * make WikiOS (and MediaWiki behind it) work on text of their choosing. `oldid=` renders that
 * revision's stored text. The other props (links, categories, sections, displaytitle, wikitext,
 * revid, properties) are read from the wikitext by linear scanners (`scan.ts`) or from the stored page.
 */

import { ApiError, badValues, invalidTitle, missingOneOf, unavailable } from "../errors";
import { wrapText, type JsonObject, type JsonValue } from "../format";
import type { ApiParams } from "../params";
import { categoryLinks, externalUrls, linkTargets, visibleText } from "../scan";
import type { ApiContext } from "../types";
import { DEFERRED_REASON } from "./deferred";
import { pagePropsOf } from "./query-prop";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { sectionHeadings } from "~/lib/wiki-os/wikitext/section-locator";

const PARSE_PROPS = [
  "text",
  "links",
  "templates",
  "categories",
  "sections",
  "displaytitle",
  "wikitext",
  "revid",
  "langlinks",
  "iwlinks",
  "externallinks",
  "images",
  "properties",
  "parsewarnings",
] as const;
type ParseProp = (typeof PARSE_PROPS)[number];
/** What MediaWiki returns by default, minus what needs plan 406's tables (templates, images). */
const DEFAULT_PROPS: readonly ParseProp[] = ["text", "categories", "links", "sections", "revid", "displaytitle", "langlinks", "externallinks", "properties", "parsewarnings", "iwlinks"];

/** Characters of `text=` a request may send. */
export const MAX_PARSE_TEXT_CHARS = 200_000;
/** Caps on what one parse lists, so a text of a million links answers in bounded time and size. */
const MAX_LINKS = 5_000;
const MAX_CATEGORIES = 1_000;
const MAX_SECTIONS = 5_000;
const MAX_EXTERNAL_LINKS = 500;
/** A section heading longer than this is cut for `line` and `anchor`. */
const MAX_HEADING_CHARS = 1_000;
/** Callers without a bot-password session may have this many renders through MediaWiki per minute. */
const ANONYMOUS_RENDERS_PER_MINUTE = 20;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** What is parsed: where its HTML comes from, and the facts the props are read from. */
interface Source {
  title: string;
  pageId: number;
  revId: number;
  wikitext: string;
  /** The page's stored rendering when it is fresh. */
  storedHtml: string | null;
  /** The page's id in the store: its stored categories, and the render service's key. */
  articleId: string | null;
  /** How the rendering is made when there is no fresh stored one: by the render service, or from the text. */
  render: "page" | "text";
}

async function pageSource(rc: ApiContext, p: ApiParams): Promise<Source | null> {
  const title = p.string("page");
  const pageId = p.optionalInteger("pageid", 1);
  const followRedirects = p.flag("redirects");
  if (title === undefined && pageId === undefined) return null;
  const { store } = rc.deps;
  let rows = pageId !== undefined ? await store.pagesById([pageId]) : [];
  if (pageId === undefined) {
    const canon = canonicalizeTitle(title ?? "");
    if (!canon) throw invalidTitle(title ?? "");
    rows = await store.pagesByTitle([canon.title]);
  }
  let row = rows[0];
  if (!row) {
    throw new ApiError(
      pageId !== undefined ? "nosuchpageid" : "missingtitle",
      pageId !== undefined ? `There is no page with ID ${pageId}.` : "The page you specified doesn't exist."
    );
  }
  if (followRedirects && row.isRedirect && row.redirectTitle) {
    row = (await store.pagesByTitle([row.redirectTitle]))[0] ?? row;
  }
  const [wikitexts, stored] = await Promise.all([store.wikitextByArticle([row.articleId]), store.pageHtml(row.articleId)]);
  return {
    title: row.title,
    pageId: row.pageId,
    revId: row.headRevId ?? 0,
    wikitext: wikitexts.get(row.articleId) ?? "",
    storedHtml: stored?.fresh && stored.html ? stored.html : null,
    articleId: row.articleId,
    render: "page",
  };
}

async function revisionSource(rc: ApiContext, p: ApiParams): Promise<Source | null> {
  const oldId = p.optionalInteger("oldid", 1);
  if (oldId === undefined) return null;
  const { store } = rc.deps;
  const [rev] = await store.revisionsById([oldId], true);
  if (!rev) throw new ApiError("nosuchrevid", `There is no revision with ID ${oldId}.`);
  if (rev.content === null) throw new ApiError("missingcontent", "The text of that revision is hidden.");
  // A page's newest revision has a stored rendering; an older one is rendered on demand.
  const [page] = await store.pagesByTitle([rev.title]);
  const stored = page?.headRevId === rev.revId ? await store.pageHtml(page.articleId) : null;
  return {
    title: rev.title,
    pageId: rev.pageId,
    revId: rev.revId,
    wikitext: rev.content,
    storedHtml: stored?.fresh && stored.html ? stored.html : null,
    articleId: null,
    render: "text",
  };
}

/** Text to parse: a bot-password login, at most `MAX_PARSE_TEXT_CHARS` characters. */
function textSource(rc: ApiContext, p: ApiParams): Source | null {
  const text = p.string("text");
  const model = p.string("contentmodel", "wikitext");
  const raw = p.string("title", "API");
  if (text === undefined) return null;
  if (rc.session.kind !== "bot") {
    throw new ApiError("permissiondenied", "Parsing text needs a login with a bot password; page=, pageid= and oldid= are open to everyone.");
  }
  if (text.length > MAX_PARSE_TEXT_CHARS) {
    throw new ApiError("toobig", `The text is longer than ${MAX_PARSE_TEXT_CHARS} characters.`);
  }
  if (model !== "wikitext") throw badValues(p.fullName("contentmodel"), [model]);
  const canon = canonicalizeTitle(raw);
  if (!canon) throw invalidTitle(raw);
  return { title: canon.title, pageId: 0, revId: 0, wikitext: text, storedHtml: null, articleId: null, render: "text" };
}

// ---------------------------------------------------------------------------
// props
// ---------------------------------------------------------------------------

interface CategoryEntry {
  /** The category's name with underscores, as `action=parse` shows it. */
  name: string;
  sortKey: string;
}

async function categoryEntries(rc: ApiContext, source: Source, p: ApiParams): Promise<CategoryEntry[]> {
  if (source.articleId && source.render === "page") {
    const { rows } = await rc.deps.store.categoriesOf({ articleIds: [source.articleId], dir: "ascending", limit: MAX_CATEGORIES });
    return rows.map((row) => ({ name: row.title.slice("Category:".length).replace(/ /g, "_"), sortKey: row.sortKey ?? "" }));
  }
  const entries = new Map<string, CategoryEntry>();
  for (const link of categoryLinks(source.wikitext, MAX_CATEGORIES + 1)) {
    const canon = canonicalizeTitle(`Category:${link.name}`);
    if (canon && !entries.has(canon.title)) entries.set(canon.title, { name: canon.base.replace(/ /g, "_"), sortKey: link.sortKey });
  }
  if (entries.size > MAX_CATEGORIES) p.addWarning(`Only the first ${MAX_CATEGORIES} categories are listed.`);
  return [...entries.values()].slice(0, MAX_CATEGORIES);
}

/** The article links of the text: canonical titles, not File:, Category: or Special: pages (those are not links between articles). */
function articleLinks(source: Source, p: ApiParams): string[] {
  const titles = new Set<string>();
  for (const target of linkTargets(source.wikitext, MAX_LINKS + 1)) {
    const canon = canonicalizeTitle(target);
    if (canon && ![6, 14, -1, -2].includes(canon.namespaceId)) titles.add(canon.title);
  }
  if (titles.size > MAX_LINKS) p.addWarning(`Only the first ${MAX_LINKS} links are listed.`);
  return [...titles].slice(0, MAX_LINKS);
}

/** The table of contents MediaWiki reports: nesting depth and `1.2` style numbers come from relative heading levels. */
function sectionEntries(source: Source, p: ApiParams): JsonObject[] {
  const headings = sectionHeadings(source.wikitext);
  if (headings.length > MAX_SECTIONS) p.addWarning(`Only the first ${MAX_SECTIONS} sections are listed.`);
  const stack: number[] = [];
  const counters: number[] = [];
  let offsetChars = 0;
  let offsetBytes = 0;
  return headings.slice(0, MAX_SECTIONS).map((heading, index) => {
    while (stack.length > 0 && stack[stack.length - 1]! >= heading.level) {
      stack.pop();
      counters.length = stack.length + 1;
    }
    stack.push(heading.level);
    counters.length = stack.length;
    counters[stack.length - 1] = (counters[stack.length - 1] ?? 0) + 1;
    const line = visibleText(heading.text.slice(0, MAX_HEADING_CHARS));
    // Byte offsets accumulate over the gaps between headings: the sum is one pass over the text.
    offsetBytes += Buffer.byteLength(source.wikitext.slice(offsetChars, heading.start), "utf8");
    offsetChars = heading.start;
    return {
      toclevel: stack.length,
      level: String(heading.level),
      line,
      number: counters.slice(0, stack.length).join("."),
      index: String(index + 1),
      fromtitle: source.title,
      byteoffset: offsetBytes,
      anchor: line.replace(/ /g, "_"),
    };
  });
}

/** The stored rendering, else one made now: by the render service for a page, by MediaWiki for text and old revisions. */
async function html(rc: ApiContext, source: Source): Promise<string> {
  if (source.storedHtml) return source.storedHtml;
  const { store, services } = rc.deps;
  if (source.render === "page" && source.articleId) {
    await services.ensureRendered(source.articleId);
    const stored = await store.pageHtml(source.articleId);
    if (stored?.html) return stored.html;
    throw new ApiError("renderfailed", "The page could not be rendered just now; try again shortly.");
  }
  if (rc.session.kind !== "bot") {
    const limit = await rc.deps.rateLimit(rc.clientKey, "wiki_api_render", {
      maxRequests: ANONYMOUS_RENDERS_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!limit.success) throw new ApiError("ratelimited", "You've exceeded your rate limit. Please wait some time and try again.");
  }
  return services.renderWikitext(source.wikitext, source.title);
}

async function propValue(rc: ApiContext, p: ApiParams, source: Source, prop: ParseProp): Promise<JsonValue> {
  const v1 = rc.version === 1;
  switch (prop) {
    case "text":
      return wrapText(await html(rc, source), rc.version);
    case "wikitext":
      return wrapText(source.wikitext, rc.version);
    case "revid":
      return source.revId;
    case "displaytitle":
      return String(pagePropsOf(source.wikitext).displaytitle ?? escapeHtml(source.title));
    case "categories":
      return (await categoryEntries(rc, source, p)).map((c) => (v1 ? { sortkey: c.sortKey, "*": c.name } : { sortkey: c.sortKey, category: c.name, hidden: false }));
    case "links": {
      const titles = articleLinks(source, p);
      const existing = new Set((await rc.deps.store.pagesByTitle(titles)).map((row) => row.title));
      return titles.map((title) => {
        const ns = canonicalizeTitle(title)?.namespaceId ?? 0;
        const exists = existing.has(title);
        return v1 ? { ns, ...(exists ? { exists: true } : {}), "*": title } : { ns, exists, title };
      });
    }
    case "sections":
      return sectionEntries(source, p);
    case "externallinks":
      return externalUrls(source.wikitext, MAX_EXTERNAL_LINKS);
    case "properties": {
      const props = pagePropsOf(source.wikitext);
      return Object.entries(props).map(([name, value]) => (v1 ? { name, "*": String(value) } : { name, value: String(value) }));
    }
    case "langlinks":
    case "iwlinks":
    case "parsewarnings":
      return [];
    case "templates":
    case "images":
      throw unavailable("prop", prop, DEFERRED_REASON);
  }
}

export async function runParse(rc: ApiContext): Promise<JsonObject> {
  const p = rc.params.scope("", "parse");
  const props = p.listOf("prop", PARSE_PROPS, DEFAULT_PROPS);
  const source = (await pageSource(rc, p)) ?? (await revisionSource(rc, p)) ?? textSource(rc, p);
  if (!source) throw missingOneOf(["page", "pageid", "oldid", "text"]);

  const parse: JsonObject = { title: source.title, pageid: source.pageId };
  for (const prop of props) parse[prop] = await propValue(rc, p, source, prop);
  return { parse };
}
