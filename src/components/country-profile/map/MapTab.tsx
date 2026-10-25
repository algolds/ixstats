"use client";

import { useState } from "react";
import { Card } from "~/components/ui/card";
import { FacetList, FacetListSection } from "~/components/ui/facet-list";
import type { MapFocus } from "~/components/maps/widgets/CountryMapEmbed";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatBig, yearLabel } from "~/app/countries/[slug]/_utils/profileLayer";
import { useLoreEntry } from "~/hooks/lore/useLoreEntry";
import { placeSeed } from "~/lib/lore/lore-seeds";
import { FactList, type Fact } from "../factbook/SnapshotBlock";
import { LoreWriter } from "../lore/LoreWriter";
import { TerritoryMap } from "../TerritoryMap";
import { MapPlaces, PlaceRow, WritePlaceBar, type ChosenPlace } from "./MapPlaces";

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
 * the land facts led by the area, every region by population, the cities and the map stories;
 * choosing one flies the map to it. Owner and co-authors write about the chosen place in the
 * tab's one lore writer ("Write about this place", seeded with its title and location).
 */
export function MapTab({ layer }: { layer: CountryProfileLayer }) {
  const { land, vitals } = layer;
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [chosen, setChosen] = useState<ChosenPlace | null>(null);
  const entry = useLoreEntry(layer.countryId);
  const area = land.areaSqKm ?? vitals.landArea;
  const choose = (place: ChosenPlace) => {
    setChosen(place);
    if (place.focus) setFocus(place.focus);
  };
  const row = { chosenKey: chosen?.key ?? null, canWrite: entry.canWrite, onChoose: choose };

  return (
    <div className="flex flex-col gap-4">
      <TerritoryMap
        countryId={layer.countryId}
        hasGeometry={land.hasGeometry}
        isLoading={land.isLoading}
        heightClass="h-80 md:h-[32rem]"
        focus={focus}
      />
      {entry.canWrite && <WritePlaceBar chosen={chosen} onWrite={entry.write} />}
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
          <h2 className="text-title-3 text-label">Places</h2>
          <MapPlaces land={land} {...row} />
        </Card>
        <Card padding="md" className="flex min-w-0 flex-col gap-3">
          <h2 className="text-title-3 text-label">Map stories</h2>
          {land.storyPins.length > 0 ? (
            <FacetList variant="plain" className="max-h-96 overflow-y-auto">
              <FacetListSection>
                {land.storyPins.map((pin) => {
                  const point = pin.coordinates;
                  return (
                    <PlaceRow
                      key={pin.id}
                      place={{
                        key: `pin:${pin.id}`,
                        title: pin.title,
                        focus: point ? { kind: "point", lng: point[0], lat: point[1] } : null,
                        seed: placeSeed(pin.title, point),
                      }}
                      subtitle={
                        pin.eraLabel ?? (pin.year != null ? yearLabel(pin.year) : undefined)
                      }
                      {...row}
                    />
                  );
                })}
              </FacetListSection>
            </FacetList>
          ) : (
            <p className="text-footnote text-label-secondary">No map stories yet.</p>
          )}
        </Card>
      </div>
      <LoreWriter countryId={layer.countryId} countryName={layer.identity.name} {...entry.writer} />
    </div>
  );
}
