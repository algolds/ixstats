import type { PrismaClient, Prisma } from "@prisma/client";
import {
  calculateTAMI,
  calculateMaintenanceDegradation,
  calculateModalBreakdown,
} from "~/lib/economy/national-mobility";

interface RoutePropertiesWithMaintenance {
  maintenanceCost?: number | string;
  speed_kmh?: number | string;
  [key: string]: string | number | boolean | null | undefined;
}

interface BudgetSpendingCategory {
  category?: string;
  amount?: number;
}

/**
 * Recalculate and synchronize transport economic modifier effects for a country.
 * Updates GDP, Trade, and Infrastructure Maintenance storyteller effects
 * using TAMI mobility and maintenance degradation mechanics.
 */
export async function syncTransportEconomicModifiers(
  db: PrismaClient | Prisma.TransactionClient,
  countryId: string
): Promise<void> {
  const [routes, hubs, citiesCount, budget, country] = await Promise.all([
    db.transportRoute.findMany({
      where: { countryId, status: "operational" },
    }),
    db.transportHub.findMany({
      where: { countryId },
    }),
    db.city.count({
      where: { countryId },
    }),
    db.governmentBudget.findUnique({
      where: { countryId },
      select: { spendingCategories: true },
    }),
    db.country.findUnique({
      where: { id: countryId },
      select: { currentTotalGdp: true, currentPopulation: true },
    }),
  ]);

  let totalLengthKm = 0;
  let totalMaintenanceCost = 0;

  for (const route of routes) {
    totalLengthKm += route.lengthKm ?? 0;
    const props = (route.properties as RoutePropertiesWithMaintenance | null) || {};
    totalMaintenanceCost += props.maintenanceCost !== undefined ? Number(props.maintenanceCost) : 0;
  }

  // Resolve budgeted infrastructure maintenance
  let budgetedInfraMaintenance = 0;
  if (budget?.spendingCategories) {
    try {
      const parsed = JSON.parse(budget.spendingCategories) as BudgetSpendingCategory[];
      if (Array.isArray(parsed)) {
        const infraCat = parsed.find(
          (c) =>
            c.category &&
            (c.category.toLowerCase().includes("infra") ||
              c.category.toLowerCase().includes("transport") ||
              c.category.toLowerCase().includes("transit"))
        );
        if (infraCat && typeof infraCat.amount === "number") {
          budgetedInfraMaintenance =
            infraCat.amount > 100_000_000 ? infraCat.amount / 1e9 : infraCat.amount;
        }
      }
    } catch {
      // JSON parse fallback
    }
  }

  // Fallback if no explicit category: estimate 1.5% of GDP as default public infrastructure spend
  if (budgetedInfraMaintenance <= 0 && country?.currentTotalGdp) {
    budgetedInfraMaintenance = (country.currentTotalGdp * 0.015) / 1e9;
  }

  const modalSummary = calculateModalBreakdown(
    routes.map((r) => ({
      id: r.id,
      name: r.name,
      routeType: r.routeType,
      lengthKm: r.lengthKm,
      speedKmh: (r as { speedKmh?: number | null }).speedKmh ?? null,
      terrainDifficulty: r.terrainDifficulty,
      status: r.status,
      properties: r.properties as Record<string, unknown> | null,
    }))
  );

  const tamiResult = calculateTAMI({
    totalLengthKm,
    landAreaKm2: null,
    effectiveAverageSpeedKmh: modalSummary.overallWeightedSpeedKmh,
    totalHubs: hubs.length,
    cityCount: citiesCount,
    operationalRouteTypes: routes.map((r) => r.routeType),
  });

  const degradation = calculateMaintenanceDegradation({
    budgetedMaintenance: budgetedInfraMaintenance,
    requiredMaintenance: totalMaintenanceCost,
  });

  const maritimeAirKm = routes
    .filter(
      (r) =>
        r.routeType === "shipping_lane" ||
        r.routeType === "air_corridor" ||
        r.routeType === "canal" ||
        r.routeType === "ferry"
    )
    .reduce((sum, r) => sum + (r.lengthKm ?? 0), 0);
  const maritimeRatio = totalLengthKm > 0 ? maritimeAirKm / totalLengthKm : 0;

  const rawGdp =
    (tamiResult.tamiScore / 100) * 0.15 * degradation.speedDegradationFactor +
    degradation.gdpModifierDelta;
  const gdpBonus = Math.max(0, Math.min(0.2, Math.round(rawGdp * 10000) / 10000));

  const rawTrade =
    ((tamiResult.tamiScore / 100) * 0.18 + maritimeRatio * 0.07) *
      degradation.speedDegradationFactor +
    degradation.tradeModifierDelta;
  const tradeBonus = Math.max(0, Math.min(0.25, Math.round(rawTrade * 10000) / 10000));

  const syncDate = new Date();

  async function upsertEffect(
    inputType: string,
    value: number,
    description: string,
    isActive: boolean
  ) {
    const existing = await db.storytellerEffect.findFirst({
      where: { countryId, inputType, createdBy: "system_transport_sync" },
    });

    if (existing) {
      await db.storytellerEffect.update({
        where: { id: existing.id },
        data: { value, description, isActive, ixTimeTimestamp: syncDate },
      });
    } else if (isActive) {
      await db.storytellerEffect.create({
        data: {
          countryId,
          inputType,
          value,
          description,
          isActive: true,
          createdBy: "system_transport_sync",
          ixTimeTimestamp: syncDate,
        },
      });
    }
  }

  await Promise.all([
    upsertEffect(
      "transport_gdp_bonus",
      gdpBonus,
      `GDP growth bonus from ${tamiResult.ratingLabel} (TAMI: ${tamiResult.tamiScore}/100, ${totalLengthKm.toFixed(1)} km, ${modalSummary.overallWeightedSpeedKmh} km/h, condition: ${degradation.conditionLabel} [${degradation.speedDegradationFactor}x speed])`,
      gdpBonus > 0
    ),
    upsertEffect(
      "transport_trade_bonus",
      tradeBonus,
      `Trade efficiency bonus from ${tamiResult.ratingLabel} (TAMI: ${tamiResult.tamiScore}/100, condition: ${degradation.conditionLabel} [${degradation.speedDegradationFactor}x speed])`,
      tradeBonus > 0
    ),
    upsertEffect(
      "transport_infra_maintenance",
      -totalMaintenanceCost,
      `Annual transport network maintenance cost (${totalMaintenanceCost.toFixed(3)} billion IxCredits, condition: ${degradation.conditionLabel})`,
      totalMaintenanceCost > 0
    ),
  ]);
}
