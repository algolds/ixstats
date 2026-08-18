/**
 * Realm Map Committer Service
 *
 * Atomic database transaction service for committing an EnrichedMapPackage
 * (7 GeoJSON layers, skeleton Countries, Cities, Rivers, GeoProfiles, Resources, and SharedVertices)
 * under a specific realmId.
 */

import type { PrismaClient } from "@prisma/client";
import type { EnrichedMapPackage } from "./enrichment-pipeline";
import type {
  NormalizedCountryPayload,
  NormalizedCityPayload,
  NormalizedRiverPayload,
} from "./azgaar-normalizer";

export interface CommitRealmMapInput {
  realmId: string;
  enrichedPackage: EnrichedMapPackage;
  countries: NormalizedCountryPayload[];
  cities?: NormalizedCityPayload[];
  rivers?: NormalizedRiverPayload[];
  replaceExisting?: boolean;
}

export interface CommitRealmMapResult {
  success: boolean;
  realmId: string;
  layersCommitted: number;
  countriesCommitted: number;
  citiesCommitted: number;
  riversCommitted: number;
  resourcesCommitted: number;
  sharedVerticesCommitted: number;
  log: string[];
}

/**
 * Commit a complete enriched map package to the database atomically under a specific realmId.
 */
export async function commitRealmMapToDatabase(
  db: PrismaClient,
  input: CommitRealmMapInput
): Promise<CommitRealmMapResult> {
  const {
    realmId,
    enrichedPackage,
    countries,
    cities = [],
    rivers = [],
    replaceExisting = true,
  } = input;
  const log: string[] = [...enrichedPackage.log];
  log.push(`[RealmCommitter] Committing map package for realm: ${realmId}`);

  let layersCommitted = 0;
  let countriesCommitted = 0;
  let citiesCommitted = 0;
  let riversCommitted = 0;
  let resourcesCommitted = 0;
  let sharedVerticesCommitted = 0;

  await db.$transaction(async (tx) => {
    // 1. Clear existing map layers for this realm if replaceExisting is true
    if (replaceExisting) {
      await tx.mapLayer.deleteMany({
        where: { worldId: realmId },
      });
      await tx.sharedVertex.deleteMany({
        where: { worldId: realmId },
      });
      log.push(
        `[RealmCommitter] Cleared existing MapLayers and SharedVertices for realm: ${realmId}`
      );
    }

    // 2. Commit MapLayers (all 7 GeoJSON feature collections)
    for (const [layerType, collection] of Object.entries(enrichedPackage.layers)) {
      if (!collection || !collection.features) continue;

      for (const feat of collection.features) {
        const props = feat.properties || {};
        const featureId = String(
          props.id || props.featureId || props._id || `${layerType}_${layersCommitted}`
        );

        await tx.mapLayer.create({
          data: {
            layerType,
            featureId,
            geometry: feat.geometry as any,
            properties: props as any,
            displayName: String(props.name || props._displayName || featureId),
            areaSqKm: Number(props.areaSqKm || props._areaSqKm || 0) || null,
            centroid:
              props._centroidLng !== undefined ? [props._centroidLng, props._centroidLat] : null,
            boundingBox: props.boundingBox || null,
            worldId: realmId,
            isActive: true,
          },
        });
        layersCommitted++;
      }
    }
    log.push(`[RealmCommitter] Committed ${layersCommitted} MapLayer records across 7 layers`);

    // 3. Upsert Skeleton Country records for the realm
    const countryMap = new Map<string, string>(); // featureId -> Country.id

    for (const c of countries) {
      const slug = c.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const countryRecord = await tx.country.upsert({
        where: {
          slug_realmId: {
            slug,
            realmId,
          },
        },
        update: {
          name: c.name,
          color: c.color,
          boundingBox: c.boundingBox as any,
          geometry: c.centroid as any, // initial marker
          updatedAt: new Date(),
        },
        create: {
          name: c.name,
          slug,
          realmId,
          color: c.color,
          boundingBox: c.boundingBox as any,
          geometry: c.centroid as any,
        },
      });

      countryMap.set(c.featureId, countryRecord.id);
      countriesCommitted++;

      // Attach MapLayer countryId linkage
      await tx.mapLayer.updateMany({
        where: { worldId: realmId, layerType: "political", featureId: c.featureId },
        data: { countryId: countryRecord.id },
      });

      // Upsert CountryGeoProfile
      const profileData = enrichedPackage.geoProfiles.find(
        (p) => p.countryFeatureId === c.featureId
      );
      if (profileData) {
        await tx.countryGeoProfile.upsert({
          where: { countryId: countryRecord.id },
          update: {
            climateDistribution: profileData.climateDistribution as any,
            elevationProfile: profileData.elevationProfile as any,
            arableLandPercent: profileData.arableLandPercent,
            coastlineKm: profileData.coastlineKm,
            isLandlocked: profileData.isLandlocked,
            isIsland: profileData.isIsland,
            riverKm: profileData.riverKm,
            lakeAreaSqKm: profileData.lakeAreaSqKm,
            neighborCount: profileData.neighborCount,
            dominantClimate: profileData.dominantClimate,
            dominantElevation: profileData.dominantElevation,
            meanElevation: profileData.meanElevation,
            gdpModifier: profileData.gdpModifier,
            tradeModifier: profileData.tradeModifier,
            infraCostModifier: profileData.infraCostModifier,
            lastCalculatedAt: new Date(),
          },
          create: {
            countryId: countryRecord.id,
            climateDistribution: profileData.climateDistribution as any,
            elevationProfile: profileData.elevationProfile as any,
            arableLandPercent: profileData.arableLandPercent,
            coastlineKm: profileData.coastlineKm,
            isLandlocked: profileData.isLandlocked,
            isIsland: profileData.isIsland,
            riverKm: profileData.riverKm,
            lakeAreaSqKm: profileData.lakeAreaSqKm,
            neighborCount: profileData.neighborCount,
            dominantClimate: profileData.dominantClimate,
            dominantElevation: profileData.dominantElevation,
            meanElevation: profileData.meanElevation,
            gdpModifier: profileData.gdpModifier,
            tradeModifier: profileData.tradeModifier,
            infraCostModifier: profileData.infraCostModifier,
          },
        });
      }

      // Upsert GeographicResources
      const countryResources = enrichedPackage.resources.filter(
        (r) => r.countryFeatureId === c.featureId
      );
      for (const res of countryResources) {
        await tx.geographicResource.create({
          data: {
            countryId: countryRecord.id,
            resourceType: res.resourceType,
            name: res.name,
            coordinates: res.coordinates as any,
            quantity: res.quantity,
            quality: res.quality,
            climateZone: res.climateZone || null,
            elevationZone: res.elevationZone || null,
          },
        });
        resourcesCommitted++;
      }
    }
    log.push(
      `[RealmCommitter] Committed ${countriesCommitted} Countries and ${resourcesCommitted} GeographicResources`
    );

    // 4. Commit Cities
    for (const city of cities) {
      const countryId = countryMap.get(city.countryFeatureId);
      if (!countryId) continue;

      await tx.city.create({
        data: {
          countryId,
          realmId,
          name: city.name,
          type: city.type,
          coordinates: city.coordinates as any,
          population: city.population,
          isNationalCapital: city.isCapital,
          status: "approved",
          submittedBy: "system_realm_pipeline",
        },
      });
      citiesCommitted++;
    }
    log.push(`[RealmCommitter] Committed ${citiesCommitted} Cities`);

    // 5. Commit Named Rivers
    if (rivers.length > 0 && countriesCommitted > 0) {
      const defaultCountryId = Array.from(countryMap.values())[0];
      if (defaultCountryId) {
        for (const riv of rivers) {
          await tx.namedRiver.create({
            data: {
              countryId: defaultCountryId,
              realmId,
              name: riv.name,
              geometry: riv.geometry,
              lengthKm: riv.lengthKm,
              status: "approved",
              submittedBy: "system_realm_pipeline",
            },
          });
          riversCommitted++;
        }
      }
    }
    log.push(`[RealmCommitter] Committed ${riversCommitted} NamedRivers`);

    // 6. Commit SharedVertices for synchronized border editing
    for (const sv of enrichedPackage.sharedVertices) {
      await tx.sharedVertex.create({
        data: {
          lng: sv.lng,
          lat: sv.lat,
          featureRefs: sv.featureRefs as any,
          worldId: realmId,
        },
      });
      sharedVerticesCommitted++;
    }
    log.push(`[RealmCommitter] Committed ${sharedVerticesCommitted} SharedVertices`);
  });

  return {
    success: true,
    realmId,
    layersCommitted,
    countriesCommitted,
    citiesCommitted,
    riversCommitted,
    resourcesCommitted,
    sharedVerticesCommitted,
    log,
  };
}
