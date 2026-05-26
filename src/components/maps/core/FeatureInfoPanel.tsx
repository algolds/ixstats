"use client";

/**
 * FeatureInfoPanel - Slide-out panel for map markers (cities, POIs, capitals).
 *
 * Desktop: Right-side panel. Mobile: Bottom sheet.
 * Shows feature data, wiki intro (fetched on demand), and action links.
 */

import { memo } from "react";
import {
  X,
  MapPin,
  Users,
  BookOpen,
  Landmark,
  ExternalLink,
  BookMarked,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import type { SelectedFeature } from "./IxWorldMap";
import { SwipeableBottomSheet } from "./SwipeableBottomSheet";

interface FeatureInfoPanelProps {
  feature: SelectedFeature;
  onClose: () => void;
  onOpenStoryModal?: (pinId: string) => void;
}

function formatPopulation(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export const FeatureInfoPanel = memo(function FeatureInfoPanel({
  feature,
  onClose,
  onOpenStoryModal,
}: FeatureInfoPanelProps) {
  // Fetch wiki intro on demand (only if wikiPageTitle is set)
  const { data: wikiIntro, isLoading: wikiLoading } = api.geoWiki.getFeatureWikiIntro.useQuery(
    { wikiPageTitle: feature.wikiPageTitle! },
    {
      enabled: !!feature.wikiPageTitle,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
    }
  );

  const isCity = feature.featureType === "city" || feature.featureType === "capital";
  const isStoryPin = feature.featureType === "storyPin";

  const panelContent = (
    <>
      {/* Header */}
      <div className="border-border/50 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              isStoryPin ? "bg-purple-100" : isCity ? "bg-blue-100" : "bg-amber-100"
            }`}
          >
            {isStoryPin ? (
              <BookMarked className="h-4 w-4 text-purple-600" />
            ) : isCity ? (
              <MapPin
                className={`h-4 w-4 ${feature.isCapital ? "text-amber-600" : "text-blue-600"}`}
              />
            ) : (
              <Landmark className="h-4 w-4 text-amber-600" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-foreground truncate text-base font-semibold">{feature.name}</h3>
            <p className="text-muted-foreground text-xs">
              {isCity
                ? (feature.cityType ?? "City").charAt(0).toUpperCase() +
                  (feature.cityType ?? "city").slice(1)
                : (feature.category ?? "Landmark").charAt(0).toUpperCase() +
                  (feature.category ?? "landmark").slice(1)}
              {" \u00B7 "}
              {feature.countryName}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-full p-1.5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(100% - 56px)" }}>
        {/* Wiki intro loading skeleton */}
        {wikiLoading && feature.wikiPageTitle && (
          <div className="mb-3 space-y-1.5">
            <div className="bg-muted h-3 w-full animate-pulse rounded" />
            <div className="bg-muted h-3 w-4/5 animate-pulse rounded" />
            <div className="bg-muted h-3 w-3/5 animate-pulse rounded" />
          </div>
        )}

        {/* Wiki intro text */}
        {wikiIntro?.extract && (
          <div className="mb-3">
            <p className="text-foreground/80 line-clamp-5 text-xs leading-relaxed">
              {wikiIntro.extract}
            </p>
          </div>
        )}

        {/* City population */}
        {isCity && feature.population != null && (
          <div className="bg-muted rounded-lg px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
              <Users className="h-3 w-3" />
              Population
            </div>
            <div className="text-foreground mt-0.5 text-sm font-semibold">
              {formatPopulation(feature.population)}
            </div>
          </div>
        )}

        {/* POI description */}
        {!isCity && !isStoryPin && feature.description && (
          <div className="bg-muted rounded-lg px-3 py-2">
            <div className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Description
            </div>
            <p className="text-foreground mt-0.5 text-xs leading-relaxed">{feature.description}</p>
          </div>
        )}

        {/* Story Pin details */}
        {isStoryPin && (
          <div className="space-y-2">
            {(feature.ixTimeYear || feature.eraLabel) && (
              <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 dark:bg-purple-900/20">
                <Calendar className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                  {feature.ixTimeYear && `Year ${feature.ixTimeYear}`}
                  {feature.ixTimeYear && feature.eraLabel && " · "}
                  {feature.eraLabel}
                </span>
              </div>
            )}
            {feature.category && (
              <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 capitalize dark:bg-purple-900/30 dark:text-purple-300">
                {feature.category}
              </span>
            )}
            {onOpenStoryModal && feature.id && (
              <button
                onClick={() => onOpenStoryModal(feature.id)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-50 py-2 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300"
              >
                <BookMarked className="h-3 w-3" />
                Read Full Story
              </button>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex flex-col gap-2">
          {wikiIntro?.wikiUrl && (
            <a
              href={wikiIntro.wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              <BookOpen className="h-3 w-3" />
              Read on {wikiIntro.wikiSource === "ixwiki" ? "IxWiki" : "IIWiki"}
            </a>
          )}
          {feature.countrySlug && (
            <Link
              href={`/countries/${feature.countrySlug}`}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
            >
              View {feature.countryName}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: Right-side panel */}
      <div
        className="absolute top-0 right-0 z-20 hidden h-full w-96 sm:block"
        style={{ animation: "slideInRight 0.25s ease-out" }}
      >
        <div className="bg-card h-full shadow-xl">{panelContent}</div>
      </div>

      {/* Mobile: Swipeable bottom sheet */}
      <SwipeableBottomSheet onClose={onClose}>{panelContent}</SwipeableBottomSheet>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
});
