"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MapPin, EditPencil as Edit3, ArrowUpRight } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  {
    ssr: false,
    loading: () => <div className="bg-muted/40 h-56 animate-pulse rounded-xl" />,
  }
);

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
      className="group/map border-border/80 relative overflow-hidden rounded-2xl p-0 shadow-lg backdrop-blur-xl dark:border-white/10"
    >
      {/* Interactive Map Canvas (Full Bleed Edge-to-Edge) */}
      <div className="relative h-60 w-full overflow-hidden">
        <CountryMapEmbed
          countryId={countryId}
          height="h-60"
          showNeighbors={true}
          showCities={true}
          showSubdivisions={false}
          interactive={true}
        />

        {/* Floating Glass Badges (Revealed on Hover/Activation) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-2.5 opacity-0 transition-opacity duration-200 group-focus-within/map:opacity-100 group-hover/map:opacity-100">
          {/* Top-Left: Open Maps */}
          <Link
            href="/maps"
            className="bg-background/90 text-foreground hover:bg-background group pointer-events-auto flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-[11px] font-bold shadow-md backdrop-blur-xl transition-all hover:scale-105 active:scale-95 dark:border-white/20 dark:bg-zinc-900/90"
            title="Open IxWorld Maps"
          >
            <MapPin className="h-3.5 w-3.5 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400" />
            <span>Open Maps</span>
            <ArrowUpRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          {/* Top-Right: Map Editor */}
          <button
            type="button"
            onClick={() => router.push("/mycountry/editor")}
            className="bg-background/90 text-foreground hover:bg-background group pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-[11px] font-bold shadow-md backdrop-blur-xl transition-all hover:scale-105 active:scale-95 dark:border-white/20 dark:bg-zinc-900/90"
            title="Open Map Editor"
          >
            <Edit3 className="h-3.5 w-3.5 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400" />
            <span>Map Editor</span>
          </button>
        </div>
      </div>
    </FacetCard>
  );
});
