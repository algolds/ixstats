/**
 * lore-card-ixwiki.ts — IxWiki as the lore-card generator's source of article data (plan 418).
 *
 * Every read is Postgres's: the page text and revision ledger (`wiki_articles`, `wiki_revisions`), the
 * render-derived links, categories and images (`wiki_links`, `wiki_category_members`,
 * `wiki_image_links`) and the file URLs (`wiki_assets`). MediaWiki is never asked, and a deleted page
 * (status ARCHIVED) is never read: every query names the published pages.
 *
 * The generator's scores are computed from the same facts as before (the page's text, its categories,
 * its backlinks), so a card's rarity does not move; only the plain-text excerpts are cleaned from the
 * wikitext instead of MediaWiki's rendered text.
 */

import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { CategoryService, type MemberKind } from "~/lib/wiki-os/core/category-service";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { isAnonymousAuthor } from "~/lib/wiki-os/core/anonymous-author";
import { extractLeadImageFileName, getImagePath } from "~/lib/wiki-os/transformers/image-url";
import { cleanWikitextExcerpt } from "~/lib/wiki-os/transformers/wikitext-parser";
import type { CardAuthorInfo } from "~/types/cards-display";
import {
  buildCardAuthorInfo,
  type EarlyRevision,
  type NamedContributor,
} from "./lore-card-author-info";

/** Categories a card's page is scored on, and files looked at for a fallback image. */
const MAX_CATEGORIES = 50;
const MAX_IMAGE_FILES = 10;
/** Inbound links counted: the wiki's own lookup stopped at 500, and the score caps well before that. */
const MAX_BACKLINKS = 500;
/** How many of a page's earliest revisions credit its creator. */
const EARLY_REVISIONS = 5;
/** The start of a page's wikitext read for a preview: the lead image and the intro are in it. */
const PREVIEW_HEAD_CHARS = 20_000;
/** A preview's plain-text extract. */
const PREVIEW_EXTRACT_CHARS = 1_000;
/** The extract the full card is built from. */
const CARD_EXTRACT_CHARS = 2_000;
/** Random candidates read per card wanted, when only those with an image count. */
const IMAGE_POOL_FACTOR = 3;
const MAX_IMAGE_POOL = 50;

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * The public URL of each file (names as the wiki spells them, no "File:"): the one WikiOS holds for
 * the asset, else the one its name gives (the wiki's files are stored under their MD5 shard).
 */
export async function ixwikiImageUrls(fileNames: readonly string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (fileNames.length === 0) return urls;

  const assets = await MediaAssetService.findAssets([...fileNames]);
  const base = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");
  for (const name of fileNames) {
    const key = name.replace(/ /g, "_");
    const asset = assets.get(key) ?? assets.get(key.toLowerCase());
    urls.set(name, asset?.url ?? `${base}${getImagePath(name)}`);
  }
  return urls;
}

/** The first file of a page's list that is a picture and not an icon, flag or logo, or undefined. */
function firstIllustration(fileNames: readonly string[]): string | undefined {
  return fileNames.find((name) => {
    const lower = name.toLowerCase();
    return (
      !lower.includes("icon") &&
      !lower.includes("flag") &&
      !lower.includes("logo") &&
      /\.(?:jpe?g|png|svg)$/.test(lower)
    );
  });
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

interface AuthorFacts {
  earliest: EarlyRevision[];
  contributors: NamedContributor[];
}

interface EarlyRow {
  articleId: string;
  author: string | null;
  createdAt: Date;
  userDeleted: boolean;
}

/** For each article: its earliest live revisions and its named contributors, most edits first. */
async function loadAuthorFacts(articleIds: readonly string[]): Promise<Map<string, AuthorFacts>> {
  const facts = new Map<string, AuthorFacts>();
  if (articleIds.length === 0) return facts;
  for (const id of articleIds) facts.set(id, { earliest: [], contributors: [] });

  const [early, groups] = await Promise.all([
    db.$queryRaw<EarlyRow[]>`
      SELECT "articleId", "author", "createdAt", "userDeleted" FROM (
        SELECT r."articleId", r."author", r."createdAt", r."userDeleted",
               row_number() OVER (
                 PARTITION BY r."articleId" ORDER BY r."createdAt" ASC, r."id" ASC
               ) AS "rank"
        FROM wiki_revisions r
        WHERE r."articleId" IN (${Prisma.join([...articleIds])}) AND r."parked" = false
      ) ranked
      WHERE "rank" <= ${EARLY_REVISIONS}
      ORDER BY "articleId", "rank"`,
    db.wikiRevision.groupBy({
      by: ["articleId", "author", "userDeleted"],
      where: { articleId: { in: [...articleIds] }, parked: false },
      _count: { _all: true },
    }),
  ]);

  for (const row of early) {
    // A hidden user is no one's creator: MediaWiki's revision list carries no user for the revision.
    facts.get(row.articleId)?.earliest.push({
      author: row.userDeleted ? null : row.author,
      createdAt: row.createdAt,
    });
  }
  for (const group of groups) {
    // Neither are anonymous (IP) editors or hidden users credited by name: MediaWiki's contributor list leaves
    // them out.
    if (group.author && !group.userDeleted && !isAnonymousAuthor(group.author)) {
      facts.get(group.articleId)?.contributors.push({ name: group.author, edits: group._count._all });
    }
  }
  for (const entry of facts.values()) {
    entry.contributors.sort((a, b) => b.edits - a.edits || a.name.localeCompare(b.name));
  }
  return facts;
}

/**
 * The credit of each published page among `titles`, under every spelling a caller may ask it by
 * (the title as given, canonical, lower-cased, with spaces or underscores).
 */
export async function ixwikiAuthorInfo(titles: readonly string[]): Promise<Map<string, CardAuthorInfo>> {
  const result = new Map<string, CardAuthorInfo>();
  const byCanonical = canonicalTitles(titles);
  if (byCanonical.size === 0) return result;

  const articles = await db.wikiArticle.findMany({
    where: { source: "ixwiki", status: "PUBLISHED", title: { in: [...byCanonical.keys()] } },
    select: { id: true, title: true },
    take: byCanonical.size,
  });
  const facts = await loadAuthorFacts(articles.map((article) => article.id));
  for (const article of articles) {
    const entry = facts.get(article.id);
    if (!entry) continue;
    const info = buildCardAuthorInfo(entry.earliest, entry.contributors);
    const spellings = [article.title, ...(byCanonical.get(article.title) ?? [])];
    for (const spelling of spellings) {
      for (const key of [
        spelling,
        spelling.toLowerCase(),
        spelling.replace(/_/g, " ").trim().toLowerCase(),
        spelling.replace(/ /g, "_").trim().toLowerCase(),
      ]) {
        result.set(key, info);
      }
    }
  }
  return result;
}

/** The canonical title of each given title (those that can be titles), with the spellings it came by. */
function canonicalTitles(titles: readonly string[]): Map<string, string[]> {
  const byCanonical = new Map<string, string[]>();
  for (const raw of titles) {
    const canon = canonicalizeTitle(raw, { source: "ixwiki" })?.title;
    if (!canon) continue;
    byCanonical.set(canon, [...(byCanonical.get(canon) ?? []), raw]);
  }
  return byCanonical;
}

// ---------------------------------------------------------------------------
// One article, in full
// ---------------------------------------------------------------------------

/** What a full card is made from, as Postgres holds it. */
export interface IxwikiArticle {
  title: string;
  wikitext: string;
  /** The page's plain text, to read an excerpt from. */
  extract: string;
  /** Titles with their "Category:" prefix, at most 50. */
  categories: Array<{ title: string }>;
  /** Titles with their "File:" prefix, at most 10. */
  images: Array<{ title: string }>;
  /** The URL of the page's lead picture, or of the first illustration it uses; undefined when none. */
  image: string | undefined;
  /** Pages that link here, counted up to 500. */
  inboundLinks: number;
  lastModified: Date;
  authorInfo: CardAuthorInfo;
}

/** The published page `title`, or null when it does not exist or has been deleted. */
export async function loadIxwikiArticle(title: string): Promise<IxwikiArticle | null> {
  const canon = canonicalizeTitle(title, { source: "ixwiki" });
  if (!canon) return null;
  const article = await db.wikiArticle.findFirst({
    where: { source: "ixwiki", title: canon.title, status: "PUBLISHED" },
    select: { id: true, title: true, wikitext: true, updatedAt: true },
  });
  if (!article) return null;

  const [categories, imageLinks, inboundLinks, newest, facts] = await Promise.all([
    db.wikiCategoryMember.findMany({
      where: { articleId: article.id },
      orderBy: { category: { name: "asc" } },
      take: MAX_CATEGORIES,
      select: { category: { select: { name: true } } },
    }),
    db.wikiImageLink.findMany({
      where: { articleId: article.id },
      orderBy: { fileName: "asc" },
      take: MAX_IMAGE_FILES,
      select: { fileName: true },
    }),
    db.wikiLink.count({
      where: {
        targetSlug: toArticleSlug(article.title),
        sourceArticle: { source: "ixwiki", status: "PUBLISHED" },
      },
    }),
    db.wikiRevision.findFirst({
      where: { articleId: article.id, parked: false },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    loadAuthorFacts([article.id]),
  ]);

  const files = imageLinks.map((link) => link.fileName);
  const leadFile = extractLeadImageFileName(article.wikitext) ?? firstIllustration(files);
  const urls = await ixwikiImageUrls(leadFile ? [leadFile] : []);
  const entry = facts.get(article.id) ?? { earliest: [], contributors: [] };

  return {
    title: article.title,
    wikitext: article.wikitext,
    extract: cleanWikitextExcerpt(article.wikitext, CARD_EXTRACT_CHARS),
    categories: categories.map((member) => ({ title: `Category:${member.category.name}` })),
    images: files.map((name) => ({ title: `File:${name}` })),
    image: leadFile ? urls.get(leadFile) : undefined,
    inboundLinks: Math.min(inboundLinks, MAX_BACKLINKS),
    lastModified: newest?.createdAt ?? article.updatedAt,
    authorInfo: buildCardAuthorInfo(entry.earliest, entry.contributors),
  };
}

// ---------------------------------------------------------------------------
// Previews of many articles
// ---------------------------------------------------------------------------

/** The cheap facts of a page a discovery preview is scored on. */
export interface IxwikiPreviewPage {
  title: string;
  /** The wikitext's size in bytes. */
  length: number;
  extract: string;
  categories: Array<{ title: string }>;
  /** The lead picture's URL, or null. */
  imageUrl: string | null;
}

/**
 * The names of the categories of each article, alphabetical, at most 50 per article. One query ranks each
 * article's categories itself: a Prisma `findMany` over many articles is cut to 1000 rows by the client's
 * guard, which drops the categories of every article past the first few hundred members.
 */
async function loadCategoryNames(articleIds: readonly string[]): Promise<Map<string, string[]>> {
  const names = new Map<string, string[]>();
  const rows = await db.$queryRaw<Array<{ articleId: string; name: string }>>`
    SELECT "articleId", "name" FROM (
      SELECT m."articleId" AS "articleId", c."name" AS "name",
             row_number() OVER (PARTITION BY m."articleId" ORDER BY c."name") AS "rank"
      FROM wiki_category_members m
      JOIN wiki_categories c ON c."id" = m."categoryId"
      WHERE m."articleId" IN (${Prisma.join([...articleIds])})
    ) ranked
    WHERE "rank" <= ${MAX_CATEGORIES}
    ORDER BY "articleId", "rank"`;
  for (const row of rows) names.set(row.articleId, [...(names.get(row.articleId) ?? []), row.name]);
  return names;
}

interface HeadRow {
  id: string;
  title: string;
  length: number;
  head: string;
}

/**
 * Previews of the published pages among `titles`, in the order asked. Reads only the start of each
 * page's text (its lead picture and intro), whatever the page's size.
 */
export async function loadIxwikiPreviews(titles: readonly string[]): Promise<IxwikiPreviewPage[]> {
  const asked = [...canonicalTitles(titles).keys()];
  if (asked.length === 0) return [];

  const rows = await db.$queryRaw<HeadRow[]>`
    SELECT a."id" AS "id", a."title" AS "title", octet_length(a."wikitext") AS "length",
           left(a."wikitext", ${PREVIEW_HEAD_CHARS}::int) AS "head"
    FROM wiki_articles a
    WHERE a."source" = 'ixwiki' AND a."status" = 'PUBLISHED'
      AND a."title" IN (${Prisma.join(asked)})`;
  if (rows.length === 0) return [];

  const members = await loadCategoryNames(rows.map((row) => row.id));
  const leadFiles = new Map(rows.map((row) => [row.id, extractLeadImageFileName(row.head)]));
  const urls = await ixwikiImageUrls([...new Set([...leadFiles.values()].flatMap((f) => f ?? []))]);

  const order = new Map(asked.map((title, index) => [title, index]));
  return rows
    .sort((a, b) => (order.get(a.title) ?? 0) - (order.get(b.title) ?? 0))
    .map((row) => {
      const lead = leadFiles.get(row.id);
      return {
        title: row.title,
        length: Number(row.length),
        extract: cleanWikitextExcerpt(row.head, PREVIEW_EXTRACT_CHARS),
        categories: (members.get(row.id) ?? []).map((name) => ({ title: `Category:${name}` })),
        imageUrl: lead ? (urls.get(lead) ?? null) : null,
      };
    });
}

// ---------------------------------------------------------------------------
// Lists of titles
// ---------------------------------------------------------------------------

/** The titles of the published members of a category: its pages and/or its files, in category order. */
export function ixwikiCategoryTitles(
  category: string,
  kinds: readonly Extract<MemberKind, "page" | "file">[],
  limit: number
): Promise<string[]> {
  return CategoryService.getMemberTitles(category, kinds, limit);
}

/** The published main-namespace pages that are not redirects, by title. */
export async function ixwikiMainNamespaceTitles(limit: number): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ title: string }>>`
    SELECT a."title" AS "title"
    FROM wiki_articles a
    WHERE a."source" = 'ixwiki' AND a."status" = 'PUBLISHED' AND a."namespace" = 0
      AND a."redirectTargetSlug" IS NULL
    ORDER BY a."title"
    LIMIT ${limit}`;
  return rows.map((row) => row.title);
}

/**
 * `count` random published main-namespace pages that are not redirects. With `withImage`, only pages
 * whose text names a lead picture count (a few times `count` are looked at to find enough).
 */
export async function ixwikiRandomTitles(
  count: number,
  { withImage }: { withImage: boolean }
): Promise<string[]> {
  const pool = withImage ? Math.min(count * IMAGE_POOL_FACTOR, MAX_IMAGE_POOL) : count;
  // The random pick is made on ids alone, then joined back for the start of the text: `left()` on every
  // page before the sort took over a second on 6,000 pages. The outer ORDER BY keeps the pick's random order.
  const rows = await db.$queryRaw<Array<{ title: string; head: string }>>`
    SELECT a."title" AS "title",
           ${withImage ? Prisma.sql`left(a."wikitext", ${PREVIEW_HEAD_CHARS}::int)` : Prisma.sql`''`} AS "head"
    FROM (
      SELECT p."id" AS "id", random() AS "r"
      FROM wiki_articles p
      WHERE p."source" = 'ixwiki' AND p."status" = 'PUBLISHED' AND p."namespace" = 0
        AND p."redirectTargetSlug" IS NULL
      ORDER BY "r"
      LIMIT ${pool}
    ) picked
    JOIN wiki_articles a ON a."id" = picked."id"
    ORDER BY picked."r"`;
  const picked = withImage ? rows.filter((row) => extractLeadImageFileName(row.head)) : rows;
  return picked.slice(0, count).map((row) => row.title);
}
