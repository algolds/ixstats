"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { EditPencil, Map as MapIcon } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { FacetMaterial } from "~/components/ui/facet";
import { MYCOUNTRY_MAP_EDITOR_PATH } from "~/lib/mycountry/routes";
import { MonogramBanner } from "../headers/FlagBanner";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <Skeleton className="size-full" /> }
);

/**
 * A nation without territory yet: the gold MyCountry monogram fills the stage (so the Lens still
 * has something to sit over), with the one thing to do about it.
 */
function NoTerritory({ insetRight }: { insetRight: number }) {
  return (
    <div data-slot="command-media-empty" className="absolute inset-0">
      <MonogramBanner />
      <div
        className="absolute inset-y-0 left-0 flex flex-col items-start justify-end gap-2 p-4 md:justify-center md:p-6"
        style={{ right: insetRight }}
      >
        <p className="text-headline text-label">No territory on the map yet</p>
        <Button asChild size="sm" variant="secondary">
          <Link href={MYCOUNTRY_MAP_EDITOR_PATH}>
            <EditPencil aria-hidden />
            Draw your territory
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * CommandMedia — the command face's media stage: the nation's live territory, the same map the
 * public profile leads with, with the owner's two map tools (edit the territory, open the atlas)
 * floating on Chrome in the corner.
 */
export function CommandMedia({ countryId, insetRight }: { countryId: string; insetRight: number }) {
  return (
    <>
      <CountryMapEmbed
        countryId={countryId}
        height="h-full"
        showNeighbors
        showCities
        showSubdivisions
        interactive
        boundsPadding={30}
        insetRight={insetRight}
        emptyFallback={<NoTerritory insetRight={insetRight} />}
      />
      <FacetMaterial
        layer="chrome"
        className="z-raised rounded-control-sm absolute top-3 left-3 flex items-center gap-0.5 print:hidden"
      >
        <Button asChild variant="ghost" size="icon-sm" className="max-sm:size-11">
          <Link href={MYCOUNTRY_MAP_EDITOR_PATH} aria-label="Edit territory" title="Edit territory">
            <EditPencil aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon-sm" className="max-sm:size-11">
          <Link href="/maps" aria-label="Open world maps" title="Open world maps">
            {/* The door into Maps wears the Maps tint; the button keeps MyCountry's focus ring. */}
            <MapIcon aria-hidden data-app="maps" className="text-tint" />
          </Link>
        </Button>
      </FacetMaterial>
    </>
  );
}
