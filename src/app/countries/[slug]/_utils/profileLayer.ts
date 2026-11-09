/**
 * Country profile layer — pure helpers behind the country profile (`/countries/[slug]`).
 *
 * No React, no tRPC, no server imports: everything here turns router output into the one
 * cohesive model the profile renders (`useCountryProfileLayer` wires the queries). The two
 * rules that matter most live here so they can be unit tested:
 *
 * - **Public record only.** Visitors see enacted directives (`active`/`completed`) and resolved
 *   issues (`responded`/`auto_resolved`). The server enforces it (`countries.getPublicRecord`);
 *   the filters are shared from `~/lib/country/public-record` and re-exported here.
 * - **One chronicle.** Wiki founding dates, map story pins, directives, decisions and diplomatic
 *   events merge into one timeline on the country's realm calendar (`buildChronicle`).
 */

import type { CardFaceData } from "~/lib/cards/face/types";
import { cleanWikiMarkup } from "~/lib/wiki-os/transformers/wikitext-parser";
import { formatRealmDate, type RealmCalendar } from "~/lib/realms/realm-clock";
import { realmFractionalYear } from "~/lib/realms/nation-time";
import type { PublicDirective, PublicIssueOutcome } from "~/lib/country/public-record";

/** Inline templates that carry prose; `cleanWikiMarkup` would otherwise drop them. */
function unpackInlineTemplates(text: string): string {
  return (
    text
      .replace(/\{\{\s*wp\s*\|\s*[^|{}]+\|\s*([^{}]+?)\s*\}\}/gi, "$1")
      .replace(/\{\{\s*wp\s*\|\s*([^|{}]+?)\s*\}\}/gi, "$1")
      .replace(/\{\{\s*(?:abbr|abbrlink)\s*\|\s*([^|{}]+?)\s*(?:\|[^{}]*)?\}\}/gi, "$1")
      .replace(/\{\{\s*(?:efn|sfn|refn|citation needed|cn|clarify)[^{}]*\}\}/gi, "")
      // {{start date|1701|5|3}} and friends → the year (month/day are not needed for ordering).
      .replace(
        /\{\{\s*(?:start date|end date|start date and age|date|dts)\s*\|\s*(?:df=\w+\s*\|\s*)?(-?\d{1,4})[^{}]*\}\}/gi,
        "$1"
      )
  );
}

// The public-record rules live in `~/lib/country/public-record` so the server
// (`countries.getPublicRecord`, `intent.getTree` for visitors) and the profile share them.
export {
  toPublicDirectives,
  toPublicIssueOutcomes,
  type IntentLike,
  type IssueLike,
  type PublicDirective,
  type PublicIssueOutcome,
} from "~/lib/country/public-record";

/** Owner-only counts from the owner's own tree: drafts (`proposed`) and directives in force. */
export function countOwnerDirectives(intents: readonly { status: string }[] | null | undefined): {
  drafts: number;
  active: number;
} {
  const list = intents ?? [];
  return {
    drafts: list.filter((i) => i.status === "proposed").length,
    active: list.filter((i) => i.status === "active").length,
  };
}

export type ChronicleKind = "founding" | "story" | "directive" | "decision" | "diplomacy";

export interface ChronicleEntry {
  id: string;
  kind: ChronicleKind;
  title: string;
  detail: string | null;
  /** In-game year, fractional for dated events so they sort within a year. */
  year: number;
  /** "1622" for lore dates, "12 March 2041" or "14 Frostfall 812 AE" for events on the realm clock. */
  dateLabel: string;
  source: "wiki" | "map" | "ixtime";
}

/** First year in a free-text lore date ("12 March 1622", "c. 900 BC", "1848–1851"). */
export function parseLoreYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = cleanWikiMarkup(unpackInlineTemplates(raw)).replace(/\d{1,2}(st|nd|rd|th)\b/gi, "");
  // Day-of-month numbers ("12 March 1622") are skipped: a year has 3–4 digits or an era marker.
  for (const match of text.matchAll(/(\d{1,4})\s*(BCE?|B\.C\.)?/gi)) {
    const year = Number(match[1]);
    if (!Number.isFinite(year)) continue;
    if (match[2]) return -year;
    if (match[1]!.length >= 3) return year;
  }
  return null;
}

export interface FoundingEvent {
  event: string;
  date: string;
}

interface StoryPinLike {
  id: string;
  title: string;
  content?: string | null;
  category?: string | null;
  ixTimeYear?: number | null;
  eraLabel?: string | null;
}

interface CanonEventLike {
  id: string;
  title: string;
  /** Time on the country's realm clock (callers convert real-world timestamps with `clockTimeAt`). */
  ixTime: number;
}

interface ChronicleSources {
  /** The country's realm calendar: realm-clock events are dated and ordered in it. */
  calendar: RealmCalendar;
  founding?: readonly FoundingEvent[];
  storyPins?: readonly StoryPinLike[];
  directives?: readonly PublicDirective[];
  issueOutcomes?: readonly PublicIssueOutcome[];
  /** Resolved issues known only by title (the public canon feed), keyed by issue id. */
  decisions?: readonly CanonEventLike[];
  diplomacy?: readonly CanonEventLike[];
}

function excerpt(text: string | null | undefined, max = 180): string | null {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function yearLabel(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}

/**
 * Merge every dated source into one timeline, oldest first. Resolved issues with an outcome win
 * over the same issue from the canon feed (which only carries a title); undated lore is dropped
 * rather than guessed.
 */
export function buildChronicle(sources: ChronicleSources): ChronicleEntry[] {
  const entries: ChronicleEntry[] = [];
  const onClock = (ms: number) => ({
    year: realmFractionalYear(ms, sources.calendar),
    dateLabel: formatRealmDate(ms, sources.calendar),
    source: "ixtime" as const,
  });

  for (const [index, f] of (sources.founding ?? []).entries()) {
    const year = parseLoreYear(f.date);
    if (year == null || !f.event.trim()) continue;
    entries.push({
      id: `founding-${index}`,
      kind: "founding",
      title: cleanWikiMarkup(unpackInlineTemplates(f.event)),
      detail: null,
      year,
      dateLabel: yearLabel(year),
      source: "wiki",
    });
  }

  for (const pin of sources.storyPins ?? []) {
    if (pin.ixTimeYear == null) continue;
    entries.push({
      id: `pin-${pin.id}`,
      kind: "story",
      title: pin.title,
      detail: excerpt(pin.content),
      year: pin.ixTimeYear,
      dateLabel: pin.eraLabel?.trim() || yearLabel(pin.ixTimeYear),
      source: "map",
    });
  }

  for (const d of sources.directives ?? []) {
    entries.push({
      id: `directive-${d.id}`,
      kind: "directive",
      title: d.goal,
      detail: excerpt(d.summary),
      ...onClock(d.createdIxTime),
    });
  }

  const outcomeIds = new Set<string>();
  for (const o of sources.issueOutcomes ?? []) {
    if (o.ixTime == null) continue;
    outcomeIds.add(o.id);
    entries.push({
      id: `issue-${o.id}`,
      kind: "decision",
      title: o.title,
      detail: excerpt(o.decision ? `${o.decision}${o.outcome ? `: ${o.outcome}` : ""}` : o.outcome),
      ...onClock(o.ixTime),
    });
  }

  for (const d of sources.decisions ?? []) {
    if (outcomeIds.has(d.id)) continue;
    entries.push({
      id: `issue-${d.id}`,
      kind: "decision",
      title: d.title,
      detail: null,
      ...onClock(d.ixTime),
    });
  }

  for (const e of sources.diplomacy ?? []) {
    entries.push({
      id: `diplomacy-${e.id}`,
      kind: "diplomacy",
      title: e.title,
      detail: null,
      ...onClock(e.ixTime),
    });
  }

  return entries.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}

/** Canon feed ids are prefixed by kind (`dec_<issueId>`, `dip_<eventId>`); strip the prefix. */
export function splitCanonFeed(
  items:
    readonly { id: string; kind: string; title: string; timestamp: number }[] | null | undefined,
  toIxTime: (realMs: number) => number
): { decisions: CanonEventLike[]; diplomacy: CanonEventLike[] } {
  const decisions: CanonEventLike[] = [];
  const diplomacy: CanonEventLike[] = [];
  for (const item of items ?? []) {
    const entry = {
      id: item.id.replace(/^[a-z]+_/, ""),
      title: item.title,
      ixTime: toIxTime(item.timestamp),
    };
    if (item.kind === "decision") decisions.push(entry);
    else if (item.kind === "diplomacy") diplomacy.push(entry);
  }
  return { decisions, diplomacy };
}

/** Finite, non-zero-by-default number or null (never render a fabricated 0). */
export function realNumber(value: unknown, { allowZero = false } = {}): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (!allowZero && n === 0) return null;
  return n;
}

export function formatBig(value: number | null, { currency = false } = {}): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  const prefix = currency ? "$" : "";
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${Math.round(abs).toLocaleString("en-US")}`;
}

/**
 * Growth rates arrive either as fractions (0.034) or percents (3.4); anything under 1 in
 * magnitude is treated as a fraction, matching the MyCountry formatters.
 */
export function formatRate(value: number | null, { signed = true } = {}): string {
  if (value == null) return "—";
  const pct = Math.abs(value) < 1 ? value * 100 : value;
  const sign = signed && pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value == null) return "—";
  return `${value.toFixed(digits)}%`;
}

/**
 * One point per year (the last reading of each year), oldest first. The engine's history can
 * hold many readings per year; points with a non-positive GDP are dropped.
 */
export function yearlySeries(raw: unknown): { year: number; gdp: number; population: number }[] {
  if (!Array.isArray(raw)) return [];
  const byYear = new Map<number, { year: number; gdp: number; population: number }>();
  for (const point of raw as { year?: unknown; gdp?: unknown; population?: unknown }[]) {
    const year = Number(point?.year);
    const gdp = Number(point?.gdp);
    const population = Number(point?.population);
    if (!Number.isFinite(year) || !Number.isFinite(gdp) || gdp <= 0) continue;
    byYear.set(year, { year, gdp, population: Number.isFinite(population) ? population : 0 });
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export interface ProfileSectionCover {
  url: string | null;
  caption: string | null;
  href?: string | null;
  summary?: string | null;
  readingTime?: number | null;
}

export interface ProfileMediaArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  imageUrl: string | null;
  readingTime: number;
}

export interface ProfileMedia {
  sectionCovers: {
    economy: ProfileSectionCover | null;
    state: ProfileSectionCover | null;
    foreign: ProfileSectionCover | null;
  };
  leaderPortraitUrl: string | null;
  articles: ProfileMediaArticle[];
  cards: CardFaceData[];
}

export const EMPTY_PROFILE_MEDIA: ProfileMedia = {
  sectionCovers: {
    economy: null,
    state: null,
    foreign: null,
  },
  leaderPortraitUrl: null,
  articles: [],
  cards: [],
};

const LEADER_KEYWORDS =
  /\b(imperator|emperor|empress|king|queen|president|prime minister|chancellor|monarch|leader|list of)/i;

const isSvgUrl = (url: string): boolean => /\.svg(?:$|\?)/i.test(url);

const imageKey = (url: string): string => {
  const trimmed = url.trim();
  const lastSegment = trimmed.split("/").pop()?.split("?")[0];
  return (lastSegment || trimmed).toLowerCase();
};

/** Candidate articles per Factbook block, best first (`countries.getCoverArticles`). */
export type CoverCandidates = Record<
  "economy" | "state" | "foreign",
  readonly {
    title: string;
    slug: string;
    summary: string | null;
    imageUrl: string | null;
    readingTime: number | null;
  }[]
>;

/** The owner's pinned image slot for each block (`card_background_images.cardType`). */
const PINNED_SLOT = {
  economy: "economic_indicators",
  state: "government",
  foreign: "diplomacy",
} as const;

/**
 * Assemble rich media for the country profile. Each Factbook block's cover is the owner's pinned
 * image, else the first of its own candidate articles with a usable image (raster before SVG, no
 * image twice), captioned and linked to the block's top article. With no candidate article the
 * cover is null and the block falls back to its map crop. Cards and the lore spotlight come from
 * the public record.
 */
export function buildProfileMedia(
  raw:
    | {
        cardImages?: Record<string, string>;
        articles?: readonly ProfileMediaArticle[];
        cards?: readonly CardFaceData[];
      }
    | null
    | undefined,
  countryName: string,
  covers?: CoverCandidates | null
): ProfileMedia {
  if (!raw && !covers) return EMPTY_PROFILE_MEDIA;
  const cardImages = raw?.cardImages ?? {};
  const allArticles = raw?.articles ?? [];
  const cards = [...(raw?.cards ?? [])];

  const leaderArticle = allArticles.find(
    (a) => a.imageUrl && !isSvgUrl(a.imageUrl) && LEADER_KEYWORDS.test(a.title)
  );
  const leaderPortraitUrl =
    cardImages.head_of_state?.trim() ||
    cardImages.head_of_government?.trim() ||
    leaderArticle?.imageUrl ||
    null;

  const usedKeys = new Set<string>();
  if (leaderPortraitUrl) usedKeys.add(imageKey(leaderPortraitUrl));

  // Exclude the bare country root article when sub-articles exist so spotlights show distinct topics.
  const normCountry = countryName.trim().toLowerCase();
  const subArticles = allArticles.filter((a) => a.title.trim().toLowerCase() !== normCountry);
  const coverArticles = subArticles.length > 0 ? subArticles : allArticles;

  const pickCover = (block: keyof typeof PINNED_SLOT): ProfileSectionCover | null => {
    const candidates = covers?.[block] ?? [];
    const top = candidates[0];
    const images = candidates.flatMap((c) =>
      c.imageUrl && !usedKeys.has(imageKey(c.imageUrl)) ? [c.imageUrl] : []
    );
    const pinned = cardImages[PINNED_SLOT[block]]?.trim() || null;
    const url = pinned ?? images.find((u) => !isSvgUrl(u)) ?? images[0] ?? null;
    if (!top && !pinned) return null;
    if (url) usedKeys.add(imageKey(url));
    return {
      url,
      caption: top?.title ?? null,
      href: top ? `/wiki/${encodeURIComponent(top.slug)}` : null,
      summary: top?.summary ?? null,
      readingTime: top?.readingTime ?? null,
    };
  };

  const finalEconomyCover = pickCover("economy");
  const finalStateCover = pickCover("state");
  const finalForeignCover = pickCover("foreign");

  // Surface the top canonical dossiers in the Encyclopedia & lore bento grid (up to 6).
  const spotlightArticles = coverArticles.slice(0, 6);

  return {
    sectionCovers: {
      economy: finalEconomyCover,
      state: finalStateCover,
      foreign: finalForeignCover,
    },
    leaderPortraitUrl,
    articles: spotlightArticles,
    cards,
  };
}
