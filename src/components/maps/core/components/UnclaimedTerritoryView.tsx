"use client";

import React from "react";
import Link from "next/link";
import { MapPin, Globe, OpenBook as BookOpen } from "iconoir-react";
import { StatCard } from "~/components/maps/core/components/StatCard";
import { sanitizeWikiContent } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { Button } from "~/components/ui/button";
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
              className="text-xs font-medium text-blue-500 hover:underline"
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

      <p className="text-muted-foreground mt-3 flex items-center justify-center gap-1.5 text-xs font-medium">
        <Globe className="h-3.5 w-3.5" aria-hidden />
        Unclaimed territory
      </p>

      {wikiRichIntro?.wikiUrl && (
        <div className="mt-3">
          {wikiRichIntro.wikiUrl.startsWith("/") || wikiRichIntro.wikiUrl.includes("/wiki/") ? (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={wikiRichIntro.wikiUrl}>
                <BookOpen aria-hidden />
                Read on IxWiki
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="w-full">
              <a href={wikiRichIntro.wikiUrl} target="_blank" rel="noopener noreferrer">
                <BookOpen aria-hidden />
                Read on {wikiRichIntro.wikiUrl.includes("ixwiki") ? "IxWiki" : "IIWiki"}
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
