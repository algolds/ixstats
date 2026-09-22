/**
 * transport-costs.ts — cost calculation for transport route construction
 * and maintenance. Pure function, framework-free, fully testable.
 *
 * Single source of truth for per-km construction cost and annual
 * maintenance cost by route type. Adding a new transport route type
 * means adding one entry to `BASE_COST_PER_KM` — no other file in the
 * transport subsystem needs to know about cost factors.
 */

/** Inputs are intentionally permissive: unknown `routeType` falls through to the road default (0.01). */
export interface RouteCostInput {
  routeType: string;
  lengthKm: number;
  terrainDifficulty: number;
}

export interface RouteCost {
  /** Construction cost in billions, rounded to 3 decimals. */
  costBillion: number;
  /** Annual maintenance cost in billions, rounded to 3 decimals (= 2% of construction). */
  maintenanceCost: number;
}

const DEFAULT_BASE_COST_PER_KM = 0.01; // road-equivalent fallback

const BASE_COST_PER_KM: Record<string, number> = {
  // Rail family
  rail: 0.04,
  high_speed_rail: 0.08,
  freight_rail: 0.035,
  commuter_rail: 0.03,

  // Road family
  motorway: 0.06,
  highway: 0.05,
  trunk: 0.025,
  road: 0.01,
  secondary: 0.007,

  // Maritime
  shipping_lane: 0.001,
  canal: 0.1,
  ferry: 0.02,

  // Air
  air_corridor: 0.08,

  // Utility
  pipeline: 0.03,
  power_grid: 0.02,
  fiber: 0.005,

  // Military
  military_supply: 0.02,
  military_naval: 0.005,
};

const MAINTENANCE_RATE = 0.02; // 2% of construction per year

/**
 * Compute construction cost (billions) and annual maintenance cost (billions)
 * for a transport route.
 *
 * Formula: `costBillion = lengthKm * baseCostPerKm * (1 + terrainDifficulty * 1.5)`.
 * Unknown `routeType` falls through to the road default.
 */
export function calculateRouteCosts({
  routeType,
  lengthKm,
  terrainDifficulty,
}: RouteCostInput): RouteCost {
  const baseCostPerKm = BASE_COST_PER_KM[routeType] ?? DEFAULT_BASE_COST_PER_KM;
  const costBillion = lengthKm * baseCostPerKm * (1 + terrainDifficulty * 1.5);
  const maintenanceCost = costBillion * MAINTENANCE_RATE;
  return {
    costBillion: Math.round(costBillion * 1000) / 1000,
    maintenanceCost: Math.round(maintenanceCost * 1000) / 1000,
  };
}

// ── Intermodal Transit & Transfer Penalties ─────────────────────────

export type ModalFamily = "rail" | "road" | "maritime" | "air" | "utility" | "military";

export function getRouteFamily(routeType: string): ModalFamily {
  if (routeType.includes("rail")) return "rail";
  if (["motorway", "highway", "trunk", "road", "secondary"].includes(routeType)) return "road";
  if (["shipping_lane", "canal", "ferry"].includes(routeType)) return "maritime";
  if (routeType === "air_corridor") return "air";
  if (["pipeline", "power_grid", "fiber"].includes(routeType)) return "utility";
  return "military";
}

export interface IntermodalTransferInput {
  fromType: string;
  toType: string;
  volumeTons?: number;
}

export interface IntermodalTransferResult {
  /** Transfer cost in billions USD for the specified volume */
  transferCostBillion: number;
  /** Dwell time / modal transfer delay in hours */
  transferDelayHours: number;
  /** Whether the two modalities can physically interchange cargo/passengers */
  isCompatible: boolean;
  /** The hub classification required for this transfer */
  hubTypeRequired: "port" | "station" | "airport" | "junction" | "interchange";
  /** Descriptive summary of the intermodal interchange */
  description: string;
}

/**
 * Calculates intermodal transfer fees, dwell time delay penalties, and required
 * hub facilities when transitioning cargo or passengers between modalities.
 */
export function calculateIntermodalTransfer({
  fromType,
  toType,
  volumeTons = 10_000,
}: IntermodalTransferInput): IntermodalTransferResult {
  const fromFamily = getRouteFamily(fromType);
  const toFamily = getRouteFamily(toType);

  // Incompatible utility/pipeline crossings
  if (fromFamily === "utility" || toFamily === "utility") {
    const isUtilityP2P = fromFamily === "utility" && toFamily === "utility";
    return {
      transferCostBillion: isUtilityP2P ? 0.0002 : 0,
      transferDelayHours: 0.1,
      isCompatible: isUtilityP2P,
      hubTypeRequired: "junction",
      description: isUtilityP2P ? "Utility Grid Interconnect" : "Incompatible Utility Transfer",
    };
  }

  // Same modality intra-network interchange
  if (fromFamily === toFamily) {
    const isRail = fromFamily === "rail";
    return {
      transferCostBillion: Math.round((volumeTons / 10_000) * 0.0002 * 10000) / 10000,
      transferDelayHours: isRail ? 1.5 : 0.5,
      isCompatible: true,
      hubTypeRequired: isRail ? "station" : "interchange",
      description: isRail ? "Rail Shunting & Classification Yard" : "Highway Interchange",
    };
  }

  const pairKey = [fromFamily, toFamily].sort().join("-");
  const scale = volumeTons / 10_000;

  switch (pairKey) {
    case "maritime-rail":
      return {
        transferCostBillion: Math.round(scale * 0.003 * 10000) / 10000,
        transferDelayHours: 12.0,
        isCompatible: true,
        hubTypeRequired: "port",
        description: "Deepwater Port Container Terminal & On-Dock Rail",
      };

    case "maritime-road":
      return {
        transferCostBillion: Math.round(scale * 0.005 * 10000) / 10000,
        transferDelayHours: 8.0,
        isCompatible: true,
        hubTypeRequired: "port",
        description: "Port Drayage & Truck Freight Facility",
      };

    case "rail-road":
      return {
        transferCostBillion: Math.round(scale * 0.002 * 10000) / 10000,
        transferDelayHours: 4.0,
        isCompatible: true,
        hubTypeRequired: "station",
        description: "Inland Intermodal Rail-Highway Transload Facility",
      };

    case "air-road":
      return {
        transferCostBillion: Math.round(scale * 0.008 * 10000) / 10000,
        transferDelayHours: 6.0,
        isCompatible: true,
        hubTypeRequired: "airport",
        description: "Air Cargo Logistics Hub & Ground Dispatch",
      };

    case "air-rail":
      return {
        transferCostBillion: Math.round(scale * 0.006 * 10000) / 10000,
        transferDelayHours: 5.0,
        isCompatible: true,
        hubTypeRequired: "airport",
        description: "Airport Rail Express Freight Link",
      };

    case "air-maritime":
      return {
        transferCostBillion: Math.round(scale * 0.012 * 10000) / 10000,
        transferDelayHours: 18.0,
        isCompatible: true,
        hubTypeRequired: "port",
        description: "Sea-Air Transshipment Center",
      };

    default:
      return {
        transferCostBillion: Math.round(scale * 0.004 * 10000) / 10000,
        transferDelayHours: 6.0,
        isCompatible: true,
        hubTypeRequired: "junction",
        description: "General Intermodal Logistics Terminal",
      };
  }
}

