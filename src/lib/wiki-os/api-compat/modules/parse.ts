/**
 * parse.ts — `action=parse` (plan 410).
 *
 * `page=`/`pageid=` serves the page's stored rendering when it is fresh (no MediaWiki call);
 * `text=` renders the given wikitext through the private renderer, storing nothing (and `oldid=`
 * renders that revision's text the same way). The other props (links, categories, sections,
 * displaytitle, wikitext, revid, properties) are read from the wikitext or the stored page.
 */

import { ApiError, badValues, invalidTitle, missingOneOf, unavailable } from "../errors";
import { wrapText, type JsonObject, type JsonValue } from "../format";
import type { ApiParams } from "../params";
import type { ApiContext } from "../types";
import { DEFERRED_REASON } from "./deferred";
import { pagePropsOf } from "./query-prop";
import { LinkGraphService } from "~/lib/wiki-os/core/link-graph-service";
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

const MAX_TEXT_BYTES = 2_097_152;

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
  /** The page's id in the store, for its stored categories. */
  articleId: string | null;
}

async function pageSource(rc: ApiContext, p: ApiParams): Promise<Source | null> {
  const title = p.string("page");
  const pageId = p.optionalInteger("pageid", 1);
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
  if (p.flag("redirects") && row.isRedirect && row.redirectTitle) {
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
  };
}

async function revisionSource(rc: ApiContext, p: ApiParams): Promise<Source | null> {
  const oldId = p.optionalInteger("oldid", 1);
  if (oldId === undefined) return null;
  const [rev] = await rc.deps.store.revisionsById([oldId], true);
  if (!rev) throw new ApiError("nosuchrevid", `There is no revision with ID ${oldId}.`);
  if (rev.content === null) throw new ApiError("missingcontent", "The text of that revision is hidden.");
  return { title: rev.title, pageId: rev.pageId, revId: rev.revId, wikitext: rev.content, storedHtml: null, articleId: null };
}

function textSource(p: ApiParams): Source | null {
  const text = p.string("text");
  if (text === undefined) return null;
  const model = p.string("contentmodel", "wikitext");
  if (model !== "wikitext") throw badValues(p.fullName("contentmodel"), [model]);
  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
    throw new ApiError("toobig", "The text is larger than MediaWiki's page size limit (2 MB).");
  }
  const raw = p.string("title", "API");
  const canon = canonicalizeTitle(raw);
  if (!canon) throw invalidTitle(raw);
  return { title: canon.title, pageId: 0, revId: 0, wikitext: text, storedHtml: null, articleId: null };
}

// ---------------------------------------------------------------------------
// props
// ---------------------------------------------------------------------------

interface CategoryEntry {
  /** The category's name with underscores, as `action=parse` shows it. */
  name: string;
  sortKey: string;
}

/** `[[Category:Name|sortkey]]` links in the text (not `[[:Category:Name]]`, which is a plain link). */
function categoriesIn(wikitext: string): CategoryEntry[] {
  const found = new Map<string, CategoryEntry>();
  for (const match of wikitext.matchAll(/\[\[\s*Category\s*:\s*([^\]|]+?)\s*(?:\|([^\]]*))?\]\]/gi)) {
    const canon = canonicalizeTitle(`Category:${match[1]}`);
    if (canon && !found.has(canon.title)) {
      found.set(canon.title, { name: canon.base.replace(/ /g, "_"), sortKey: match[2]?.trim() ?? "" });
    }
  }
  return [...found.values()];
}

async function categoryEntries(rc: ApiContext, source: Source): Promise<CategoryEntry[]> {
  if (!source.articleId) return categoriesIn(source.wikitext);
  const { rows } = await rc.deps.store.categoriesOf({ articleIds: [source.articleId], dir: "ascending", limit: 5000 });
  return rows.map((row) => ({ name: row.title.slice("Category:".length).replace(/ /g, "_"), sortKey: row.sortKey ?? "" }));
}

function linkEntries(source: Source) {
  const links = LinkGraphService.extractLinks(source.wikitext, "", "ixwiki");
  return [...new Map(links.map((link) => [link.targetTitle, link])).values()];
}

/** The table of contents MediaWiki reports: nesting depth and `1.2` style numbers come from relative heading levels. */
function sectionEntries(source: Source): JsonObject[] {
  const stack: number[] = [];
  const counters: number[] = [];
  return sectionHeadings(source.wikitext).map((heading, index) => {
    while (stack.length > 0 && stack[stack.length - 1]! >= heading.level) {
      stack.pop();
      counters.length = stack.length + 1;
    }
    stack.push(heading.level);
    counters.length = stack.length;
    counters[stack.length - 1] = (counters[stack.length - 1] ?? 0) + 1;
    const line = heading.text.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/'{2,}/g, "");
    return {
      toclevel: stack.length,
      level: String(heading.level),
      line,
      number: counters.slice(0, stack.length).join("."),
      index: String(index + 1),
      fromtitle: source.title,
      byteoffset: Buffer.byteLength(source.wikitext.slice(0, heading.start), "utf8"),
      anchor: line.trim().replace(/ /g, "_"),
    };
  });
}

/** The `[[Target]]` URLs people paste (`http(s)://...`) in the text. */
function externalLinks(wikitext: string): string[] {
  return [...new Set(wikitext.match(/https?:\/\/[^\s<>[\]|"{}]+/g) ?? [])];
}

async function html(rc: ApiContext, source: Source): Promise<string> {
  return source.storedHtml ?? (await rc.deps.services.renderWikitext(source.wikitext, source.title));
}

async function propValue(rc: ApiContext, source: Source, prop: ParseProp): Promise<JsonValue> {
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
      return (await categoryEntries(rc, source)).map((c) => (v1 ? { sortkey: c.sortKey, "*": c.name } : { sortkey: c.sortKey, category: c.name, hidden: false }));
    case "links": {
      const links = linkEntries(source);
      const existing = new Set((await rc.deps.store.pagesByTitle(links.map((l) => l.targetTitle))).map((row) => row.title));
      return links.map((link) => {
        const ns = canonicalizeTitle(link.targetTitle)?.namespaceId ?? 0;
        const exists = existing.has(link.targetTitle);
        return v1 ? { ns, ...(exists ? { exists: true } : {}), "*": link.targetTitle } : { ns, exists, title: link.targetTitle };
      });
    }
    case "sections":
      return sectionEntries(source);
    case "externallinks":
      return externalLinks(source.wikitext);
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
  const sources = [await pageSource(rc, p), await revisionSource(rc, p), textSource(p)];
  const source = sources.find((candidate): candidate is Source => candidate !== null);
  if (!source) throw missingOneOf(["page", "pageid", "oldid", "text"]);
  const props = p.listOf("prop", PARSE_PROPS, DEFAULT_PROPS);

  const parse: JsonObject = { title: source.title, pageid: source.pageId };
  for (const prop of props) parse[prop] = await propValue(rc, source, prop);
  return { parse };
}
