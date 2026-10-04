"use client";

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
import { FacetMaterial } from "~/components/ui/facet";
import { Stat } from "~/components/ui/stat";
import { Card } from "~/components/ui/card";
import { WikiLinkButton } from "~/components/maps/shared/WikiLinkButton";

interface FeatureInfoPanelProps {
  feature: SelectedFeature;
  onClose: () => void;
  onOpenStoryModal?: (pinId: string) => void;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function FeaturePeekContent({ feature }: { feature: SelectedFeature }) {
  const { featureType } = feature;
  const typeLabel =
    featureType === "capital"
      ? "Capital"
      : featureType === "storyPin"
        ? "Story Pin"
        : featureType === "city"
          ? feature.cityType || "City"
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

function FeatureHeaderIcon({ feature }: { feature: SelectedFeature }) {
  if (feature.featureType === "storyPin") {
    return <BookMarked className="text-wiki h-4 w-4 shrink-0" aria-hidden />;
  }
  if (feature.featureType === "city" || feature.featureType === "capital") {
    return (
      <MapPin
        className={`h-4 w-4 shrink-0 ${feature.isCapital ? "text-yellow" : "text-blue"}`}
        aria-hidden
      />
    );
  }
  return <Landmark className="text-label-secondary h-4 w-4 shrink-0" aria-hidden />;
}

/** Desktop-only header (mobile uses the sheet's peek header). */
function FeatureHeader({ feature, onClose }: { feature: SelectedFeature; onClose: () => void }) {
  const isCity = feature.featureType === "city" || feature.featureType === "capital";
  const kind = isCity ? (feature.cityType ?? "city") : (feature.category ?? "landmark");
  return (
    <div className="border-separator flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-2 overflow-hidden">
        <FeatureHeaderIcon feature={feature} />
        <div className="min-w-0">
          <h3 className="text-label text-title-3 truncate">{feature.name}</h3>
          <p className="text-label-secondary text-footnote">
            {capitalize(kind)}
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
  );
}

function StoryPinDetails({
  feature,
  onOpenStoryModal,
}: {
  feature: SelectedFeature;
  onOpenStoryModal?: (pinId: string) => void;
}) {
  return (
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
      {!isMobile && <FeatureHeader feature={feature} onClose={onClose} />}

      <div
        className="overflow-y-auto p-4"
        style={{ maxHeight: isMobile ? "100%" : "calc(100% - 56px)" }}
      >
        {wikiLoading && feature.wikiPageTitle && (
          <div className="mb-3 space-y-2">
            <Skeleton className="h-3 w-full rounded-xs" />
            <Skeleton className="h-3 w-4/5 rounded-xs" />
            <Skeleton className="h-3 w-3/5 rounded-xs" />
          </div>
        )}

        {wikiIntro?.extract && (
          <div className="mb-3">
            <p className="text-label-secondary text-footnote line-clamp-5 leading-relaxed">
              {wikiIntro.extract}
            </p>
          </div>
        )}

        {isCity && feature.population != null && (
          <Card className="mb-3 px-3 py-2">
            <Stat
              size="sm"
              label="Population"
              value={formatPopulation(feature.population)}
              icon={<Users className="size-3.5" />}
            />
          </Card>
        )}

        {!isCity && !isStoryPin && feature.description && (
          <Card className="mb-3 px-3 py-2">
            <Eyebrow className="block">Description</Eyebrow>
            <p className="text-label text-footnote mt-0.5 leading-relaxed">{feature.description}</p>
          </Card>
        )}

        {isStoryPin && <StoryPinDetails feature={feature} onOpenStoryModal={onOpenStoryModal} />}

        <div className="mt-4 flex flex-col gap-2">
          {wikiIntro?.wikiUrl && (
            <WikiLinkButton url={wikiIntro.wikiUrl} externalIcon variant="outline" size="sm">
              <BookOpen aria-hidden />
              Read on {wikiIntro.wikiSource === "ixwiki" ? "IxWiki" : "IIWiki"}
            </WikiLinkButton>
          )}
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
      {!isMobile && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute top-0 right-0 z-20 hidden h-full w-96 sm:block"
          style={{ animation: "slideInRight 0.25s ease-out" }}
        >
          <FacetMaterial layer="chrome" className="h-full rounded-none">
            {panelContent}
          </FacetMaterial>
        </div>
      )}

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
