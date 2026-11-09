"use client";

import Link from "next/link";
import type { Geometry } from "geojson";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { countryTabHref } from "~/lib/country/country-routes";
import { geometryPath, mapCropFrame, type MapCropKind } from "~/lib/maps/map-crop";
import { api } from "~/trpc/react";

/** The cover box is `h-32` across a third of the grid: about 3:1. The SVG slices to fit. */
const ASPECT = 3;
const MAP_CACHE = { staleTime: 30 * 60_000, gcTime: 2 * 60 * 60_000 } as const;

const LABEL: Record<MapCropKind, string> = {
  economy: "Open the map of its cities",
  state: "Open the map at the capital",
  foreign: "Open the map with its neighbours",
};

/** The country outline from the geo bundle's JSON, whether stored bare or as a Feature. */
function asGeometry(value: unknown): Geometry | null {
  if (!value || typeof value !== "object" || !("type" in value)) return null;
  if (value.type === "Feature" && "geometry" in value) return asGeometry(value.geometry);
  return value.type === "Polygon" || value.type === "MultiPolygon" ? (value as Geometry) : null;
}

function asBox(value: unknown): [number, number, number, number] | null {
  return Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === "number")
    ? [value[0], value[1], value[2], value[3]]
    : null;
}

/**
 * MapCrop — a Factbook block's still map when it has no fitting article image: the country drawn
 * from the geo bundle the profile already loaded, framed per block (Economy: its cities; State:
 * the capital; Foreign: its neighbours, embassy partners in the tint). It links to the Map tab.
 * Decorative: the link's label carries the meaning. Renders nothing without an outline.
 */
export function MapCrop({ kind, layer }: { kind: MapCropKind; layer: CountryProfileLayer }) {
  const { data } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId: layer.countryId },
    { enabled: layer.land.hasGeometry, ...MAP_CACHE }
  );
  const geometry = asGeometry(data?.geometry);
  const bbox = asBox(data?.boundingBox);
  if (!geometry || !bbox) return null;

  const cities = layer.land.cities.flatMap((c) =>
    c.coordinates ? [{ id: c.id, at: c.coordinates, isCapital: c.isCapital }] : []
  );
  const capital = cities.find((c) => c.isCapital)?.at ?? null;
  const partners = new Set(layer.world.embassies.map((e) => e.countryName.toLowerCase()));
  const neighbors = (data?.neighbors ?? []).map((n) => ({
    key: n.featureId,
    at: [n.centroidLng, n.centroidLat] as [number, number],
    partner: partners.has(n.displayName.toLowerCase()),
  }));
  const frame = mapCropFrame(
    kind,
    {
      bbox,
      capital,
      cities: cities.map((c) => c.at),
      neighbors: neighbors.map((n) => n.at),
    },
    ASPECT
  );
  const dot = frame.w / 90;

  return (
    <Link
      href={countryTabHref("map", layer.slug)}
      aria-label={LABEL[kind]}
      data-slot="block-map-crop"
      className="rounded-row border-separator bg-fill-4 focus-visible:outline-tint relative block h-32 overflow-hidden border focus-visible:outline-2"
    >
      <svg
        aria-hidden
        viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
        preserveAspectRatio="xMidYMid slice"
        className="size-full"
      >
        <path
          d={geometryPath(geometry)}
          vectorEffect="non-scaling-stroke"
          className="fill-tint/45 stroke-tint"
          strokeWidth={1}
        />
        {kind === "foreign" &&
          neighbors.map((n) => (
            <circle
              key={n.key}
              cx={n.at[0]}
              cy={-n.at[1]}
              r={dot}
              className={n.partner ? "fill-tint" : "fill-label-tertiary"}
            />
          ))}
        {kind !== "foreign" &&
          cities.map((c) => (
            <circle
              key={c.id}
              cx={c.at[0]}
              cy={-c.at[1]}
              r={c.isCapital ? dot * 1.4 : dot * 0.8}
              className={c.isCapital ? "fill-label" : "fill-label-secondary"}
            />
          ))}
      </svg>
    </Link>
  );
}
