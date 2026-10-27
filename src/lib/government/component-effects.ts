/**
 * Government Component Effects Engine
 *
 * Applies economic and political effects from active atomic government components
 * to the country's game state. Economic changes are GDP level StorytellerEffects (read by
 * IxStatsCalculator), political metrics update GovernmentStructure directly.
 *
 * @module government-component-effects
 */

import { ComponentType, type PrismaClient } from "@prisma/client";
import { COMPONENT_CATEGORIES } from "./atomic-data";
import { calculateGovernmentEffectiveness } from "./atomic-utils";
import { StorytellerEffectType } from "~/lib/economy/calculations";
import { syncLevelEffects, type LevelTarget } from "~/lib/economy/storyteller-effects";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";
import { loadEffectiveBudget } from "./budget-allocations";

/** IxTime years over which a component or broker GDP effect phases in. */
const COMPONENT_EFFECT_YEARS = 5;

/**
 * Category → GDP level shift per component (0.002 = +0.2% GDP per capita) and description.
 * Social Policy has no economic effect: it used to add to the annual population growth rate,
 * which rewrote the whole projected population history.
 */
const CATEGORY_EFFECTS: Record<string, [base: number, desc: string]> = {
  "Power Distribution": [0.002, "Governance efficiency and economic coordination"],
  "Decision Process": [0.002, "Policy effectiveness and institutional predictability"],
  "Legitimacy Sources": [0.002, "Investor confidence and social cohesion"],
  Institutions: [0.003, "Administrative efficiency and economic throughput"],
  "Control Mechanisms": [0.0015, "Regulatory predictability and enforcement"],
  "Administrative Efficiency": [0.003, "Reduced friction boosts economic output"],
  "International Relations": [0.003, "Trade and investment channel expansion"],
  "Innovation & Development": [0.004, "R&D investment drives long-term output"],
  "Crisis Management": [0.002, "Shock protection and economic resilience"],
};

/**
 * GDP level effects granted by satisfied power brokers. (The Party's +5% support is applied by
 * politics-drift's party drift; Technocrats and Generals have no economic effect to write.)
 */
const BROKER_EFFECTS: Array<{ id: string; value: number; description: string }> = [
  {
    id: "magnates",
    value: 0.005,
    description: "[BrokerComponent] The Magnates: +0.5% GDP",
  },
];

/** `createdBy` prefixes of the keyed component and broker effects. */
const COMPONENT_KEY = "component:";
const BROKER_KEY = "broker:";

/**
 * Political metric → stored fallback, delta scale and clamp range. Every metric is stored on a
 * 0-100 scale; deltas (component and broker shifts) are fractions of it (0.1 = 10 points).
 */
const POLITICAL_METRICS = {
  politicalStability: { fallback: 50, scale: 100, min: 0, max: 100 },
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

type MetricKey = keyof typeof POLITICAL_METRICS;
type AppliedShift = Partial<Record<MetricKey, number>>;

function parseAppliedShift(raw: string | null): AppliedShift {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AppliedShift;
  } catch {
    return {};
  }
}

/**
 * Sets the stored political metrics to base + the component shift (`deltas`), where base is the
 * stored value minus the shift applied last time (`componentMetricsSnapshot`), so event deltas
 * (issues, elections) are carried and repeated runs never compound. True when a row was updated.
 */
async function applyPoliticalMetrics(
  db: PrismaClient,
  countryId: string,
  deltas: PoliticalDelta
): Promise<boolean> {
  const struct = await db.governmentStructure.findUnique({
    where: { countryId },
    select: {
      politicalStability: true,
      democracyIndex: true,
      governmentEffectiveness: true,
      ruleOfLaw: true,
      componentMetricsSnapshot: true,
    },
  });
  if (!struct) return false;

  const previous = parseAppliedShift(struct.componentMetricsSnapshot);
  const update: Partial<Record<MetricKey, number>> = {};
  const applied: AppliedShift = {};
  for (const [key, { fallback, scale, min, max }] of Object.entries(POLITICAL_METRICS) as Array<
    [MetricKey, (typeof POLITICAL_METRICS)[MetricKey]]
  >) {
    const stored = struct[key] ?? fallback;
    const previousShift = previous[key];
    const base = stored - (Number.isFinite(previousShift) ? previousShift! : 0);
    const next = Math.max(min, Math.min(max, base + (deltas[key] ?? 0) * scale));
    if (Math.abs(next - base) > 1e-9) applied[key] = next - base;
    if (Math.abs(next - stored) > 1e-9) update[key] = next;
  }
  const snapshot = JSON.stringify(applied);
  if (Object.keys(update).length === 0 && snapshot === (struct.componentMetricsSnapshot ?? "{}")) {
    return false;
  }

  await db.governmentStructure.update({
    where: { countryId },
    data: { ...update, componentMetricsSnapshot: snapshot, politicalMetricsUpdated: new Date() },
  });
  return true;
}

/** The keyed GDP level each present category and satisfied broker should hold. */
function componentLevelTargets(
  countryId: string,
  categoryCounts: Record<string, number>,
  effectivenessMultiplier: number,
  satisfiedBrokers: ReadonlySet<string>
): LevelTarget[] {
  const targets: LevelTarget[] = [];
  for (const [cat, count] of Object.entries(categoryCounts)) {
    const cfg = CATEGORY_EFFECTS[cat];
    if (!cfg || count === 0) continue;
    const [base, desc] = cfg;
    const raw = base * count;
    const value = Math.max(-0.1, Math.min(0.1, raw + raw * effectivenessMultiplier));
    if (Math.abs(value) < 0.0001) continue;
    targets.push({
      countryId,
      inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
      value: Math.round(value * 1e6) / 1e6,
      duration: COMPONENT_EFFECT_YEARS,
      description: `[GovComponent] ${cat} (${count} component${count !== 1 ? "s" : ""}): ${desc}`,
      createdBy: `${COMPONENT_KEY}${cat}`,
    });
  }
  for (const { id, value, description } of BROKER_EFFECTS) {
    if (!satisfiedBrokers.has(id)) continue;
    targets.push({
      countryId,
      inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
      value,
      duration: COMPONENT_EFFECT_YEARS,
      description,
      createdBy: `${BROKER_KEY}${id}`,
    });
  }
  return targets;
}

/** Retires the pre-level-effect component rows (growth types, no key); they rewrote history. */
async function deactivateLegacyComponentEffects(db: PrismaClient, countryId: string) {
  await db.storytellerEffect.updateMany({
    where: {
      countryId,
      isActive: true,
      createdBy: null,
      OR: [
        { description: { startsWith: "[GovComponent]" } },
        { description: { startsWith: "[BrokerComponent]" } },
      ],
    },
    data: { isActive: false },
  });
}

/**
 * Moves the keyed component/broker GDP levels to `targets` in place (delta rows only on change), from `now` (the
 * nation's clock time; read from its realm when omitted).
 */
async function syncComponentEffects(
  db: PrismaClient,
  countryId: string,
  targets: LevelTarget[],
  now?: number
) {
  await deactivateLegacyComponentEffects(db, countryId);
  return syncLevelEffects(
    db,
    {
      countryId,
      OR: [{ createdBy: { startsWith: COMPONENT_KEY } }, { createdBy: { startsWith: BROKER_KEY } }],
    },
    targets,
    now
  );
}

/** Political shift from components plus what satisfied brokers add or stir up. */
function politicalTarget(
  activeComponents: Array<{ componentType: ComponentType; effectivenessScore: number }>,
  satisfiedSet: ReadonlySet<string>,
  spendByCategory: Record<string, number>
): PoliticalDelta {
  const deltas = computePoliticalDeltas(activeComponents);
  // Fractions of the 0-100 stability scale, like the component deltas (0.1 = +10 points).
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
  return deltas;
}

/**
 * Brings a country's component and broker effects to what its active components call for: GDP
 * level effects keyed per category/broker (written only when a level changes) and political
 * metrics set to base + component shift. Idempotent, so politics-drift can run it every tick.
 */
export async function applyGovernmentComponentEffects(
  db: PrismaClient,
  countryId: string,
  preloaded?: {
    activeComponents?: Array<{ componentType: ComponentType; effectivenessScore: number }>;
    allocations?: Array<{ allocatedPercent: number; department: { category: string } }>;
    /** The nation's clock time the effects start at; read from its realm when omitted. */
    now?: number;
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

  const componentTypes = activeComponents.map((c) => c.componentType);
  const overallEffectiveness =
    componentTypes.length > 0 ? calculateGovernmentEffectivenessScore(componentTypes) : 50;
  const effectivenessMultiplier = (overallEffectiveness - 50) / 100;

  // Count components per category (anything uncategorised is "Other")
  const categoryCounts = sumBy(
    componentTypes,
    (ct) =>
      Object.entries(COMPONENT_CATEGORIES).find(([, types]) =>
        (types as readonly ComponentType[]).includes(ct)
      )?.[0] ?? "Other",
    () => 1
  );

  // Allocations derive the brokers (none without components)
  const allocations =
    componentTypes.length === 0
      ? []
      : (preloaded?.allocations ?? (await loadEffectiveBudget(db, countryId)).allocations);
  const spendByCategory = sumBy(
    allocations,
    (a) => a.department.category,
    (a) => a.allocatedPercent
  );
  const satisfiedSet = new Set(
    deriveBrokers(componentTypes, spendByCategory)
      .filter((b) => b.satisfied)
      .map((b) => b.id)
  );

  const effectsCreated = await syncComponentEffects(
    db,
    countryId,
    componentLevelTargets(countryId, categoryCounts, effectivenessMultiplier, satisfiedSet),
    preloaded?.now
  );
  const politicalMetricsUpdated = await applyPoliticalMetrics(
    db,
    countryId,
    politicalTarget(activeComponents, satisfiedSet, spendByCategory)
  );

  return { effectsCreated, politicalMetricsUpdated, overallEffectiveness };
}
