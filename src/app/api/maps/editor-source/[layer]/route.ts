import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { loadLayerFromDB } from "~/server/api/routers/geo/core/layer-loader";

const COUNTRY_REF = { country: { select: { name: true, slug: true } } } as const;

interface CountryRow {
  countryId: string;
  country?: { name: string; slug: string | null } | null;
}

const hasPoint = (row: { coordinates: unknown }) =>
  Array.isArray(row.coordinates) && row.coordinates.length >= 2;

const pointFeature = (row: { coordinates: unknown }, properties: object) => ({
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: row.coordinates as [number, number] },
  properties,
});

const countryProps = (row: CountryRow) => ({
  countryId: row.countryId,
  countryName: row.country?.name || "",
  countrySlug: row.country?.slug || "",
});

/** Approved DB records of each overlay, as the GeoJSON features Maputnik previews. */
const OVERLAY_FEATURES: Record<string, () => Promise<object[]>> = {
  capitals: async () => {
    const cities = await db.city.findMany({
      where: { isNationalCapital: true, status: "approved" },
      select: {
        id: true,
        name: true,
        coordinates: true,
        population: true,
        wikiPageTitle: true,
        countryId: true,
        ...COUNTRY_REF,
      },
    });
    return cities.filter(hasPoint).map((c) =>
      pointFeature(c, {
        id: c.id,
        name: c.name,
        ...countryProps(c),
        population: c.population,
        wikiPageTitle: c.wikiPageTitle,
      })
    );
  },
  subdivisions: async () => {
    const subdivisions = await db.subdivision.findMany({
      where: { status: "approved" },
      select: {
        id: true,
        name: true,
        type: true,
        level: true,
        areaSqKm: true,
        geometry: true,
        countryId: true,
        ...COUNTRY_REF,
      },
    });
    return subdivisions
      .filter((s) => s.geometry)
      .map((s) => ({
        type: "Feature" as const,
        geometry: s.geometry as any,
        properties: {
          id: s.id,
          name: s.name,
          subdivisionType: s.type,
          level: s.level,
          areaSqKm: s.areaSqKm,
          ...countryProps(s),
        },
      }));
  },
  cities: async () => {
    const cities = await db.city.findMany({
      where: { isNationalCapital: false, status: "approved" },
      select: {
        id: true,
        name: true,
        coordinates: true,
        population: true,
        type: true,
        wikiPageTitle: true,
        countryId: true,
        ...COUNTRY_REF,
      },
    });
    return cities.filter(hasPoint).map((c) =>
      pointFeature(c, {
        id: c.id,
        name: c.name,
        cityType: c.type,
        isCapital: false,
        population: c.population,
        ...countryProps(c),
        wikiPageTitle: c.wikiPageTitle,
      })
    );
  },
  pois: async () => {
    const pois = await db.pointOfInterest.findMany({
      where: { status: "approved" },
      select: {
        id: true,
        name: true,
        coordinates: true,
        category: true,
        icon: true,
        description: true,
        wikiPageTitle: true,
        countryId: true,
        ...COUNTRY_REF,
      },
    });
    return pois.filter(hasPoint).map((p) =>
      pointFeature(p, {
        id: p.id,
        name: p.name,
        category: p.category,
        icon: p.icon,
        description: p.description,
        wikiPageTitle: p.wikiPageTitle,
        ...countryProps(p),
      })
    );
  },
  storyPins: async () => {
    const pins = await db.storyPin.findMany({
      where: { status: "approved" },
      select: {
        id: true,
        title: true,
        category: true,
        coordinates: true,
        importance: true,
        content: true,
        wikiPageTitle: true,
        countryId: true,
      },
    });
    return pins.filter(hasPoint).map((sp) =>
      pointFeature(sp, {
        id: sp.id,
        title: sp.title,
        category: sp.category,
        importance: sp.importance,
        content: sp.content,
        wikiPageTitle: sp.wikiPageTitle,
        countryId: sp.countryId,
      })
    );
  },
  mapLabels: async () => {
    const labels = await db.mapLabel.findMany({
      where: { status: "approved" },
      select: {
        id: true,
        text: true,
        labelType: true,
        coordinates: true,
        fontSize: true,
        color: true,
        rotation: true,
        letterSpacing: true,
        fontWeight: true,
        opacity: true,
        minZoom: true,
        maxZoom: true,
      },
    });
    return labels.filter(hasPoint).map((label) => {
      const { coordinates: _coordinates, ...properties } = label;
      return pointFeature(label, properties);
    });
  },
};

/** Layer name (with or without its `source-` / `overlay-` prefix, either spelling) -> overlay key. */
const OVERLAY_ALIASES = new Map(
  Object.entries({
    capitals: "capitals",
    "overlay-subdivisions": "subdivisions",
    subdivisions: "subdivisions",
    "overlay-cities": "cities",
    cities: "cities",
    "overlay-pois": "pois",
    pois: "pois",
    "story-pins": "storyPins",
    storyPins: "storyPins",
    "map-labels": "mapLabels",
    mapLabels: "mapLabels",
  })
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ layer: string }> }
) {
  try {
    const { layer } = await params;
    let dbLayerType = layer.replace(/^source-/, "");

    const overlay = OVERLAY_ALIASES.get(dbLayerType);
    if (overlay) {
      const features = await OVERLAY_FEATURES[overlay]!();
      return NextResponse.json({ type: "FeatureCollection", features }, { status: 200 });
    }

    if (dbLayerType === "country-labels") dbLayerType = "country_labels";

    // Default fallback to base layers in MapLayer table
    const fc = await loadLayerFromDB(db, dbLayerType, 2);
    return NextResponse.json(fc ?? { type: "FeatureCollection", features: [] }, { status: 200 });
  } catch (error) {
    console.error("❌ Map editor source query failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch map layer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
