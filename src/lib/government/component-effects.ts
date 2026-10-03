/**
 * Government Component Effects Engine
 *
 * Applies economic and political effects from active atomic government components
 * to the country's game state. All economic changes flow through StorytellerEffect
 * records (processed by IxStatsCalculator on next tick). Political metrics update
 * GovernmentStructure directly.
 *
 * @module government-component-effects
 */

import { ComponentType, type PrismaClient } from "@prisma/client";
import { COMPONENT_CATEGORIES } from "./atomic-data";
import { calculateGovernmentEffectiveness } from "./atomic-utils";
import { IxTime } from "~/lib/ixtime";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";
import { loadEffectiveBudget } from "./budget-allocations";

/** Category → StorytellerEffect inputType, base effect value per component, and description. */
const CATEGORY_EFFECTS: Record<string, [inputType: string, base: number, desc: string]> = {
  "Power Distribution": [
    "ECONOMIC_POLICY",
    0.002,
    "Governance efficiency and economic coordination",
  ],
  "Decision Process": [
    "ECONOMIC_POLICY",
    0.002,
    "Policy effectiveness and institutional predictability",
  ],
  "Legitimacy Sources": ["ECONOMIC_POLICY", 0.002, "Investor confidence and social cohesion"],
  Institutions: ["ECONOMIC_POLICY", 0.003, "Administrative efficiency and economic throughput"],
  "Control Mechanisms": ["ECONOMIC_POLICY", 0.0015, "Regulatory predictability and enforcement"],
  "Administrative Efficiency": [
    "GROWTH_RATE_MODIFIER",
    0.003,
    "Reduced friction boosts economic growth",
  ],
  "Social Policy": [
    "POPULATION_ADJUSTMENT",
    0.004,
    "Population wellbeing and demographic stability",
  ],
  "International Relations": [
    "GROWTH_RATE_MODIFIER",
    0.003,
    "Trade and investment channel expansion",
  ],
  "Innovation & Development": [
    "GROWTH_RATE_MODIFIER",
    0.004,
    "R&D investment drives long-term growth",
  ],
  "Crisis Management": ["ECONOMIC_POLICY", 0.002, "Shock protection and economic resilience"],
};

/** StorytellerEffects granted by satisfied power brokers, in application order. */
const BROKER_EFFECTS: Array<{ id: string; inputType: string; value: number; description: string }> =
  [
    {
      id: "technocrats",
      inputType: "CAPACITY_RELIEF",
      value: 0.15,
      description: "[BrokerComponent] The Technocrats: -15% domestic policy upkeep",
    },
    {
      id: "party",
      inputType: "PARTY_INFLUENCE",
      value: 0.05,
      description: "[BrokerComponent] The Party: +5% leading-party strength",
    },
    {
      id: "generals",
      inputType: "MILITARY_READINESS",
      value: 0.1,
      description: "[BrokerComponent] The Generals: +10% military readiness",
    },
    {
      id: "magnates",
      inputType: "GROWTH_RATE_MODIFIER",
      value: 0.005, // +0.5% GDP growth
      description: "[BrokerComponent] The Magnates: +0.5% GDP growth modifier",
    },
  ];

/** Political metric → stored fallback, delta scale (deltas are fractions) and clamp range. */
const POLITICAL_METRICS = {
  politicalStability: { fallback: 0.5, scale: 1, min: 0, max: 1 },
  democracyIndex: { fallback: 50, scale: 100, min: 0, max: 100 },
  governmentEffectiveness: { fallback: 50, scale: 100, min: 0, max: 100 },
  ruleOfLaw: { fallback: 50, scale: 100, min: 0, max: 100 },
} as const;

interface PoliticalDelta {
  politicalStability?: number;
  democracyIndex?: number;
  governmentEffectiveness?: number;
  ruleOfLaw?: number;
}

function computePoliticalDeltas(
  components: Array<{ componentType: ComponentType; effectivenessScore: number }>
): PoliticalDelta {
  const d: PoliticalDelta = {};
  const set = new Set(components.map((c) => c.componentType));

  // Power Distribution → politicalStability
  const power = COMPONENT_CATEGORIES["Power Distribution"].filter((ct) => set.has(ct));
  if (power.length > 0) d.politicalStability = Math.min(0.15, power.length * 0.03);

  // Decision Process → democracyIndex
  let demDelta = 0;
  for (const ct of COMPONENT_CATEGORIES["Decision Process"]) {
    if (!set.has(ct)) continue;
    if (ct === ComponentType.DEMOCRATIC_PROCESS || ct === ComponentType.CONSENSUS_PROCESS)
      demDelta += 0.04;
    else if (ct === ComponentType.AUTOCRATIC_PROCESS) demDelta -= 0.04;
  }
  if (demDelta !== 0) d.democracyIndex = Math.max(-0.2, Math.min(0.2, demDelta));

  // Legitimacy Sources → politicalStability
  const legitimacy = COMPONENT_CATEGORIES["Legitimacy Sources"].filter((ct) => set.has(ct));
  if (legitimacy.length > 0)
    d.politicalStability = (d.politicalStability ?? 0) + legitimacy.length * 0.025;

  // Institutions + Administrative Efficiency → governmentEffectiveness
  const admin = [
    ...COMPONENT_CATEGORIES["Institutions"],
    ...COMPONENT_CATEGORIES["Administrative Efficiency"],
  ].filter((ct) => set.has(ct));
  if (admin.length > 0) d.governmentEffectiveness = Math.min(0.3, admin.length * 0.025);

  // Control Mechanisms → ruleOfLaw
  const controlBonus =
    COMPONENT_CATEGORIES["Control Mechanisms"].filter(
      (ct) =>
        set.has(ct) &&
        (ct === ComponentType.RULE_OF_LAW || ct === ComponentType.MILITARY_ENFORCEMENT)
    ).length * 0.03;
  if (controlBonus > 0) d.ruleOfLaw = controlBonus;

  return d;
}

function calculateGovernmentEffectivenessScore(componentTypes: ComponentType[]): number {
  const metrics = calculateGovernmentEffectiveness(componentTypes);
  return Math.round(metrics.totalEffectiveness * 100) / 100;
}

const sumBy = <T>(items: T[], key: (item: T) => string, amount: (item: T) => number) => {
  const totals: Record<string, number> = {};
  for (const item of items) totals[key(item)] = (totals[key(item)] || 0) + amount(item);
  return totals;
};

/** Deactivates previous government component and broker effects (prevents stacking). */
async function deactivatePreviousEffects(db: PrismaClient, countryId: string) {
  const prevIds = await db.storytellerEffect.findMany({
    where: {
      countryId,
      isActive: true,
      OR: [
        { description: { startsWith: "[GovComponent]" } },
        { description: { startsWith: "[BrokerComponent]" } },
      ],
    },
    select: { id: true },
  });
  if (prevIds.length > 0) {
    await db.storytellerEffect.updateMany({
      where: { id: { in: prevIds.map((e) => e.id) } },
      data: { isActive: false },
    });
  }
}

/** Moves the stored political metrics by `deltas`; true when a row was updated. */
async function applyPoliticalMetrics(
  db: PrismaClient,
  countryId: string,
  deltas: PoliticalDelta
): Promise<boolean> {
  if (Object.keys(deltas).length === 0) return false;
  const struct = await db.governmentStructure.findUnique({
    where: { countryId },
    select: {
      politicalStability: true,
      democracyIndex: true,
      governmentEffectiveness: true,
      ruleOfLaw: true,
    },
  });
  if (!struct) return false;

  const update: Record<string, number> = {};
  for (const [key, { fallback, scale, min, max }] of Object.entries(POLITICAL_METRICS)) {
    const delta = deltas[key as keyof PoliticalDelta];
    if (delta === undefined) continue;
    const current = struct[key as keyof typeof struct] ?? fallback;
    update[key] = Math.max(min, Math.min(max, current + delta * scale));
  }
  if (Object.keys(update).length === 0) return false;

  await db.governmentStructure.update({
    where: { countryId },
    data: { ...update, politicalMetricsUpdated: new Date() },
  });
  return true;
}

export async function applyGovernmentComponentEffects(
  db: PrismaClient,
  countryId: string,
  preloaded?: {
    activeComponents?: Array<{ componentType: ComponentType; effectivenessScore: number }>;
    allocations?: Array<{ allocatedPercent: number; department: { category: string } }>;
  }
): Promise<{
  effectsCreated: number;
  politicalMetricsUpdated: boolean;
  overallEffectiveness: number;
}> {
  const activeComponents =
    preloaded?.activeComponents ??
    (await db.governmentComponent.findMany({
      where: { countryId, isActive: true },
      select: { componentType: true, effectivenessScore: true },
    }));

  if (activeComponents.length === 0) {
    try {
      await db.governmentStructure.update({
        where: { countryId },
        data: { politicalMetricsUpdated: new Date() },
      });
    } catch {
      /* GovernmentStructure may not exist yet */
    }
    return { effectsCreated: 0, politicalMetricsUpdated: false, overallEffectiveness: 50 };
  }

  const componentTypes = activeComponents.map((c) => c.componentType);
  const overallEffectiveness = calculateGovernmentEffectivenessScore(componentTypes);
  const effectivenessMultiplier = (overallEffectiveness - 50) / 100;

  await deactivatePreviousEffects(db, countryId);

  // Count components per category (anything uncategorised is "Other")
  const categoryCounts = sumBy(
    componentTypes,
    (ct) =>
      Object.entries(COMPONENT_CATEGORIES).find(([, types]) =>
        (types as readonly ComponentType[]).includes(ct)
      )?.[0] ?? "Other",
    () => 1
  );

  // One StorytellerEffect per category
  const now = new Date(IxTime.getCurrentIxTime());
  const effectsData: Array<{
    countryId: string;
    ixTimeTimestamp: Date;
    inputType: string;
    value: number;
    duration: number;
    description: string;
    isActive: boolean;
  }> = [];

  for (const [cat, count] of Object.entries(categoryCounts)) {
    const cfg = CATEGORY_EFFECTS[cat];
    if (!cfg || count === 0) continue;
    const [inputType, base, desc] = cfg;
    const raw = base * count;
    const scaled = raw + raw * effectivenessMultiplier;
    const clamped = Math.max(-0.1, Math.min(0.1, scaled));
    if (Math.abs(clamped) < 0.0001) continue;
    effectsData.push({
      countryId,
      ixTimeTimestamp: now,
      inputType,
      value: clamped,
      duration: 5,
      description: `[GovComponent] ${cat} (${count} component${count !== 1 ? "s" : ""}): ${desc}`,
      isActive: true,
    });
  }

  // Calculate allocations to derive brokers
  const allocations =
    preloaded?.allocations ?? (await loadEffectiveBudget(db, countryId)).allocations;
  const spendByCategory = sumBy(
    allocations,
    (a) => a.department.category,
    (a) => a.allocatedPercent
  );

  const activeComponentTypes = activeComponents.map((c) => c.componentType);
  const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
  const satisfiedSet = new Set(activeBrokers.filter((b) => b.satisfied).map((b) => b.id));

  for (const { id, inputType, value, description } of BROKER_EFFECTS) {
    if (satisfiedSet.has(id)) {
      effectsData.push({
        countryId,
        ixTimeTimestamp: now,
        inputType,
        value,
        duration: 5,
        description,
        isActive: true,
      });
    }
  }

  if (effectsData.length > 0) {
    await db.storytellerEffect.createMany({ data: effectsData });
  }

  // Political metrics: component deltas plus what satisfied brokers add or stir up
  const deltas = computePoliticalDeltas(activeComponents);
  const stabilityShifts: Array<[applies: boolean, shift: number]> = [
    [satisfiedSet.has("party"), 0.1],
    [satisfiedSet.has("clergy"), 0.05],
    // Over-fed generals trigger tension
    [satisfiedSet.has("generals") && (spendByCategory["Defense"] || 0) > 30.0, -0.05],
    // Magnates trigger social inequality tension
    [satisfiedSet.has("magnates"), -0.03],
  ];
  for (const [applies, shift] of stabilityShifts) {
    if (applies) deltas.politicalStability = (deltas.politicalStability ?? 0) + shift;
  }

  const politicalMetricsUpdated = await applyPoliticalMetrics(db, countryId, deltas);

  return { effectsCreated: effectsData.length, politicalMetricsUpdated, overallEffectiveness };
}
