/**
 * A country's wiki readers (the `countries.getWiki*` procedures): its intro, sections, section previews, images and
 * rich intro. A country that names its own page (`Country.wikiSource` + `wikiPageTitle`, as realm nations do) is
 * read on that wiki only; a country of another wiki that names no page is read under its name on that wiki; a bare
 * name (no country) is looked up on IxWiki and then on iiwiki. So an Eurth nation never reads IxWiki, even when an
 * IxWiki article has its name.
 */
import type { PrismaClient } from "@prisma/client";
import {
  getArticleIntro,
  getPageSections,
  getPageImages as wikiBridgePageImages,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { parseRedirect } from "~/lib/wiki-os/core/redirect";
import { parseWikiSource, wikiReaderPath, type WikiSource } from "~/lib/wiki-os/config";

/** Common icon/template image filenames to exclude from media galleries. */
const EXCLUDED_IMAGE_PATTERNS = [
  /^File:Flag.icon/i,
  /^File:Crystal/i,
  /^File:Nuvola/i,
  /^File:Commons-logo/i,
  /^File:Wikisource-logo/i,
  /^File:Wiktionary-logo/i,
  /^File:Symbol /i,
  /^File:Yes ?check/i,
  /^File:X ?mark/i,
  /^File:Increase/i,
  /^File:Decrease/i,
  /^File:Steady/i,
  /^File:Green ?arrow/i,
  /^File:Red ?arrow/i,
  /\.svg$/i,
];

/** Text before the first heading, after dropping a leading infobox template (balanced braces). */
function leadSection(wikitext: string, infoboxPattern: RegExp): string {
  let content = wikitext;
  const infoboxMatch = wikitext.match(infoboxPattern);
  if (infoboxMatch) {
    const startIdx = wikitext.indexOf(infoboxMatch[0]);
    let depth = 0;
    let i = startIdx;
    while (i < wikitext.length - 1) {
      if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
        depth++;
        i += 2;
      } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
        depth--;
        i += 2;
        if (depth === 0) break;
      } else {
        i++;
      }
    }
    content = wikitext.substring(i).trim();
  }
  return content.split(/^==/m)[0] || content;
}

/** Strip templates, refs, comments, tables, categories, files and magic words from wikitext. */
function stripCommonWikiMarkup(text: string): string {
  return text
    .replace(/\{\{wp\|[^|}]+\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{wp\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{lang\|[^|]+\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{nowrap\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{convert[^}]*\}\}/gi, "")
    .replace(/\{\{[^}]+\|([^|}]+)\}\}/g, "$1")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\[\[Template:[^\]]*\]\]/gi, "")
    .replace(/\[\[Category:[^\]]*\]\]/gi, "")
    .replace(/\[\[File:[^\]]*\]\]/gi, "")
    .replace(/\[\[Image:[^\]]*\]\]/gi, "")
    .replace(/\[\[[a-z]{2,3}:[^\]]*\]\]/gi, "")
    .replace(/<ref[^>]*>.*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<!--.*?-->/gs, "")
    .replace(/\{\|.*?\|\}/gs, "")
    .replace(/__[A-Z_]+__/g, "");
}

/**
 * Extract the first paragraph (intro) from wikitext after the infobox.
 * Returns clean plaintext.
 */
export function extractWikiIntro(wikitext: string): string | null {
  const beforeFirstHeading = leadSection(wikitext, /\{\{\s*[Ii]nfobox\s/);

  // Clean wikitext to plaintext
  const cleaned = stripCommonWikiMarkup(beforeFirstHeading)
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'{2,3}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&\w+;/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Return first substantial paragraph
  if (cleaned.length > 30) {
    return cleaned.slice(0, 500) + (cleaned.length > 500 ? "..." : "");
  }
  return null;
}

/** The wikis a country's name is looked up on when it names no page of its own, in order. */
const NAME_LOOKUP_WIKIS = ["ixwiki", "iiwiki"] as const;

/** A country's own wiki page: realm nations name theirs (`Country.wikiSource` + `wikiPageTitle`). */
export interface WikiPageRef {
  title: string;
  wiki: WikiSource;
}

/**
 * A country row's own page: the page it names, or its name on its own wiki when that is another wiki (an Eurth
 * nation on iiwiki). Undefined for an IxWiki country that names none (its name is looked up as before).
 */
function ownPage(row: {
  name: string;
  wikiSource: string | null;
  wikiPageTitle: string | null;
}): WikiPageRef | undefined {
  const wiki = parseWikiSource(row.wikiSource);
  const title = row.wikiPageTitle?.trim();
  if (title) return { title, wiki };
  return wiki === "ixwiki" ? undefined : { title: row.name, wiki };
}

/** The wiki pages of the given countries that have one, by country id. */
export async function countryWikiPages(
  db: Pick<PrismaClient, "country">,
  countryIds: string[]
): Promise<Map<string, WikiPageRef>> {
  if (countryIds.length === 0) return new Map();
  const rows = await db.country.findMany({
    where: { id: { in: countryIds } },
    select: { id: true, name: true, wikiSource: true, wikiPageTitle: true },
  });
  return new Map(
    rows.flatMap((row): Array<[string, WikiPageRef]> => {
      const page = ownPage(row);
      return page ? [[row.id, page]] : [];
    })
  );
}

/** The page of one country, when `countryId` names a country that has one. */
export async function countryWikiPage(
  db: Pick<PrismaClient, "country">,
  countryId: string | undefined
): Promise<WikiPageRef | undefined> {
  if (!countryId) return undefined;
  return (await countryWikiPages(db, [countryId])).get(countryId);
}

/** The pages read for `name`: the country's own page, or the name on each lookup wiki in order. */
function pageCandidates(name: string, page: WikiPageRef | undefined): WikiPageRef[] {
  return page ? [page] : NAME_LOOKUP_WIKIS.map((wiki) => ({ title: name, wiki }));
}

/** The first candidate page `read` finds something on, with that page; a read that throws is logged and skipped. */
async function firstFound<T>(
  candidates: WikiPageRef[],
  what: string,
  read: (page: WikiPageRef) => Promise<T | null>
): Promise<{ value: T; page: WikiPageRef } | null> {
  for (const page of candidates) {
    try {
      const value = await read(page);
      if (value !== null) return { value, page };
    } catch (err) {
      console.error(`[Wiki] Error fetching ${what} for ${page.title} from ${page.wiki}:`, err);
    }
  }
  return null;
}

/** A country's wiki intro (plain text, 400 characters) and the page it came from. */
export async function fetchWikiIntro(
  name: string,
  page: WikiPageRef | undefined
): Promise<{ extract: string; wikiSource: WikiSource; wikiUrl: string } | null> {
  const found = await firstFound(pageCandidates(name, page), "intro", async ({ title, wiki }) => {
    const result = await getArticleIntro(title, wiki);
    return result?.text ? result : null;
  });
  if (!found) return null;
  return {
    extract: found.value.text.substring(0, 400),
    wikiSource: found.page.wiki,
    wikiUrl: wikiReaderPath(found.value.title, found.page.wiki),
  };
}

interface WikiSectionEntry {
  level: number;
  line: string;
  number: string;
  anchor: string;
}

/** Table-of-contents sections of a country's wiki page, and the page they came from. */
async function findWikiSections(
  name: string,
  page: WikiPageRef | undefined
): Promise<{ value: WikiSectionEntry[]; page: WikiPageRef } | null> {
  return firstFound(pageCandidates(name, page), "sections", async ({ title, wiki }) => {
    const sections = await getPageSections(title, wiki);
    if (!sections || sections.length === 0) return null;
    return sections.map((s, i) => ({
      level: s.level,
      line: s.title,
      number: String(i + 1),
      anchor: s.title.replace(/\s+/g, "_"),
    }));
  });
}

/** Fetch table-of-contents sections from a country's wiki page. */
export async function fetchWikiSections(
  name: string,
  page: WikiPageRef | undefined
): Promise<WikiSectionEntry[] | null> {
  return (await findWikiSections(name, page))?.value ?? null;
}

/**
 * Fetch images from a country's wiki page with thumbnail URLs: a page's images are looked up on the wiki the page
 * belongs to, as its intro and sections are.
 */
export async function fetchWikiPageImages(
  name: string,
  page: WikiPageRef | undefined
): Promise<Array<{
  title: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}> | null> {
  const found = await firstFound(
    pageCandidates(name, page),
    "page images",
    async ({ title, wiki }) => {
      const images = await wikiBridgePageImages(title, {
        excludePatterns: EXCLUDED_IMAGE_PATTERNS,
        wiki,
      });
      return images && images.length > 0 ? images : null;
    }
  );
  return found?.value ?? null;
}

/** A page's wikitext and the title it was read under, following one redirect to the page it names. */
async function readArticle(
  title: string,
  wiki: WikiSource
): Promise<{ title: string; wikitext: string } | null> {
  const article = await getArticleWikitextShadow(title, wiki);
  const target = parseRedirect(article?.wikitext);
  if (!target) return article ? { title, wikitext: article.wikitext } : null;
  const resolved = await getArticleWikitextShadow(target.title, wiki);
  return resolved ? { title: target.title, wikitext: resolved.wikitext } : null;
}

/** The lead's paragraphs as HTML; its wiki links open `wiki`'s pages in the reader. */
function richIntroParagraphs(wikitext: string, wiki: WikiSource): string[] {
  const beforeFirstHeading = leadSection(wikitext, /\{\{\s*Infobox/i);

  // Clean wikitext templates, refs, categories, files
  const cleanContent = stripCommonWikiMarkup(beforeFirstHeading)
    .replace(/\n\n+/g, "|||PARA|||")
    .replace(/[ \t]+/g, " ")
    .replace(/\n/g, " ")
    .trim();

  // Convert wiki links to HTML
  const linkBase = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "";
  const processedContent = cleanContent
    .replace(/\[\[([^[\]|]+)\|([^[\]]+?)\]\]/g, (_, pg: string, display: string) => {
      if (pg.toLowerCase().includes("template:")) return "";
      return `<a href="${linkBase}${wikiReaderPath(pg, wiki)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${display}</a>`;
    })
    .replace(/\[\[([^[\]]+?)\]\]/g, (_, pg: string) => {
      if (pg.toLowerCase().includes("template:")) return "";
      return `<a href="${linkBase}${wikiReaderPath(pg, wiki)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${pg}</a>`;
    })
    .replace(
      /\[([^\s\]]+)\s+([^\]]+)\]/g,
      '<a href="$1" class="external-link text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 underline" target="_blank">$2</a>'
    )
    .replace(/'''([^']*)'''/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/''([^']*)''/g, '<em class="italic text-muted-foreground">$1</em>');

  // Split into paragraphs, filter short/empty
  return processedContent
    .split("|||PARA|||")
    .map((p) => p.trim())
    .filter((p) => p.length > 50)
    .slice(0, 5);
}

/**
 * Fetch raw wikitext intro, clean it, and convert wiki markup to HTML paragraphs. A country's own page is
 * read on its own wiki; without one, its name is looked up on IxWiki and then on iiwiki.
 */
export async function fetchWikiRichIntro(
  name: string,
  page: WikiPageRef | undefined
): Promise<{ paragraphs: string[]; wikiUrl: string } | null> {
  const found = await firstFound(
    pageCandidates(name, page),
    "rich intro",
    async ({ title, wiki }) => {
      const article = await readArticle(title, wiki);
      if (!article) return null;
      const paragraphs = richIntroParagraphs(article.wikitext, wiki);
      return paragraphs.length > 0
        ? { paragraphs, wikiUrl: wikiReaderPath(article.title, wiki) }
        : null;
    }
  );
  return found?.value ?? null;
}

/** A level-2 section's opening text as a plain-text preview of up to 200 characters, or undefined. */
function sectionPreview(
  wikitext: string,
  headings: Array<{ title: string; start: number }>,
  line: string
): string | undefined {
  const hIdx = headings.findIndex((h) => h.title === line);
  if (hIdx < 0) return undefined;

  const start = headings[hIdx]!.start;
  const end = hIdx + 1 < headings.length ? headings[hIdx + 1]!.start - 10 : start + 1000;
  const cleaned = wikitext
    .substring(start, Math.min(end, start + 1000))
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<ref[^>]*>.*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^==+[^=]+=+\s*/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 20) return undefined;
  return cleaned.slice(0, 200) + (cleaned.length > 200 ? "..." : "");
}

/**
 * Fetch wiki sections with plain-text previews for level-2 headers, from the page the sections came from.
 */
export async function fetchWikiSectionPreviews(
  name: string,
  page: WikiPageRef | undefined
): Promise<Array<WikiSectionEntry & { preview?: string }> | null> {
  const found = await findWikiSections(name, page);
  if (!found) return null;
  const results = found.value.map((s) => ({ ...s, preview: undefined as string | undefined }));

  try {
    const article = await getArticleWikitextShadow(found.page.title, found.page.wiki);
    if (!article) return results;

    const wikitext = article.wikitext;
    const headingPattern = /^(={2,6})\s*(.+?)\s*\1$/gm;
    const headings: Array<{ title: string; start: number }> = [];
    let m;
    while ((m = headingPattern.exec(wikitext)) !== null) {
      headings.push({ title: m[2]!.trim(), start: m.index + m[0].length });
    }

    const level2 = results.filter((s) => s.level === 2).slice(0, 10);
    for (const section of level2) {
      section.preview = sectionPreview(wikitext, headings, section.line);
    }
    return results;
  } catch (err) {
    console.error(`[Wiki] Error fetching section previews for ${name}:`, err);
    return results;
  }
}
