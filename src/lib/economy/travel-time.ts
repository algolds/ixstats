/**
 * Route Travel Time & Velocity Engine
 *
 * Computes realistic travel durations across transport corridors by integrating:
 *  1. Physical distance (length in km)
 *  2. Design / cruising velocity (km/h)
 *  3. Topographic elevation drag (terrain difficulty gradient penalty)
 *  4. Intermediate node dwell overhead (rail acceleration/stops, flight clearance, docking)
 *  5. Instantaneous network transmission exceptions (fiber optic, electric grid)
 */

export interface TravelTimeCalculationInput {
  lengthKm?: number | null;
  speedKmh?: number | null;
  routeType?: string | null;
  terrainDifficulty?: number | null; // 0 to 1
  stopsCount?: number | null;
  properties?: Record<string, unknown> | object | null;
}

export interface TravelTimeResult {
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
}

export interface SpeedPreset {
  speed: number;
  label: string;
}

/**
 * Standard baseline speeds (km/h) by route type.
 */
export const DEFAULT_ROUTE_SPEEDS: Record<string, number> = {
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
export const SPEED_PRESETS_BY_TYPE: Record<string, SpeedPreset[]> = {
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

export interface RouteSpeedInput {
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

  const effectiveSpeedKmh = Math.max(
    5,
    Math.round(baseSpeed * (1 - terrainPenaltyFraction) * 10) / 10
  );

  // 2. Dwell time from stops and station approaches
  let dwellTimeMinutes = 0;
  const intermediateStops = Math.max(0, (stopsCount ?? 2) - 2);

  if (routeType === "high_speed_rail" || routeType === "rail" || routeType === "commuter_rail") {
    const dwellPerStop = routeType === "commuter_rail" ? 2 : 5;
    dwellTimeMinutes = intermediateStops * dwellPerStop;
  } else if (routeType === "air_corridor") {
    // Air routes include terminal departure & arrival approach time
    dwellTimeMinutes = 45;
  } else if (routeType === "shipping_lane" || routeType === "ferry") {
    // Maritime routes include port docking maneuvers
    dwellTimeMinutes = 20 + intermediateStops * 15;
  }

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
  };
}
