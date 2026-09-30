/**
 * Template candidate selection for the National Issues engine: weekly issue
 * budget, template query filter, cooldown / max-active checks, trigger
 * evaluation and probability weighting (intent boost + NPC personality).
 */

import type { NPCPersonality, Prisma, PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { INTENT_CATEGORY_TO_TEMPLATE } from "~/lib/intent/resistance";
import { getNationalIssuesConfig } from "../config";
import type { CountrySnapshot, EvaluationResult } from "../types";
import { evaluateTriggerCondition, type TriggerCondition } from "./condition-evaluator";
import type { TemplateCandidate } from "./issue-generator";

type CandidateTemplate = TemplateCandidate["template"];
type RecentIssue = { templateId: string; createdIxTime: number; status: string };

const IX_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve how many issues this evaluation may generate. Returns null when the
 * weekly cap is already reached and nothing was generated yet (abort generation).
 */
export async function resolveMaxIssues(
  countryId: string,
  db: PrismaClient,
  options: { maxIssues?: number; bypassLimits?: boolean } | undefined,
  result: EvaluationResult
): Promise<number | null> {
  const config = getNationalIssuesConfig();
  const maxIssues = options?.maxIssues ?? config.maxIssuesPerSession;
  if (options?.bypassLimits) return maxIssues;

  const sevenIxDaysMs = 7 * IX_DAY_MS;
  const weekAgoIxTime = IxTime.getCurrentIxTime() - sevenIxDaysMs;
  const weeklyCount = await db.nationalIssue.count({
    where: { countryId, createdIxTime: { gte: weekAgoIxTime } },
  });

  if (weeklyCount >= config.maxIssuesPerWeek && result.issuesGenerated === 0) {
    // Abort normal template generation
    return null;
  }

  const capacityRemaining = Math.max(0, config.maxIssuesPerWeek - weeklyCount);
  return Math.min(maxIssues, capacityRemaining);
}

/**
 * Active, non-diplomatic templates (optionally restricted to one domain).
 */
export function buildTemplateWhere(forceDomain?: string): Prisma.NationalIssueTemplateWhereInput {
  const whereClause: Prisma.NationalIssueTemplateWhereInput = {
    isActive: true,
    NOT: [
      { domain: { in: ["diplomatic", "foreign"] } },
      { category: { in: ["DIPLOMATIC", "diplomatic"] } },
    ],
  };
  if (forceDomain) {
    whereClause.domain = forceDomain;
  }
  return whereClause;
}

function applyPersonalityModifiers(
  probability: number,
  personalityModifiers: string,
  traits: NPCPersonality
): number {
  let adjusted = probability;
  try {
    const modifiers = JSON.parse(personalityModifiers) as Record<string, number>;
    for (const [trait, multiplier] of Object.entries(modifiers)) {
      const traitValue = (traits[trait as keyof typeof traits] as number) ?? 50;
      const normalizedTrait = traitValue / 100;
      adjusted *= 1 + (multiplier - 1) * normalizedTrait;
    }
  } catch {
    // Ignore personality modifier parsing errors
  }
  return adjusted;
}

/**
 * Base probability from urgency, boosted when an active intent category maps to the
 * template, then adjusted by NPC personality modifiers.
 */
function candidateProbability(
  template: CandidateTemplate,
  snapshot: CountrySnapshot,
  personality: NPCPersonality | null
): number {
  let probability = template.baseUrgency / 100;

  // Vocabulary fix: intent categories (defense/fiscal/economy/...) differ from
  // template domains/categories (military/security/economic/...); bridge via
  // INTENT_CATEGORY_TO_TEMPLATE so economy/fiscal/defense intents boost their templates.
  const boosted = Object.entries(INTENT_CATEGORY_TO_TEMPLATE).some(
    ([intentCat, tokens]) =>
      snapshot.activeIntentCategories.includes(intentCat) &&
      tokens.some((t) => t === template.domain || t === template.category)
  );
  if (boosted) {
    probability *= 2.0;
  }

  if (personality && template.personalityModifiers) {
    probability = applyPersonalityModifiers(
      probability,
      template.personalityModifiers,
      personality
    );
  }
  return Math.min(probability, 1);
}

/**
 * Cooldown and max-active checks. Returns false (and counts the skip) when the
 * template may not fire for this country right now.
 */
function passesIssueLimits(
  template: CandidateTemplate,
  recentIssues: RecentIssue[],
  currentIxTime: number,
  result: EvaluationResult
): boolean {
  const cooldownIxTime = currentIxTime - template.cooldownDays * IX_DAY_MS;
  const recentFromTemplate = recentIssues.filter(
    (i) => i.templateId === template.id && i.createdIxTime > cooldownIxTime
  );
  if (recentFromTemplate.length > 0) {
    result.issuesSkippedCooldown++;
    return false;
  }

  const activeFromTemplate = recentIssues.filter(
    (i) => i.templateId === template.id && (i.status === "pending" || i.status === "viewed")
  );
  if (activeFromTemplate.length >= template.maxActivePerCountry) {
    result.issuesSkippedMaxActive++;
    return false;
  }
  return true;
}

/**
 * Evaluate each template against the snapshot and return the triggered candidates,
 * sorted by probability (higher = more likely to be selected).
 */
export function scoreTemplateCandidates(
  templates: CandidateTemplate[],
  recentIssues: RecentIssue[],
  personality: NPCPersonality | null,
  snapshot: CountrySnapshot,
  result: EvaluationResult
): TemplateCandidate[] {
  const candidates: TemplateCandidate[] = [];

  for (const template of templates) {
    if (!passesIssueLimits(template, recentIssues, snapshot.currentIxTime, result)) continue;

    let triggerCondition: TriggerCondition;
    try {
      triggerCondition = JSON.parse(template.triggerConditions) as TriggerCondition;
    } catch {
      result.errors.push(`Invalid trigger JSON for template ${template.slug}`);
      continue;
    }

    if (!evaluateTriggerCondition(triggerCondition, snapshot)) continue;

    result.templatesPassed++;
    candidates.push({
      template,
      probability: candidateProbability(template, snapshot, personality),
    });
  }

  candidates.sort((a, b) => b.probability - a.probability);
  return candidates;
}
