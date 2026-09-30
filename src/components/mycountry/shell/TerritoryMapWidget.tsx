"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Map as MapIcon, EditPencil as Edit3 } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";
import { soundEffects } from "~/lib/sound/cuelume";
import { GHOST_BUTTON, SectionHeader } from "./surface-kit";

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
      depth={1}
      interactive="none"
      role="region"
      aria-labelledby="territory-title"
      className="flex flex-col gap-3 overflow-hidden rounded-3xl p-0"
    >
      <SectionHeader
        id="territory-title"
        title="Territory"
        subtitle="Your borders, neighbours and cities"
        className="px-4 pt-4 sm:px-5 sm:pt-5"
        accessory={
          <>
            <Link
              href="/maps"
              className={GHOST_BUTTON}
              aria-label="Open world maps"
              title="Open world maps"
              onClick={() => soundEffects.press()}
            >
              <MapIcon aria-hidden="true" className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                router.push("/mycountry/editor");
              }}
              className={GHOST_BUTTON}
              aria-label="Edit territory"
              title="Edit territory"
            >
              <Edit3 aria-hidden="true" className="h-4 w-4" />
            </button>
          </>
        }
      />

      <div className="border-border/60 relative h-60 w-full overflow-hidden border-t">
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
