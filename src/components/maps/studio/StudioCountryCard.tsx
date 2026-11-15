"use client";

import { memo } from "react";
import { Xmark } from "iconoir-react";
import { dollars, StatRow } from "~/components/maps/editor/panels/WorldStatsSection";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { formatCompact } from "~/lib/format/compact";
import { compact } from "~/lib/worldgen/calibration-format";
import type { WorldSlot } from "~/lib/worldgen/v2/types";

/** The country picked on the Studio map: its name and the figures it would start with as a nation. */
export const StudioCountryCard = memo(function StudioCountryCard({
  slot,
  onClose,
}: {
  slot: WorldSlot;
  onClose: () => void;
}) {
  return (
    <FacetMaterial
      as="section"
      layer="chrome"
      data-content="entity"
      aria-label={slot.name}
      className="facet-chrome-subtle rounded-row pointer-events-auto absolute bottom-2 left-2 w-64 p-3"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-sm"
          style={{ backgroundColor: slot.colour }}
        />
        <h3 className="text-headline min-w-0 flex-1 truncate">{slot.name}</h3>
        <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}>
          <Xmark aria-hidden />
        </Button>
      </div>
      <dl className="text-footnote mt-2 space-y-1">
        <StatRow label="Area" value={`${compact(slot.areaKm2)} km²`} />
        <StatRow label="Population" value={formatCompact(slot.population)} />
        <StatRow label="Income per person" value={dollars(slot.gdpPerCapita)} />
      </dl>
    </FacetMaterial>
  );
});
