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
 *   events merge into one timeline on the in-game calendar (`buildChronicle`).
 */

import { cleanWikiMarkup } from "~/lib/wiki-os/transformers/wikitext-parser";
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
  /** "1622" for lore dates, "12 March 2041" for IxTime events. */
  dateLabel: string;
  source: "wiki" | "map" | "ixtime";
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** IxTime ms → fractional in-game year. IxTime is a UTC timestamp on the in-game calendar. */
export function ixTimeToYear(ixTime: number): number {
  const d = new Date(ixTime);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return d.getUTCFullYear() + (ixTime - start) / MS_PER_YEAR;
}

export function formatIxDate(ixTime: number): string {
  const d = new Date(ixTime);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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
  /** In-game time (callers convert real-world timestamps with `IxTime.convertToIxTime`). */
  ixTime: number;
}

interface ChronicleSources {
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
      year: ixTimeToYear(d.createdIxTime),
      dateLabel: formatIxDate(d.createdIxTime),
      source: "ixtime",
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
      year: ixTimeToYear(o.ixTime),
      dateLabel: formatIxDate(o.ixTime),
      source: "ixtime",
    });
  }

  for (const d of sources.decisions ?? []) {
    if (outcomeIds.has(d.id)) continue;
    entries.push({
      id: `issue-${d.id}`,
      kind: "decision",
      title: d.title,
      detail: null,
      year: ixTimeToYear(d.ixTime),
      dateLabel: formatIxDate(d.ixTime),
      source: "ixtime",
    });
  }

  for (const e of sources.diplomacy ?? []) {
    entries.push({
      id: `diplomacy-${e.id}`,
      kind: "diplomacy",
      title: e.title,
      detail: null,
      year: ixTimeToYear(e.ixTime),
      dateLabel: formatIxDate(e.ixTime),
      source: "ixtime",
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
