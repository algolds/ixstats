/**
 * Route Travel Time & Velocity Engine
 *
 * Computes realistic travel durations across transport corridors by integrating:
 *  1. Physical distance (length in km)
 *  2. Design / cruising velocity (km/h)
 *  3. Topographic elevation drag (terrain difficulty gradient penalty)
 *  4. Intermediate node dwell overhead (rail acceleration/stops, flight clearance, docking)
 *  5. Instantaneous network transmission exceptions (fiber optic, electric grid)
 *  6. Sea routes only, when a path is given: ocean currents and prevailing winds
 *     along each segment's bearing (docs/reference/oceanography-report.md)
 */

import { bearing, distanceKm } from "~/lib/maps/geo-math";

/** A route vertex as [longitude, latitude] in degrees. */
export type LngLat = [number, number];

interface TravelTimeCalculationInput {
  lengthKm?: number | null;
  speedKmh?: number | null;
  routeType?: string | null;
  terrainDifficulty?: number | null; // 0 to 1
  stopsCount?: number | null;
  properties?: Record<string, unknown> | object | null;
  /**
   * Route vertices. For sea route types (shipping_lane, ferry, military_naval) with two or
   * more vertices this turns on the current/wind model; other routes ignore it.
   */
  seaPath?: LngLat[] | null;
}

/** One current or wind system's net effect on a sea route. */
interface SeaConditionEffect {
  name: string;
  kind: "current" | "wind";
  /** Distance-weighted mean along-track speed change where it applies (km/h, signed). */
  averageChangeKmh: number;
  /** Route distance over which it applies (km). */
  distanceKm: number;
}

interface SeaTransitSummary {
  /** Great-circle length of the path (km). */
  distanceKm: number;
  /** Ship speed through still water (km/h). */
  shipSpeedKmh: number;
  /** Path distance divided by total sailing time (km/h). */
  averageSpeedKmh: number;
  /** The system with the largest net speed × distance effect, or null when none apply. */
  largestEffect: SeaConditionEffect | null;
}

interface TravelTimeResult {
  totalMinutes: number;
  hours: number;
  minutes: number;
  days: number;
  formattedTime: string;
  effectiveSpeedKmh: number;
  terrainDragFactor: number;
  terrainPenaltyPercent: number;
  dwellTimeMinutes: number;
  isInstantaneous: boolean;
  /** Present only when the sea current/wind model was applied. */
  sea?: SeaTransitSummary;
}

interface SpeedPreset {
  speed: number;
  label: string;
}

/**
 * Standard baseline speeds (km/h) by route type.
 */
const DEFAULT_ROUTE_SPEEDS: Record<string, number> = {
  // Rail
  high_speed_rail: 300,
  rail: 120,
  freight_rail: 80,
  commuter_rail: 90,

  // Road
  motorway: 130,
  highway: 100,
  trunk: 80,
  road: 60,
  secondary: 50,

  // Maritime
  shipping_lane: 30,
  canal: 15,
  ferry: 40,

  // Aviation
  air_corridor: 850,

  // Utilities
  pipeline: 12,
  power_grid: 0, // instantaneous / light speed
  fiber: 0, // instantaneous / light speed

  // Military
  military_supply: 70,
  military_naval: 35,
};

/**
 * Speed preset quick-pills per route type for high-efficiency UI selection.
 */
const SPEED_PRESETS_BY_TYPE: Record<string, SpeedPreset[]> = {
  high_speed_rail: [
    { speed: 200, label: "200 (Regional)" },
    { speed: 250, label: "250 (Express)" },
    { speed: 300, label: "300 (Shinkansen)" },
    { speed: 350, label: "350 (Maglev/Ultra)" },
  ],
  rail: [
    { speed: 80, label: "80 (Freight)" },
    { speed: 100, label: "100 (Mixed)" },
    { speed: 120, label: "120 (Standard)" },
    { speed: 160, label: "160 (Intercity)" },
  ],
  freight_rail: [
    { speed: 50, label: "50 (Heavy)" },
    { speed: 70, label: "70 (Bulk)" },
    { speed: 80, label: "80 (Standard)" },
    { speed: 100, label: "100 (Express)" },
  ],
  commuter_rail: [
    { speed: 60, label: "60 (Urban)" },
    { speed: 80, label: "80 (Suburban)" },
    { speed: 90, label: "90 (Standard)" },
    { speed: 120, label: "120 (Regional)" },
  ],
  motorway: [
    { speed: 100, label: "100" },
    { speed: 120, label: "120" },
    { speed: 130, label: "130 (Standard)" },
    { speed: 150, label: "150 (Autobahn)" },
  ],
  highway: [
    { speed: 80, label: "80" },
    { speed: 90, label: "90" },
    { speed: 100, label: "100 (Standard)" },
    { speed: 110, label: "110" },
  ],
  trunk: [
    { speed: 60, label: "60" },
    { speed: 70, label: "70" },
    { speed: 80, label: "80 (Standard)" },
    { speed: 90, label: "90" },
  ],
  road: [
    { speed: 40, label: "40 (City)" },
    { speed: 50, label: "50" },
    { speed: 60, label: "60 (Standard)" },
    { speed: 80, label: "80 (Rural)" },
  ],
  secondary: [
    { speed: 30, label: "30 (Winding)" },
    { speed: 40, label: "40" },
    { speed: 50, label: "50 (Standard)" },
    { speed: 60, label: "60" },
  ],
  shipping_lane: [
    { speed: 18, label: "18 (Freighter)" },
    { speed: 25, label: "25 (Container)" },
    { speed: 30, label: "30 (Standard)" },
    { speed: 40, label: "40 (Fast Liner)" },
  ],
  canal: [
    { speed: 10, label: "10 (Barge)" },
    { speed: 15, label: "15 (Standard)" },
    { speed: 20, label: "20 (Express)" },
  ],
  ferry: [
    { speed: 25, label: "25 (Vehicle)" },
    { speed: 35, label: "35 (Passenger)" },
    { speed: 40, label: "40 (Standard)" },
    { speed: 55, label: "55 (Hydrofoil)" },
  ],
  air_corridor: [
    { speed: 450, label: "450 (Turboprop)" },
    { speed: 750, label: "750 (Regional)" },
    { speed: 850, label: "850 (Jet)" },
    { speed: 1200, label: "1200 (Supersonic)" },
  ],
  pipeline: [
    { speed: 5, label: "5 (Slurry)" },
    { speed: 10, label: "10 (Crude)" },
    { speed: 15, label: "15 (Refined)" },
    { speed: 25, label: "25 (Gas)" },
  ],
};

/**
 * Checks whether a route type represents an instantaneous light-speed network (e.g. telecom, power grid).
 */
export function isInstantaneousRoute(routeType?: string | null): boolean {
  if (!routeType) return false;
  return routeType === "power_grid" || routeType === "fiber";
}

interface RouteSpeedInput {
  routeType?: string | null;
  speedKmh?: number | null;
  properties?: Record<string, unknown> | object | null;
}

/**
 * Resolves the baseline speed (km/h) for a route using the fallback hierarchy:
 * 1. Explicit `speedKmh` column
 * 2. Legacy `properties.speed_kmh`
 * 3. Default route type speed
 * 4. Fallback default (80 km/h)
 *
 * Accepts either an options object or positional parameters.
 */
export function resolveRouteBaseSpeed(
  routeTypeOrInput?: string | null | RouteSpeedInput,
  speedKmh?: number | null,
  properties?: Record<string, unknown> | object | null
): number {
  let rType: string | null | undefined;
  let sKmh: number | null | undefined;
  let props: Record<string, unknown> | null | undefined;

  if (typeof routeTypeOrInput === "object" && routeTypeOrInput !== null) {
    rType = routeTypeOrInput.routeType;
    sKmh = routeTypeOrInput.speedKmh;
    props = routeTypeOrInput.properties as Record<string, unknown> | null | undefined;
  } else {
    rType = routeTypeOrInput;
    sKmh = speedKmh;
    props = properties as Record<string, unknown> | null | undefined;
  }

  if (typeof sKmh === "number" && sKmh > 0) {
    return sKmh;
  }
  const propSpeed = props?.speed_kmh;
  if (typeof propSpeed === "number" && propSpeed > 0) {
    return propSpeed;
  }
  if (typeof propSpeed === "string" && !isNaN(Number(propSpeed)) && Number(propSpeed) > 0) {
    return Number(propSpeed);
  }
  if (rType && rType in DEFAULT_ROUTE_SPEEDS) {
    return DEFAULT_ROUTE_SPEEDS[rType]!;
  }
  return 80;
}

/**
 * Returns the speed preset pills for a given route type.
 */
export function getSpeedPresets(routeType?: string | null): SpeedPreset[] {
  if (!routeType) return [];
  return SPEED_PRESETS_BY_TYPE[routeType] ?? [];
}

/**
 * Formats a duration in minutes into a human-readable string.
 * Examples:
 *  - 45 min -> "45m"
 *  - 142 min -> "2h 22m"
 *  - 1440 min -> "1d 00h"
 *  - 1720 min -> "1d 04h"
 */
export function formatTravelDuration(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "0m";
  }

  const rounded = Math.round(totalMinutes);
  if (rounded < 60) {
    return `${rounded}m`;
  }

  const totalHours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;

  if (totalHours < 24) {
    if (remainingMinutes === 0) {
      return `${totalHours}h`;
    }
    return `${totalHours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
  }

  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;

  if (remHours === 0 && remainingMinutes === 0) {
    return `${days}d`;
  }
  return `${days}d ${remHours.toString().padStart(2, "0")}h`;
}

// ─── Sea current & wind model ───────────────────────────────────────────────
// Numbers come from docs/reference/oceanography-report.md and stay in knots as
// the report gives them; they become km/h only through KMH_PER_KNOT.

/** §2.2: 1 nautical mile = 1.852 km, so 1 knot = 1.852 km/h. */
export const KMH_PER_KNOT = 1.852;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Route types sailed on open water. Canals are inland and keep the plain model. */
const SEA_ROUTE_TYPES = new Set(["shipping_lane", "ferry", "military_naval"]);

/** Segments are cut into great-circle pieces no longer than this before sampling. */
const SAMPLE_STEP_KM = 50;

/** Safety floor so a strong head current can never stop or reverse a slow ship. */
const MIN_SEA_SPEED_KMH = 1;

interface OceanCurrent {
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  /** Direction the water flows toward, degrees clockwise from north. */
  towardDeg: number;
  speedKn: number;
}

/**
 * Only currents the report places with numbers. First match wins, so the
 * Barbary box sits ahead of the counter-current band it overlaps.
 */
const OCEAN_CURRENTS: readonly OceanCurrent[] = [
  // §4.2, §12.2: Barbary Straits at 115°E 2°N, 85 km wide, westward 1.2 kn (85 km square box).
  {
    name: "Barbary Straits current",
    minLat: 1.62,
    maxLat: 2.38,
    minLng: 114.62,
    maxLng: 115.38,
    towardDeg: 270,
    speedKn: 1.2,
  },
  // §10.1.1, §10.3: Dolong Warm Current, northward 2.0 kn, 18°N–45°N; 90°E–100°E per plan 049.
  {
    name: "Dolong Warm Current",
    minLat: 18,
    maxLat: 45,
    minLng: 90,
    maxLng: 100,
    towardDeg: 0,
    speedKn: 2.0,
  },
  // §3.1, §5.2.1: Levantine Counter-Current, eastward 0.5–0.8 kn, 2°N–8°N inside the Levantine Ocean (70°E–160°E).
  {
    name: "Levantine Counter-Current",
    minLat: 2,
    maxLat: 8,
    minLng: 70,
    maxLng: 160,
    towardDeg: 90,
    speedKn: 0.65,
  },
];

interface WindBelt {
  name: string;
  minLat: number;
  maxLat: number;
  /** Direction the wind blows toward, degrees clockwise from north. */
  towardDeg: number;
}

/** §6.1 wind belts. Doldrums (0°–10°) and horse latitudes (30°–35°) are calm/variable: no effect. */
const WIND_BELTS: readonly WindBelt[] = [
  { name: "NE Trade Winds", minLat: 10, maxLat: 30, towardDeg: 225 },
  { name: "SE Trade Winds", minLat: -30, maxLat: -10, towardDeg: 315 },
  { name: "Prevailing Westerlies", minLat: 35, maxLat: 60, towardDeg: 45 },
  { name: "Roaring Forties", minLat: -60, maxLat: -35, towardDeg: 135 },
  { name: "Polar Easterlies", minLat: 60, maxLat: 90, towardDeg: 225 },
  { name: "Polar Easterlies", minLat: -90, maxLat: -60, towardDeg: 315 },
];

/**
 * §11.2 V_wind_effect in knots, midpoint of each range: following seas +0.5 to +2.0,
 * beam seas −0.5 to −1.0, head seas −0.5 to −3.0. Following = wind within 45° of the
 * heading, head = within 45° of the reverse heading, beam = anything between.
 */
const WIND_EFFECT_KN = { following: 1.25, beam: -0.75, head: -1.75 } as const;

interface PathPiece {
  km: number;
  headingDeg: number;
  lng: number;
  lat: number;
}

interface SeaCondition {
  name: string;
  kind: "current" | "wind";
  changeKmh: number;
}

interface EffectTally {
  kind: "current" | "wind";
  /** Σ (speed change × piece km) */
  kmhKm: number;
  km: number;
}

function toUnitVector([lng, lat]: LngLat): [number, number, number] {
  const lambda = lng * DEG_TO_RAD;
  const phi = lat * DEG_TO_RAD;
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
}

/**
 * Point at fraction `f` along the great circle from `a` to `b`. Output longitude is
 * always in [-180, 180], so segments that cross the antimeridian sample correctly.
 */
function greatCirclePoint(a: LngLat, b: LngLat, f: number): LngLat {
  const va = toUnitVector(a);
  const vb = toUnitVector(b);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const delta = Math.acos(dot);
  const sinDelta = Math.sin(delta);
  const wa = sinDelta < 1e-9 ? 1 - f : Math.sin((1 - f) * delta) / sinDelta;
  const wb = sinDelta < 1e-9 ? f : Math.sin(f * delta) / sinDelta;
  const x = wa * va[0] + wb * vb[0];
  const y = wa * va[1] + wb * vb[1];
  const z = wa * va[2] + wb * vb[2];
  return [Math.atan2(y, x) * RAD_TO_DEG, Math.atan2(z, Math.hypot(x, y)) * RAD_TO_DEG];
}

/** Cuts a path into short great-circle pieces with their own heading and midpoint. */
function splitSeaPath(path: LngLat[]): PathPiece[] {
  const pieces: PathPiece[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const segmentKm = distanceKm(a, b);
    const count = Math.max(1, Math.ceil(segmentKm / SAMPLE_STEP_KM));
    for (let p = 0; p < count; p++) {
      const start = greatCirclePoint(a, b, p / count);
      const end = greatCirclePoint(a, b, (p + 1) / count);
      const [lng, lat] = greatCirclePoint(a, b, (p + 0.5) / count);
      pieces.push({ km: segmentKm / count, headingDeg: bearing(start, end), lng, lat });
    }
  }
  return pieces;
}

/** Smallest angle between two directions, 0–180°. */
function angleBetween(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function windEffectKn(offDeg: number): number {
  if (offDeg <= 45) return WIND_EFFECT_KN.following;
  if (offDeg >= 135) return WIND_EFFECT_KN.head;
  return WIND_EFFECT_KN.beam;
}

function conditionsAt(piece: PathPiece): SeaCondition[] {
  const { lng, lat, headingDeg } = piece;
  const conditions: SeaCondition[] = [];
  const current = OCEAN_CURRENTS.find(
    (c) => lat >= c.minLat && lat <= c.maxLat && lng >= c.minLng && lng <= c.maxLng
  );
  if (current) {
    // Along-track component: V_current · cos(θ_bearing − θ_current)
    const alongKn = current.speedKn * Math.cos((headingDeg - current.towardDeg) * DEG_TO_RAD);
    conditions.push({ name: current.name, kind: "current", changeKmh: alongKn * KMH_PER_KNOT });
  }
  const belt = WIND_BELTS.find((w) => lat >= w.minLat && lat <= w.maxLat);
  if (belt) {
    const kn = windEffectKn(angleBetween(headingDeg, belt.towardDeg));
    conditions.push({ name: belt.name, kind: "wind", changeKmh: kn * KMH_PER_KNOT });
  }
  return conditions;
}

function largestEffect(tallies: Map<string, EffectTally>): SeaConditionEffect | null {
  let best: SeaConditionEffect | null = null;
  let bestImpact = 0;
  for (const [name, tally] of tallies) {
    if (tally.km <= 0 || Math.abs(tally.kmhKm) <= bestImpact) continue;
    bestImpact = Math.abs(tally.kmhKm);
    best = {
      name,
      kind: tally.kind,
      averageChangeKmh: tally.kmhKm / tally.km,
      distanceKm: tally.km,
    };
  }
  return best;
}

/**
 * Sails `path` at `shipSpeedKmh` through still water plus the currents and winds met on
 * each piece: V_effective = V_ship + V_current·cos(θ_bearing − θ_current) + V_wind_effect.
 */
function calculateSeaTransit(path: LngLat[], shipSpeedKmh: number): SeaTransitSummary | null {
  let totalKm = 0;
  let totalHours = 0;
  const tallies = new Map<string, EffectTally>();

  for (const piece of splitSeaPath(path)) {
    const conditions = conditionsAt(piece);
    const change = conditions.reduce((sum, c) => sum + c.changeKmh, 0);
    totalKm += piece.km;
    totalHours += piece.km / Math.max(MIN_SEA_SPEED_KMH, shipSpeedKmh + change);
    for (const c of conditions) {
      const tally = tallies.get(c.name) ?? { kind: c.kind, kmhKm: 0, km: 0 };
      tally.kmhKm += c.changeKmh * piece.km;
      tally.km += piece.km;
      tallies.set(c.name, tally);
    }
  }

  // Non-finite hours means bad coordinates; fall back to the still-water model.
  if (!Number.isFinite(totalHours) || totalHours <= 0) return null;
  return {
    distanceKm: totalKm,
    shipSpeedKmh,
    averageSpeedKmh: totalKm / totalHours,
    largestEffect: largestEffect(tallies),
  };
}

function seaTransitFor(
  routeType: string | null | undefined,
  seaPath: LngLat[] | null | undefined,
  shipSpeedKmh: number
): SeaTransitSummary | null {
  if (!routeType || !SEA_ROUTE_TYPES.has(routeType) || !seaPath || seaPath.length < 2) {
    return null;
  }
  return calculateSeaTransit(seaPath, shipSpeedKmh);
}

/** Port, station and terminal overhead in minutes. */
function dwellMinutesFor(
  routeType: string | null | undefined,
  stopsCount: number | null | undefined
): number {
  const intermediateStops = Math.max(0, (stopsCount ?? 2) - 2);
  if (routeType === "high_speed_rail" || routeType === "rail" || routeType === "commuter_rail") {
    const dwellPerStop = routeType === "commuter_rail" ? 2 : 5;
    return intermediateStops * dwellPerStop;
  }
  if (routeType === "air_corridor") {
    // Air routes include terminal departure & arrival approach time
    return 45;
  }
  if (routeType === "shipping_lane" || routeType === "ferry") {
    // Maritime routes include port docking maneuvers
    return 20 + intermediateStops * 15;
  }
  return 0;
}

/**
 * Primary calculation engine: Computes estimated travel time and effective velocity.
 */
export function calculateRouteTravelTime(input: TravelTimeCalculationInput): TravelTimeResult {
  const {
    lengthKm,
    speedKmh,
    routeType = "road",
    terrainDifficulty = 0,
    stopsCount = 2,
    properties,
    seaPath,
  } = input;

  // Instantaneous networks (power grid, fiber optics)
  if (isInstantaneousRoute(routeType)) {
    return {
      totalMinutes: 0,
      hours: 0,
      minutes: 0,
      days: 0,
      formattedTime: "< 1ms",
      effectiveSpeedKmh: 299792458 * 3.6, // Speed of light in km/h
      terrainDragFactor: 1.0,
      terrainPenaltyPercent: 0,
      dwellTimeMinutes: 0,
      isInstantaneous: true,
    };
  }

  const baseSpeed = resolveRouteBaseSpeed(routeType, speedKmh, properties);

  if (!lengthKm || lengthKm <= 0 || baseSpeed <= 0) {
    return {
      totalMinutes: 0,
      hours: 0,
      minutes: 0,
      days: 0,
      formattedTime: "0m",
      effectiveSpeedKmh: baseSpeed,
      terrainDragFactor: 1.0,
      terrainPenaltyPercent: 0,
      dwellTimeMinutes: 0,
      isInstantaneous: false,
    };
  }

  // 1. Topographic elevation gradient penalty
  // Maximum 25% drag for mountainous/rough terrain
  const clampedDifficulty = Math.max(0, Math.min(1, terrainDifficulty ?? 0));
  const terrainPenaltyFraction = clampedDifficulty * 0.25;
  const terrainDragFactor = Math.round((1 - terrainPenaltyFraction) * 100) / 100;
  const terrainPenaltyPercent = Math.round(terrainPenaltyFraction * 100);

  const cruiseSpeedKmh = baseSpeed * (1 - terrainPenaltyFraction);

  // 1b. Sea routes with a path: currents and winds along each segment's bearing
  const sea = seaTransitFor(routeType, seaPath, cruiseSpeedKmh);

  const effectiveSpeedKmh = Math.max(
    5,
    Math.round((sea?.averageSpeedKmh ?? cruiseSpeedKmh) * 10) / 10
  );

  // 2. Dwell time from stops and station approaches
  const dwellTimeMinutes = dwellMinutesFor(routeType, stopsCount);

  // 3. Transit duration
  const cruisingMinutes = (lengthKm / effectiveSpeedKmh) * 60;
  const totalMinutes = Math.max(1, Math.round(cruisingMinutes + dwellTimeMinutes));

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const formattedTime = formatTravelDuration(totalMinutes);

  return {
    totalMinutes,
    hours,
    minutes,
    days,
    formattedTime,
    effectiveSpeedKmh,
    terrainDragFactor,
    terrainPenaltyPercent,
    dwellTimeMinutes,
    isInstantaneous: false,
    ...(sea ? { sea } : {}),
  };
}
