// src/app/admin/wiki/components/types.ts
// Shared types and formatting helpers for Admin Wiki Panel.

import {
  Trophy,
  Medal,
  Star,
  Crown,
  Shield,
  Trophy as Award,
  Group as Users,
  Check,
  Sparks as Sparkles,
} from "iconoir-react";
import { WIKI_SOURCES, type WikiSource } from "~/lib/wiki-os/config";

export type FilterTab = "all" | "linked" | "unlinked";

export interface ScanResult {
  countryId: string;
  countryName: string;
  matchedTitle: string;
  source: WikiSource;
  confidence: "exact" | "partial";
  selected: boolean;
}

/** A country as the wiki link tools read it (a row of `countries.getAll`). */
export interface CountryLinkRow {
  id: string;
  name: string;
  wikiPageTitle?: string | null;
  wikiSource?: string | null;
  wikiLastSynced?: string | Date | null;
}

/** `countries.getAll`'s answer (or a bare list of rows); undefined while it loads. */
export type CountriesData =
  { countries: readonly CountryLinkRow[] } | readonly CountryLinkRow[] | null | undefined;

export function countryRows(data: CountriesData): readonly CountryLinkRow[] {
  if (!data) return [];
  return "countries" in data ? data.countries : data;
}

/** The wiki sources the link tools offer, in `WIKI_SOURCES` order, named as people see them. */
export const WIKI_SOURCE_OPTIONS = (Object.keys(WIKI_SOURCES) as WikiSource[]).map((value) => ({
  value,
  label: WIKI_SOURCES[value].name,
}));

/**
 * Whether a failed wiki read was an outage, not an answer: the wiki could not be reached (SERVICE_UNAVAILABLE) or
 * it, or our limiter, said busy (TOO_MANY_REQUESTS). An outage says nothing about whether a page exists.
 */
export function isWikiOutage(
  error: { data?: { code?: string } | null } | null | undefined
): boolean {
  const code = error?.data?.code;
  return code === "SERVICE_UNAVAILABLE" || code === "TOO_MANY_REQUESTS";
}

/** "<Wiki> could not be reached just now." */
export function unreachableText(source: WikiSource): string {
  return `${WIKI_SOURCES[source].name} could not be reached just now.`;
}

const ICON_COMPONENTS = {
  trophy: Trophy,
  medal: Medal,
  star: Star,
  crown: Crown,
  shield: Shield,
  award: Award,
  users: Users,
  check: Check,
  sparkles: Sparkles,
} as const;

export const getIconComponent = (iconName?: string) =>
  ICON_COMPONENTS[iconName as keyof typeof ICON_COMPONENTS] ?? Sparkles;

/** Tailwind text class and chart colour token for each award colour name. */
const AWARD_COLORS: Record<string, { text: string; hex: string }> = {
  amber: { text: "text-yellow", hex: "var(--color-chart-2)" },
  slate: { text: "text-label-secondary", hex: "var(--color-gray)" },
  cyan: { text: "text-teal", hex: "var(--color-chart-6)" },
  green: { text: "text-green", hex: "var(--color-chart-3)" },
  purple: { text: "text-purple", hex: "var(--color-chart-4)" },
  pink: { text: "text-pink", hex: "var(--color-chart-5)" },
  red: { text: "text-red", hex: "var(--color-chart-8)" },
};

export const getColorClass = (colorName?: string) =>
  AWARD_COLORS[colorName ?? ""]?.text ?? AWARD_COLORS.amber.text;

export const getColorHex = (colorName: string) =>
  AWARD_COLORS[colorName]?.hex ?? AWARD_COLORS.amber.hex;
