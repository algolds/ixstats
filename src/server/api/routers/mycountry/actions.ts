/**
 * MyCountry Executive Actions Router
 *
 * Provides the executive command suite: listing available actions and executing them
 * with real economic effects, cooldown enforcement, audit logging, and narrative output.
 */

import { z } from "zod";
import { createTRPCRouter, countryOwnerProcedure, executiveProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { db } from "~/server/db";
import { globalCache } from "~/lib/advanced-cache-system";
import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";
import { getMyCountryCache, setMyCountryCache } from "~/server/shared/mycountry-helpers";

import type { ExecutiveAction } from "~/types/mycountry";

interface ActionDefinition {
  name: string;
  category: ExecutiveAction["category"];
  description: string;
  estimatedImpact: string;
  requires: string[];
  inputType: string;
  baseValue: number;
  duration: number;
  cooldownHours: number;
  cost?: { budget: number };
  urgency: ExecutiveAction["urgency"];
}

const ACTION_DEFINITIONS: Record<string, ActionDefinition> = {
  stimulus_package: {
    name: "Economic Stimulus Package",
    category: "economic",
    description: "Deploy fiscal stimulus to boost economic growth",
    estimatedImpact: "GDP growth +2-4% for 2 IxTime years",
    requires: ["Budget approval", "Parliamentary consent"],
    inputType: "GDP_ADJUSTMENT",
    baseValue: 0.03,
    duration: 2,
    cooldownHours: 48,
    cost: { budget: 5000 },
    urgency: "high",
  },
  population_incentives: {
    name: "Population Growth Incentives",
    category: "social",
    description: "Implement policies to encourage population growth",
    estimatedImpact: "Population growth +1-2% for 4 IxTime years",
    requires: ["Social ministry approval"],
    inputType: "POPULATION_ADJUSTMENT",
    baseValue: 0.015,
    duration: 4,
    cooldownHours: 72,
    cost: { budget: 3000 },
    urgency: "medium",
  },
  tax_policy: {
    name: "Tax Policy Reform",
    category: "economic",
    description: "Reform tax code to stimulate investment and growth",
    estimatedImpact: "GDP growth +1-3% for 4 IxTime years",
    requires: ["Legislative approval"],
    inputType: "GROWTH_RATE_MODIFIER",
    baseValue: 0.02,
    duration: 4,
    cooldownHours: 96,
    cost: { budget: 2000 },
    urgency: "medium",
  },
  diplomatic_mission: {
    name: "Diplomatic Mission",
    category: "diplomatic",
    description: "Launch a high-level diplomatic initiative to improve international standing",
    estimatedImpact: "Improves diplomatic relations and global influence",
    requires: ["Foreign ministry"],
    inputType: "SPECIAL_EVENT",
    baseValue: 0.01,
    duration: 2,
    cooldownHours: 48,
    cost: { budget: 4000 },
    urgency: "medium",
  },
  emergency_response: {
    name: "Emergency Response Protocol",
    category: "emergency",
    description: "Activate emergency powers to address an ongoing crisis",
    estimatedImpact: "Reduces crisis severity, stabilizes population and economy",
    requires: ["Executive authority"],
    inputType: "SPECIAL_EVENT",
    baseValue: 0.005,
    duration: 1,
    cooldownHours: 24,
    cost: { budget: 10000 },
    urgency: "critical",
  },
  budget_allocation: {
    name: "Budget Reallocation",
    category: "economic",
    description: "Optimize budget allocation for efficiency gains",
    estimatedImpact: "GDP growth +0.5-1.5% for 4 IxTime years",
    requires: ["Treasury approval"],
    inputType: "ECONOMIC_POLICY",
    baseValue: 0.01,
    duration: 4,
    cooldownHours: 72,
    cost: { budget: 1000 },
    urgency: "low",
  },
  infrastructure_project: {
    name: "Infrastructure Project",
    category: "economic",
    description: "Launch a major infrastructure development program",
    estimatedImpact: "GDP growth +1-2% for 4 IxTime years",
    requires: ["Budget approval", "Parliamentary consent"],
    inputType: "ECONOMIC_POLICY",
    baseValue: 0.015,
    duration: 4,
    cooldownHours: 120,
    cost: { budget: 15000 },
    urgency: "medium",
  },
  education_reform: {
    name: "Education Reform",
    category: "social",
    description: "Comprehensive education system reform for long-term growth",
    estimatedImpact: "GDP growth +0.5-1% for 8 IxTime years (long-term)",
    requires: ["Social ministry approval", "Budget approval"],
    inputType: "SPECIAL_EVENT",
    baseValue: 0.008,
    duration: 8,
    cooldownHours: 168,
    cost: { budget: 8000 },
    urgency: "low",
  },
  healthcare_investment: {
    name: "Healthcare Investment",
    category: "social",
    description: "Major investment in public healthcare infrastructure",
    estimatedImpact: "Population growth +0.5-1% for 4 IxTime years",
    requires: ["Social ministry approval", "Budget approval"],
    inputType: "POPULATION_ADJUSTMENT",
    baseValue: 0.008,
    duration: 4,
    cooldownHours: 96,
    cost: { budget: 10000 },
    urgency: "low",
  },
};

function computeEffectValue(def: ActionDefinition, _country: any): number {
  const variance = def.baseValue * 0.35;
  const randomFactor = (Math.random() - 0.5) * 2 * variance;
  // Clamp to 4 significant digits to avoid floating-point noise
  return Math.round((def.baseValue + randomFactor) * 10000) / 10000;
}

export const myCountryActionsRouter = createTRPCRouter({
  /**
   * Get all executive actions available for the country.
   * Shows which are ready vs. on cooldown based on execution history.
   */
  getExecutiveActions: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (input.countryId !== ctx.user.countryId) {
        throw new Error("FORBIDDEN: Can only access actions for owned country");
      }

      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, adjustedGdpGrowth: true, populationGrowthRate: true, name: true },
      });
      if (!country) {
        throw new Error("FORBIDDEN: Country data not available");
      }

      // Check cooldowns: find the most recent execution of each action
      const recentEffects = await ctx.db.storytellerEffect.findMany({
        where: {
          countryId: input.countryId,
          inputType: "executive_action",
        },
        orderBy: { ixTimeTimestamp: "desc" },
        take: 20,
        select: { description: true, ixTimeTimestamp: true },
      });

      const now = Date.now();
      const cooldownMap = new Map<string, Date>();
      for (const effect of recentEffects) {
        for (const actionId of Object.keys(ACTION_DEFINITIONS)) {
          if (effect.description?.includes(`(${actionId})`) && !cooldownMap.has(actionId)) {
            cooldownMap.set(actionId, effect.ixTimeTimestamp);
          }
        }
      }

      const actions: ExecutiveAction[] = [];

      for (const [id, def] of Object.entries(ACTION_DEFINITIONS)) {
        const lastExecuted = cooldownMap.get(id);
        const onCooldown =
          lastExecuted &&
          now - lastExecuted.getTime() < def.cooldownHours * 60 * 60 * 1000;

        const cooldownRemaining = onCooldown && lastExecuted
          ? Math.ceil(
              (def.cooldownHours * 60 * 60 * 1000 - (now - lastExecuted.getTime())) /
                (60 * 60 * 1000)
            )
          : 0;

        // Contextual enablement based on country state
        const contextuallyRelevant =
          (id === "stimulus_package" && country.adjustedGdpGrowth < 0.02) ||
          (id === "population_incentives" && country.populationGrowthRate < 0.01) ||
          (id === "emergency_response"); // Always available

        actions.push({
          id,
          title: def.name,
          description: def.description,
          category: def.category,
          urgency: def.urgency,
          estimatedImpact: {
            economic: def.estimatedImpact,
            timeframe: `${def.duration} IxTime years`,
          },
          requirements: def.requires,
          enabled: !onCooldown,
          cooldownHours: onCooldown ? cooldownRemaining : undefined,
          cost: def.cost,
        } as ExecutiveAction & { cooldownHours?: number; cost?: { budget: number } } as any);
      }

      return actions;
    }),

  /**
   * Execute an executive action with real economic effects, cooldown tracking,
   * audit logging, and narrative output.
   */
  executeAction: executiveProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        actionId: z.string().min(1).max(50),
        parameters: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.countryId !== ctx.user.countryId) {
        throw new Error("FORBIDDEN: Can only execute actions for owned country");
      }

      const def = ACTION_DEFINITIONS[input.actionId];
      if (!def) {
        throw new Error("FORBIDDEN: Invalid or unauthorized action");
      }

      // Check cooldown
      const lastEffect = await db.storytellerEffect.findFirst({
        where: {
          countryId: input.countryId,
          inputType: "executive_action",
          description: { contains: `(${input.actionId})` },
        },
        orderBy: { ixTimeTimestamp: "desc" },
        select: { ixTimeTimestamp: true },
      });

      if (lastEffect) {
        const elapsed = Date.now() - lastEffect.ixTimeTimestamp.getTime();
        const cooldownMs = def.cooldownHours * 60 * 60 * 1000;
        if (elapsed < cooldownMs) {
          const remainingHours = Math.ceil((cooldownMs - elapsed) / (60 * 60 * 1000));
          throw new Error(
            `Action on cooldown. Available again in ${remainingHours} hour${remainingHours === 1 ? "" : "s"}.`
          );
        }
      }

      // Sanitize parameters
      const sanitizedParameters: Record<string, any> = {};
      if (input.parameters) {
        const allowedParams = ["amount", "duration", "target", "scope", "priority"];
        for (const [key, value] of Object.entries(input.parameters)) {
          if (allowedParams.includes(key) && value !== null && value !== undefined) {
            if (typeof value === "string") {
              sanitizedParameters[key] = value.slice(0, 100);
            } else if (typeof value === "number" && !isNaN(value)) {
              sanitizedParameters[key] = Math.max(0, Math.min(1000000, value));
            }
          }
        }
      }

      // Fetch country for name (needed for news) and compute effect value
      const country = await db.country.findUnique({
        where: { id: input.countryId },
        select: { name: true, adjustedGdpGrowth: true },
      });

      const effectValue = computeEffectValue(def, country);

      try {
        // Create the real StorytellerEffect with computed value
        const effect = await db.storytellerEffect.create({
          data: {
            countryId: input.countryId,
            ixTimeTimestamp: new Date(IxTime.getCurrentIxTime() * 1000),
            inputType: def.inputType,
            value: effectValue,
            duration: def.duration,
            isActive: true,
            description: `Executive Action: ${def.name} (${input.actionId}) - Category: ${def.category}`,
            createdBy: ctx.user?.id || "system",
          },
        });

        // Clear relevant caches
        const cacheKeys = [
          `intelligence_${input.countryId}`,
          `achievements_${input.countryId}`,
          `rankings_${input.countryId}`,
          `summary_${input.countryId}`,
          `dashboard_${input.countryId}_hist_true`,
          `dashboard_${input.countryId}_hist_false`,
        ];
        await Promise.all(cacheKeys.map((key) => globalCache.delete(key)));

        // Narrative output: post to ThinkPages — template varies by category
        const templateMap: Record<
          string,
          { eventType: string; extraContext?: Record<string, string> }
        > = {
          economic: { eventType: "free_trade_signed" },
          social: { eventType: "free_trade_signed" },
          diplomatic: { eventType: "embassy_established" },
          emergency: {
            eventType: "alliance_action_approved",
            extraContext: {
              allianceName: country?.name ?? "Government",
              actionType: def.name,
            },
          },
        };
        const template = templateMap[def.category] ?? { eventType: "free_trade_signed" };

        void generateDiplomaticNews(db, input.countryId, template.eventType as any, {
          countryName: country?.name ?? "Government",
          targetName: def.name,
          severity: "light",
          reason: `Executive action executed: ${def.description}`,
          ...(template.extraContext ?? {}),
        }).catch((err) =>
          console.error("[MyCountry] Failed to generate executive action news:", err)
        );

        return {
          success: true,
          message: `${def.name} executed successfully`,
          actionId: input.actionId,
          actionName: def.name,
          category: def.category,
          impact: def.estimatedImpact,
          effectValue,
          duration: def.duration,
          timestamp: Date.now(),
          effectId: effect.id,
          parameters: sanitizedParameters,
        };
      } catch (error) {
        console.error("[MyCountry Execute Action] Database error:", error);
        throw new Error("INTERNAL_ERROR: Failed to execute action - please try again");
      }
    }),
});
