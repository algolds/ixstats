import { getCountryColor } from "~/lib/map-config";
import { featureIdToDisplayName } from "~/lib/map-utils";
import { getTerrainAtPoint } from "~/lib/base-layer-query";
import { geometryAreaSqKm } from "~/lib/geo-math";

/**
 * Sync helper to keep Country cached geo columns up to date with its MapLayer political geometry.
 * Collapses the double-write points in the codebase.
 */
export async function syncCountryGeometryFromMapLayer(db: any, countryId: string): Promise<void> {
  const mapLayer = await db.mapLayer.findFirst({
    where: {
      layerType: "political",
      countryId,
      isActive: true,
    },
    select: {
      geometry: true,
      centroid: true,
      boundingBox: true,
      areaSqKm: true,
    },
  });

  if (mapLayer) {
    await db.country.update({
      where: { id: countryId },
      data: {
        geometry: mapLayer.geometry as any,
        centroid: mapLayer.centroid as any,
        boundingBox: mapLayer.boundingBox as any,
        landArea: mapLayer.areaSqKm,
        areaSqMi: mapLayer.areaSqKm ? mapLayer.areaSqKm * 0.386102 : null,
      },
    });
  } else {
    // If no active political layer is linked, clear the cached fields
    await db.country.update({
      where: { id: countryId },
      data: {
        geometry: null,
        centroid: null,
        boundingBox: null,
        landArea: null,
        areaSqMi: null,
      },
    });
  }
}

/**
 * Builds a unified geographic data bundle for a country, reducing client round-trips
 * and ensuring attribute and spatial data are fetched together.
 */
export async function getCountryGeoBundle(db: any, countryId: string) {
  // 1. Fetch Country base information
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: {
      id: true,
      name: true,
      slug: true,
      currentPopulation: true,
      currentTotalGdp: true,
      geoRollupMode: true,
      geometry: true,
      centroid: true,
      boundingBox: true,
      landArea: true,
      areaSqMi: true,
    },
  });

  if (!country) {
    throw new Error(`Country not found: ${countryId}`);
  }

  // 2. Fetch the active political MapLayer for this country
  const mapLayer = await db.mapLayer.findFirst({
    where: {
      layerType: "political",
      countryId,
      isActive: true,
    },
  });

  // Derive geometry details, falling back to cached country columns
  const geometry = (mapLayer?.geometry || country.geometry) ?? null;
  const centroid = (mapLayer?.centroid || country.centroid) ?? null;
  const boundingBox = (mapLayer?.boundingBox || country.boundingBox) ?? null;
  const areaSqKm = (mapLayer?.areaSqKm || country.landArea) ?? null;
  const displayName = mapLayer?.displayName || country.name;
  const featureId = mapLayer?.featureId ?? null;
  const fillColor = featureId ? getCountryColor(featureId) : null;

  // Parse centroid into standardized { lng, lat } format
  let parsedCentroid: { lng: number; lat: number } | null = null;
  if (Array.isArray(centroid) && centroid.length >= 2) {
    parsedCentroid = { lng: Number(centroid[0]), lat: Number(centroid[1]) };
  } else if (
    centroid &&
    typeof centroid === "object" &&
    "coordinates" in centroid &&
    Array.isArray((centroid as any).coordinates)
  ) {
    parsedCentroid = {
      lng: Number((centroid as any).coordinates[0]),
      lat: Number((centroid as any).coordinates[1]),
    };
  }

  // 3. Fetch neighboring countries via PostGIS spatial query if possible
  let neighbors: Array<{
    featureId: string;
    displayName: string;
    countryId: string | null;
    centroidLng: number;
    centroidLat: number;
  }> = [];

  if (mapLayer && mapLayer.geom_postgis !== null) {
    try {
      const dbNeighbors = (await db.$queryRawUnsafe(
        `SELECT ml2."featureId", ml2."displayName", ml2."countryId",
                (ml2.centroid -> 'coordinates' ->> 0)::float AS "centroidLng",
                (ml2.centroid -> 'coordinates' ->> 1)::float AS "centroidLat"
         FROM map_layers ml1
         JOIN map_layers ml2 ON ml2."layerType" = 'political'
           AND ml2."isActive" = true
           AND ml2.id != ml1.id
           AND ml1.geom_postgis IS NOT NULL
           AND ml2.geom_postgis IS NOT NULL
           AND ST_Touches(ml1.geom_postgis, ml2.geom_postgis)
         WHERE ml1.id = $1`,
        mapLayer.id
      )) as Array<{
        featureId: string;
        displayName: string | null;
        countryId: string | null;
        centroidLng: number | null;
        centroidLat: number | null;
      }>;

      neighbors = dbNeighbors.map((n) => ({
        featureId: n.featureId,
        displayName: n.displayName || featureIdToDisplayName(n.featureId),
        countryId: n.countryId,
        centroidLng: Number(n.centroidLng) || 0,
        centroidLat: Number(n.centroidLat) || 0,
      }));
    } catch (err) {
      console.warn(`[getCountryGeoBundle] Failed to calculate neighbors via PostGIS:`, err);
    }
  }

  // 4. Fetch subdivisions, cities, points of interest, story pins, and map labels in parallel
  const [subdivisions, cities, pois, storyPins, mapLabels] = await Promise.all([
    db.subdivision.findMany({
      where: { countryId, status: "approved" },
      orderBy: { name: "asc" },
    }),
    db.city.findMany({
      where: { countryId, status: "approved" },
      orderBy: [{ isNationalCapital: "desc" }, { population: "desc" }],
    }),
    db.pointOfInterest.findMany({
      where: { countryId, status: "approved" },
      orderBy: { name: "asc" },
    }),
    db.storyPin.findMany({
      where: { countryId, status: "approved" },
      orderBy: { ixTimeYear: "asc" },
    }),
    db.mapLabel.findMany({
      where: { countryId, status: "approved" },
      orderBy: { text: "asc" },
    }),
  ]);

  // 5. Fetch country geographic profile
  const geoProfile = await db.countryGeoProfile.findUnique({
    where: { countryId },
  });

  // 6. Compute rollups & coverage ratios (Phase P-D preparation)
  const cityPopulationSum = cities.reduce((sum: number, c: any) => sum + (c.population ?? 0), 0);
  const subdivisionPopulationSum = subdivisions.reduce(
    (sum: number, s: any) => sum + (s.population ?? 0),
    0
  );

  const cityGdpContributionSum = cities.reduce(
    (sum: number, c: any) => sum + (c.gdpContribution ?? 0),
    0
  );
  const subdivisionGdpContributionSum = subdivisions.reduce(
    (sum: number, s: any) => sum + (s.gdpContribution ?? 0),
    0
  );

  let reconciledSubdivisions = subdivisions;
  let reconciledCities = cities;
  let populationCoverage =
    country.currentPopulation > 0 ? subdivisionPopulationSum / country.currentPopulation : 0;

  let gdpCoverage =
    country.currentTotalGdp > 0 ? subdivisionGdpContributionSum / country.currentTotalGdp : 0;

  // Apply top-down scaling on display values if in top-down mode
  if (country.geoRollupMode === "top-down") {
    populationCoverage = 1.0;
    gdpCoverage = 1.0;

    if (subdivisionPopulationSum > 0 || subdivisionGdpContributionSum > 0) {
      const popScale =
        subdivisionPopulationSum > 0 ? country.currentPopulation / subdivisionPopulationSum : 1;
      const gdpScale =
        subdivisionGdpContributionSum > 0
          ? country.currentTotalGdp / subdivisionGdpContributionSum
          : 1;

      reconciledSubdivisions = subdivisions.map((s: any) => ({
        ...s,
        population: s.population ? Math.round(s.population * popScale) : 0,
        gdpContribution: s.gdpContribution ? s.gdpContribution * gdpScale : 0,
      }));
    }

    if (cityPopulationSum > 0 || cityGdpContributionSum > 0) {
      const popScale = cityPopulationSum > 0 ? country.currentPopulation / cityPopulationSum : 1;
      const gdpScale =
        cityGdpContributionSum > 0 ? country.currentTotalGdp / cityGdpContributionSum : 1;

      reconciledCities = cities.map((c: any) => {
        const hasPopShare =
          c.populationShare !== null && c.populationShare !== undefined && c.populationShare > 0;
        const pop = hasPopShare
          ? Math.round(country.currentPopulation * (c.populationShare / 100))
          : c.population
            ? Math.round(c.population * popScale)
            : 0;

        const gdp = c.gdpContribution ? c.gdpContribution * gdpScale : 0;
        return {
          ...c,
          population: pop,
          gdpContribution: gdp,
        };
      });
    }
  }

  return {
    country: {
      id: country.id,
      name: country.name,
      slug: country.slug,
      geoRollupMode: country.geoRollupMode,
      currentPopulation: country.currentPopulation,
      currentTotalGdp: country.currentTotalGdp,
    },
    geometry,
    centroid: parsedCentroid,
    boundingBox,
    areaSqKm,
    displayName,
    featureId,
    fillColor,
    subdivisions: reconciledSubdivisions,
    cities: reconciledCities,
    pois,
    storyPins,
    mapLabels,
    neighbors,
    geoProfile,
    rollups: {
      cityPopulationSum,
      subdivisionPopulationSum,
      cityGdpContributionSum,
      subdivisionGdpContributionSum,
      populationCoverage,
      gdpCoverage,
    },
  };
}

/**
 * Validate a point is within a country's borders using PostGIS.
 * Returns true if inside, false if outside or query fails.
 */
export async function checkPointInCountryTerritory(
  db: any,
  countryId: string,
  lng: number,
  lat: number
): Promise<boolean> {
  const { validatePointContainment } = await import("~/lib/geo-validation");
  try {
    await validatePointContainment(db, countryId, lng, lat);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recalculates the largest city based on population and updates NationalIdentity cache.
 */
export async function recalculateLargestCity(db: any, countryId: string): Promise<void> {
  const largestCity = await db.city.findFirst({
    where: {
      countryId,
      status: "approved",
      population: { not: null },
    },
    orderBy: {
      population: "desc",
    },
  });

  if (largestCity) {
    await db.nationalIdentity.upsert({
      where: { countryId },
      update: {
        largestCityId: largestCity.id,
        largestCity: largestCity.name,
      },
      create: {
        countryId,
        largestCity: largestCity.name,
        largestCityId: largestCity.id,
      },
    });
  } else {
    await db.nationalIdentity.upsert({
      where: { countryId },
      update: {
        largestCityId: null,
        largestCity: null,
      },
      create: {
        countryId,
        largestCity: null,
        largestCityId: null,
      },
    });
  }
}

/**
 * Syncs subdivision and country demographics from child cities and subdivisions.
 */
export async function syncGeographicDemographics(
  db: any,
  countryId: string,
  subdivisionId?: string | null
) {
  if (subdivisionId) {
    const citiesSum = await db.city.aggregate({
      where: { subdivisionId, status: "approved" },
      _sum: { population: true, gdpContribution: true },
    });
    const subPop = citiesSum._sum.population ?? 0;
    const subGdp = citiesSum._sum.gdpContribution ?? 0;
    await db.subdivision.update({
      where: { id: subdivisionId },
      data: {
        population: subPop,
        gdpContribution: subGdp,
      },
    });
  }

  // Fetch the country rollup mode to see if we should sync to the national baseline
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { geoRollupMode: true },
  });

  if (!country || country.geoRollupMode !== "bottom-up") {
    return;
  }

  const subdivisionsSum = await db.subdivision.aggregate({
    where: { countryId, status: "approved" },
    _sum: { population: true, gdpContribution: true },
  });
  let totalSubPop = subdivisionsSum._sum.population ?? 0;
  let totalSubGdp = subdivisionsSum._sum.gdpContribution ?? 0;

  // Fallback to cities if no subdivisions exist/are approved
  if (totalSubPop === 0 && totalSubGdp === 0) {
    const citiesSum = await db.city.aggregate({
      where: { countryId, status: "approved" },
      _sum: { population: true, gdpContribution: true },
    });
    totalSubPop = citiesSum._sum.population ?? 0;
    totalSubGdp = citiesSum._sum.gdpContribution ?? 0;
  }

  if (totalSubPop > 0) {
    const gdpPerCapita = totalSubGdp / totalSubPop;
    await db.country.update({
      where: { id: countryId },
      data: {
        currentPopulation: totalSubPop,
        currentTotalGdp: totalSubGdp,
        currentGdpPerCapita: gdpPerCapita,
      },
    });
  }
}

/**
 * Upsert a City and handle all cascading changes (NationalIdentity, largestCity, subdivisions, etc.)
 */
export async function upsertCity(db: any, countryId: string, data: any): Promise<any> {
  const input = data;
  const isNew = !data.id;
  const { validatePointContainment } = await import("~/lib/geo-validation");

  if (data.coordinates) {
    const coords = data.coordinates as any;
    const lng = Array.isArray(coords) ? coords[0] : coords.lng;
    const lat = Array.isArray(coords) ? coords[1] : coords.lat;
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
    geometry = await clipAndValidatePolygon(db, countryId, geometry, "Subdivision");
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
 * Sets a city as national capital and syncs with NationalIdentity.
 */
export async function setCapital(db: any, countryId: string, cityId: string): Promise<void> {
  const city = await db.city.findFirst({
    where: { id: cityId, countryId },
  });
  if (!city) {
    throw new Error(`City not found or does not belong to this country.`);
  }

  await db.city.updateMany({
    where: { countryId, isNationalCapital: true },
    data: { isNationalCapital: false },
  });

  await db.city.update({
    where: { id: cityId },
    data: { isNationalCapital: true },
  });

  await db.nationalIdentity.upsert({
    where: { countryId },
    update: {
      capitalCityId: cityId,
      capitalCity: city.name,
    },
    create: {
      countryId,
      capitalCityId: cityId,
      capitalCity: city.name,
    },
  });
}

/**
 * Upsert a Point of Interest (POI)
 */
export async function upsertPoi(db: any, countryId: string, data: any): Promise<any> {
  const { validatePointContainment } = await import("~/lib/geo-validation");

  if (data.coordinates) {
    const coords = data.coordinates as any;
    const lng = Array.isArray(coords) ? coords[0] : coords.lng;
    const lat = Array.isArray(coords) ? coords[1] : coords.lat;
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
    const lng = Array.isArray(coords) ? coords[0] : coords.lng;
    const lat = Array.isArray(coords) ? coords[1] : coords.lat;
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
    const lng = Array.isArray(coords) ? coords[0] : coords.lng;
    const lat = Array.isArray(coords) ? coords[1] : coords.lat;
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

/**
 * Update the rollup mode of a country.
 */
export async function updateGeoRollupMode(db: any, countryId: string, mode: string) {
  if (!["hybrid", "top-down", "bottom-up"].includes(mode)) {
    throw new Error(`Invalid rollup mode: ${mode}`);
  }

  const country = await db.country.update({
    where: { id: countryId },
    data: { geoRollupMode: mode },
  });

  // If switched to bottom-up, sync demographics immediately
  if (mode === "bottom-up") {
    await syncGeographicDemographics(db, countryId);
  }

  return country;
}

/**
 * Rebase the country's national population and GDP totals to match geographic sums.
 */
export async function rebaseNationalFromGeography(db: any, countryId: string) {
  const subdivisionsSum = await db.subdivision.aggregate({
    where: { countryId, status: "approved" },
    _sum: { population: true, gdpContribution: true },
  });

  let totalPop = subdivisionsSum._sum.population ?? 0;
  let totalGdp = subdivisionsSum._sum.gdpContribution ?? 0;

  // Fallback to cities if no subdivisions are present/approved
  if (totalPop === 0 && totalGdp === 0) {
    const citiesSum = await db.city.aggregate({
      where: { countryId, status: "approved" },
      _sum: { population: true, gdpContribution: true },
    });
    totalPop = citiesSum._sum.population ?? 0;
    totalGdp = citiesSum._sum.gdpContribution ?? 0;
  }

  if (totalPop <= 0) {
    throw new Error("Cannot rebase: geographic population must be greater than zero.");
  }

  const gdpPerCapita = totalGdp / totalPop;

  const country = await db.country.update({
    where: { id: countryId },
    data: {
      currentPopulation: totalPop,
      currentTotalGdp: totalGdp,
      currentGdpPerCapita: gdpPerCapita,
    },
  });

  return country;
}

/**
 * Find Subdivision at coordinate point using PostGIS contains check.
 */
export async function findSubdivisionAtPoint(
  db: any,
  countryId: string,
  lng: number,
  lat: number
): Promise<any> {
  try {
    const results = (await db.$queryRawUnsafe(
      `
      SELECT id, name FROM subdivisions
      WHERE "countryId" = $1 AND status = 'approved'
        AND geom_postgis IS NOT NULL
        AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($2, $3), 4326))
      LIMIT 1
    `,
      countryId,
      lng,
      lat
    )) as Array<{ id: string; name: string }>;

    if (results.length > 0) {
      return results[0];
    }
  } catch (err) {
    console.error(`[findSubdivisionAtPoint] Failed:`, err);
  }
  return null;
}

/**
 * Compute and update spatial profiles (climate, elevation, water) for a Subdivision
 */
export async function updateSubdivisionSpatialProfile(
  db: any,
  subdivisionId: string
): Promise<any> {
  const subdivision = await db.subdivision.findUnique({
    where: { id: subdivisionId },
    select: { id: true, geometry: true, areaSqKm: true },
  });

  if (!subdivision || !subdivision.geometry || Object.keys(subdivision.geometry).length === 0) {
    return null;
  }

  const { resolveClimateFromColor, getAgricultureFactor, ELEVATION_ZONES } =
    await import("~/lib/geo-analytics");

  try {
    // 1. Climate distribution
    const climateResults = (await db.$queryRawUnsafe(
      `
      SELECT 
        ml.properties->>'fill' as fill,
        ST_Area(ST_Intersection(s.geom_postgis, ml.geom_postgis)::geography) / 1000000.0 as "intersectAreaSqKm"
      FROM subdivisions s
      JOIN map_layers ml ON ml."layerType" = 'climate' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
      WHERE s.id = $1
        AND ST_Intersects(s.geom_postgis, ml.geom_postgis)
    `,
      subdivisionId
    )) as Array<{ fill: string; intersectAreaSqKm: number }>;

    const climateMap = new Map<string, number>();
    for (const r of climateResults) {
      if (!r.fill || r.intersectAreaSqKm <= 0) continue;
      const climateName = resolveClimateFromColor(r.fill);
      if (climateName) {
        climateMap.set(
          climateName,
          (climateMap.get(climateName) ?? 0) + Number(r.intersectAreaSqKm)
        );
      }
    }

    const totalClimateArea = Array.from(climateMap.values()).reduce((sum, a) => sum + a, 0);
    const climateProfile = Array.from(climateMap.entries()).map(([climateName, areaSqKm]) => ({
      type: climateName,
      name: climateName,
      percentArea:
        totalClimateArea > 0 ? Math.round((areaSqKm / totalClimateArea) * 100 * 10) / 10 : 0,
      areaSqKm: Math.round(areaSqKm * 100) / 100,
      agricultureFactor: getAgricultureFactor(climateName),
    }));

    // 2. Elevation profile
    const elevationResults = (await db.$queryRawUnsafe(
      `
      SELECT 
        ml.properties->>'fill' as fill,
        ST_Area(ST_Intersection(s.geom_postgis, ml.geom_postgis)::geography) / 1000000.0 as "intersectAreaSqKm"
      FROM subdivisions s
      JOIN map_layers ml ON ml."layerType" = 'altitudes' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
      WHERE s.id = $1
        AND ST_Intersects(s.geom_postgis, ml.geom_postgis)
    `,
      subdivisionId
    )) as Array<{ fill: string; intersectAreaSqKm: number }>;

    const elevationMap = new Map<
      string,
      { name: string; areaSqKm: number; minElev: number; maxElev: number }
    >();
    for (const r of elevationResults) {
      if (!r.fill || r.intersectAreaSqKm <= 0) continue;
      const zoneMatch = ELEVATION_ZONES.find(
        (ez) => ez.color.toLowerCase() === r.fill.toLowerCase()
      );
      if (zoneMatch) {
        const existing = elevationMap.get(zoneMatch.zoneId);
        if (existing) {
          existing.areaSqKm += Number(r.intersectAreaSqKm);
        } else {
          elevationMap.set(zoneMatch.zoneId, {
            name: zoneMatch.zoneName,
            areaSqKm: Number(r.intersectAreaSqKm),
            minElev: zoneMatch.elevationMin,
            maxElev: zoneMatch.elevationMax,
          });
        }
      }
    }

    const totalElevArea = Array.from(elevationMap.values()).reduce((sum, z) => sum + z.areaSqKm, 0);
    const elevationProfile = Array.from(elevationMap.entries()).map(([zoneId, z]) => ({
      zone: zoneId,
      name: z.name,
      percentArea: totalElevArea > 0 ? Math.round((z.areaSqKm / totalElevArea) * 100 * 10) / 10 : 0,
      areaSqKm: Math.round(z.areaSqKm * 100) / 100,
      minElev: z.minElev,
      maxElev: z.maxElev,
    }));

    // 3. Water access (rivers and lakes)
    const riverResult = (await db.$queryRawUnsafe(
      `
      SELECT 
        COALESCE(SUM(ST_Length(ST_Intersection(s.geom_postgis, ml.geom_postgis)::geography) / 1000.0), 0.0) as "riverLengthKm"
      FROM subdivisions s
      JOIN map_layers ml ON ml."layerType" = 'rivers' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
      WHERE s.id = $1
        AND ST_Intersects(s.geom_postgis, ml.geom_postgis)
    `,
      subdivisionId
    )) as Array<{ riverLengthKm: number }>;

    const lakeResult = (await db.$queryRawUnsafe(
      `
      SELECT 
        COALESCE(SUM(ST_Area(ST_Intersection(s.geom_postgis, ml.geom_postgis)::geography) / 1000000.0), 0.0) as "lakeAreaSqKm"
      FROM subdivisions s
      JOIN map_layers ml ON ml."layerType" = 'lakes' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
      WHERE s.id = $1
        AND ST_Intersects(s.geom_postgis, ml.geom_postgis)
    `,
      subdivisionId
    )) as Array<{ lakeAreaSqKm: number }>;

    const riverLengthKm = Number(riverResult[0]?.riverLengthKm) || 0;
    const lakeAreaSqKm = Number(lakeResult[0]?.lakeAreaSqKm) || 0;

    const waterAccess = {
      hasRiver: riverLengthKm > 0,
      hasLake: lakeAreaSqKm > 0,
      riverLengthKm: Math.round(riverLengthKm * 100) / 100,
      lakeAreaSqKm: Math.round(lakeAreaSqKm * 100) / 100,
    };

    // Update the subdivision record
    return await db.subdivision.update({
      where: { id: subdivisionId },
      data: {
        climateProfile: climateProfile as any,
        elevationProfile: elevationProfile as any,
        waterAccess: waterAccess as any,
      },
    });
  } catch (err) {
    console.error(`[updateSubdivisionSpatialProfile] Failed for ${subdivisionId}:`, err);
    return null;
  }
}

/**
 * Compute and update spatial profile (climate, water access) for a City
 */
export async function updateCitySpatialProfile(db: any, cityId: string): Promise<any> {
  const city = await db.city.findUnique({
    where: { id: cityId },
    select: { id: true, coordinates: true },
  });

  if (!city || !city.coordinates) {
    return null;
  }

  const { resolveClimateFromColor } = await import("~/lib/geo-analytics");

  try {
    // 1. Dominant climate
    const climateResult = (await db.$queryRawUnsafe(
      `
      SELECT ml.properties->>'fill' as fill
      FROM cities c
      JOIN map_layers ml ON ml."layerType" = 'climate' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
      WHERE c.id = $1
        AND ST_Contains(ml.geom_postgis, c.geom_postgis)
      LIMIT 1
    `,
      cityId
    )) as Array<{ fill: string }>;

    let climateName = null;
    if (climateResult.length > 0 && climateResult[0]?.fill) {
      climateName = resolveClimateFromColor(climateResult[0].fill);
    }

    // 2. Distance to nearest water body (rivers, lakes)
    const waterDistances = (await db.$queryRawUnsafe(
      `
      SELECT 
        ml."layerType" as "type",
        COALESCE(MIN(ST_Distance(c.geom_postgis::geography, ml.geom_postgis::geography) / 1000.0), 9999.0) as "distance"
      FROM cities c
      JOIN map_layers ml ON ml."isActive" = true AND ml.geom_postgis IS NOT NULL AND ml."layerType" IN ('rivers', 'lakes')
      WHERE c.id = $1
      GROUP BY ml."layerType"
    `,
      cityId
    )) as Array<{ type: string; distance: number }>;

    const riverDist = Number(waterDistances.find((w) => w.type === "rivers")?.distance) ?? 9999.0;
    const lakeDist = Number(waterDistances.find((w) => w.type === "lakes")?.distance) ?? 9999.0;

    // Consider close if within 10km
    const waterAccess = {
      nearRiver: riverDist <= 10.0,
      nearLake: lakeDist <= 10.0,
      riverDistanceKm: Math.round(riverDist * 100) / 100,
      lakeDistanceKm: Math.round(lakeDist * 100) / 100,
    };

    return await db.city.update({
      where: { id: cityId },
      data: {
        climate: climateName,
        waterAccess: waterAccess as any,
      },
    });
  } catch (err) {
    console.error(`[updateCitySpatialProfile] Failed for ${cityId}:`, err);
    return null;
  }
}

/**
 * Auto-generates a draft executive policy/proclamation in the database when new geography is created.
 */
export async function triggerGeographyPolicy(
  db: any,
  countryId: string,
  type: "subdivision" | "city",
  name: string,
  submittedBy?: string
): Promise<void> {
  try {
    const creatorId = submittedBy || "system";
    const title =
      type === "subdivision" ? `Establish Subdivision: ${name}` : `Charter City: ${name}`;
    const desc =
      type === "subdivision"
        ? `Establish administrative, tax, and infrastructure structures for the new subdivision ${name}. This increases regional cohesion but incurs an administrative startup cost.`
        : `Grant municipal charter to the city of ${name}, starting local development programs to spur commerce and population attraction.`;

    await db.policy.create({
      data: {
        countryId,
        userId: creatorId,
        name: title,
        description: desc,
        policyType: "governance",
        category: "governance",
        priority: "medium",
        status: "draft",
        implementationCost: type === "subdivision" ? 500000 : 250000,
        maintenanceCost: type === "subdivision" ? 25000 : 10000,
        objectives: `Enact official administrative control over ${name} to scale regional tax collection and security.`,
        targetMetrics:
          type === "subdivision"
            ? "taxCapacity, politicalStability"
            : "localCommerce, populationFlow",
      },
    });
  } catch (err) {
    console.warn(`[triggerGeographyPolicy] Failed to auto-generate policy for ${name}:`, err);
  }
}
