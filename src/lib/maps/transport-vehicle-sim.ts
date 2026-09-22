/**
 * transport-vehicle-sim.ts — Procedural vehicle traffic simulation along transport segments.
 *
 * Generates continuous vehicle trip trajectories with timestamps suitable for:
 * 1. deck.gl TripsLayer (hardware-accelerated GPU trails)
 * 2. MapLibre GeoJSON Point layer animation (pure native MapLibre fallback)
 */

import { ROUTE_STYLES } from "~/lib/maps/map-config";

export interface RouteEconomicContext {
  totalGdp?: number | null;
  gdpPerCapita?: number | null;
  economicTier?: string | null;
  population?: number | null;
  isInternational?: boolean | null;
}

export interface TransportSegmentInput {
  id: string;
  routeType: string;
  geometry: {
    type?: string;
    coordinates: [number, number][];
  };
  status?: string;
  lengthKm?: number | null;
  speedKmh?: number | null;
  capacity?: number | null;
  totalGdp?: number | null;
  gdpPerCapita?: number | null;
  economicTier?: string | null;
  isInternational?: boolean | null;
  population?: number | null;
}

export interface VehicleTrip {
  id: string;
  segmentId: string;
  routeType: string;
  path: [number, number][];
  timestamps: number[]; // seconds elapsed along path [0, T]
  durationSec: number;
  color: [number, number, number];
  economicCoeff?: number;
}

export const VEHICLE_COLORS_RGB: Record<string, [number, number, number]> = {
  rail: [148, 163, 184],
  high_speed_rail: [14, 165, 233],
  freight_rail: [100, 116, 139],
  commuter_rail: [71, 85, 105],
  motorway: [234, 88, 12],
  highway: [249, 115, 22],
  trunk: [217, 119, 6],
  road: [245, 158, 11],
  secondary: [168, 162, 158],
  shipping_lane: [59, 130, 246],
  canal: [6, 182, 212],
  ferry: [20, 184, 166],
  air_corridor: [168, 85, 247],
  pipeline: [234, 179, 8],
  power_grid: [245, 158, 11],
  fiber: [229, 231, 235],
  military_supply: [220, 38, 38],
  military_naval: [127, 29, 29],
};

/**
 * Calculates a dynamic economic traffic coefficient (\kappa_econ) based on live national metrics.
 * Modulates between 0.25x (low income / developing backroads) and 2.5x (superpower economic arterials).
 */
export function calculateEconomicTrafficCoefficient(context?: RouteEconomicContext): number {
  if (!context || context.totalGdp === undefined || context.totalGdp === null) {
    return 1.0; // neutral default benchmark
  }

  // Economic tier multiplier
  let tierMult = 1.0;
  const tier = (context.economicTier ?? "").toLowerCase();
  if (tier.includes("superpower") || tier.includes("tier 1") || tier === "t1") {
    tierMult = 1.4;
  } else if (tier.includes("developed") || tier.includes("tier 2") || tier === "t2") {
    tierMult = 1.15;
  } else if (tier.includes("middle") || tier.includes("tier 3") || tier === "t3") {
    tierMult = 1.0;
  } else if (tier.includes("developing") || tier.includes("tier 4") || tier === "t4") {
    tierMult = 0.7;
  } else if (tier.includes("emerging") || tier.includes("tier 5") || tier === "t5") {
    tierMult = 0.45;
  }

  // GDP scaling factor (normalized around $500B national GDP)
  const gdpFactor = Math.sqrt(Math.max(1, context.totalGdp) / 500);
  let rawCoeff = gdpFactor * tierMult;

  // International corridor premium (trade flows)
  if (context.isInternational) {
    rawCoeff *= 1.2;
  }

  // Per capita multiplier for high-value services & tech commerce
  if (context.gdpPerCapita && context.gdpPerCapita > 40_000) {
    rawCoeff *= Math.min(1.25, 1.0 + (context.gdpPerCapita - 40_000) / 120_000);
  }

  // Clamp between 0.25 and 2.5
  return Math.min(2.5, Math.max(0.25, Math.round(rawCoeff * 100) / 100));
}

/**
 * Calculates the mean economic coefficient across a collection of segments.
 */
export function calculateNetworkAverageEconomicCoefficient(
  segments: TransportSegmentInput[]
): number {
  if (segments.length === 0) return 1.0;
  let total = 0;
  let count = 0;
  for (const s of segments) {
    total += calculateEconomicTrafficCoefficient({
      totalGdp: s.totalGdp,
      gdpPerCapita: s.gdpPerCapita,
      economicTier: s.economicTier,
      isInternational: s.isInternational,
    });
    count++;
  }
  return count > 0 ? Math.round((total / count) * 100) / 100 : 1.0;
}

function haversineDistKm(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);
  const aVal =
    sinHalfLat * sinHalfLat +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      sinHalfLng *
      sinHalfLng;
  return 2 * R * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

/**
 * Generate simulated vehicle trips along operational transport segments with real-economy dynamic scaling.
 *
 * @param segments Network segments with line geometries and optional economic context
 * @param vehicleDensity Base vehicles per 100 km (default 0.5)
 * @param loopPeriodSec Base loop duration for cyclic normalization
 */
export function generateVehicleTrips(
  segments: TransportSegmentInput[],
  vehicleDensity: number = 0.5,
  loopPeriodSec: number = 120
): VehicleTrip[] {
  const trips: VehicleTrip[] = [];

  for (const seg of segments) {
    if (seg.status && seg.status !== "operational") continue;

    const coords = seg.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;

    // Calculate cumulative distance along coords
    const cumDist: number[] = [0];
    for (let i = 1; i < coords.length; i++) {
      const segDist = haversineDistKm(coords[i - 1]!, coords[i]!);
      cumDist.push(cumDist[i - 1]! + segDist);
    }
    const totalDistKm = cumDist[cumDist.length - 1]!;
    if (totalDistKm <= 0) continue;

    // Real economy coefficient
    const econCoeff = calculateEconomicTrafficCoefficient({
      totalGdp: seg.totalGdp,
      gdpPerCapita: seg.gdpPerCapita,
      economicTier: seg.economicTier,
      isInternational: seg.isInternational,
      population: seg.population,
    });

    // Speed in km/h -> km/s
    const speedKmh =
      seg.speedKmh ??
      (seg.routeType === "air_corridor"
        ? 800
        : seg.routeType.includes("rail")
          ? 120
          : 80);
    const speedKmPerSec = Math.max(0.001, speedKmh / 3600);
    const transitDurationSec = Math.max(5, totalDistKm / speedKmPerSec);

    // Number of vehicles on this segment dynamically scaled by real economy
    const effectiveDensity = vehicleDensity * econCoeff;
    const vehicleCount = Math.max(
      1,
      Math.min(8, Math.round((totalDistKm / 100) * effectiveDensity * 2))
    );

    const rgb = VEHICLE_COLORS_RGB[seg.routeType] ?? [245, 158, 11];

    for (let v = 0; v < vehicleCount; v++) {
      const phaseOffset = (v / vehicleCount) * loopPeriodSec;
      const timestamps: number[] = [];

      for (let p = 0; p < coords.length; p++) {
        const frac = cumDist[p]! / totalDistKm;
        const t = (phaseOffset + frac * transitDurationSec) % loopPeriodSec;
        timestamps.push(t);
      }

      trips.push({
        id: `${seg.id}_veh_${v}`,
        segmentId: seg.id,
        routeType: seg.routeType,
        path: coords,
        timestamps,
        durationSec: transitDurationSec,
        color: rgb,
        economicCoeff: econCoeff,
      });
    }
  }

  return trips;
}

/**
 * Interpolates vehicle position [lng, lat] along a trip at a given timestamp.
 */
export function getVehiclePositionAtTime(
  trip: VehicleTrip,
  currentTimeSec: number
): [number, number] | null {
  const { path, timestamps } = trip;
  if (path.length < 2 || timestamps.length !== path.length) return null;

  const t = ((currentTimeSec % 120) + 120) % 120;

  // Find surrounding segment
  for (let i = 0; i < timestamps.length - 1; i++) {
    const t0 = timestamps[i]!;
    const t1 = timestamps[i + 1]!;

    if (t0 <= t1 && t >= t0 && t <= t1) {
      const alpha = (t - t0) / (t1 - t0 || 1);
      const lng = path[i]![0] + alpha * (path[i + 1]![0] - path[i]![0]);
      const lat = path[i]![1] + alpha * (path[i + 1]![1] - path[i]![1]);
      return [lng, lat];
    }
  }

  return path[0] ?? null;
}

export interface GeoJSONFeatureLike {
  id?: string | number;
  properties?: {
    id?: string | number;
    routeType?: string;
    status?: string;
    speedKmh?: number | null;
    capacity?: number | null;
    builtYear?: number | null;
    [key: string]: string | number | boolean | null | undefined;
  } | null;
  geometry?: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  } | null;
}

export interface GeoJSONCollectionLike {
  type: string;
  features: GeoJSONFeatureLike[];
}

/**
 * Converts a GeoJSON FeatureCollection of routes into TransportSegmentInput array.
 */
export function featuresToSegments(fc: GeoJSONCollectionLike): TransportSegmentInput[] {
  if (!fc || !Array.isArray(fc.features)) return [];
  const segments: TransportSegmentInput[] = [];

  for (const f of fc.features) {
    if (!f.geometry) continue;
    const geomType = f.geometry.type;
    let coords: [number, number][] = [];

    if (geomType === "LineString" && Array.isArray(f.geometry.coordinates)) {
      coords = f.geometry.coordinates as [number, number][];
    } else if (geomType === "MultiLineString" && Array.isArray(f.geometry.coordinates)) {
      const multi = f.geometry.coordinates as [number, number][][];
      if (multi.length > 0 && Array.isArray(multi[0])) {
        coords = multi[0];
      }
    }

    if (coords.length >= 2) {
      const props = f.properties ?? {};
      const segId = String(props.id ?? f.id ?? `seg-${segments.length}`);
      const routeType = String(props.routeType ?? "road");
      const status = String(props.status ?? "operational");
      const speedKmh = typeof props.speedKmh === "number" ? props.speedKmh : null;
      const capacity = typeof props.capacity === "number" ? props.capacity : null;
      const totalGdp = typeof props.totalGdp === "number" ? props.totalGdp : null;
      const gdpPerCapita = typeof props.gdpPerCapita === "number" ? props.gdpPerCapita : null;
      const economicTier = typeof props.economicTier === "string" ? props.economicTier : null;
      const isInternational = Boolean(props.isInternational);
      const population = typeof props.population === "number" ? props.population : null;

      segments.push({
        id: segId,
        routeType,
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
        status,
        speedKmh,
        capacity,
        totalGdp,
        gdpPerCapita,
        economicTier,
        isInternational,
        population,
      });
    }
  }

  return segments;
}
