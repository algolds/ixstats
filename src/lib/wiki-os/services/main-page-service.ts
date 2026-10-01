/**
 * main-page-service.ts — everything the Main Page shows, in one answer.
 *
 * The featured article is read out of the Main Page's own stored view, the almanac is a daily pick
 * from a category (its lead and picture read from that article's stored view), recent changes are a
 * slim select (no wikitext), the numbers are counted from the database. A count or part that cannot
 * be had is null (or empty) and the page hides it: nothing here is a made-up figure.
 *
 * ponytail: the shared part is kept 60 s per process, single-flight. The prompt is picked at random
 * per request from a list kept just as long, so each visitor still gets their own.
 */

import { db } from "~/server/db";
import { getRecentChanges, getSiteStats } from "../adapters/mediawiki/bridge";
import { CategoryService } from "../core/category-service";
import { extractFeaturedArticle, featuredArticleDetails } from "../main-page/featured-article";
import { extractLeadImageFromHtml } from "../transformers/image-url";
import { parseInertOnServer } from "../transformers/server-dom";
import { getArticleView } from "./article-view-service";

const MAIN_PAGE_TITLE = "Main Page";
const ALMANAC_CATEGORY = "Bureau of International Statistics";
const RECENT_CHANGES_SHOWN = 6;
const CACHE_TTL_MS = 60_000;

/** The topic tiles of the page (name and accent colour; the page links each to its category). */
export const MAIN_PAGE_CATEGORIES = [
  { name: "Countries", color: "#3b82f6" },
  { name: "Companies", color: "#f97316" },
  { name: "Culture", color: "#a855f7" },
  { name: "Economy", color: "#22c55e" },
  { name: "Geography", color: "#14b8a6" },
  { name: "Government", color: "#6366f1" },
  { name: "History", color: "#eab308" },
  { name: "Military", color: "#ef4444" },
  { name: "Nature", color: "#10b981" },
  { name: "People", color: "#ec4899" },
  { name: "Politics", color: "#8b5cf6" },
  { name: "Technology", color: "#06b6d4" },
] as const;

export interface MainPageFeatured {
  title: string;
  /** The title as a /wiki/ path segment. */
  slug: string;
  excerpt: string;
  image: string | null;
}

export interface MainPageAlmanac {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  thumbnail: string | null;
}

export interface MainPageChange {
  title: string;
  user: string;
  timestamp: string;
  comment: string;
  oldLen: number;
  newLen: number;
  blurb: string | null;
  thumbnail: string | null;
}

export interface MainPageStats {
  articles: number | null;
  edits: number | null;
  users: number | null;
  images: number | null;
  activeUsers: number | null;
}

export interface MainPagePrompt {
  id: string;
  title: string;
  question: string;
  slug: string;
  featured: boolean;
  _count: { responses: number };
}

export interface MainPageData {
  featured: MainPageFeatured | null;
  almanac: MainPageAlmanac | null;
  recentChanges: MainPageChange[];
  stats: MainPageStats;
  categories: ReadonlyArray<{ readonly name: string; readonly color: string }>;
  prompt: MainPagePrompt | null;
}

/** A view of an article for the server's own use: no viewer, no import from MediaWiki. */
const readView = (title: string) => getArticleView(title, async () => null, undefined, "none");

// ─── Parts ────────────────────────────────────────────────────────

async function readFeatured(): Promise<MainPageFeatured | null> {
  const view = await readView(MAIN_PAGE_TITLE);
  const card = view && extractFeaturedArticle(view.contentHtml, parseInertOnServer);
  if (!card) return null;
  const { title, slug, excerpt, image } = featuredArticleDetails(card);
  return { title, slug, excerpt, image };
}

/** Pages of other namespaces in the category (subcategories, templates...) are not almanac entries. */
const isAlmanacEntry = (title: string): boolean =>
  !/^(Category|Template|User|MediaWiki):/.test(title);

/** A stable pick for the UTC calendar day of `now`: the same article all day, a new one tomorrow. */
function dailyIndex(now: Date, size: number): number {
  const key = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % size;
}

/** The lead paragraph of article HTML as plain text, skipping empty and infobox paragraphs. */
function leadParagraph(html: string): string {
  const lead = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? []).find(
    (p) => p.length > 25 && !/infobox|mw-empty-elt/i.test(p)
  );
  return (lead ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function readAlmanac(now: Date): Promise<MainPageAlmanac | null> {
  const { articles } = await CategoryService.getCategoryDetails(ALMANAC_CATEGORY);
  const pool = articles
    .map((a) => a.title)
    .filter(isAlmanacEntry)
    .sort();
  const title = pool[dailyIndex(now, Math.max(1, pool.length))];
  if (!title) return null;

  const view = await readView(title);
  if (!view) return null;
  // the infobox is stored apart from the body, and its picture is the one to show
  const html = `${view.infoboxHtml ?? ""}${view.contentHtml}`;
  return {
    title,
    slug: encodeURIComponent(title.replace(/ /g, "_")),
    category: ALMANAC_CATEGORY,
    excerpt: leadParagraph(view.contentHtml),
    thumbnail: extractLeadImageFromHtml(html),
  };
}

async function readRecentChanges(): Promise<MainPageChange[]> {
  // The edits that went live: a parked one (a conflicting MediaWiki edit) was never the page's text
  const changes = await getRecentChanges(RECENT_CHANGES_SHOWN, { includeParked: false });
  return changes.map((c) => ({
    title: c.title,
    user: c.user,
    timestamp: c.timestamp,
    comment: c.comment,
    oldLen: c.oldLen,
    newLen: c.newLen,
    blurb: c.blurb ?? null,
    thumbnail: c.thumbnail ?? null,
  }));
}

/** A part that failed is left out (null or empty): the page shows the rest. */
async function orElse<T>(part: Promise<T>, fallback: T, name: string): Promise<T> {
  try {
    return await part;
  } catch (error) {
    console.warn(`[WikiOS:main-page] ${name} failed`, error);
    return fallback;
  }
}

type SharedPart = Omit<MainPageData, "prompt">;

async function buildShared(): Promise<SharedPart> {
  const [featured, almanac, recentChanges, stats] = await Promise.all([
    orElse(readFeatured(), null, "featured article"),
    orElse(readAlmanac(new Date()), null, "almanac"),
    orElse(readRecentChanges(), [], "recent changes"),
    orElse(
      getSiteStats().then(({ articles, edits, users, images, activeUsers }) => ({
        articles,
        edits,
        users,
        images,
        activeUsers,
      })),
      { articles: null, edits: null, users: null, images: null, activeUsers: null },
      "statistics"
    ),
  ]);
  return { featured, almanac, recentChanges, stats, categories: MAIN_PAGE_CATEGORIES };
}

let shared: { expires: number; value: Promise<SharedPart> } | null = null;

/** The part of the page every visitor gets, built at most once a minute (and once at a time). */
function loadShared(): Promise<SharedPart> {
  const now = Date.now();
  if (shared && shared.expires > now) return shared.value;
  const value = buildShared();
  const entry = { expires: now + CACHE_TTL_MS, value };
  shared = entry;
  value.catch(() => {
    if (shared === entry) shared = null; // a failed build is not kept
  });
  return value;
}

// ─── Prompt ───────────────────────────────────────────────────────

let prompts: { expires: number; value: Promise<MainPagePrompt[]> } | null = null;

function loadPrompts(): Promise<MainPagePrompt[]> {
  const now = Date.now();
  if (prompts && prompts.expires > now) return prompts.value;
  const value = (async () =>
    db.blurbPrompt.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        question: true,
        slug: true,
        featured: true,
        _count: { select: { responses: true } },
      },
    }))();
  const entry = { expires: now + CACHE_TTL_MS, value };
  prompts = entry;
  value.catch(() => {
    if (prompts === entry) prompts = null;
  });
  return value;
}

/** A featured prompt half the time when there is one, else any: the homepage's long-standing rule. */
function pickPrompt(active: readonly MainPagePrompt[]): MainPagePrompt | null {
  if (active.length === 0) return null;
  const featured = active.filter((p) => p.featured);
  const pool = featured.length > 0 && Math.random() < 0.5 ? featured : active;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/** The Main Page's data: the shared part from the minute's cache, and a prompt of this visitor's own. */
export async function getMainPageData(): Promise<MainPageData> {
  const [part, active] = await Promise.all([
    loadShared(),
    orElse(loadPrompts(), [], "blurb prompts"),
  ]);
  return { ...part, prompt: pickPrompt(active) };
}
