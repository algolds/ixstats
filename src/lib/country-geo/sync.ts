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
 * Distributes subdivision populations and GDP contributions down to the subdivision's approved cities.
 * Uses either scaling proportional to existing populations or predefined category/status weights.
 */
export async function distributeSubdivisionDemographicsToCities(
  db: any,
  countryId: string,
  scaleExisting: boolean
) {
  // 1. Fetch subdivisions for the country
  const subdivisions = await db.subdivision.findMany({
    where: { countryId, status: "approved" },
  });

  let totalCitiesUpdated = 0;

  // 2. Iterate subdivisions
  for (const sub of subdivisions) {
    const subPop = sub.population ?? 0;
    const subGdp = sub.gdpContribution ?? 0;

    if (subPop <= 0) continue;

    // Fetch approved cities in this subdivision
    const cities = await db.city.findMany({
      where: { subdivisionId: sub.id, countryId, status: "approved" },
    });

    if (cities.length === 0) continue;

    let useScaling = scaleExisting;
    let citiesSumPop = 0;
    if (useScaling) {
      citiesSumPop = cities.reduce((sum: number, c: any) => sum + (c.population ?? 0), 0);
      if (citiesSumPop <= 0) {
        useScaling = false; // Fallback to weights if sum of existing population is 0
      }
    }

    const cityUpdates: Array<{ id: string; population: number; gdpContribution: number }> = [];

    if (useScaling) {
      // Scale existing population proportionally
      const popScale = subPop / citiesSumPop;
      const gdpPerCapita = subPop > 0 ? subGdp / subPop : 0;

      let allocatedPop = 0;
      let allocatedGdp = 0;

      for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        let pop = Math.round((city.population ?? 0) * popScale);
        let gdp = pop * gdpPerCapita;

        // Rounding adjustment for last city
        if (i === cities.length - 1) {
          pop = subPop - allocatedPop;
          gdp = subGdp - allocatedGdp;
        }

        allocatedPop += pop;
        allocatedGdp += gdp;

        cityUpdates.push({ id: city.id, population: pop, gdpContribution: gdp });
      }
    } else {
      // Predefined weights
      // National Capital = 5.0
      // Subdivision Capital = 3.0
      // standard City/major = 2.0
      // Town = 0.5
      // other/Village = 0.1
      const getWeight = (c: any) => {
        if (c.isNationalCapital) return 5.0;
        if (c.isSubdivisionCapital || c.name === sub.capital) return 3.0;
        if (c.type === "city" || c.type === "major") return 2.0;
        if (c.type === "town") return 0.5;
        return 0.1;
      };

      const weights = cities.map((c: any) => ({ city: c, w: getWeight(c) }));
      const sumWeights = weights.reduce((sum: number, item: { w: number }) => sum + item.w, 0);

      const gdpPerCapita = subPop > 0 ? subGdp / subPop : 0;

      let allocatedPop = 0;
      let allocatedGdp = 0;

      for (let i = 0; i < weights.length; i++) {
        const { city, w } = weights[i];
        let pop = Math.round(subPop * (w / sumWeights));
        let gdp = pop * gdpPerCapita;

        // Rounding adjustment for last city
        if (i === weights.length - 1) {
          pop = subPop - allocatedPop;
          gdp = subGdp - allocatedGdp;
        }

        allocatedPop += pop;
        allocatedGdp += gdp;

        cityUpdates.push({ id: city.id, population: pop, gdpContribution: gdp });
      }
    }

    // Write updates to database
    for (const update of cityUpdates) {
      await db.city.update({
        where: { id: update.id },
        data: {
          population: update.population,
          gdpContribution: update.gdpContribution,
        },
      });
      totalCitiesUpdated++;
    }
  }

  return { success: true, totalCitiesUpdated };
}
