/**
 * Wiki integration helpers for the MyCountry overview tab (pure, no React/JSX).
 *
 * Extracted from MyCountryTabSystem during modular decomposition.
 * Behavior preserved exactly.
 */

import { Clock, Shield, Landmark, Globe2, Scroll, Users, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Wiki intro parsing ──────────────────────────────────────────────────────

/** Possible shapes returned by the `getWikiRichIntro` query. */
export type WikiIntro =
  | { paragraphs?: string[]; wikiUrl?: string }
  | string
  | string[]
  | null
  | undefined;

/**
 * Extracts the first intro paragraph HTML from the variety of shapes the
 * wiki intro query may return (object with `paragraphs`, plain string, or
 * array of strings). Returns `null` when no usable content is present.
 */
export function extractWikiIntroHtml(introObj: WikiIntro): string | null {
  if (
    introObj &&
    typeof introObj === "object" &&
    "paragraphs" in introObj &&
    Array.isArray(introObj.paragraphs) &&
    introObj.paragraphs.length > 0
  ) {
    return introObj.paragraphs[0] ?? null;
  } else if (typeof introObj === "string") {
    return introObj;
  } else if (Array.isArray(introObj) && introObj.length > 0) {
    return String(introObj[0]);
  }
  return null;
}

// ─── Coat of arms detection ──────────────────────────────────────────────────

/** Regex matching common coat-of-arms / seal / emblem image titles. */
export const COAT_OF_ARMS_REGEX = /coat.?of.?arms|coa|seal|emblem|escudo|wappen/i;

/**
 * Finds the coat-of-arms image URL among a list of wiki page images, or `null`.
 */
export function findCoatOfArmsUrl(
  wikiImages: Array<{ title: string; url: string }> | null | undefined
): string | null {
  return (
    wikiImages?.find((img: { title: string; url: string }) => COAT_OF_ARMS_REGEX.test(img.title))
      ?.url ?? null
  );
}

// ─── Wiki URL generation ─────────────────────────────────────────────────────

/**
 * Builds the canonical wiki article URL for a country, honoring its
 * `wikiSource` (iiwiki vs. ixwiki). Spaces are converted to underscores and
 * the page title is URL-encoded.
 */
export function getCountryWikiUrl(countryName: string, wikiSource?: string | null): string {
  if (wikiSource !== "iiwiki") {
    const basePath = process.env.BASE_PATH || "";
    return `${basePath}/wiki/${encodeURIComponent(countryName.replace(/ /g, "_"))}`;
  }
  return `https://iiwiki.com/wiki/${encodeURIComponent(countryName.replace(/ /g, "_"))}`;
}

/**
 * Builds a deep link to a specific section anchor within a country's wiki
 * article.
 */
export function getWikiSectionUrl(wikiUrl: string, sectionTitle: string): string {
  return `${wikiUrl}#${encodeURIComponent(sectionTitle.replace(/ /g, "_"))}`;
}

// ─── Wiki section content cleaning ───────────────────────────────────────────

/**
 * Normalizes the raw section-content payload (string or `{ content }` object)
 * into a plain string, or `null` when absent.
 */
export function extractWikiSectionRawContent(sectionContent: unknown): string | null {
  return sectionContent
    ? typeof sectionContent === "object" && "content" in (sectionContent as object)
      ? (sectionContent as { content: string }).content
      : String(sectionContent)
    : null;
}

/**
 * Strips wiki markup (links, templates, HTML tags, bold/italic quotes) from raw
 * section content and truncates to 600 characters. Returns `null` when there is
 * no raw content.
 */
export function cleanWikiSectionContent(rawContent: string | null): string | null {
  return rawContent
    ? rawContent
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/'{2,3}/g, "")
        .trim()
        .slice(0, 600)
    : null;
}

// ─── Wiki section classification ─────────────────────────────────────────────

export const WIKI_SECTION_TYPES: Array<{
  pattern: RegExp;
  label: string;
  icon: LucideIcon;
  color: string;
}> = [
  {
    pattern: /^history|^early|^medieval|^modern|^ancient|^prehistory|^contemporary|^classical/i,
    label: "History",
    icon: Clock,
    color: "text-amber-600",
  },
  {
    pattern: /^military|^army|^navy|^defense|^armed/i,
    label: "Military",
    icon: Shield,
    color: "text-red-600",
  },
  {
    pattern: /^government|^politics|^executive|^legislature|^judicial|^constitution/i,
    label: "Government",
    icon: Landmark,
    color: "text-indigo-600",
  },
  {
    pattern: /^economy|^trade|^industry|^agriculture|^energy|^currency|^labor/i,
    label: "Economy",
    icon: Globe2,
    color: "text-emerald-600",
  },
  {
    pattern: /^culture|^cuisine|^music|^art|^sport|^education|^language|^religion|^ethnic/i,
    label: "Culture",
    icon: Scroll,
    color: "text-purple-600",
  },
  {
    pattern: /^demograph|^population|^society|^social|^health/i,
    label: "Society",
    icon: Users,
    color: "text-blue-600",
  },
  {
    pattern: /^geography|^climate|^environment|^natural|^transport/i,
    label: "Geography",
    icon: Globe2,
    color: "text-teal-600",
  },
];

/**
 * Classifies a wiki section title into a label/icon/color, falling back to a
 * generic "General" descriptor.
 */
export function classifyWikiSection(title: string): {
  label: string;
  icon: LucideIcon;
  color: string;
} {
  for (const type of WIKI_SECTION_TYPES) {
    if (type.pattern.test(title)) return type;
  }
  return { label: "General", icon: BookOpen, color: "text-muted-foreground" };
}
