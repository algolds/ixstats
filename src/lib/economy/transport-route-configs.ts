/** Route families and their per-type terrain and speed limits, for transport-generator.ts. */

export type RouteType =
  // Rail family
  | "rail"
  | "high_speed_rail"
  | "freight_rail"
  | "commuter_rail"
  // Road family
  | "motorway"
  | "highway"
  | "trunk"
  | "road"
  | "secondary"
  // Maritime
  | "shipping_lane"
  | "canal"
  | "ferry"
  // Air
  | "air_corridor"
  // Utility
  | "pipeline"
  | "power_grid"
  | "fiber"
  // Military
  | "military_supply"
  | "military_naval";

export const ROUTE_CONFIGS: Record<
  RouteType,
  {
    maxElevation: number;
    maxGrade: number; // percent
    waterCost: number; // multiplier (Infinity = impassable)
    elevationCostFactor: number;
    baseSpeed: number; // km/h
  }
> = {
  rail: {
    maxElevation: 2000,
    maxGrade: 3,
    waterCost: Infinity,
    elevationCostFactor: 5,
    baseSpeed: 120,
  },
  high_speed_rail: {
    maxElevation: 1800,
    maxGrade: 2.5,
    waterCost: Infinity,
    elevationCostFactor: 6,
    baseSpeed: 300,
  },
  freight_rail: {
    maxElevation: 2200,
    maxGrade: 2.0,
    waterCost: Infinity,
    elevationCostFactor: 5,
    baseSpeed: 80,
  },
  commuter_rail: {
    maxElevation: 2500,
    maxGrade: 3.5,
    waterCost: Infinity,
    elevationCostFactor: 4,
    baseSpeed: 90,
  },
  motorway: {
    maxElevation: 2800,
    maxGrade: 6,
    waterCost: Infinity,
    elevationCostFactor: 3.5,
    baseSpeed: 130,
  },
  highway: {
    maxElevation: 3000,
    maxGrade: 8,
    waterCost: Infinity,
    elevationCostFactor: 3,
    baseSpeed: 100,
  },
  trunk: {
    maxElevation: 3500,
    maxGrade: 10,
    waterCost: Infinity,
    elevationCostFactor: 2.5,
    baseSpeed: 80,
  },
  road: {
    maxElevation: 4500,
    maxGrade: 15,
    waterCost: Infinity,
    elevationCostFactor: 1.5,
    baseSpeed: 60,
  },
  secondary: {
    maxElevation: 4500,
    maxGrade: 18,
    waterCost: Infinity,
    elevationCostFactor: 1.2,
    baseSpeed: 50,
  },
  shipping_lane: {
    maxElevation: 0,
    maxGrade: 0,
    waterCost: 0.5,
    elevationCostFactor: 0,
    baseSpeed: 30,
  },
  canal: { maxElevation: 500, maxGrade: 0.1, waterCost: 1, elevationCostFactor: 10, baseSpeed: 15 },
  air_corridor: {
    maxElevation: Infinity,
    maxGrade: 0,
    waterCost: 0,
    elevationCostFactor: 0,
    baseSpeed: 850, // cruising speed
  },
  ferry: {
    maxElevation: 0,
    maxGrade: 0,
    waterCost: 0.3,
    elevationCostFactor: 0,
    baseSpeed: 40,
  },
  pipeline: {
    maxElevation: 4000,
    maxGrade: 20,
    waterCost: Infinity,
    elevationCostFactor: 1.5,
    baseSpeed: 10,
  },
  power_grid: {
    maxElevation: 5000,
    maxGrade: 30,
    waterCost: Infinity,
    elevationCostFactor: 1.0,
    baseSpeed: 300000,
  },
  fiber: {
    maxElevation: 5000,
    maxGrade: 30,
    waterCost: Infinity,
    elevationCostFactor: 1.0,
    baseSpeed: 200000,
  },
  military_supply: {
    maxElevation: 4000,
    maxGrade: 15,
    waterCost: Infinity,
    elevationCostFactor: 2.0,
    baseSpeed: 80,
  },
  military_naval: {
    maxElevation: 0,
    maxGrade: 0,
    waterCost: 0.5,
    elevationCostFactor: 0,
    baseSpeed: 40,
  },
};
