/**
 * National Mobility, Transit Accessibility & Degradation Engine (Phase 2)
 *
 * Implements national-scale mobility mechanics:
 *  1. Transit Accessibility & Mobility Index (TAMI: 0-100)
 *  2. Budgetary infrastructure maintenance funding ratio (F_R) and speed degradation
 *  3. Modal velocity distribution and weighted network averages
 *  4. Intercity settlement transit time matrices
 */

import {
  calculateRouteTravelTime,
  resolveRouteBaseSpeed,
  formatTravelDuration,
} from "./travel-time";

export interface TAMICalculationInput {
  totalLengthKm: number;
  landAreaKm2?: number | null;
  effectiveAverageSpeedKmh: number;
  baselineSpeedKmh?: number;
  totalHubs: number;
  cityCount: number;
  operationalRouteTypes: string[];
}

export interface TAMIResult {
  tamiScore: number; // 0 to 100
  rating: "world_class" | "advanced" | "developing" | "underdeveloped";
  ratingLabel: string;
  ratingColor: string;
  densityScore: number; // 0 to 100
  velocityScore: number; // 0 to 100
  connectivityScore: number; // 0 to 100
  diversityScore: number; // 0 to 100
}

export interface DegradationInput {
  budgetedMaintenance: number; // Annual currency/credits budgeted
  requiredMaintenance: number; // Annual currency/credits required
}

export interface DegradationResult {
  fundingRatio: number; // F_R = budgeted / required
  condition: "optimal" | "adequate" | "deteriorating" | "failing";
  conditionLabel: string;
  conditionColor: string;
  speedDegradationFactor: number; // 1.00 down to 0.60
  speedPenaltyPercent: number; // 0% up to 40%
  gdpModifierDelta: number;
  tradeModifierDelta: number;
  description: string;
}

export interface RouteForMobility {
  id: string;
  name: string | null;
  routeType: string;
  lengthKm?: number | null;
  speedKmh?: number | null;
  terrainDifficulty?: number | null;
  status: string;
  properties?: Record<string, unknown> | null;
}

export interface ModalGroupMetrics {
  count: number;
  totalKm: number;
  avgSpeedKmh: number;
  label: string;
  color: string;
}

export interface ModalVelocitySummary {
  modalGroups: Record<string, ModalGroupMetrics>;
  overallWeightedSpeedKmh: number;
  fastestRoute: { name: string; speedKmh: number; routeType: string } | null;
  totalOperationalKm: number;
  annualHoursSavedVsRoad: number;
}

export interface CityNode {
  id: string;
  name: string;
  population?: number | null;
  coordinates?: [number, number] | null;
}

export interface IntercityTransitLink {
  originName: string;
  destName: string;
  distanceKm: number;
  travelTimeFormatted: string;
  totalMinutes: number;
  effectiveSpeedKmh: number;
  mode: string;
}

/**
 * Calculates the National Transit Accessibility & Mobility Index (TAMI: 0 - 100).
 *
 * Weighting:
 *  - 35% Coverage Density (Km / Land Area)
 *  - 35% Velocity vs Terrain Efficiency
 *  - 20% Intermodal Hub Connectivity
 *  - 10% Modal Diversity
 */
export function calculateTAMI(input: TAMICalculationInput): TAMIResult {
  const {
    totalLengthKm,
    landAreaKm2,
    effectiveAverageSpeedKmh,
    baselineSpeedKmh = 80,
    totalHubs,
    cityCount,
    operationalRouteTypes,
  } = input;

  if (totalLengthKm <= 0) {
    return {
      tamiScore: 0,
      rating: "underdeveloped",
      ratingLabel: "Underdeveloped",
      ratingColor: "var(--color-rose-500)",
      densityScore: 0,
      velocityScore: 0,
      connectivityScore: 0,
      diversityScore: 0,
    };
  }

  // 1. Coverage Density (0 to 100)
  // Baseline: 100 km of network per 1,000 km² land area = 100 score
  const safeArea = landAreaKm2 && landAreaKm2 > 0 ? landAreaKm2 : 50_000;
  const kmPerThousandKm2 = (totalLengthKm / safeArea) * 1_000;
  const densityScore = Math.min(100, Math.round(kmPerThousandKm2 * 1.25));

  // 2. Velocity Efficiency (0 to 100)
  // 160 km/h average = 100 score
  const safeBaseline = Math.max(20, baselineSpeedKmh);
  const velocityRatio = effectiveAverageSpeedKmh / safeBaseline;
  const velocityScore = Math.min(100, Math.round(velocityRatio * 50));

  // 3. Intermodal Hub Connectivity (0 to 100)
  const safeCities = Math.max(1, cityCount);
  const hubCoverageRatio = totalHubs / safeCities;
  const connectivityScore = Math.min(100, Math.round(hubCoverageRatio * 85));

  // 4. Modal Diversity (0 to 100)
  // 5 distinct modal families: Rail, Road, Maritime, Aviation, Utility
  const familySet = new Set<string>();
  for (const t of operationalRouteTypes) {
    if (t.includes("rail")) familySet.add("rail");
    else if (t === "motorway" || t === "highway" || t === "road" || t === "trunk") familySet.add("road");
    else if (t === "shipping_lane" || t === "canal" || t === "ferry") familySet.add("maritime");
    else if (t === "air_corridor") familySet.add("aviation");
    else if (t === "pipeline" || t === "power_grid" || t === "fiber") familySet.add("utility");
  }
  const diversityScore = Math.min(100, familySet.size * 20);

  // Composite TAMI Score
  const rawScore =
    0.35 * densityScore +
    0.35 * velocityScore +
    0.20 * connectivityScore +
    0.10 * diversityScore;
  const tamiScore = Math.max(1, Math.min(100, Math.round(rawScore)));

  let rating: TAMIResult["rating"] = "underdeveloped";
  let ratingLabel = "Underdeveloped";
  let ratingColor = "var(--color-rose-500)";

  if (tamiScore >= 80) {
    rating = "world_class";
    ratingLabel = "World-Class Mobility";
    ratingColor = "var(--color-emerald-400)";
  } else if (tamiScore >= 60) {
    rating = "advanced";
    ratingLabel = "Advanced Transit";
    ratingColor = "var(--color-sky-400)";
  } else if (tamiScore >= 35) {
    rating = "developing";
    ratingLabel = "Developing Network";
    ratingColor = "var(--color-amber-400)";
  }

  return {
    tamiScore,
    rating,
    ratingLabel,
    ratingColor,
    densityScore,
    velocityScore,
    connectivityScore,
    diversityScore,
  };
}

/**
 * Calculates physical route condition and velocity degradation based on
 * budgeted maintenance versus required maintenance cost.
 */
export function calculateMaintenanceDegradation(input: DegradationInput): DegradationResult {
  const { budgetedMaintenance, requiredMaintenance } = input;

  if (requiredMaintenance <= 0) {
    return {
      fundingRatio: 1.0,
      condition: "optimal",
      conditionLabel: "Optimal",
      conditionColor: "var(--color-emerald-400)",
      speedDegradationFactor: 1.0,
      speedPenaltyPercent: 0,
      gdpModifierDelta: 0.005,
      tradeModifierDelta: 0.005,
      description: "Network maintenance is fully funded. Routes operate at 100% design velocity.",
    };
  }

  const fundingRatio = Math.max(0, budgetedMaintenance / requiredMaintenance);

  if (fundingRatio >= 0.95) {
    return {
      fundingRatio,
      condition: "optimal",
      conditionLabel: "Optimal",
      conditionColor: "var(--color-emerald-400)",
      speedDegradationFactor: 1.0,
      speedPenaltyPercent: 0,
      gdpModifierDelta: 0.005,
      tradeModifierDelta: 0.005,
      description: "Transit infrastructure is fully funded. Maximum design speeds and zero structural backlog.",
    };
  }

  if (fundingRatio >= 0.70) {
    return {
      fundingRatio,
      condition: "adequate",
      conditionLabel: "Adequate",
      conditionColor: "var(--color-sky-400)",
      speedDegradationFactor: 0.92,
      speedPenaltyPercent: 8,
      gdpModifierDelta: 0.0,
      tradeModifierDelta: 0.0,
      description: "Minor deferred maintenance. Minor speed restrictions apply across aging arterial segments.",
    };
  }

  if (fundingRatio >= 0.40) {
    return {
      fundingRatio,
      condition: "deteriorating",
      conditionLabel: "Deteriorating",
      conditionColor: "var(--color-amber-400)",
      speedDegradationFactor: 0.78,
      speedPenaltyPercent: 22,
      gdpModifierDelta: -0.0025,
      tradeModifierDelta: -0.005,
      description: "Significant maintenance backlog. Potholes, rail slow-zones, and delayed intermodal freight dispatch.",
    };
  }

  return {
    fundingRatio,
    condition: "failing",
    conditionLabel: "Failing",
    conditionColor: "var(--color-rose-500)",
    speedDegradationFactor: 0.60,
    speedPenaltyPercent: 40,
    gdpModifierDelta: -0.0075,
    tradeModifierDelta: -0.015,
    description: "Critical infrastructure failure. Severe speed limits, bridge weight restrictions, and logistical bottlenecks.",
  };
}

const MODAL_CONFIG: Record<string, { label: string; color: string }> = {
  high_speed_rail: { label: "High-Speed Rail", color: "var(--color-sky-400)" },
  rail: { label: "Standard Rail", color: "var(--color-slate-400)" },
  freight_rail: { label: "Freight Rail", color: "var(--color-zinc-400)" },
  commuter_rail: { label: "Commuter Rail", color: "var(--color-slate-300)" },
  motorway: { label: "Motorway", color: "var(--color-orange-500)" },
  highway: { label: "Highway", color: "var(--color-amber-400)" },
  trunk: { label: "Trunk Road", color: "var(--color-amber-500)" },
  road: { label: "Road Network", color: "var(--color-orange-400)" },
  secondary: { label: "Secondary Road", color: "var(--color-stone-400)" },
  shipping_lane: { label: "Shipping Lane", color: "var(--color-blue-400)" },
  canal: { label: "Canal", color: "var(--color-cyan-400)" },
  ferry: { label: "Ferry Link", color: "var(--color-teal-400)" },
  air_corridor: { label: "Air Corridor", color: "var(--color-purple-400)" },
  pipeline: { label: "Pipeline", color: "var(--color-yellow-400)" },
  power_grid: { label: "Power Grid", color: "var(--color-amber-300)" },
  fiber: { label: "Fiber Optic", color: "var(--color-emerald-400)" },
};

/**
 * Aggregates routes into modal categories and computes weighted network velocity.
 */
export function calculateModalBreakdown(routes: RouteForMobility[]): ModalVelocitySummary {
  const modalGroups: Record<string, ModalGroupMetrics> = {};
  let totalKmWeight = 0;
  let totalSpeedWeightedKm = 0;
  let totalOperationalKm = 0;
  let fastestRoute: { name: string; speedKmh: number; routeType: string } | null = null;
  let totalPassengerKmTimeMinutes = 0;

  for (const r of routes) {
    if (r.status !== "operational") continue;

    const lengthKm = r.lengthKm ?? 0;
    if (lengthKm <= 0) continue;

    totalOperationalKm += lengthKm;

    const baseSpeed = resolveRouteBaseSpeed({
      speedKmh: r.speedKmh,
      properties: r.properties,
      routeType: r.routeType,
    });

    const travelResult = calculateRouteTravelTime({
      lengthKm,
      speedKmh: baseSpeed,
      routeType: r.routeType,
      terrainDifficulty: r.terrainDifficulty,
    });

    const effSpeed = travelResult.effectiveSpeedKmh;

    if (!fastestRoute || effSpeed > fastestRoute.speedKmh) {
      fastestRoute = {
        name: r.name ?? `${r.routeType} Corridor`,
        speedKmh: Math.round(effSpeed),
        routeType: r.routeType,
      };
    }

    // Accumulate weighted speed
    totalKmWeight += lengthKm;
    totalSpeedWeightedKm += effSpeed * lengthKm;

    // Estimate time saved vs baseline 60 km/h road
    const roadMinutes = (lengthKm / 60) * 60;
    totalPassengerKmTimeMinutes += Math.max(0, roadMinutes - travelResult.totalMinutes);

    const typeKey = r.routeType;
    const config = MODAL_CONFIG[typeKey] ?? { label: typeKey, color: "var(--color-slate-400)" };

    if (!modalGroups[typeKey]) {
      modalGroups[typeKey] = {
        count: 0,
        totalKm: 0,
        avgSpeedKmh: 0,
        label: config.label,
        color: config.color,
      };
    }

    const group = modalGroups[typeKey]!;
    const prevKm = group.totalKm;
    const nextKm = prevKm + lengthKm;
    group.count += 1;
    group.totalKm = nextKm;
    group.avgSpeedKmh = Math.round((group.avgSpeedKmh * prevKm + effSpeed * lengthKm) / nextKm);
  }

  const overallWeightedSpeedKmh =
    totalKmWeight > 0 ? Math.round(totalSpeedWeightedKm / totalKmWeight) : 0;
  const annualHoursSavedVsRoad = Math.round((totalPassengerKmTimeMinutes / 60) * 365);

  return {
    modalGroups,
    overallWeightedSpeedKmh,
    fastestRoute,
    totalOperationalKm: Math.round(totalOperationalKm),
    annualHoursSavedVsRoad,
  };
}

/**
 * Calculates estimated intercity travel times between top population centers.
 */
export function estimateIntercityTravelTimes(
  topCities: CityNode[],
  routes: RouteForMobility[]
): IntercityTransitLink[] {
  if (topCities.length < 2) return [];

  const operationalRoutes = routes.filter(
    (r) => r.status === "operational" && (r.lengthKm ?? 0) > 0
  );

  const hasHsr = operationalRoutes.some((r) => r.routeType === "high_speed_rail");
  const hasAir = operationalRoutes.some((r) => r.routeType === "air_corridor");
  const hasMotorway = operationalRoutes.some((r) => r.routeType === "motorway");

  const links: IntercityTransitLink[] = [];
  const primaryCity = topCities[0]!;

  for (let i = 1; i < Math.min(5, topCities.length); i++) {
    const targetCity = topCities[i]!;

    // Find if a direct route exists between them or compute geographic proxy
    let bestSpeed = 80;
    let bestMode = "highway";
    let distanceKm = 180;

    if (primaryCity.coordinates && targetCity.coordinates) {
      const [lon1, lat1] = primaryCity.coordinates;
      const [lon2, lat2] = targetCity.coordinates;
      // Haversine approximation
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const greatCircleKm = 6371 * c;
      // Real route distance ~ 1.25x direct geodesic
      distanceKm = Math.max(15, Math.round(greatCircleKm * 1.25));
    }

    if (hasHsr && distanceKm > 60) {
      bestSpeed = 280;
      bestMode = "high_speed_rail";
    } else if (hasAir && distanceKm > 400) {
      bestSpeed = 850;
      bestMode = "air_corridor";
    } else if (hasMotorway) {
      bestSpeed = 120;
      bestMode = "motorway";
    }

    const travelResult = calculateRouteTravelTime({
      lengthKm: distanceKm,
      speedKmh: bestSpeed,
      routeType: bestMode,
    });

    links.push({
      originName: primaryCity.name,
      destName: targetCity.name,
      distanceKm,
      travelTimeFormatted: travelResult.formattedTime,
      totalMinutes: travelResult.totalMinutes,
      effectiveSpeedKmh: travelResult.effectiveSpeedKmh,
      mode: bestMode,
    });
  }

  return links;
}
