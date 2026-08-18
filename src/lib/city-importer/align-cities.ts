import type { AffineMatrix, ReferencePoint } from "~/lib/maps/province-importer/types";
import {
  computeAffineFromReferencePoints,
  applyAffineToPoint,
} from "~/lib/maps/province-importer/alignment";

export interface DbSubdivisionRef {
  name: string;
  centroid: [number, number]; // [lng, lat]
}

export interface SvgProvinceRef {
  name: string;
  svgX: number;
  svgY: number;
}

export interface SvgCityPoint {
  svgX: number;
  svgY: number;
  name: string;
  isCapital: boolean;
}

export interface CityAlignResult {
  matrix: AffineMatrix | null;
  matchCount: number;
  rmse: number;
  unmatchedSvgProvinces: string[];
}

const normalizeName = (name: string): string => {
  return name.trim().toLowerCase();
};

export function deriveCityAffine(
  svgProvinces: SvgProvinceRef[],
  dbSubdivisions: DbSubdivisionRef[]
): CityAlignResult {
  const matchedPairs: ReferencePoint[] = [];
  const unmatchedSvgProvinces: string[] = [];

  const dbMap = new Map<string, DbSubdivisionRef>();
  for (const dbSub of dbSubdivisions) {
    dbMap.set(normalizeName(dbSub.name), dbSub);
  }

  for (const svgProv of svgProvinces) {
    const normName = normalizeName(svgProv.name);
    const dbSub = dbMap.get(normName);
    if (dbSub) {
      matchedPairs.push({
        source: [svgProv.svgX, svgProv.svgY],
        target: dbSub.centroid, // [lng, lat]
      });
    } else {
      unmatchedSvgProvinces.push(svgProv.name);
    }
  }

  const matchCount = matchedPairs.length;

  if (matchCount < 3) {
    return {
      matrix: null,
      matchCount,
      rmse: Infinity,
      unmatchedSvgProvinces,
    };
  }

  const alignResult = computeAffineFromReferencePoints(matchedPairs);

  return {
    matrix: alignResult.matrix,
    matchCount,
    rmse: alignResult.rmse,
    unmatchedSvgProvinces,
  };
}

export function applyCityAffine(
  points: SvgCityPoint[],
  matrix: AffineMatrix
): Array<{ name: string; lat: number; lng: number; isCapital: boolean }> {
  return points.map((pt) => {
    const [lng, lat] = applyAffineToPoint([pt.svgX, pt.svgY], matrix);
    return {
      name: pt.name,
      lat: lat ?? 0,
      lng: lng ?? 0,
      isCapital: pt.isCapital,
    };
  });
}
