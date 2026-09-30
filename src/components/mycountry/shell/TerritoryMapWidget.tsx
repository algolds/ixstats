"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Map as MapIcon, EditPencil as Edit3 } from "iconoir-react";
import { FacetCard, FacetCardHeader } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-60 w-full rounded-none" />,
  }
);

/**
 * Territory card: the country on the world map, with its two tools (open the atlas, edit the
 * territory) always visible in the header rather than hidden behind hover.
 */
export const TerritoryMapWidget = React.memo(function TerritoryMapWidget({
  countryId,
}: {
  countryId: string;
}) {
  const router = useRouter();

  return (
    <FacetCard
      depth={2}
      interactive="none"
      role="region"
      aria-labelledby="territory-title"
      className="overflow-hidden rounded-3xl"
    >
      <FacetCardHeader className="flex-row items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <h2
            id="territory-title"
            className="text-foreground text-base font-semibold tracking-tight"
          >
            Territory
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Your borders, neighbours and cities
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-11 sm:size-9"
          >
            <Link href="/maps" aria-label="Open world maps" title="Open world maps">
              <MapIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/mycountry/editor")}
            className="text-muted-foreground size-11 sm:size-9"
            aria-label="Edit territory"
            title="Edit territory"
          >
            <Edit3 aria-hidden="true" />
          </Button>
        </div>
      </FacetCardHeader>

      <div className="border-border relative h-60 w-full overflow-hidden border-t">
        <CountryMapEmbed
          countryId={countryId}
          height="h-60"
          showNeighbors={true}
          showCities={true}
          showSubdivisions={false}
          interactive={true}
        />
      </div>
    </FacetCard>
  );
});
