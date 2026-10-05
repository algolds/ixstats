import { IxTime } from "~/lib/ixtime";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import type { NewsEventType } from "~/lib/diplomacy/news-generator";
import { ActivityHooks } from "./hooks";
import type { PrismaClient } from "@prisma/client";

const FIELD_BOUNDS: Record<string, [number, number]> = {
  // Country fields
  publicApproval: [0, 100],
  unemploymentRate: [0, 50],
  inflationRate: [-5, 100],
  infrastructureRating: [0, 100],
  tradeBalance: [-Infinity, Infinity],
  currentTotalGdp: [0, Infinity],
  currentGdpPerCapita: [0, Infinity],
  currentPopulation: [0, Infinity],
  povertyRate: [0, 100],
  incomeInequalityGini: [0, 1],
  taxRevenueGDPPercent: [0, 100],
  budgetDeficitSurplus: [-Infinity, Infinity],
  totalDebtGDPRatio: [0, 500],
  economicVitality: [0, 100],
  populationWellbeing: [0, 100],
  diplomaticStanding: [0, 100],
  governmentalEfficiency: [0, 100],
  overallNationalHealth: [0, 100],
  actualGdpGrowth: [-50, 100],
  // GovernmentStructure fields
  politicalStability: [0, 100],
  democracyIndex: [0, 100],
  governmentEffectiveness: [0, 100],
  ruleOfLaw: [0, 100],
  corruptionIndex: [0, 100],
  politicalPolarization: [0, 100],
  // InternalStabilityMetrics fields
  stabilityScore: [0, 100],
  crimeRate: [0, 100],
  protestFrequency: [0, 100],
  riotRisk: [0, 100],
  socialCohesion: [0, 100],
  ethnicTension: [0, 100],
  trustInGovernment: [0, 100],
  trustInPolice: [0, 100],
  fearOfCrime: [0, 100],
  civilDisobedience: [0, 100],
  policingEffectiveness: [0, 100],
  justiceSystemEfficiency: [0, 100],
};

function clampField(field: string, value: number): number {
  const bounds = FIELD_BOUNDS[field];
  if (!bounds) return value;
  return Math.max(bounds[0], Math.min(bounds[1], value));
}

const MODEL_CONFIG: Record<string, { prismaModel: string; lookupField: string }> = {
  Country: { prismaModel: "country", lookupField: "id" },
  GovernmentStructure: {
    prismaModel: "governmentStructure",
    lookupField: "countryId",
  },
  InternalStabilityMetrics: {
    prismaModel: "internalStabilityMetrics",
    lookupField: "countryId",
  },
};

const OPERATIONS: Record<
  "add" | "subtract" | "multiply" | "set",
  (current: number, value: number) => number
> = {
  add: (current, value) => current + value,
  subtract: (current, value) => current - value,
  multiply: (current, value) => current * value,
  set: (_current, value) => value,
};

const FIELD_LABELS: Record<string, string> = {
  publicApproval: "Public Approval",
  unemploymentRate: "Unemployment Rate",
  inflationRate: "Inflation Rate",
  currentTotalGdp: "GDP",
  currentGdpPerCapita: "GDP per Capita",
  infrastructureRating: "Infrastructure Rating",
  tradeBalance: "Trade Balance",
  povertyRate: "Poverty Rate",
  stabilityScore: "Stability Score",
  crimeRate: "Crime Rate",
  protestFrequency: "Protest Frequency",
  riotRisk: "Riot Risk",
  socialCohesion: "Social Cohesion",
  ethnicTension: "Ethnic Tension",
  trustInGovernment: "Trust in Government",
  politicalStability: "Political Stability",
  democracyIndex: "Democracy Index",
  governmentEffectiveness: "Government Effectiveness",
  corruptionIndex: "Corruption Index",
  politicalPolarization: "Political Polarization",
  totalDebtGDPRatio: "Debt-to-GDP Ratio",
  economicVitality: "Economic Vitality",
  ruleOfLaw: "Rule of Law",
};

interface ConsequenceInput {
  targetModel: string;
  targetField: string;
  operation: "add" | "subtract" | "multiply" | "set";
  value: number;
  effectType?: string;
  durationDays?: number;
}

interface AppliedConsequence {
  targetModel: string;
  targetField: string;
  previousValue: number;
  newValue: number;
  delta: number;
  description: string;
  effectType: string;
}

interface RecordEventParams {
  db: PrismaClient;
  countryId: string;
  sourceType: "issue" | "policy" | "decision" | "diplomacy" | "election" | "meeting" | "other";
  sourceId?: string;
  description: string;
  consequences?: ConsequenceInput[];
  newsTemplate?: NewsEventType;
  newsVars?: Record<string, any>;
  activityCategory?:
    "game" | "diplomatic" | "government" | "economic" | "security" | "social" | "user";
  activityHookName?: string;
  activityHookArgs?: any[];
}

export class CountryEventSpine {
  /**
   * Process a country event: apply consequences, write to the ledger, and trigger notifications/feeds.
   */
  static async recordCountryEvent(params: RecordEventParams): Promise<AppliedConsequence[]> {
    const {
      db,
      countryId,
      sourceType,
      sourceId,
      description,
      consequences = [],
      newsTemplate,
      newsVars,
      activityCategory,
      activityHookName,
      activityHookArgs = [],
    } = params;

    const currentIxTime = IxTime.getCurrentIxTime();
    const appliedConsequences: AppliedConsequence[] = [];

    for (const consequence of consequences) {
      await this.applyConsequence(
        { db, countryId, sourceType, sourceId, currentIxTime },
        consequence,
        appliedConsequences
      );
    }

    // Write a general entry to the ledger if no consequences were applied, just to document the event
    if (appliedConsequences.length === 0) {
      try {
        await (db as any).countryChangeLog?.create?.({
          data: {
            countryId,
            sourceType,
            sourceId: sourceId ?? null,
            description,
            appliedIxTime: currentIxTime,
          },
        });
      } catch (err) {
        console.error("[Spine] Failed to write fallback change log:", err);
      }
    }

    // 3. Post diplomatic news to ThinkPages (fire-and-forget)
    if (newsTemplate) {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      const vars = {
        countryName: country?.name ?? "Government",
        reason: description,
        ...newsVars,
      };

      void generateDiplomaticNews(db, countryId, newsTemplate, vars).catch((err) =>
        console.error("[Spine] Failed to generate diplomatic news:", err)
      );
    }

    // 4. Trigger Activity Hook (mirroring to activity feed)
    if (activityCategory && activityHookName) {
      try {
        const catHooks = (ActivityHooks as any)[
          activityCategory.charAt(0).toUpperCase() + activityCategory.slice(1)
        ];
        if (catHooks && typeof catHooks[activityHookName] === "function") {
          void catHooks[activityHookName](countryId, ...activityHookArgs).catch((err: any) =>
            console.error(`[Spine] Failed activity hook ${activityHookName}:`, err)
          );
        }
      } catch (err) {
        console.error(`[Spine] Failed to execute activity hook:`, err);
      }
    }

    return appliedConsequences;
  }

  /** Applies one consequence to its stat, records it in `applied` and writes the ledger entry. */
  private static async applyConsequence(
    ctx: {
      db: PrismaClient;
      countryId: string;
      sourceType: RecordEventParams["sourceType"];
      sourceId?: string;
      currentIxTime: number;
    },
    consequence: ConsequenceInput,
    applied: AppliedConsequence[]
  ): Promise<void> {
    const { db, countryId, sourceType, sourceId, currentIxTime } = ctx;
    const modelCfg = MODEL_CONFIG[consequence.targetModel];
    if (!modelCfg) return;
    const dbTable = (db as any)[modelCfg.prismaModel];
    if (!dbTable) return;

    try {
      const where = { [modelCfg.lookupField]: countryId };
      const record = await dbTable.findUnique({
        where,
        select: { [consequence.targetField]: true },
      });
      if (!record) return;

      // An unset (null) stat has no baseline to move from: skip it rather than treating it
      // as 0 (subtracting from a missing unemployment rate used to write 0% unemployment).
      const previousValue = record[consequence.targetField];
      if (typeof previousValue !== "number" || !Number.isFinite(previousValue)) return;

      const operation = OPERATIONS[consequence.operation];
      if (!operation) return;

      const rawNewValue = operation(previousValue, consequence.value);
      const newValue = clampField(consequence.targetField, rawNewValue);
      const wasClamped = Math.abs(newValue - rawNewValue) > 0.0001;

      await dbTable.update({ where, data: { [consequence.targetField]: newValue } });

      const delta = newValue - previousValue;
      let description = this.describeConsequence(
        consequence.targetField,
        previousValue,
        newValue,
        delta
      );
      if (wasClamped) description += ` [clamped from ${rawNewValue.toFixed(1)} by guardrail]`;

      applied.push({
        targetModel: consequence.targetModel,
        targetField: consequence.targetField,
        previousValue,
        newValue,
        delta,
        description,
        effectType: consequence.effectType ?? "immediate",
      });

      await (db as any).countryChangeLog?.create?.({
        data: {
          countryId,
          sourceType,
          sourceId: sourceId ?? null,
          targetModel: consequence.targetModel,
          targetField: consequence.targetField,
          previousValue: JSON.stringify(previousValue),
          newValue: JSON.stringify(newValue),
          deltaValue: delta,
          description,
          appliedIxTime: currentIxTime,
        },
      });
    } catch (err) {
      console.error(`[Spine] Failed to apply consequence on ${consequence.targetField}:`, err);
    }
  }

  /**
   * Format delta description.
   */
  private static describeConsequence(
    field: string,
    previousValue: number,
    newValue: number,
    delta: number
  ): string {
    const label = FIELD_LABELS[field] || field;
    const direction = delta > 0 ? "increased" : "decreased";
    const absStr = Math.abs(delta).toFixed(1);

    return `${label} ${direction} by ${absStr} (${previousValue.toFixed(1)} → ${newValue.toFixed(1)})`;
  }
}
