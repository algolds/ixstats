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
import { COMPONENT_CATEGORIES } from "~/lib/atomic-government-data";
import { calculateGovernmentEffectiveness } from "~/lib/atomic-government-utils";
import { IxTime } from "~/lib/ixtime";
import { deriveBrokers } from "~/lib/statecraft-power-brokers";

// Category → StorytellerEffect inputType + base effect value per component
const CATEGORY_EFFECTS: Record<string, { inputType: string; base: number; desc: string }> = {
  "Power Distribution": {
    inputType: "ECONOMIC_POLICY",
    base: 0.002,
    desc: "Governance efficiency and economic coordination",
  },
  "Decision Process": {
    inputType: "ECONOMIC_POLICY",
    base: 0.002,
    desc: "Policy effectiveness and institutional predictability",
  },
  "Legitimacy Sources": {
    inputType: "ECONOMIC_POLICY",
    base: 0.002,
    desc: "Investor confidence and social cohesion",
  },
  Institutions: {
    inputType: "ECONOMIC_POLICY",
    base: 0.003,
    desc: "Administrative efficiency and economic throughput",
  },
  "Control Mechanisms": {
    inputType: "ECONOMIC_POLICY",
    base: 0.0015,
    desc: "Regulatory predictability and enforcement",
  },
  "Administrative Efficiency": {
    inputType: "GROWTH_RATE_MODIFIER",
    base: 0.003,
    desc: "Reduced friction boosts economic growth",
  },
  "Social Policy": {
    inputType: "POPULATION_ADJUSTMENT",
    base: 0.004,
    desc: "Population wellbeing and demographic stability",
  },
  "International Relations": {
    inputType: "GROWTH_RATE_MODIFIER",
    base: 0.003,
    desc: "Trade and investment channel expansion",
  },
  "Innovation & Development": {
    inputType: "GROWTH_RATE_MODIFIER",
    base: 0.004,
    desc: "R&D investment drives long-term growth",
  },
  "Crisis Management": {
    inputType: "ECONOMIC_POLICY",
    base: 0.002,
    desc: "Shock protection and economic resilience",
  },
};

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

export function calculateGovernmentEffectivenessScore(componentTypes: ComponentType[]): number {
  const metrics = calculateGovernmentEffectiveness(componentTypes);
  return Math.round(metrics.totalEffectiveness * 100) / 100;
}

export async function applyGovernmentComponentEffects(
  db: PrismaClient,
  countryId: string
): Promise<{
  effectsCreated: number;
  politicalMetricsUpdated: boolean;
  overallEffectiveness: number;
}> {
  const activeComponents = await db.governmentComponent.findMany({
    where: { countryId, isActive: true },
    select: { componentType: true, effectivenessScore: true },
  });

  if (activeComponents.length === 0) {
    try {
      await db.governmentStructure.update({
        where: { countryId },
        data: { politicalMetricsUpdated: new Date() },
      });
    } catch (_e) {
      /* GovernmentStructure may not exist yet */
    }
    return { effectsCreated: 0, politicalMetricsUpdated: false, overallEffectiveness: 50 };
  }

  const componentTypes = activeComponents.map((c) => c.componentType);
  const overallEffectiveness = calculateGovernmentEffectivenessScore(componentTypes);
  const effectivenessMultiplier = (overallEffectiveness - 50) / 100;

  // Deactivate previous government component and broker effects (prevent stacking)
  const prevIds = await db.storytellerEffect.findMany({
    where: {
      countryId,
      isActive: true,
      OR: [
        { description: { startsWith: "[GovComponent]" } },
        { description: { startsWith: "[BrokerComponent]" } }
      ]
    },
    select: { id: true },
  });
  if (prevIds.length > 0) {
    await db.storytellerEffect.updateMany({
      where: { id: { in: prevIds.map((e) => e.id) } },
      data: { isActive: false },
    });
  }

  // Group components by category
  const categoryCounts: Record<string, number> = {};
  for (const ct of componentTypes) {
    let found = false;
    for (const [name, types] of Object.entries(COMPONENT_CATEGORIES)) {
      if ((types as readonly ComponentType[]).includes(ct)) {
        categoryCounts[name] = (categoryCounts[name] ?? 0) + 1;
        found = true;
        break;
      }
    }
    if (!found) categoryCounts.Other = (categoryCounts.Other ?? 0) + 1;
  }

  // Build StorytellerEffect records per category
  const now = new Date(IxTime.getCurrentIxTime() * 1000);
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
    const raw = cfg.base * count;
    const scaled = raw + raw * effectivenessMultiplier;
    const clamped = Math.max(-0.1, Math.min(0.1, scaled));
    if (Math.abs(clamped) < 0.0001) continue;
    effectsData.push({
      countryId,
      ixTimeTimestamp: now,
      inputType: cfg.inputType,
      value: clamped,
      duration: 5,
      description: `[GovComponent] ${cat} (${count} component${count !== 1 ? "s" : ""}): ${cfg.desc}`,
      isActive: true,
    });
  }

  // Calculate allocations to derive brokers
  const allocations = await db.budgetAllocation.findMany({
    where: {
      governmentStructure: { countryId },
      budgetYear: new Date().getFullYear(),
    },
    include: { department: { select: { category: true } } }
  });
  const spendByCategory: Record<string, number> = {};
  allocations.forEach((alloc) => {
    const cat = alloc.department.category;
    spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
  });

  const activeComponentTypes = activeComponents.map((c) => c.componentType);
  const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
  const satisfiedSet = new Set(activeBrokers.filter((b) => b.satisfied).map((b) => b.id));

  // Build StorytellerEffect records for brokers
  if (satisfiedSet.has("technocrats")) {
    effectsData.push({
      countryId,
      ixTimeTimestamp: now,
      inputType: "CAPACITY_RELIEF",
      value: 0.15,
      duration: 5,
      description: "[BrokerComponent] The Technocrats: -15% domestic policy upkeep",
      isActive: true,
    });
  }
  if (satisfiedSet.has("party")) {
    effectsData.push({
      countryId,
      ixTimeTimestamp: now,
      inputType: "PARTY_INFLUENCE",
      value: 0.05,
      duration: 5,
      description: "[BrokerComponent] The Party: +5% leading-party strength",
      isActive: true,
    });
  }
  if (satisfiedSet.has("generals")) {
    effectsData.push({
      countryId,
      ixTimeTimestamp: now,
      inputType: "MILITARY_READINESS",
      value: 0.10,
      duration: 5,
      description: "[BrokerComponent] The Generals: +10% military readiness",
      isActive: true,
    });
  }
  if (satisfiedSet.has("magnates")) {
    effectsData.push({
      countryId,
      ixTimeTimestamp: now,
      inputType: "GROWTH_RATE_MODIFIER",
      value: 0.005, // +0.5% GDP growth
      duration: 5,
      description: "[BrokerComponent] The Magnates: +0.5% GDP growth modifier",
      isActive: true,
    });
  }

  if (effectsData.length > 0) {
    await db.storytellerEffect.createMany({ data: effectsData });
  }

  // Update GovernmentStructure political metrics
  const deltas = computePoliticalDeltas(activeComponents);

  // Apply satisfied broker political metric bonuses
  if (satisfiedSet.has("party")) {
    deltas.politicalStability = (deltas.politicalStability ?? 0) + 0.10; // +10% stability
  }
  if (satisfiedSet.has("clergy")) {
    deltas.politicalStability = (deltas.politicalStability ?? 0) + 0.05; // +5% stability
  }

  // Apply satisfied broker tensions
  if (satisfiedSet.has("generals")) {
    const defenseSpend = spendByCategory["Defense"] || 0;
    if (defenseSpend > 30.0) {
      deltas.politicalStability = (deltas.politicalStability ?? 0) - 0.05; // Over-fed generals trigger tension
    }
  }
  if (satisfiedSet.has("magnates")) {
    deltas.politicalStability = (deltas.politicalStability ?? 0) - 0.03; // Magnates trigger social inequality tension
  }

  let politicalMetricsUpdated = false;

  if (Object.keys(deltas).length > 0) {
    const struct = await db.governmentStructure.findUnique({
      where: { countryId },
      select: {
        politicalStability: true,
        democracyIndex: true,
        governmentEffectiveness: true,
        ruleOfLaw: true,
      },
    });

    if (struct) {
      const update: Record<string, number> = {};
      const applyDelta = (
        key: string,
        current: number,
        delta: number,
        min: number,
        max: number
      ) => {
        update[key] = Math.max(min, Math.min(max, current + delta));
      };

      if (deltas.politicalStability !== undefined)
        applyDelta(
          "politicalStability",
          struct.politicalStability ?? 0.5,
          deltas.politicalStability,
          0,
          1
        );
      if (deltas.democracyIndex !== undefined)
        applyDelta(
          "democracyIndex",
          struct.democracyIndex ?? 50,
          deltas.democracyIndex * 100,
          0,
          100
        );
      if (deltas.governmentEffectiveness !== undefined)
        applyDelta(
          "governmentEffectiveness",
          struct.governmentEffectiveness ?? 50,
          deltas.governmentEffectiveness * 100,
          0,
          100
        );
      if (deltas.ruleOfLaw !== undefined)
        applyDelta("ruleOfLaw", struct.ruleOfLaw ?? 50, deltas.ruleOfLaw * 100, 0, 100);

      if (Object.keys(update).length > 0) {
        await db.governmentStructure.update({
          where: { countryId },
          data: { ...update, politicalMetricsUpdated: new Date() },
        });
        politicalMetricsUpdated = true;
      }
    }
  }

  return { effectsCreated: effectsData.length, politicalMetricsUpdated, overallEffectiveness };
}
