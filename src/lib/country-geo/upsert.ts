import { getTerrainAtPoint } from "./base-layer-query";
import { geometryAreaSqKm } from "~/lib/maps/geo-math";
import {
  findSubdivisionAtPoint,
  updateCitySpatialProfile,
  updateSubdivisionSpatialProfile,
  alignSubdivisionBorders,
} from "./spatial";
import { triggerGeographyPolicy } from "./policy";
import { recalculateLargestCity, syncGeographicDemographics } from "./sync";

/** [lng, lat] from a stored coordinate: either a tuple or `{ lng, lat }`. */
const lngLatOf = (coords: any): [number, number] =>
  Array.isArray(coords)
    ? [Number(coords[0]), Number(coords[1])]
    : [Number(coords.lng), Number(coords.lat)];

/** Snaps `data.coordinates` to the country border and validates containment (mutates `data`). */
async function snapAndValidateCoordinates(
  db: any,
  countryId: string,
  data: any,
  label: "City" | "POI"
) {
  if (!data.coordinates) return;
  const { snapPointToCountryBorder, validatePointContainment } =
    await import("~/lib/maps/geo-validation");
  const [rawLng, rawLat] = lngLatOf(data.coordinates);
  const [lng, lat] = await snapPointToCountryBorder(db, countryId, rawLng, rawLat);
  data.coordinates = [lng, lat];
  await validatePointContainment(db, countryId, Number(lng), Number(lat), label);
}

/** Resolves `data.subdivisionId`: "auto"/unset detects it from the coordinates, "none" clears it. */
async function resolveSubdivisionId(db: any, countryId: string, data: any) {
  if (data.coordinates && (data.subdivisionId === "auto" || data.subdivisionId == null)) {
    const [lng, lat] = lngLatOf(data.coordinates);
    const autoSub = await findSubdivisionAtPoint(db, countryId, lng, lat);
    data.subdivisionId = autoSub ? autoSub.id : null;
  } else if (data.subdivisionId === "none") {
    data.subdivisionId = null;
  }
}

/** Forces the PostGIS triggers to run by rewriting geom_postgis from the stored point. */
async function syncPointGeometry(db: any, table: string, row: any, label: string) {
  if (!row?.coordinates) return;
  try {
    const [lng, lat] = lngLatOf(row.coordinates);
    await db.$executeRawUnsafe(
      `UPDATE ${table} SET geom_postgis = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
      lng,
      lat,
      row.id
    );
  } catch (err) {
    console.warn(`[${label}] Failed to manually sync PostGIS coordinate:`, err);
  }
}

const pickFields = (data: any, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, data[key]]));

/** City columns copied as given on both create and update. */
const CITY_FIELDS = [
  "name",
  "coordinates",
  "population",
  "subdivisionId",
  "wikiPageTitle",
  "gdpContribution",
  "economyOutput",
  "specialization",
  "infrastructureLevel",
  "mayorName",
  "foundedYear",
] as const;

const setNationalCapital = (db: any, countryId: string, city: { id: string; name: string }) =>
  db.nationalIdentity.upsert({
    where: { countryId },
    update: { capitalCityId: city.id, capitalCity: city.name },
    create: { countryId, capitalCityId: city.id, capitalCity: city.name },
  });

/** Updates an owned city; moving the national-capital flag also repoints the NationalIdentity. */
async function updateExistingCity(db: any, countryId: string, data: any) {
  const existing = await db.city.findFirst({ where: { id: data.id, countryId } });
  if (!existing) {
    throw new Error(`City not found or does not belong to this country.`);
  }

  const wasCapital = existing.isNationalCapital;
  const isCapital = data.isNationalCapital !== undefined ? data.isNationalCapital : wasCapital;

  const city = await db.city.update({
    where: { id: data.id },
    data: {
      ...pickFields(data, CITY_FIELDS),
      type: data.type,
      isNationalCapital: isCapital,
      isSubdivisionCapital: data.isSubdivisionCapital,
      isPort: data.isPort,
      ...(data.elevation !== undefined && { elevation: data.elevation }),
      status: "approved",
    },
  });

  if (isCapital && !wasCapital) {
    await db.city.updateMany({
      where: { countryId, id: { not: city.id }, isNationalCapital: true },
      data: { isNationalCapital: false },
    });
    await setNationalCapital(db, countryId, city);
  } else if (!isCapital && wasCapital) {
    await db.nationalIdentity.update({
      where: { countryId },
      data: { capitalCityId: null, capitalCity: null },
    });
  }
  return { city, oldSubdivisionId: existing.subdivisionId as string | null };
}

async function createCity(db: any, countryId: string, data: any, autoElevation?: number) {
  if (data.isNationalCapital) {
    await db.city.updateMany({
      where: { countryId, isNationalCapital: true },
      data: { isNationalCapital: false },
    });
  }

  const city = await db.city.create({
    data: {
      countryId,
      ...pickFields(data, CITY_FIELDS),
      type: data.type || "city",
      isNationalCapital: !!data.isNationalCapital,
      isSubdivisionCapital: !!data.isSubdivisionCapital,
      isPort: !!data.isPort,
      elevation: data.elevation ?? autoElevation,
      status: "approved",
      submittedBy: data.submittedBy || "owner",
    },
  });

  if (data.isNationalCapital) await setNationalCapital(db, countryId, city);
  return city;
}

/**
 * Upsert a City and handle all cascading changes (NationalIdentity, largestCity, subdivisions, etc.)
 */
export async function upsertCity(db: any, countryId: string, data: any): Promise<any> {
  if (!data.id && data.name) {
    const matchedCity = await db.city.findFirst({
      where: {
        countryId,
        name: {
          equals: data.name.trim(),
          mode: "insensitive",
        },
      },
      select: { id: true },
    });
    if (matchedCity) {
      data.id = matchedCity.id;
    }
  }
  const isNew = !data.id;
  await snapAndValidateCoordinates(db, countryId, data, "City");
  await resolveSubdivisionId(db, countryId, data);

  // Auto-derive elevation from the terrain zone at the city's coordinates when
  // the caller did not supply an explicit value. The explicit value is kept as
  // an override.
  let autoElevation: number | undefined;
  if (data.elevation === undefined && data.coordinates) {
    const [lng, lat] = lngLatOf(data.coordinates);
    // Scope to the country's realm so another realm's altitude band can't answer
    const realmRow = await db.country.findUnique({
      where: { id: countryId },
      select: { realmId: true },
    });
    const terrain = await getTerrainAtPoint(db, lng, lat, realmRow?.realmId ?? undefined);
    if (terrain.elevationZone) {
      autoElevation = Math.round(
        (terrain.elevationZone.elevationMin + terrain.elevationZone.elevationMax) / 2
      );
    }
  }

  const { city, oldSubdivisionId } = data.id
    ? await updateExistingCity(db, countryId, data)
    : { city: await createCity(db, countryId, data, autoElevation), oldSubdivisionId: null };

  await syncPointGeometry(db, "cities", city, "upsertCity");

  // Update spatial profiles
  await updateCitySpatialProfile(db, city.id);

  if (isNew) {
    await triggerGeographyPolicy(db, countryId, "city", city.name, data.submittedBy || "owner");
  }

  await recalculateLargestCity(db, countryId);
  await syncGeographicDemographics(db, countryId, city.subdivisionId);
  if (oldSubdivisionId && oldSubdivisionId !== city.subdivisionId) {
    await syncGeographicDemographics(db, countryId, oldSubdivisionId);
  }

  // Refresh returned city object with database state
  return await db.city.findUnique({ where: { id: city.id } });
}

/** Clips an edited polygon to the country and aligns it to neighbouring borders, warning on large reshapes. */
async function clipAndAlignGeometry(db: any, countryId: string, id: string | null, geometry: any) {
  const { clipAndValidatePolygon } = await import("~/lib/maps/geo-validation");
  const clipped = await clipAndValidatePolygon(db, countryId, geometry, "Subdivision");
  const aligned = await alignSubdivisionBorders(db, countryId, id, clipped);
  // Diagnostic: surface when server-side clip/snap materially reshapes the edit
  // (a likely cause of "my geometry edit didn't stick"). Logs to ixworld-out.log.
  try {
    const beforeArea = geometryAreaSqKm(geometry);
    const afterArea = geometryAreaSqKm(aligned);
    if (beforeArea > 0 && Math.abs(beforeArea - afterArea) / beforeArea > 0.01) {
      console.warn(
        `[upsertSubdivision] clip/align reshaped geometry (id=${id ?? "new"}): ` +
          `${beforeArea.toFixed(1)} -> ${afterArea.toFixed(1)} km² ` +
          `(${(((afterArea - beforeArea) / beforeArea) * 100).toFixed(1)}%)`
      );
    }
  } catch {
    /* diagnostic only — never block a save */
  }
  return aligned;
}

const SUBDIVISION_FIELDS = [
  "name",
  "level",
  "governorName",
  "budgetShare",
  "governmentType",
  "color",
  "population",
  "capital",
  "gdpContribution",
] as const;

/** Attributes-only update (geometry only when supplied); area is recomputed from a new geometry. */
async function updateSubdivision(db: any, countryId: string, data: any, geometry: any) {
  const existing = await db.subdivision.findFirst({ where: { id: data.id, countryId } });
  if (!existing) {
    throw new Error(`Subdivision not found or does not belong to this country.`);
  }

  const areaSqKm =
    data.areaSqKm !== undefined ? data.areaSqKm : geometry ? geometryAreaSqKm(geometry) : undefined;
  return db.subdivision.update({
    where: { id: data.id },
    data: {
      ...pickFields(data, SUBDIVISION_FIELDS),
      type: data.type,
      status: "approved",
      ...(geometry && { geometry }),
      ...(areaSqKm !== undefined && { areaSqKm }),
    },
  });
}

function createSubdivision(db: any, countryId: string, data: any, geometry: any) {
  const defaultGeometry = geometry || { type: "Polygon", coordinates: [] };
  return db.subdivision.create({
    data: {
      ...pickFields(data, SUBDIVISION_FIELDS),
      countryId,
      type: data.type || "province",
      level: data.level || 1,
      geometry: defaultGeometry,
      population: data.population || 0,
      areaSqKm: data.areaSqKm ?? geometryAreaSqKm(defaultGeometry),
      gdpContribution: data.gdpContribution || 0,
      status: "approved",
      submittedBy: data.submittedBy || "owner",
    },
  });
}

/**
 * Upsert a Subdivision (attributes only, geometry updates remain deferred)
 */
export async function upsertSubdivision(db: any, countryId: string, data: any): Promise<any> {
  const isNew = !data.id;
  let geometry = data.geometry;
  const hasPolygon =
    geometry &&
    Object.keys(geometry).length > 0 &&
    geometry.type !== "Point" &&
    geometry.coordinates?.length > 0;
  if (hasPolygon) geometry = await clipAndAlignGeometry(db, countryId, data.id || null, geometry);

  const subdivision = data.id
    ? await updateSubdivision(db, countryId, data, geometry)
    : await createSubdivision(db, countryId, data, geometry);

  // Force PostGIS triggers to run by updating geom_postgis from geometry
  if (
    subdivision &&
    subdivision.geometry &&
    (subdivision.geometry as any).coordinates &&
    (subdivision.geometry as any).coordinates.length > 0
  ) {
    try {
      await db.$executeRawUnsafe(
        `UPDATE subdivisions SET geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) WHERE id = $2`,
        JSON.stringify(subdivision.geometry),
        subdivision.id
      );
    } catch (err) {
      console.warn(`[upsertSubdivision] Failed to manually sync PostGIS geometry:`, err);
    }
  }

  // Update spatial profiles
  await updateSubdivisionSpatialProfile(db, subdivision.id);

  if (isNew) {
    await triggerGeographyPolicy(
      db,
      countryId,
      "subdivision",
      subdivision.name,
      data.submittedBy || "owner"
    );
  }
  await syncGeographicDemographics(db, countryId);

  // Refresh returned subdivision object with database state
  return await db.subdivision.findUnique({ where: { id: subdivision.id } });
}

/**
 * Upsert a Point of Interest (POI)
 */
export async function upsertPoi(db: any, countryId: string, data: any): Promise<any> {
  await snapAndValidateCoordinates(db, countryId, data, "POI");
  await resolveSubdivisionId(db, countryId, data);

  let poi;
  if (data.id) {
    const existing = await db.pointOfInterest.findFirst({
      where: { id: data.id, countryId },
    });
    if (!existing) {
      throw new Error(`POI not found or does not belong to this country.`);
    }

    poi = await db.pointOfInterest.update({
      where: { id: data.id },
      data: {
        name: data.name,
        category: data.category,
        icon: data.icon,
        coordinates: data.coordinates,
        description: data.description,
        wikiPageTitle: data.wikiPageTitle,
        subdivisionId: data.subdivisionId,
        status: "approved",
      },
    });
  } else {
    poi = await db.pointOfInterest.create({
      data: {
        countryId,
        name: data.name,
        category: data.category,
        icon: data.icon,
        coordinates: data.coordinates,
        description: data.description,
        wikiPageTitle: data.wikiPageTitle,
        subdivisionId: data.subdivisionId,
        status: "approved",
        submittedBy: data.submittedBy || "owner",
      },
    });
  }

  await syncPointGeometry(db, "points_of_interest", poi, "upsertPoi");

  return poi;
}
