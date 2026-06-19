import { findSubdivisionAtPoint } from "./spatial";
import { polylineLengthKm, geometryAreaSqKm } from "~/lib/geo-math";

export async function upsertPeak(db: any, countryId: string, data: any): Promise<any> {
  const { validatePointContainment, snapPointToCountryBorder } = await import("~/lib/geo-validation");

  let coordinates = data.coordinates;
  if (coordinates) {
    let lng = Array.isArray(coordinates) ? coordinates[0] : coordinates.lng;
    let lat = Array.isArray(coordinates) ? coordinates[1] : coordinates.lat;

    const snapped = await snapPointToCountryBorder(db, countryId, Number(lng), Number(lat));
    lng = snapped[0];
    lat = snapped[1];
    coordinates = [lng, lat];
    data.coordinates = coordinates;

    await validatePointContainment(db, countryId, Number(lng), Number(lat), "Peak");
  }

  // Auto-detect subdivision containment if requested
  if (
    coordinates &&
    (data.subdivisionId === "auto" ||
      data.subdivisionId === undefined ||
      data.subdivisionId === null)
  ) {
    const lng = coordinates[0];
    const lat = coordinates[1];
    const autoSub = await findSubdivisionAtPoint(db, countryId, Number(lng), Number(lat));
    data.subdivisionId = autoSub ? autoSub.id : null;
  } else if (data.subdivisionId === "none") {
    data.subdivisionId = null;
  }

  let peak;
  if (data.id) {
    const existing = await db.peak.findFirst({
      where: { id: data.id, countryId },
    });
    if (!existing) {
      throw new Error(`Peak not found or does not belong to this country.`);
    }

    peak = await db.peak.update({
      where: { id: data.id },
      data: {
        name: data.name,
        coordinates: data.coordinates,
        elevation: data.elevation,
        prominence: data.prominence,
        subdivisionId: data.subdivisionId,
        wikiPageTitle: data.wikiPageTitle,
        status: "approved",
      },
    });
  } else {
    peak = await db.peak.create({
      data: {
        countryId,
        name: data.name,
        coordinates: data.coordinates,
        elevation: data.elevation,
        prominence: data.prominence,
        subdivisionId: data.subdivisionId,
        wikiPageTitle: data.wikiPageTitle,
        status: "approved",
        submittedBy: data.submittedBy || "owner",
      },
    });
  }

  // Force PostGIS triggers to run by updating geom_postgis from coordinates
  if (peak && peak.coordinates) {
    try {
      const coords = peak.coordinates as any;
      const lng = Array.isArray(coords) ? coords[0] : coords.lng;
      const lat = Array.isArray(coords) ? coords[1] : coords.lat;
      await db.$executeRawUnsafe(
        `UPDATE peaks SET geom_postgis = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
        Number(lng),
        Number(lat),
        peak.id
      );
    } catch (err) {
      console.warn(`[upsertPeak] Failed to manually sync PostGIS coordinate:`, err);
    }
  }

  return await db.peak.findUnique({ where: { id: peak.id } });
}

export async function upsertNamedRiver(db: any, countryId: string, data: any): Promise<any> {
  const { validateGeometryBounds } = await import("~/lib/geo-validation");
  const geometry = data.geometry;

  if (geometry) {
    validateGeometryBounds(geometry);
    const coords = geometry.coordinates as [number, number][];
    if (coords && coords.length > 0) {
      data.lengthKm = polylineLengthKm(coords);
    }
  }

  let river;
  if (data.id) {
    const existing = await db.namedRiver.findFirst({
      where: { id: data.id, countryId },
    });
    if (!existing) {
      throw new Error(`NamedRiver not found or does not belong to this country.`);
    }

    river = await db.namedRiver.update({
      where: { id: data.id },
      data: {
        name: data.name,
        geometry: data.geometry,
        lengthKm: data.lengthKm,
        wikiPageTitle: data.wikiPageTitle,
        status: "approved",
      },
    });
  } else {
    river = await db.namedRiver.create({
      data: {
        countryId,
        name: data.name,
        geometry: data.geometry,
        lengthKm: data.lengthKm,
        wikiPageTitle: data.wikiPageTitle,
        status: "approved",
        submittedBy: data.submittedBy || "owner",
      },
    });
  }

  // Force PostGIS triggers to run by updating geom_postgis from geometry
  if (river && river.geometry) {
    try {
      await db.$executeRawUnsafe(
        `UPDATE named_rivers SET geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) WHERE id = $2`,
        JSON.stringify(river.geometry),
        river.id
      );
    } catch (err) {
      console.warn(`[upsertNamedRiver] Failed to manually sync PostGIS geometry:`, err);
    }
  }

  return await db.namedRiver.findUnique({ where: { id: river.id } });
}

export async function upsertNamedLake(db: any, countryId: string, data: any): Promise<any> {
  const { validateGeometryBounds } = await import("~/lib/geo-validation");
  const geometry = data.geometry;

  if (geometry) {
    validateGeometryBounds(geometry);
    data.areaSqKm = geometryAreaSqKm(geometry);
  }

  let lake;
  if (data.id) {
    const existing = await db.namedLake.findFirst({
      where: { id: data.id, countryId },
    });
    if (!existing) {
      throw new Error(`NamedLake not found or does not belong to this country.`);
    }

    lake = await db.namedLake.update({
      where: { id: data.id },
      data: {
        name: data.name,
        geometry: data.geometry,
        areaSqKm: data.areaSqKm,
        maxDepthM: data.maxDepthM,
        wikiPageTitle: data.wikiPageTitle,
        status: "approved",
      },
    });
  } else {
    lake = await db.namedLake.create({
      data: {
        countryId,
        name: data.name,
        geometry: data.geometry,
        areaSqKm: data.areaSqKm,
        maxDepthM: data.maxDepthM,
        wikiPageTitle: data.wikiPageTitle,
        status: "approved",
        submittedBy: data.submittedBy || "owner",
      },
    });
  }

  // Force PostGIS triggers to run by updating geom_postgis from geometry
  if (lake && lake.geometry) {
    try {
      await db.$executeRawUnsafe(
        `UPDATE named_lakes SET geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) WHERE id = $2`,
        JSON.stringify(lake.geometry),
        lake.id
      );
    } catch (err) {
      console.warn(`[upsertNamedLake] Failed to manually sync PostGIS geometry:`, err);
    }
  }

  return await db.namedLake.findUnique({ where: { id: lake.id } });
}
