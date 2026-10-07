/**
 * GeoJSON for the Maputnik style editor's preview sources (`/api/maps/style-store` points each geojson source here).
 * Admins only, like the style editor itself: the overlays carry every approved feature's full geometry. One realm
 * per request (`?realm=<slug>`, IxWorld by default), rate limited per admin, and privately cacheable for a minute.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { loadLayerFromDB } from "~/server/api/routers/geo/core/layer-loader";
import { rateLimiter } from "~/lib/cache";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { requireAdminSession } from "~/server/shared/route-auth";

/** Maputnik loads every source of a style at once; this leaves room for several reloads a minute. */
const EDITOR_SOURCE_LIMIT = { maxRequests: 120, windowMs: 60_000 } as const;

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

/** Approved DB records of each overlay in one realm, as the GeoJSON features Maputnik previews. */
const OVERLAY_FEATURES: Record<string, (realmId: string) => Promise<object[]>> = {
  capitals: async (realmId) => {
    const cities = await db.city.findMany({
      where: { isNationalCapital: true, status: "approved", country: { realmId } },
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
  subdivisions: async (realmId) => {
    const subdivisions = await db.subdivision.findMany({
      where: { status: "approved", country: { realmId } },
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
  cities: async (realmId) => {
    const cities = await db.city.findMany({
      where: { isNationalCapital: false, status: "approved", country: { realmId } },
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
  pois: async (realmId) => {
    const pois = await db.pointOfInterest.findMany({
      where: { status: "approved", country: { realmId } },
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
  storyPins: async (realmId) => {
    const pins = await db.storyPin.findMany({
      where: { status: "approved", country: { realmId } },
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
  mapLabels: async (realmId) => {
    const labels = await db.mapLabel.findMany({
      where: { status: "approved", country: { realmId } },
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

/** The `?realm=` slug's realm id (IxWorld when absent), or null when no realm has that slug. */
async function requestedRealmId(request: NextRequest): Promise<string | null> {
  const slug = request.nextUrl.searchParams.get("realm");
  if (!slug) return DEFAULT_REALM_ID;
  const realm = await db.realm.findUnique({ where: { slug }, select: { id: true } });
  return realm?.id ?? null;
}

const PRIVATE_CACHE = { "Cache-Control": "private, max-age=60" };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ layer: string }> }
) {
  try {
    const admin = await requireAdminSession();
    if (admin instanceof NextResponse) return admin;

    const limit = await rateLimiter.check(admin.userId, "map_editor_source", EDITOR_SOURCE_LIMIT);
    if (!limit.success) {
      const retryAfter = Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const realmId = await requestedRealmId(request);
    if (!realmId) return NextResponse.json({ error: "Unknown realm" }, { status: 404 });

    const { layer } = await params;
    let dbLayerType = layer.replace(/^source-/, "");

    const overlay = OVERLAY_ALIASES.get(dbLayerType);
    if (overlay) {
      const features = await OVERLAY_FEATURES[overlay]!(realmId);
      return NextResponse.json(
        { type: "FeatureCollection", features },
        { status: 200, headers: PRIVATE_CACHE }
      );
    }

    if (dbLayerType === "country-labels") dbLayerType = "country_labels";

    // Default fallback to base layers in MapLayer table
    const fc = await loadLayerFromDB(db, dbLayerType, 2, realmId);
    return NextResponse.json(fc ?? { type: "FeatureCollection", features: [] }, {
      status: 200,
      headers: PRIVATE_CACHE,
    });
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
