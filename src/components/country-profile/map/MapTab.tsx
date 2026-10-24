"use client";

import { useState } from "react";
import { Card } from "~/components/ui/card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import type { MapFocus } from "~/components/maps/widgets/CountryMapEmbed";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatBig, yearLabel } from "~/app/countries/[slug]/_utils/profileLayer";
import { FactList, type Fact } from "../factbook/SnapshotBlock";
import { TerritoryMap } from "../TerritoryMap";

function landFacts({ land }: CountryProfileLayer): Fact[] {
  const p = land.profile;
  const neighbours = land.neighbors.length;
  const capital = land.capital;
  return [
    {
      label: "Capital",
      value: capital
        ? [capital.name, capital.population && formatBig(capital.population)]
            .filter(Boolean)
            .join(" · ")
        : null,
    },
    { label: "Coastline", value: p?.coastlineKm ? `${formatBig(p.coastlineKm)} km` : null },
    {
      label: "Setting",
      value: p?.isIsland ? "Island nation" : p?.isLandlocked ? "Landlocked" : null,
    },
    { label: "Climate", value: p?.dominantClimate ?? null },
    { label: "Terrain", value: p?.dominantElevation ?? null },
    {
      label: "Arable land",
      value: p?.arableLandPercent ? `${p.arableLandPercent.toFixed(1)}%` : null,
    },
    {
      label: "Borders",
      value:
        neighbours > 0 ? `${neighbours} ${neighbours === 1 ? "neighbour" : "neighbours"}` : null,
    },
  ];
}

/**
 * MapTab — the map's one home: the interactive territory map (with its link to the Maps app),
 * the land facts led by the area, every region by population and the map stories; choosing a
 * region or a story flies the map to it.
 */
export function MapTab({ layer }: { layer: CountryProfileLayer }) {
  const { land, vitals } = layer;
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const area = land.areaSqKm ?? vitals.landArea;
  const regions = [...land.subdivisions].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  return (
    <div className="flex flex-col gap-4">
      <TerritoryMap
        countryId={layer.countryId}
        hasGeometry={land.hasGeometry}
        isLoading={land.isLoading}
        heightClass="h-80 md:h-[32rem]"
        focus={focus}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card padding="md" className="flex flex-col gap-4">
          <h2 className="text-title-3 text-label">Land</h2>
          {area && (
            <p className="flex flex-col gap-0.5">
              <span className="text-large-title text-label tabular-nums">{`${formatBig(area)} km²`}</span>
              <span className="text-footnote text-label-secondary">
                {vitals.density != null
                  ? `Land area · ${Math.round(vitals.density).toLocaleString("en-US")} people per km²`
                  : "Land area"}
              </span>
            </p>
          )}
          <FactList facts={landFacts(layer)} />
        </Card>
        <Card padding="md" className="flex min-w-0 flex-col gap-3">
          <h2 className="text-title-3 text-label">Regions</h2>
          {regions.length > 0 ? (
            <FacetList variant="plain" className="max-h-96 overflow-y-auto">
              <FacetListSection>
                {regions.map((r) => (
                  <FacetRow
                    key={r.id}
                    title={r.name}
                    subtitle={r.type}
                    trailing={r.population ? formatBig(r.population) : undefined}
                    onClick={() => setFocus({ kind: "subdivision", id: r.id })}
                  />
                ))}
              </FacetListSection>
            </FacetList>
          ) : (
            <p className="text-footnote text-label-secondary">No regions on the map yet.</p>
          )}
        </Card>
        <Card padding="md" className="flex min-w-0 flex-col gap-3">
          <h2 className="text-title-3 text-label">Map stories</h2>
          {land.storyPins.length > 0 ? (
            <FacetList variant="plain" className="max-h-96 overflow-y-auto">
              <FacetListSection>
                {land.storyPins.map((pin) => {
                  const when = pin.eraLabel ?? (pin.year != null ? yearLabel(pin.year) : undefined);
                  const point = pin.coordinates;
                  return point ? (
                    <FacetRow
                      key={pin.id}
                      title={pin.title}
                      subtitle={when}
                      onClick={() => setFocus({ kind: "point", lng: point[0], lat: point[1] })}
                    />
                  ) : (
                    <FacetRow key={pin.id} title={pin.title} subtitle={when} />
                  );
                })}
              </FacetListSection>
            </FacetList>
          ) : (
            <p className="text-footnote text-label-secondary">No map stories yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
