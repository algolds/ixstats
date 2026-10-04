"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Map as MapIcon, NavArrowRight } from "iconoir-react";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { createUrl } from "~/lib/utils";
import { cn } from "~/lib/utils/cn";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> }
);

/**
 * TerritoryMap — the country's real territory (MapLibre embed: borders, dimmed neighbours,
 * cities, capital star) from the countryGeo bundle, or an EmptyState when the country has not
 * been drawn on the map yet. The embed shares its query cache with the profile layer.
 */
export function TerritoryMap({
  countryId,
  hasGeometry,
  isLoading,
  heightClass = "h-72",
  className,
}: {
  countryId: string;
  hasGeometry: boolean;
  isLoading: boolean;
  heightClass?: string;
  className?: string;
}) {
  if (isLoading) return <Skeleton className={cn("rounded-row w-full", heightClass, className)} />;
  if (!hasGeometry) {
    return (
      <EmptyState
        compact
        icon={<MapIcon />}
        title="Not on the map yet"
        message="This country's territory has not been drawn on the world map."
        className={cn("bg-surface-secondary rounded-row", className)}
      />
    );
  }
  return (
    <div className={cn("rounded-row border-separator relative overflow-hidden border", className)}>
      <CountryMapEmbed
        countryId={countryId}
        height={heightClass}
        showNeighbors
        showCities
        showSubdivisions
        boundsPadding={40}
      />
      <Link
        href={createUrl(`/maps?country=${encodeURIComponent(countryId)}`)}
        className="facet-chrome text-caption text-label focus-visible:outline-tint z-raised absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Open on map
        <NavArrowRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}
