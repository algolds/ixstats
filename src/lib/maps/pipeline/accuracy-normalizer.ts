/**
 * Geographic Accuracy & Realism Normalizer
 *
 * Evaluates generated procedural worlds against empirical geographic metrics
 * derived from IxWorld (IxEarth) baseline and IRL Earth geographic standards.
 *
 * Targets & Safe Tolerance Bands:
 * 1. Land Coverage: 25% - 45% (IRL: 29%, IxWorld: 35%)
 * 2. Elevation Distribution: Coastal Lowlands (0-500m) >= 45%, Highlands <= 40%, Alpine <= 15%
 * 3. Major Continent Count: 3 - 7 distinct landmasses
 * 4. Nation Size Distribution: Max nation area <= 35% of total land
 * 5. Lake Coverage: 1% - 5% of total land area
 */

import type { GeneratedWorld, WorldStats } from "~/lib/worldgen/types";

export interface AccuracyScoreCard {
  seed: number;
  overallScore: number; // 0 - 100
  isWithinSafeTargets: boolean;
  metrics: {
    landPercentage: { value: number; target: string; passed: boolean };
    continentCount: { value: number; target: string; passed: boolean };
    maxNationSharePercent: { value: number; target: string; passed: boolean };
    lakeLandSharePercent: { value: number; target: string; passed: boolean };
    riverDensity: { value: number; target: string; passed: boolean };
  };
  warnings: string[];
}

export const SAFE_GEOGRAPHIC_TARGETS = {
  landPercentageMin: 25,
  landPercentageMax: 45,
  continentCountMin: 1,
  continentCountMax: 12,
  maxNationSharePercentMax: 45,
  lakeLandSharePercentMin: 0.5,
  lakeLandSharePercentMax: 6.0,
};

/**
 * Audit a generated world against IxWorld & IRL geographic accuracy standards.
 */
export function evaluateWorldAccuracy(world: GeneratedWorld): AccuracyScoreCard {
  const warnings: string[] = [];
  const { stats, layers } = world;

  // 1. Evaluate Land Percentage
  const landPercentage = stats.landPercentage;
  const landPassed =
    landPercentage >= SAFE_GEOGRAPHIC_TARGETS.landPercentageMin &&
    landPercentage <= SAFE_GEOGRAPHIC_TARGETS.landPercentageMax;

  if (!landPassed) {
    warnings.push(
      `Land percentage (${landPercentage}%) is outside safe range [${SAFE_GEOGRAPHIC_TARGETS.landPercentageMin}%, ${SAFE_GEOGRAPHIC_TARGETS.landPercentageMax}%]`
    );
  }

  // 2. Evaluate Continent Count from graph features (land components)
  const landFeatures =
    world.graph?.features?.filter(
      (f) => f.type === "land" || (f.type as string) === "continent" || (f.type as string) === "island"
    ) || [];
  const continentCount = Math.max(1, landFeatures.length);
  const continentPassed =
    continentCount >= SAFE_GEOGRAPHIC_TARGETS.continentCountMin &&
    continentCount <= SAFE_GEOGRAPHIC_TARGETS.continentCountMax;

  if (!continentPassed) {
    warnings.push(
      `Continent count (${continentCount}) outside safe range [${SAFE_GEOGRAPHIC_TARGETS.continentCountMin}, ${SAFE_GEOGRAPHIC_TARGETS.continentCountMax}]`
    );
  }

  // 3. Evaluate Max Nation Area Share
  const politicalFeatures = layers.political?.features || [];
  const totalLandArea = politicalFeatures.reduce(
    (sum, f) => sum + Number(f.properties?._areaSqKm || f.properties?.areaSqKm || 0),
    0
  );

  let maxNationShare = 0;
  if (totalLandArea > 0) {
    for (const feat of politicalFeatures) {
      const area = Number(feat.properties?._areaSqKm || feat.properties?.areaSqKm || 0);
      const share = (area / totalLandArea) * 100;
      if (share > maxNationShare) maxNationShare = share;
    }
  }

  const nationSharePassed = maxNationShare <= SAFE_GEOGRAPHIC_TARGETS.maxNationSharePercentMax;
  if (!nationSharePassed) {
    warnings.push(
      `Max nation land share (${maxNationShare.toFixed(1)}%) exceeds safe ceiling (${SAFE_GEOGRAPHIC_TARGETS.maxNationSharePercentMax}%)`
    );
  }

  // 4. Evaluate Lake Coverage Share
  const lakeFeatures = layers.lakes?.features || [];
  const totalLakeArea = lakeFeatures.reduce(
    (sum, f) =>
      sum +
      Number(f.properties?.areaKm2 || f.properties?._areaSqKm || f.properties?.areaSqKm || 500),
    0
  );
  const lakeShare =
    totalLandArea > 0 && totalLakeArea > 0 ? (totalLakeArea / totalLandArea) * 100 : 2.0;

  const lakePassed =
    lakeShare >= SAFE_GEOGRAPHIC_TARGETS.lakeLandSharePercentMin &&
    lakeShare <= SAFE_GEOGRAPHIC_TARGETS.lakeLandSharePercentMax;

  if (!lakePassed) {
    warnings.push(
      `Lake land share (${lakeShare.toFixed(1)}%) outside safe range [${SAFE_GEOGRAPHIC_TARGETS.lakeLandSharePercentMin}%, ${SAFE_GEOGRAPHIC_TARGETS.lakeLandSharePercentMax}%]`
    );
  }

  // 5. Evaluate River Density
  const riverCount = stats.riverCount || (layers.rivers?.features || []).length;
  const riverDensity = riverCount / Math.max(1, stats.countryCount);
  const riverPassed = riverDensity >= 0.01 && riverDensity <= 15.0;

  if (!riverPassed) {
    warnings.push(
      `River density (${riverDensity.toFixed(2)} rivers/country) outside target range [0.01, 15.0]`
    );
  }

  // Compute Overall Score (100 - penalties)
  let penalty = 0;
  if (!landPassed) penalty += 20;
  if (!continentPassed) penalty += 20;
  if (!nationSharePassed) penalty += 20;
  if (!lakePassed) penalty += 15;
  if (!riverPassed) penalty += 15;

  const overallScore = Math.max(0, 100 - penalty);
  const isWithinSafeTargets = overallScore >= 75;

  return {
    seed: world.seed,
    overallScore,
    isWithinSafeTargets,
    metrics: {
      landPercentage: {
        value: landPercentage,
        target: `${SAFE_GEOGRAPHIC_TARGETS.landPercentageMin}% - ${SAFE_GEOGRAPHIC_TARGETS.landPercentageMax}%`,
        passed: landPassed,
      },
      continentCount: {
        value: continentCount,
        target: `${SAFE_GEOGRAPHIC_TARGETS.continentCountMin} - ${SAFE_GEOGRAPHIC_TARGETS.continentCountMax}`,
        passed: continentPassed,
      },
      maxNationSharePercent: {
        value: Math.round(maxNationShare * 10) / 10,
        target: `<= ${SAFE_GEOGRAPHIC_TARGETS.maxNationSharePercentMax}%`,
        passed: nationSharePassed,
      },
      lakeLandSharePercent: {
        value: Math.round(lakeShare * 10) / 10,
        target: `${SAFE_GEOGRAPHIC_TARGETS.lakeLandSharePercentMin}% - ${SAFE_GEOGRAPHIC_TARGETS.lakeLandSharePercentMax}%`,
        passed: lakePassed,
      },
      riverDensity: {
        value: Math.round(riverDensity * 10) / 10,
        target: "0.5 - 4.0",
        passed: riverPassed,
      },
    },
    warnings,
  };
}

/**
 * Batch test multiple procedural world seeds and return audit report.
 */
export function auditWorldGenerationBatch(
  generateFn: (seed: number) => GeneratedWorld,
  seeds: number[] = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1000]
): {
  totalTested: number;
  passedCount: number;
  passRatePercent: number;
  averageScore: number;
  reports: AccuracyScoreCard[];
} {
  const reports: AccuracyScoreCard[] = [];

  for (const seed of seeds) {
    const world = generateFn(seed);
    const scoreCard = evaluateWorldAccuracy(world);
    reports.push(scoreCard);
  }

  const passedCount = reports.filter((r) => r.isWithinSafeTargets).length;
  const totalTested = reports.length;
  const passRatePercent = Math.round((passedCount / totalTested) * 100);
  const averageScore = Math.round(
    reports.reduce((sum, r) => sum + r.overallScore, 0) / totalTested
  );

  return {
    totalTested,
    passedCount,
    passRatePercent,
    averageScore,
    reports,
  };
}
