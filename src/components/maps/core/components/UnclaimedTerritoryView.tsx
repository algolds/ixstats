"use client";

import React from "react";
import { MapPin, Globe, OpenBook as BookOpen } from "iconoir-react";
import { StatCard } from "~/components/maps/core/components/StatCard";
import { sanitizeWikiContent } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { Button } from "~/components/ui/button";
import { WikiLinkButton, wikiSiteName } from "~/components/maps/shared/WikiLinkButton";
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
        <div className="mb-3 space-y-2">
          {wikiRichIntro.paragraphs.slice(0, introExpanded ? 5 : 1).map((p: string, i: number) => (
            <WikiHtmlContent
              key={i}
              as="p"
              className="text-label-secondary text-footnote leading-relaxed"
              html={sanitizeWikiContent(p)}
            />
          ))}
          {wikiRichIntro.paragraphs.length > 1 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setIntroExpanded((v) => !v)}
              className="text-blue h-auto px-0"
            >
              {introExpanded ? "Show less" : "Read more..."}
            </Button>
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

      <p className="text-label-secondary text-caption mt-3 flex items-center justify-center gap-2">
        <Globe className="h-3.5 w-3.5" aria-hidden />
        Unclaimed territory
      </p>

      {wikiRichIntro?.wikiUrl && (
        <div className="mt-3">
          <WikiLinkButton
            url={wikiRichIntro.wikiUrl}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <BookOpen aria-hidden />
            Read on {wikiSiteName(wikiRichIntro.wikiUrl)}
          </WikiLinkButton>
        </div>
      )}
    </div>
  );
}
