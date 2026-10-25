"use client";

import type { Ref } from "react";
import { EditPencil } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import type { MapFocus } from "~/components/maps/widgets/CountryMapEmbed";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatBig } from "~/app/countries/[slug]/_utils/profileLayer";
import { placeSeed, type LoreSeed } from "~/lib/lore/lore-seeds";

/** A region, city or story pin the reader chose: where the map flies, and what the lore writer is seeded with. */
export interface ChosenPlace {
  key: string;
  title: string;
  focus: MapFocus | null;
  seed: LoreSeed;
}

type Land = CountryProfileLayer["land"];

/**
 * A place in a list. It is a button when choosing it does something: flying the map to it (it has a place on the
 * map), or, for a writer, choosing it to write about.
 */
export function PlaceRow({
  place,
  subtitle,
  trailing,
  chosenKey,
  canWrite,
  onChoose,
}: {
  place: ChosenPlace;
  subtitle?: string;
  trailing?: string;
  chosenKey: string | null;
  canWrite: boolean;
  onChoose: (place: ChosenPlace) => void;
}) {
  if (place.focus === null && !canWrite) {
    return <FacetRow title={place.title} subtitle={subtitle} trailing={trailing} />;
  }
  return (
    <FacetRow
      title={place.title}
      subtitle={subtitle}
      trailing={trailing}
      selected={chosenKey === place.key}
      selectionStyle="tint"
      onClick={() => onChoose(place)}
    />
  );
}

/** The regions by population and the cities (capital first), as places to choose. */
export function MapPlaces({
  land,
  chosenKey,
  canWrite,
  onChoose,
}: {
  land: Land;
  chosenKey: string | null;
  canWrite: boolean;
  onChoose: (place: ChosenPlace) => void;
}) {
  const regions = [...land.subdivisions].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  const regionName = new Map(land.subdivisions.map((r) => [r.id, r.name]));
  const row = { chosenKey, canWrite, onChoose };
  if (regions.length === 0 && land.cities.length === 0) {
    return (
      <p className="text-footnote text-label-secondary">No regions or cities on the map yet.</p>
    );
  }
  return (
    <FacetList variant="plain" className="max-h-96 overflow-y-auto">
      {regions.length > 0 && (
        <FacetListSection header="Regions">
          {regions.map((r) => (
            <PlaceRow
              key={r.id}
              place={{
                key: `region:${r.id}`,
                title: r.name,
                focus: { kind: "subdivision", id: r.id },
                seed: placeSeed(r.name),
              }}
              subtitle={r.type}
              trailing={r.population ? formatBig(r.population) : undefined}
              {...row}
            />
          ))}
        </FacetListSection>
      )}
      {land.cities.length > 0 && (
        <FacetListSection header="Cities">
          {land.cities.map((c) => {
            const point = c.coordinates;
            const region = c.subdivisionId ? (regionName.get(c.subdivisionId) ?? null) : null;
            return (
              <PlaceRow
                key={c.id}
                place={{
                  key: `city:${c.id}`,
                  title: c.name,
                  focus: point ? { kind: "point", lng: point[0], lat: point[1] } : null,
                  seed: placeSeed(c.name, point, region),
                }}
                subtitle={c.isCapital ? "Capital" : c.isPort ? "Port" : undefined}
                trailing={c.population ? formatBig(c.population) : undefined}
                {...row}
              />
            );
          })}
        </FacetListSection>
      )}
    </FacetList>
  );
}

/** For owner and co-authors: the chosen place, and "Write about this place". */
export function WritePlaceBar({
  chosen,
  onWrite,
  ref,
}: {
  chosen: ChosenPlace | null;
  onWrite: (seed: LoreSeed) => void;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Write lore about a place"
      aria-live="polite"
      className="flex min-h-9 flex-wrap items-center gap-3"
    >
      {chosen ? (
        <>
          <p className="text-headline text-label min-w-0 flex-1 truncate">{chosen.title}</p>
          <Button size="sm" onClick={() => onWrite(chosen.seed)}>
            <EditPencil aria-hidden="true" />
            Write about this place
          </Button>
        </>
      ) : (
        <p className="text-footnote text-label-secondary">
          Choose a region, city or story to write about it.
        </p>
      )}
    </div>
  );
}
