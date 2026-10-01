"use client";

/**
 * FeatureInfoPanel - Slide-out panel for map markers (cities, POIs, capitals).
 *
 * Desktop: Right-side panel. Mobile: Snap bottom sheet.
 * Shows feature data, wiki intro (fetched on demand), and action links.
 */

import { Skeleton } from "~/components/ui/skeleton";
import { memo } from "react";
import {
  Xmark as X,
  MapPin,
  Group as Users,
  OpenBook as BookOpen,
  Bank as Landmark,
  OpenNewWindow as ExternalLink,
  Bookmark as BookMarked,
  Calendar,
} from "iconoir-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import type { SelectedFeature } from "./IxWorldMap";
import { SnapBottomSheet } from "./SnapBottomSheet";
import { useIsMobile } from "~/hooks/useIsMobile";
import { formatPopulation } from "~/lib/utils/format-utils";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { FacetMaterial } from "~/components/ui/facet";
import { Stat } from "~/components/ui/stat";

interface FeatureInfoPanelProps {
  feature: SelectedFeature;
  onClose: () => void;
  onOpenStoryModal?: (pinId: string) => void;
}

function FeaturePeekContent({ feature }: { feature: SelectedFeature }) {
  // oxlint-disable-next-line eslint/no-unused-vars
  const isCity = feature.featureType === "city" || feature.featureType === "capital";
  const typeLabel =
    feature.featureType === "capital"
      ? "Capital"
      : feature.featureType === "city"
        ? feature.cityType || "City"
        : feature.featureType === "storyPin"
          ? "Story Pin"
          : feature.category || "POI";

  return (
    <div className="flex items-center gap-3">
      <MapPin className="text-blue h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <h3 className="text-label text-headline truncate">{feature.name}</h3>
        <div className="text-label-secondary text-footnote flex gap-2">
          <span className="capitalize">{typeLabel}</span>
          <span>•</span>
          <span>{feature.countryName}</span>
        </div>
      </div>
    </div>
  );
}

export const FeatureInfoPanel = memo(function FeatureInfoPanel({
  feature,
  onClose,
  onOpenStoryModal,
}: FeatureInfoPanelProps) {
  const isMobile = useIsMobile();

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
      {/* Header — only needed for desktop since mobile has Peek header */}
      {!isMobile && (
        <div className="border-separator flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 overflow-hidden">
            {isStoryPin ? (
              <BookMarked className="text-wiki h-4 w-4 shrink-0" aria-hidden />
            ) : isCity ? (
              <MapPin
                className={`h-4 w-4 shrink-0 ${feature.isCapital ? "text-yellow" : "text-blue"}`}
                aria-hidden
              />
            ) : (
              <Landmark className="text-label-secondary h-4 w-4 shrink-0" aria-hidden />
            )}
            <div className="min-w-0">
              <h3 className="text-label text-title-3 truncate">{feature.name}</h3>
              <p className="text-label-secondary text-footnote">
                {isCity
                  ? (feature.cityType ?? "City").charAt(0).toUpperCase() +
                    (feature.cityType ?? "city").slice(1)
                  : (feature.category ?? "Landmark").charAt(0).toUpperCase() +
                    (feature.category ?? "landmark").slice(1)}
                {" · "}
                {feature.countryName}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="text-label-secondary h-8 w-8 shrink-0 rounded-full"
          >
            <X aria-hidden />
          </Button>
        </div>
      )}

      {/* Body */}
      <div
        className="overflow-y-auto p-4"
        style={{ maxHeight: isMobile ? "100%" : "calc(100% - 56px)" }}
      >
        {/* Wiki intro loading skeleton */}
        {wikiLoading && feature.wikiPageTitle && (
          <div className="mb-3 space-y-2">
            <Skeleton className="h-3 w-full rounded-xs" />
            <Skeleton className="h-3 w-4/5 rounded-xs" />
            <Skeleton className="h-3 w-3/5 rounded-xs" />
          </div>
        )}

        {/* Wiki intro text */}
        {wikiIntro?.extract && (
          <div className="mb-3">
            <p className="text-label-secondary text-footnote line-clamp-5 leading-relaxed">
              {wikiIntro.extract}
            </p>
          </div>
        )}

        {/* City population */}
        {isCity && feature.population != null && (
          <FacetCard className="mb-3 px-3 py-2">
            <Stat
              size="sm"
              label="Population"
              value={formatPopulation(feature.population)}
              icon={<Users className="size-3.5" />}
            />
          </FacetCard>
        )}

        {/* POI description */}
        {!isCity && !isStoryPin && feature.description && (
          <FacetCard className="mb-3 px-3 py-2">
            <Eyebrow className="block">Description</Eyebrow>
            <p className="text-label text-footnote mt-0.5 leading-relaxed">{feature.description}</p>
          </FacetCard>
        )}

        {/* Story Pin details */}
        {isStoryPin && (
          <div className="mb-3 space-y-2">
            {(feature.ixTimeYear || feature.eraLabel) && (
              <div className="text-label text-caption flex items-center gap-2">
                <Calendar className="text-wiki h-3.5 w-3.5" aria-hidden />
                <span>
                  {feature.ixTimeYear && `Year ${feature.ixTimeYear}`}
                  {feature.ixTimeYear && feature.eraLabel && " · "}
                  {feature.eraLabel}
                </span>
              </div>
            )}
            {feature.category && (
              <Badge variant="outline" className="capitalize">
                {feature.category}
              </Badge>
            )}
            {onOpenStoryModal && feature.id && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => onOpenStoryModal(feature.id)}
              >
                <BookMarked aria-hidden />
                Read full story
              </Button>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex flex-col gap-2">
          {wikiIntro?.wikiUrl &&
            (wikiIntro.wikiUrl.startsWith("/") || wikiIntro.wikiUrl.includes("/wiki/") ? (
              <Button asChild variant="outline" size="sm">
                <Link href={wikiIntro.wikiUrl}>
                  <BookOpen aria-hidden />
                  Read on {wikiIntro.wikiSource === "ixwiki" ? "IxWiki" : "IIWiki"}
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <a href={wikiIntro.wikiUrl} target="_blank" rel="noopener noreferrer">
                  <BookOpen aria-hidden />
                  Read on {wikiIntro.wikiSource === "ixwiki" ? "IxWiki" : "IIWiki"}
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            ))}
          {feature.countrySlug && (
            <Button asChild size="sm" className="bg-blue text-on-blue hover:bg-blue/90">
              <Link href={`/countries/${feature.countrySlug}`}>
                View {feature.countryName}
                <ExternalLink aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: Right-side panel */}
      {!isMobile && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute top-0 right-0 z-20 hidden h-full w-96 sm:block"
          style={{ animation: "slideInRight 0.25s ease-out" }}
        >
          <FacetMaterial material="regular" className="h-full rounded-none">
            {panelContent}
          </FacetMaterial>
        </div>
      )}

      {/* Mobile: Snap bottom sheet */}
      {isMobile && (
        <SnapBottomSheet onClose={onClose} peekContent={<FeaturePeekContent feature={feature} />}>
          {panelContent}
        </SnapBottomSheet>
      )}

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
