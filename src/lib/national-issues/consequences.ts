/**
 * National Issues Consequence System
 *
 * Applies effects when a player responds to a national issue (or auto-resolution fires).
 * Handles:
 * - Direct DB field updates on Country, GovernmentStructure, InternalStabilityMetrics
 * - Field value clamping to sensible bounds
 * - Consequence audit trail (NationalIssueConsequence records)
 * - Follow-up issue chain generation
 * - Activity feed and news generation side effects
 * - IxCredits rewards
 */

import { IxTime } from "~/lib/ixtime";
import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";
import {
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
} from "~/lib/government/atomic-utils";
import {
  NationalIssuesEngine,
  type ResponseOptionTemplate,
  type ConsequenceDefinition,
} from "./engine";
import type { PrismaClient } from "@prisma/client";
import { CountryEventSpine } from "~/lib/activity";

// ==================== FIELD BOUNDS ====================

/** Sensible min/max bounds for all modifiable numeric fields */
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

/** Clamp a value to the field's defined bounds */
function _clampField(field: string, value: number): number {
  const bounds = FIELD_BOUNDS[field];
  if (!bounds) return value;
  return Math.max(bounds[0], Math.min(bounds[1], value));
}

// ==================== MODEL FIELD MAPPING ====================

/** Maps targetModel values to their Prisma model name and lookup strategy */
const _MODEL_CONFIG: Record<string, { prismaModel: string; lookupField: string }> = {
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

// ==================== TYPES ====================

export interface AppliedConsequence {
  targetModel: string;
  targetField: string;
  previousValue: number;
  newValue: number;
  delta: number;
  description: string;
  effectType: string;
}

export interface ResolveResult {
  success: boolean;
  consequences: AppliedConsequence[];
  consequenceLog: string;
  followUpIssueIds: string[];
  ixCreditsAwarded: number;
  recommendedDirective?: string;
  error?: string;
}

// ==================== CONSEQUENCE APPLICATOR ====================

export class NationalIssuesConsequences {
  /**
   * Resolve an issue by applying the chosen option's consequences.
   * This is the main entry point called by the tRPC router.
   */
  static async resolveIssue(
    issueId: string,
    optionId: string,
    db: PrismaClient,
    isAutoResolve = false
  ): Promise<ResolveResult> {
    const result: ResolveResult = {
      success: false,
      consequences: [],
      consequenceLog: "",
      followUpIssueIds: [],
      ixCreditsAwarded: 0,
    };

    try {
      // Load the issue
      const issue = await (db as any).nationalIssue.findUnique({
        where: { id: issueId },
        include: { template: true },
      });

      if (!issue) {
        result.error = "Issue not found";
        return result;
      }

      if (issue.status === "responded" || issue.status === "auto_resolved") {
        result.error = "Issue already resolved";
        return result;
      }

      // Parse response options
      let responseOptions: ResponseOptionTemplate[];
      try {
        responseOptions = JSON.parse(issue.responseOptions) as ResponseOptionTemplate[];
      } catch {
        result.error = "Invalid response options";
        return result;
      }

      // Find the chosen option
      const chosenOption = responseOptions.find((o) => o.id === optionId);
      if (!chosenOption) {
        result.error = `Option ${optionId} not found`;
        return result;
      }

      result.recommendedDirective = chosenOption.recommendedDirective;

      const currentIxTime = IxTime.getCurrentIxTime();

      // Apply consequences
      let failedGamble = false;
      if (chosenOption.isRisky && !isAutoResolve) {
        // 40% chance of failure on risky choices
        failedGamble = Math.random() < 0.4;
      }

      if (failedGamble) {
        // Gamble backfired! Apply penalties instead of normal consequences
        try {
          const stabilityHit = await this.applyConsequence(
            {
              targetModel: "InternalStabilityMetrics",
              targetField: "stabilityScore",
              operation: "subtract",
              value: 6,
            },
            issue.countryId,
            db,
            issueId,
            currentIxTime
          );
          if (stabilityHit) result.consequences.push(stabilityHit);

          const approvalHit = await this.applyConsequence(
            {
              targetModel: "Country",
              targetField: "publicApproval",
              operation: "subtract",
              value: 8,
            },
            issue.countryId,
            db,
            issueId,
            currentIxTime
          );
          if (approvalHit) result.consequences.push(approvalHit);
        } catch (err) {
          console.error("Failed to apply gamble failure consequences:", err);
        }
      } else {
        // Normal consequence application
        if (chosenOption.consequences && chosenOption.consequences.length > 0) {
          for (const consequence of chosenOption.consequences) {
            try {
              const applied = await this.applyConsequence(
                consequence,
                issue.countryId,
                db,
                issueId,
                currentIxTime
              );
              if (applied) {
                result.consequences.push(applied);
              }
            } catch (err) {
              console.error(`Failed to apply consequence for ${consequence.targetField}:`, err);
            }
          }
        }
      }

      // Apply party alignment support modifications
      if (chosenOption.partyAlignment && !isAutoResolve) {
        try {
          const alignedParty = await (db as any).politicalParty.findFirst({
            where: {
              countryId: issue.countryId,
              OR: [
                { name: { contains: chosenOption.partyAlignment, mode: "insensitive" } },
                { shortName: { contains: chosenOption.partyAlignment, mode: "insensitive" } },
                { ideology: { contains: chosenOption.partyAlignment, mode: "insensitive" } },
              ],
            },
          });
          if (alignedParty) {
            await (db as any).politicalParty.update({
              where: { id: alignedParty.id },
              data: {
                currentSupport: Math.min(100, alignedParty.currentSupport + 3.0),
              },
            });
          }
        } catch (err) {
          console.error("Failed to update party support:", err);
        }
      }

      // Calculate IxCredits reward
      result.ixCreditsAwarded = this.calculateIxCredits(issue, isAutoResolve);

      // Build consequence log
      result.consequenceLog = this.buildConsequenceLog(
        chosenOption,
        result.consequences,
        isAutoResolve,
        failedGamble
      );

      // Update the issue
      await (db as any).nationalIssue.update({
        where: { id: issueId },
        data: {
          status: isAutoResolve ? "auto_resolved" : "responded",
          chosenOptionId: optionId,
          chosenOptionLabel: chosenOption.label,
          respondedAt: new Date(),
          respondedIxTime: currentIxTime,
          appliedConsequences: JSON.stringify(result.consequences),
          consequenceLog: result.consequenceLog,
          ixCreditsAwarded: result.ixCreditsAwarded,
        },
      });

      // Handle follow-up chain
      if (chosenOption.triggersFollowUp && chosenOption.triggersFollowUp.length > 0) {
        for (const followUpSlug of chosenOption.triggersFollowUp) {
          try {
            const followUpTemplate = await (db as any).nationalIssueTemplate.findUnique({
              where: { slug: followUpSlug },
            });
            if (followUpTemplate) {
              const followUpId = await NationalIssuesEngine.forceGenerate(
                followUpTemplate.id,
                issue.countryId,
                db,
                issueId
              );
              if (followUpId) {
                result.followUpIssueIds.push(followUpId);
              }
            }
          } catch (err) {
            console.error(`Failed to generate follow-up ${followUpSlug}:`, err);
          }
        }

        // Update parent issue with child IDs
        if (result.followUpIssueIds.length > 0) {
          await (db as any).nationalIssue.update({
            where: { id: issueId },
            data: {
              childIssueIds: JSON.stringify(result.followUpIssueIds),
            },
          });
        }
      }

      // Recompute linked intent progress (resistance resolution feeds the intent's agenda bar)
      if (issue.intentId) {
        try {
          await this.recomputeIntentProgress(issue.intentId, db);
        } catch (err) {
          console.error(`Failed to recompute progress for intent ${issue.intentId}:`, err);
        }
      }

      result.success = true;
    } catch (err) {
      result.error = `Resolution failed: ${(err as Error).message}`;
    }

    return result;
  }

  /**
   * Recompute the cached 0-100 progress of an Intent from its linked resistance
   * issues. Resolved = responded | auto_resolved | dismissed. pending/viewed are
   * still open. Exported for the intent router and agenda aggregation to reuse.
   */
  static async recomputeIntentProgress(intentId: string, db: PrismaClient): Promise<number> {
    const linked = await (db as any).nationalIssue.findMany({
      where: { intentId },
      select: { status: true },
    });

    const total = linked.length;
    if (total === 0) {
      await (db as any).intent.update({
        where: { id: intentId },
        data: { progress: 0 },
      });
      return 0;
    }

    const resolved = linked.filter((issue: { status: string }) =>
      ["responded", "auto_resolved", "dismissed"].includes(issue.status)
    ).length;

    const progress = Math.round((resolved / total) * 100);
    await (db as any).intent.update({
      where: { id: intentId },
      data: { progress },
    });

    return progress;
  }

  /**
   * Apply a single consequence definition to the database.
   */
  private static async applyConsequence(
    consequence: ConsequenceDefinition,
    countryId: string,
    db: PrismaClient,
    issueId: string,
    currentIxTime: number
  ): Promise<AppliedConsequence | null> {
    const appliedList = await CountryEventSpine.recordCountryEvent({
      db,
      countryId,
      sourceType: "issue",
      sourceId: issueId,
      description: `Resolved national issue consequence`,
      consequences: [
        {
          targetModel: consequence.targetModel,
          targetField: consequence.targetField,
          operation: consequence.operation as any,
          value: consequence.value,
          effectType: consequence.effectType,
          durationDays: consequence.durationDays,
        },
      ],
    });

    if (appliedList.length === 0) return null;
    const applied = appliedList[0];

    // Create local issue consequence audit record
    await (db as any).nationalIssueConsequence.create({
      data: {
        issueId,
        targetModel: consequence.targetModel,
        targetField: consequence.targetField,
        previousValue: JSON.stringify(applied.previousValue),
        newValue: JSON.stringify(applied.newValue),
        deltaValue: applied.delta,
        description: applied.description,
        effectType: applied.effectType,
        effectDuration: consequence.durationDays ?? null,
        appliedIxTime: currentIxTime,
      },
    });

    return applied;
  }

  /**
   * Generate a human-readable description of a consequence.
   */
  private static describeConsequence(
    field: string,
    previousValue: number,
    newValue: number,
    delta: number
  ): string {
    const fieldLabels: Record<string, string> = {
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

    const label = fieldLabels[field] || field;
    const direction = delta > 0 ? "increased" : "decreased";
    const absStr = Math.abs(delta).toFixed(1);

    return `${label} ${direction} by ${absStr} (${previousValue.toFixed(1)} → ${newValue.toFixed(1)})`;
  }

  /**
   * Calculate IxCredits reward based on issue severity and resolution type.
   */
  private static calculateIxCredits(issue: any, isAutoResolve: boolean): number {
    if (!GAMEPLAY_FLAGS.issuesAwardCredits) return 0; // narrative mode: no reward farming
    if (isAutoResolve) return 0; // No reward for inaction

    const severityRewards: Record<string, number> = {
      critical: 25,
      CRITICAL: 25,
      high: 15,
      HIGH: 15,
      medium: 8,
      MEDIUM: 8,
      low: 3,
      LOW: 3,
    };

    const base = severityRewards[issue.severity as string] ?? 5;

    // Bonus for resolving before deadline
    if (issue.deadlineIxTime) {
      const currentIxTime = IxTime.getCurrentIxTime();
      const remainingTime = issue.deadlineIxTime - currentIxTime;
      const totalTime = issue.deadlineIxTime - issue.createdIxTime;
      const timeRatio = remainingTime / totalTime;
      if (timeRatio > 0.5) return base + 5; // Early resolution bonus
    }

    return base;
  }

  /**
   * Build a human-readable summary of all consequences.
   */
  private static buildConsequenceLog(
    option: ResponseOptionTemplate,
    consequences: AppliedConsequence[],
    isAutoResolve: boolean,
    failedGamble: boolean = false
  ): string {
    const lines: string[] = [];

    if (isAutoResolve) {
      lines.push(
        "⚠ This issue was auto-resolved due to inaction. The default outcome was applied."
      );
      lines.push("");
    }

    if (failedGamble) {
      lines.push("❌ THE RISKY CHOICE BACKFIRED!");
      lines.push("Your gamble went wrong, causing instability and public backlash.");
      lines.push("");
    } else if (option.isRisky && !isAutoResolve) {
      lines.push("✅ THE RISKY CHOICE PAID OFF!");
      lines.push("Your gamble succeeded, establishing order and avoiding backlash.");
      lines.push("");
    }

    lines.push(`Decision: ${option.label}`);
    lines.push("");

    if (option.outcomeText) {
      lines.push(option.outcomeText);
      lines.push("");
    }

    if (consequences.length > 0) {
      lines.push("Effects:");
      for (const c of consequences) {
        const icon = c.delta > 0 ? "↑" : c.delta < 0 ? "↓" : "→";
        lines.push(`  ${icon} ${c.description}`);
      }
    }

    return lines.join("\n");
  }
}
