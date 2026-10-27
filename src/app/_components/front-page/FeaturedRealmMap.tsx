"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapIcon } from "iconoir-react";
import { CoordinatesMapEmbed } from "~/components/maps/widgets/CoordinatesMapEmbed";
import { Skeleton } from "~/components/ui/skeleton";
import { assetUrl } from "~/lib/base-path";
import type { RouterOutputs } from "~/trpc/react";
import { Pane, PaneBody, type PaneQuery } from "./Pane";

type Featured = RouterOutputs["frontPage"]["get"]["featured"];

/**
 * The zoom that fits the whole world to the pane's width (Mercator's world is 512px wide at zoom 0), measured once
 * the browser is idle after first paint, so MapLibre and its tiles never compete with it. Null until then.
 */
function useIdleWorldZoom(box: React.RefObject<HTMLDivElement | null>): number | null {
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => setZoom(Math.log2(Math.max(box.current?.clientWidth ?? 512, 256) / 512));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(fit, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(fit, 200);
    return () => clearTimeout(id);
  }, [box]);
  return zoom;
}

/** Today's featured realm on a live political map; its thumbnail stands in until the map mounts. */
export function FeaturedRealmMap({
  realm,
  query,
  className,
}: {
  realm: Featured | undefined;
  query: PaneQuery;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const zoom = useIdleWorldZoom(box);
  const failed = query.isError || (!query.isLoading && !realm);
  return (
    <Pane
      app="maps"
      content="visualization"
      flush
      icon={<MapIcon />}
      title={realm?.name ?? "Featured realm"}
      subtitle="Featured realm today"
      link={
        realm
          ? { href: `/maps?realm=${encodeURIComponent(realm.slug)}`, label: "Open map" }
          : undefined
      }
      className={className}
    >
      {failed ? (
        <PaneBody query={query} what="today's realm" empty="No realm to feature yet.">
          {null}
        </PaneBody>
      ) : (
        <div ref={box} className="relative h-[300px] lg:h-full lg:min-h-[420px]">
          {realm && zoom !== null ? (
            <CoordinatesMapEmbed
              realm={realm.slug}
              lat={20}
              lng={0}
              zoom={zoom}
              marker={false}
              options="height=100%"
              className="absolute inset-0 rounded-none border-0"
            />
          ) : realm?.thumbnail ? (
            <img
              src={assetUrl(realm.thumbnail) ?? ""}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <Skeleton className="absolute inset-0 rounded-none" />
          )}
        </div>
      )}
    </Pane>
  );
}
