"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useWikiSectionMap } from "~/hooks/useWikiSectionMap";
import { useWikiPreferences } from "~/hooks/useWikiPreferences";
import { useCountryData } from "./CountryDataProvider";
import { PanelCard } from "~/components/mycountry/cards";
import { ACCENT_CLASSES, type MyCountryAccent } from "~/components/mycountry/shared/cards/accents";

/** Strip wiki markup/templates/HTML down to a plain-text excerpt. */
function cleanWiki(raw: string | null | undefined, max = 420): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/'{2,3}/g, "")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max).trimEnd()}…` : cleaned;
}

function InlineWikiExcerpt({
  countryName,
  title,
  wikiUrl,
  accent,
}: {
  countryName: string;
  title: string;
  wikiUrl: string;
  accent: MyCountryAccent;
}) {
  const a = ACCENT_CLASSES[accent];
  const { data, isLoading } = api.wikios.getSectionContent.useQuery(
    { title: countryName, section: title, source: "ixwiki" },
    { enabled: !!countryName, staleTime: 10 * 60_000 }
  );

  const raw =
    data && typeof data === "object" && "content" in data
      ? (data as { content: string }).content
      : typeof data === "string"
        ? data
        : null;
  const excerpt = cleanWiki(raw);

  // Skip rendering sections that resolve to no usable content.
  if (!isLoading && !excerpt) return null;

  return (
    <PanelCard accent={accent} tinted texture="dots" textureOpacity={0.025} className="p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <BookOpen className={cn("h-3.5 w-3.5", a.text)} />
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-muted-foreground ml-auto text-[10px] tracking-wider uppercase">
          From the wiki
        </span>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
          <span className="text-muted-foreground text-[10px]">Loading lore…</span>
        </div>
      ) : (
        <p className="text-foreground/75 text-xs leading-relaxed">{excerpt}</p>
      )}
      {wikiUrl &&
        (wikiUrl.startsWith("/") || wikiUrl.includes("/wiki/") ? (
          <Link
            href={`${wikiUrl}#${encodeURIComponent(title.replace(/ /g, "_"))}`}
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-[11px] hover:underline",
              a.text
            )}
          >
            Read more
          </Link>
        ) : (
          <a
            href={`${wikiUrl}#${encodeURIComponent(title.replace(/ /g, "_"))}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-[11px] hover:underline",
              a.text
            )}
          >
            Read more <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ))}
    </PanelCard>
  );
}

interface InlineWikiProps {
  /** Section context for auto-matching relevant wiki sections (e.g. "diplomacy"). */
  context: string;
  accent?: MyCountryAccent;
  /** How many matched wiki sections to weave in (default 1). */
  maxSections?: number;
  className?: string;
}

/**
 * InlineWiki — weaves contextually relevant wiki content INLINE within a
 * section's content (vs. a collapsible bottom block). Drop it between gameplay
 * cards. Respects the user's wiki preferences and renders nothing when there's
 * no matching content. Theme-compliant via PanelCard.
 */
export const InlineWiki = React.memo(function InlineWiki({
  context,
  accent = "neutral",
  maxSections = 1,
  className,
}: InlineWikiProps) {
  const { country } = useCountryData();
  const { autoScan, displayMode } = useWikiPreferences();
  const { sections, isLoading, wikiUrl, sectionCount } = useWikiSectionMap(country?.name, context);

  if (!autoScan || displayMode === "hidden") return null;
  if (!isLoading && sectionCount === 0) return null;

  const visible = sections.slice(0, maxSections);

  return (
    <div className={cn("space-y-3", className)}>
      {isLoading
        ? null
        : visible.map((section) => (
            <InlineWikiExcerpt
              key={section.key}
              countryName={country?.name ?? ""}
              title={section.title}
              wikiUrl={wikiUrl}
              accent={accent}
            />
          ))}
    </div>
  );
});
