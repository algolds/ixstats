"use client";

import { useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { NavArrowDown, NavArrowUp } from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";
import { cn } from "~/lib/utils";

export interface LegendNation {
  id: string;
  name: string;
  color: string;
  unclaimed: boolean;
}

/** The nations of a political layer, one entry each (a nation with several regions is listed once), by name. */
export function legendNations(
  political: FeatureCollection | null | undefined,
  unclaimedCountryIds: readonly string[] = []
): LegendNation[] {
  const unclaimed = new Set(unclaimedCountryIds);
  const byId = new Map<string, LegendNation>();
  for (const feature of political?.features ?? []) {
    const p = feature.properties ?? {};
    const id = (p._countryId as string | null) ?? null;
    if (!id || byId.has(id) || p._sovereignId) continue;
    byId.set(id, {
      id,
      name: String(p._displayName ?? p._id ?? id),
      color: String(p._fillColor ?? "#e8e5da"),
      unclaimed: unclaimed.has(id),
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The hatch the map draws over unclaimed nations, as a CSS background over the nation's colour. */
const HATCH = "repeating-linear-gradient(135deg, rgba(40,40,40,0.6) 0 2px, transparent 2px 6px)";

function Swatch({ color, hatched }: { color: string; hatched?: boolean }) {
  return (
    <span
      aria-hidden
      className="border-separator inline-block h-3 w-3 shrink-0 rounded-sm border"
      style={{
        backgroundColor: color,
        ...(hatched && { backgroundImage: HATCH }),
      }}
    />
  );
}

/**
 * The political legend of a realm's map: each nation by its colour, unclaimed ones hatched (as on the map), with
 * a key entry for the hatch. Collapsed to its title until opened.
 */
export function RealmMapLegend({
  political,
  unclaimedCountryIds,
  defaultOpen = false,
}: {
  political: FeatureCollection | null | undefined;
  unclaimedCountryIds?: readonly string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const nations = useMemo(
    () => legendNations(political, unclaimedCountryIds),
    [political, unclaimedCountryIds]
  );
  if (nations.length === 0) return null;
  const anyUnclaimed = nations.some((n) => n.unclaimed);

  return (
    <FacetMaterial
      layer="chrome"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="rounded-row pointer-events-auto w-56 max-w-full px-3 py-2"
    >
      <button
        type="button"
        className="text-label text-footnote flex w-full items-center justify-between gap-2 font-medium"
        aria-expanded={open}
        aria-controls="realm-map-legend-list"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Nations ({nations.length})</span>
        {open ? (
          <NavArrowDown className="h-3 w-3" aria-hidden />
        ) : (
          <NavArrowUp className="h-3 w-3" aria-hidden />
        )}
      </button>
      {open && (
        <div id="realm-map-legend-list" className="mt-2">
          {anyUnclaimed && (
            <p className="text-label-secondary text-caption mb-2 flex items-center gap-2">
              <Swatch color="transparent" hatched />
              Unclaimed nation (no player yet)
            </p>
          )}
          <ul
            className="flex max-h-56 flex-col gap-1 overflow-y-auto"
            aria-label="Nations by colour"
          >
            {nations.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "text-footnote flex items-center gap-2",
                  n.unclaimed ? "text-label-secondary" : "text-label"
                )}
              >
                <Swatch color={n.color} hatched={n.unclaimed} />
                <span className="truncate">{n.name}</span>
                {n.unclaimed && <span className="sr-only">(unclaimed)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </FacetMaterial>
  );
}
