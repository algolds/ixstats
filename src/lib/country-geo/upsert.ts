import { getTerrainAtPoint } from "~/lib/base-layer-query";
import { geometryAreaSqKm } from "~/lib/geo-math";
import {
  findSubdivisionAtPoint,
  updateCitySpatialProfile,
  updateSubdivisionSpatialProfile,
  alignSubdivisionBorders,
} from "./spatial";
import { triggerGeographyPolicy } from "./policy";
import { recalculateLargestCity, syncGeographicDemographics } from "./sync";

/**
 * Upsert a City and handle all cascading changes (NationalIdentity, largestCity, subdivisions, etc.)
 */
export async function upsertCity(db: any, countryId: string, data: any): Promise<any> {
  const input = data;
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
  const { validatePointContainment } = await import("~/lib/geo-validation");

  if (data.coordinates) {
    const coords = data.coordinates as any;
    let lng = Array.isArray(coords) ? coords[0] : coords.lng;
    let lat = Array.isArray(coords) ? coords[1] : coords.lat;

    const { snapPointToCountryBorder } = await import("~/lib/geo-validation");
    const snapped = await snapPointToCountryBorder(db, countryId, Number(lng), Number(lat));
    lng = snapped[0];
    lat = snapped[1];
    data.coordinates = [lng, lat];

    await validatePointContainment(db, countryId, Number(lng), Number(lat), "City");
  }

  // Auto-detect subdivision containment if requested
  if (
    data.coordinates &&
    (data.subdivisionId === "auto" ||
      data.subdivisionId === undefined ||
      data.subdivisionId === null)
  ) {
    const coords = data.coordinates as any;
    const lng = Array.isArray(coords) ? coords[0] : coords.lng;
    const lat = Array.isArray(coords) ? coords[1] : coords.lat;
    const autoSub = await findSubdivisionAtPoint(db, countryId, Number(lng), Number(lat));
    data.subdivisionId = autoSub ? autoSub.id : null;
  } else if (data.subdivisionId === "none") {
    data.subdivisionId = null;
  }

  // Auto-derive elevation from the terrain zone at the city's coordinates when
  // the caller did not supply an explicit value. The explicit value is kept as
  // an override.
  let autoElevation: number | undefined;
  if (data.elevation === undefined && data.coordinates) {
    const coords = data.coordinates as any;
    const lng = Array.isArray(coords) ? coords[0] : coords.lng;
    const lat = Array.isArray(coords) ? coords[1] : coords.lat;
    const terrain = await getTerrainAtPoint(db, Number(lng), Number(lat));
    if (terrain.elevationZone) {
      autoElevation = Math.round(
        (terrain.elevationZone.elevationMin + terrain.elevationZone.elevationMax) / 2
      );
    }
  }

  let city;
  let oldSubdivisionId: string | null = null;

  if (data.id) {
    const existing = await db.city.findFirst({
      where: { id: data.id, countryId },
    });
    if (!existing) {
      throw new Error(`City not found or does not belong to this country.`);
    }

    oldSubdivisionId = existing.subdivisionId;
    const wasCapital = existing.isNationalCapital;
    const isCapital = data.isNationalCapital !== undefined ? data.isNationalCapital : wasCapital;

    city = await db.city.update({
      where: { id: data.id },
      data: {
        name: data.name,
        type: data.type,
        coordinates: data.coordinates,
        population: data.population,
        isNationalCapital: isCapital,
        isSubdivisionCapital: data.isSubdivisionCapital,
        subdivisionId: data.subdivisionId,
        wikiPageTitle: data.wikiPageTitle,
        gdpContribution: data.gdpContribution,
        economyOutput: data.economyOutput,
        specialization: data.specialization,
        infrastructureLevel: data.infrastructureLevel,
        mayorName: data.mayorName,
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
      await db.nationalIdentity.upsert({
        where: { countryId },
        update: { capitalCityId: city.id, capitalCity: city.name },
        create: { countryId, capitalCityId: city.id, capitalCity: city.name },
      });
    } else if (!isCapital && wasCapital) {
      await db.nationalIdentity.update({
        where: { countryId },
        data: { capitalCityId: null, capitalCity: null },
      });
    }
  } else {
    if (data.isNationalCapital) {
      await db.city.updateMany({
        where: { countryId, isNationalCapital: true },
        data: { isNationalCapital: false },
      });
    }

    city = await db.city.create({
      data: {
        countryId,
        name: data.name,
        type: data.type || "city",
        coordinates: data.coordinates,
        population: data.population,
        isNationalCapital: !!data.isNationalCapital,
        isSubdivisionCapital: !!data.isSubdivisionCapital,
        subdivisionId: data.subdivisionId,
        wikiPageTitle: data.wikiPageTitle,
        gdpContribution: data.gdpContribution,
        economyOutput: data.economyOutput,
        specialization: data.specialization,
        infrastructureLevel: data.infrastructureLevel,
        mayorName: data.mayorName,
        isPort: !!data.isPort,
        elevation: input.elevation ?? autoElevation,
        status: "approved",
        submittedBy: data.submittedBy || "owner",
      },
    });

    if (data.isNationalCapital) {
      await db.nationalIdentity.upsert({
        where: { countryId },
        update: { capitalCityId: city.id, capitalCity: city.name },
        create: { countryId, capitalCityId: city.id, capitalCity: city.name },
      });
    }
  }

  // Force PostGIS triggers to run by updating geom_postgis from coordinates
  if (city && city.coordinates) {
    try {
      const coords = city.coordinates as any;
      const lng = Array.isArray(coords) ? coords[0] : coords.lng;
      const lat = Array.isArray(coords) ? coords[1] : coords.lat;
      await db.$executeRawUnsafe(
        `UPDATE cities SET geom_postgis = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
        Number(lng),
        Number(lat),
        city.id
      );
    } catch (err) {
      console.warn(`[upsertCity] Failed to manually sync PostGIS coordinate:`, err);
    }
  }

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

/**
 * Upsert a Subdivision (attributes only, geometry updates remain deferred)
 */
export async function upsertSubdivision(db: any, countryId: string, data: any): Promise<any> {
  const isNew = !data.id;
  const { clipAndValidatePolygon } = await import("~/lib/geo-validation");
  let geometry = data.geometry;

  if (
    geometry &&
    Object.keys(geometry).length > 0 &&
    geometry.type !== "Point" &&
    geometry.coordinates &&
    geometry.coordinates.length > 0
  ) {
    const rawGeometry = data.geometry;
    geometry = await clipAndValidatePolygon(db, countryId, geometry, "Subdivision");
    geometry = await alignSubdivisionBorders(db, countryId, data.id || null, geometry);
    // Diagnostic: surface when server-side clip/snap materially reshapes the edit
    // (a likely cause of "my geometry edit didn't stick"). Logs to ixworld-out.log.
    try {
      const beforeArea = geometryAreaSqKm(rawGeometry);
      const afterArea = geometryAreaSqKm(geometry);
      if (beforeArea > 0 && Math.abs(beforeArea - afterArea) / beforeArea > 0.01) {
        console.warn(
          `[upsertSubdivision] clip/align reshaped geometry (id=${data.id ?? "new"}): ` +
            `${beforeArea.toFixed(1)} -> ${afterArea.toFixed(1)} km² ` +
            `(${(((afterArea - beforeArea) / beforeArea) * 100).toFixed(1)}%)`
        );
      }
    } catch {
      /* diagnostic only — never block a save */
    }
  }

  let subdivision;
  if (data.id) {
    const existing = await db.subdivision.findFirst({
      where: { id: data.id, countryId },
    });
    if (!existing) {
      throw new Error(`Subdivision not found or does not belong to this country.`);
    }

    const updateData: any = {
      name: data.name,
      type: data.type,
      level: data.level,
      governorName: data.governorName,
      budgetShare: data.budgetShare,
      governmentType: data.governmentType,
      color: data.color,
      population: data.population,
      gdpContribution: data.gdpContribution,
      status: "approved",
    };

    if (geometry) {
      updateData.geometry = geometry;
    }

    if (data.areaSqKm !== undefined) {
      updateData.areaSqKm = data.areaSqKm;
    } else if (geometry) {
      updateData.areaSqKm = geometryAreaSqKm(geometry);
    }

    subdivision = await db.subdivision.update({
      where: { id: data.id },
      data: updateData,
    });
  } else {
    const defaultGeometry = geometry || { type: "Polygon", coordinates: [] };
    const areaSqKm = data.areaSqKm ?? geometryAreaSqKm(defaultGeometry);
    subdivision = await db.subdivision.create({
      data: {
        countryId,
        name: data.name,
        type: data.type || "province",
        level: data.level || 1,
        geometry: defaultGeometry,
        governorName: data.governorName,
        budgetShare: data.budgetShare,
        governmentType: data.governmentType,
        color: data.color,
        population: data.population || 0,
        areaSqKm,
        gdpContribution: data.gdpContribution || 0,
        status: "approved",
        submittedBy: data.submittedBy || "owner",
      },
    });
  }

  // Force PostGIS triggers to run by updating geom_postgis from geometry
  if (
    subdivision &&
    subdivision.geometry &&
    (subdivision.geometry as any).coordinates &&
    (subdivision.geometry as any).coordinates.length > 0
  ) {
    try {
      await db.$executeRawUnsafe(
        `UPDATE subdivisions SET geom_postgis = ST_GeomFromGeoJSON($1) WHERE id = $2`,
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
  const { validatePointContainment } = await import("~/lib/geo-validation");

  if (data.coordinates) {
    const coords = data.coordinates as any;
    let lng = Array.isArray(coords) ? coords[0] : coords.lng;
    let lat = Array.isArray(coords) ? coords[1] : coords.lat;

    const { snapPointToCountryBorder } = await import("~/lib/geo-validation");
    const snapped = await snapPointToCountryBorder(db, countryId, Number(lng), Number(lat));
    lng = snapped[0];
    lat = snapped[1];
    data.coordinates = [lng, lat];

    await validatePointContainment(db, countryId, Number(lng), Number(lat), "POI");
  }

  // Auto-detect subdivision containment if requested
  if (
    data.coordinates &&
    (data.subdivisionId === "auto" ||
      data.subdivisionId === undefined ||
      data.subdivisionId === null)
  ) {
    const coords = data.coordinates as any;
    const lng = Array.isArray(coords) ? coords[0] : coords.lng;
    const lat = Array.isArray(coords) ? coords[1] : coords.lat;
    const autoSub = await findSubdivisionAtPoint(db, countryId, Number(lng), Number(lat));
    data.subdivisionId = autoSub ? autoSub.id : null;
  } else if (data.subdivisionId === "none") {
    data.subdivisionId = null;
  }

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

  // Force PostGIS triggers to run
  if (poi && poi.coordinates) {
    try {
      const coords = poi.coordinates as any;
      const lng = Array.isArray(coords) ? coords[0] : coords.lng;
      const lat = Array.isArray(coords) ? coords[1] : coords.lat;
      await db.$executeRawUnsafe(
        `UPDATE points_of_interest SET geom_postgis = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
        Number(lng),
        Number(lat),
        poi.id
      );
    } catch (err) {
      console.warn(`[upsertPoi] Failed to manually sync PostGIS coordinate:`, err);
    }
  }

  return poi;
}

/**
 * Upsert a Story Pin
 */
export async function upsertStoryPin(db: any, countryId: string, data: any): Promise<any> {
  const { validatePointContainment } = await import("~/lib/geo-validation");

  if (data.coordinates) {
    const coords = data.coordinates as any;
    let lng = Array.isArray(coords) ? coords[0] : coords.lng;
    let lat = Array.isArray(coords) ? coords[1] : coords.lat;

    const { snapPointToCountryBorder } = await import("~/lib/geo-validation");
    const snapped = await snapPointToCountryBorder(db, countryId, Number(lng), Number(lat));
    lng = snapped[0];
    lat = snapped[1];
    data.coordinates = [lng, lat];

    await validatePointContainment(db, countryId, Number(lng), Number(lat), "Story Pin");
  }

  let storyPin;
  if (data.id) {
    const existing = await db.storyPin.findFirst({
      where: { id: data.id, countryId },
    });
    if (!existing) {
      throw new Error(`Story Pin not found or does not belong to this country.`);
    }

    storyPin = await db.storyPin.update({
      where: { id: data.id },
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        coordinates: data.coordinates,
        ixTimeYear: data.ixTimeYear,
        status: "approved",
      },
    });
  } else {
    storyPin = await db.storyPin.create({
      data: {
        countryId,
        title: data.title,
        content: data.content,
        category: data.category,
        coordinates: data.coordinates,
        ixTimeYear: data.ixTimeYear,
        status: "approved",
        submittedBy: data.submittedBy || "owner",
      },
    });
  }

  // Force PostGIS triggers to run
  if (storyPin && storyPin.coordinates) {
    try {
      const coords = storyPin.coordinates as any;
      const lng = Array.isArray(coords) ? coords[0] : coords.lng;
      const lat = Array.isArray(coords) ? coords[1] : coords.lat;
      await db.$executeRawUnsafe(
        `UPDATE story_pins SET geom_postgis = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
        Number(lng),
        Number(lat),
        storyPin.id
      );
    } catch (err) {
      console.warn(`[upsertStoryPin] Failed to manually sync PostGIS coordinate:`, err);
    }
  }

  return storyPin;
}

/**
 * Upsert a Map Label
 */
export async function upsertMapLabel(db: any, countryId: string, data: any): Promise<any> {
  const { validatePointContainment } = await import("~/lib/geo-validation");

  if (data.coordinates) {
    const coords = data.coordinates as any;
    let lng = Array.isArray(coords) ? coords[0] : coords.lng;
    let lat = Array.isArray(coords) ? coords[1] : coords.lat;

    const { snapPointToCountryBorder } = await import("~/lib/geo-validation");
    const snapped = await snapPointToCountryBorder(db, countryId, Number(lng), Number(lat));
    lng = snapped[0];
    lat = snapped[1];
    data.coordinates = [lng, lat];

    await validatePointContainment(db, countryId, Number(lng), Number(lat), "Map Label");
  }

  let mapLabel;
  if (data.id) {
    const existing = await db.mapLabel.findFirst({
      where: { id: data.id, countryId },
    });
    if (!existing) {
      throw new Error(`Map Label not found or does not belong to this country.`);
    }

    mapLabel = await db.mapLabel.update({
      where: { id: data.id },
      data: {
        text: data.text,
        labelType: data.labelType,
        coordinates: data.coordinates,
        fontSize: data.fontSize,
        color: data.color,
        rotation: data.rotation,
        opacity: data.opacity,
        letterSpacing: data.letterSpacing,
        fontWeight: data.fontWeight,
        minZoom: data.minZoom,
        maxZoom: data.maxZoom,
        status: "approved",
      },
    });
  } else {
    mapLabel = await db.mapLabel.create({
      data: {
        countryId,
        text: data.text,
        labelType: data.labelType,
        coordinates: data.coordinates,
        fontSize: data.fontSize || 14,
        color: data.color || "#374151",
        rotation: data.rotation !== undefined ? data.rotation : 0,
        opacity: data.opacity !== undefined ? data.opacity : 1.0,
        letterSpacing: data.letterSpacing !== undefined ? data.letterSpacing : 0,
        fontWeight: data.fontWeight || "normal",
        minZoom: data.minZoom !== undefined ? data.minZoom : 4,
        maxZoom: data.maxZoom !== undefined ? data.maxZoom : 18,
        status: "approved",
        submittedBy: data.submittedBy || "owner",
      },
    });
  }

  // Force PostGIS triggers to run
  if (mapLabel && mapLabel.coordinates) {
    try {
      const coords = mapLabel.coordinates as any;
      const lng = Array.isArray(coords) ? coords[0] : coords.lng;
      const lat = Array.isArray(coords) ? coords[1] : coords.lat;
      await db.$executeRawUnsafe(
        `UPDATE map_labels SET geom_postgis = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
        Number(lng),
        Number(lat),
        mapLabel.id
      );
    } catch (err) {
      console.warn(`[upsertMapLabel] Failed to manually sync PostGIS coordinate:`, err);
    }
  }

  return mapLabel;
}
