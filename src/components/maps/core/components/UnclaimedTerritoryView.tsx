"use client";

import React from "react";
import Link from "next/link";
import { MapPin, Globe, BookOpen } from "lucide-react";
import { StatCard } from "~/components/maps/core/components/StatCard";
import { sanitizeWikiContent } from "~/lib/sanitize-html";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";
import type { SelectedCountry } from "../IxWorldMap";

interface UnclaimedTerritoryViewProps {
  country: SelectedCountry;
  wikiRichIntro: any;
  introExpanded: boolean;
  setIntroExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export function UnclaimedTerritoryView({
  country,
  wikiRichIntro,
  introExpanded,
  setIntroExpanded,
}: UnclaimedTerritoryViewProps) {
  return (
    <div>
      {wikiRichIntro?.paragraphs && wikiRichIntro.paragraphs.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {wikiRichIntro.paragraphs.slice(0, introExpanded ? 5 : 1).map((p: string, i: number) => (
            <WikiHtmlContent
              key={i}
              as="p"
              className="text-foreground/80 text-xs leading-relaxed"
              html={sanitizeWikiContent(p)}
            />
          ))}
          {wikiRichIntro.paragraphs.length > 1 && (
            <button
              onClick={() => setIntroExpanded((v) => !v)}
              className="text-[10px] font-medium text-blue-600 transition-colors hover:text-blue-500"
            >
              {introExpanded ? "Show less" : "Read more..."}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={MapPin}
          label="Location"
          value={`${country.centroidLat.toFixed(1)}°, ${country.centroidLng.toFixed(1)}°`}
        />
      </div>

      <div className="bg-muted/50 mt-3 flex items-center justify-center gap-1.5 rounded-lg py-2">
        <Globe className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-muted-foreground text-xs font-medium">Unclaimed Territory</span>
      </div>

      {wikiRichIntro?.wikiUrl && (
        <div className="mt-3">
          {wikiRichIntro.wikiUrl.startsWith("/") || wikiRichIntro.wikiUrl.includes("/wiki/") ? (
            <Link
              href={wikiRichIntro.wikiUrl}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              <BookOpen className="h-3 w-3" />
              Read on IxWiki
            </Link>
          ) : (
            <a
              href={wikiRichIntro.wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              <BookOpen className="h-3 w-3" />
              Read on {wikiRichIntro.wikiUrl.includes("ixwiki") ? "IxWiki" : "IIWiki"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
