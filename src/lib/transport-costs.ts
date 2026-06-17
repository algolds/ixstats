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
  rail: 0.04,
  highway: 0.05,
  shipping_lane: 0.001,
  canal: 0.1,
  road: 0.01,
  air_corridor: 0.08,
  ferry: 0.02,
  pipeline: 0.03,
  power_grid: 0.02,
  fiber: 0.005,
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
