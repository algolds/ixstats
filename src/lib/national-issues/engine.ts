/**
 * National Issues Engine
 *
 * Core engine that dynamically generates contextual national issues (decisions/events)
 * based on country data, player actions, and world state. Inspired by NationStates' issue system.
 *
 * Architecture:
 * - Template-based with variable substitution (no LLM, no API costs)
 * - JSON expression tree for trigger conditions (safe evaluation, no eval)
 * - Lazy evaluation: runs when player opens inbox, debounced by 5 minutes of the nation's realm clock
 * - Supports NPC personality modifiers for probability adjustment
 * - Tiered urgency with auto-resolution for deadline issues
 *
 * Flow:
 * 1. Build CountrySnapshot (single optimized query)
 * 2. Load active templates, filter by cooldown
 * 3. Evaluate trigger conditions against snapshot
 * 4. Apply NPC personality modifiers
 * 5. Select top issues (max 3 per evaluation)
 * 6. Instantiate issues with variable substitution
 * 7. Persist to DB
 */

import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";
import { clockForCountry } from "~/server/shared/realm-time";
import type { PrismaClient } from "@prisma/client";
import { getNationalIssuesConfig } from "./config";
import { buildCountrySnapshot } from "./country-snapshot";
import type { CountrySnapshot, ConsequenceDefinition, EvaluationResult } from "./types";
import {
  evaluateTriggerCondition,
  type ComparisonOp,
  type TriggerCondition,
} from "./evaluators/condition-evaluator";
import {
  maybeTriggerStaffingShortage,
  type ResponseOptionTemplate,
  type TemplateCandidate,
} from "./evaluators/issue-generator";
import {
  buildTemplateWhere,
  resolveMaxIssues,
  scoreTemplateCandidates,
  usesRank,
} from "./evaluators/candidate-selection";
import {
  balanceDomains,
  issueDue,
  selectPacedCandidates,
  withRoutineFallback,
} from "./evaluators/pacing";
import { createRankCache, type RankSource } from "./realm-rank-store";
import {
  instantiateCandidate,
  logEvaluation,
  renderIssueTemplate,
  resolveTargetCountryRecord,
} from "./evaluators/issue-instantiation";

export type { ComparisonOp, TriggerCondition, ResponseOptionTemplate, TemplateCandidate };
export type { CountrySnapshot, ConsequenceDefinition, EvaluationResult };

// ENGINE

export class NationalIssuesEngine {
  /**
   * Build a flattened snapshot of all relevant country data.
   * Single optimized query - all template evaluations share this.
   */
  static async buildCountrySnapshot(
    countryId: string,
    db: PrismaClient,
    nowMs?: number
  ): Promise<CountrySnapshot | null> {
    return buildCountrySnapshot(countryId, db, nowMs);
  }

  /**
   * Evaluate a trigger condition tree against a country snapshot.
   * Safe evaluation - no eval(), no injection risk.
   */
  static evaluateCondition(condition: TriggerCondition, snapshot: CountrySnapshot): boolean {
    return evaluateTriggerCondition(condition, snapshot);
  }

  /**
   * Main evaluation entry point. Analyzes a country's state and generates
   * appropriate issues from the template library, at `options.now` (its realm clock's now when omitted).
   */
  static async evaluateCountry(
    countryId: string,
    db: PrismaClient,
    options?: {
      maxIssues?: number;
      forceDomain?: string;
      bypassLimits?: boolean;
      now?: number;
      /** The run's realm rank tables (the cron shares one cache); built on demand when absent. */
      ranks?: RankSource;
      /** Cron cadence: one issue once the nation's gap since its last issue is up (./evaluators/pacing.ts). */
      paced?: boolean;
    }
  ): Promise<EvaluationResult> {
    const startTime = Date.now();
    const result: EvaluationResult = {
      issuesGenerated: 0,
      issuesSkippedCooldown: 0,
      issuesSkippedMaxActive: 0,
      templatesEvaluated: 0,
      templatesPassed: 0,
      executionTimeMs: 0,
      errors: [],
    };

    try {
      // Build snapshot
      const snapshot = await this.buildCountrySnapshot(countryId, db, options?.now);
      if (!snapshot) {
        result.errors.push(`Country ${countryId} not found`);
        return result;
      }

      // Structural staffing-shortage check runs regardless of the normal pipeline cap.
      await maybeTriggerStaffingShortage(countryId, db, snapshot, result);

      // Suppress generation if too many pending issues
      if (snapshot.pendingIssueCount >= 10) {
        result.errors.push("Issue cap reached (10+ pending)");
        return result;
      }

      const maxIssues = await resolveMaxIssues(
        countryId,
        db,
        options,
        snapshot.currentIxTime,
        result
      );
      if (maxIssues === null) return result;

      // Load active templates
      const templates = await db.nationalIssueTemplate.findMany({
        where: buildTemplateWhere(options?.forceDomain),
      });
      result.templatesEvaluated = templates.length;

      // Get recent issue history for cooldown checking
      const recentIssues = await db.nationalIssue.findMany({
        where: { countryId },
        select: {
          templateId: true,
          createdIxTime: true,
          status: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      // Paced and not yet due: nothing to hand out, so skip the scoring and the realm's rank table.
      if (options?.paced && !issueDue(countryId, recentIssues, snapshot.currentIxTime)) return result;

      // Get NPC personality for modifier calculations
      const personalityAssignment = await db.nPCPersonalityAssignment.findUnique({
        where: { countryId },
        include: { personality: true },
      });

      // Rank conditions compare against the realm: load its table only when a template asks.
      const ranks = templates.some(usesRank)
        ? await (options?.ranks ?? createRankCache(db)).forCountry(countryId, snapshot.currentIxTime)
        : null;

      // Evaluate each template, then select the top N issues by probability (paced: one weighted pick when due)
      const candidates = scoreTemplateCandidates(
        templates,
        recentIssues,
        personalityAssignment?.personality ?? null,
        snapshot,
        result,
        ranks ?? undefined
      );
      // Routine templates only when nothing else qualified; the paced pick favours domains not seen lately.
      const pool = withRoutineFallback(candidates);
      const selected = options?.paced
        ? selectPacedCandidates(
            balanceDomains(pool, recentIssues, templates),
            recentIssues,
            countryId,
            snapshot.currentIxTime,
            maxIssues
          )
        : pool.slice(0, maxIssues);

      // Instantiate issues
      const targetCountryRecord = await resolveTargetCountryRecord(countryId, db, snapshot);
      for (const candidate of selected) {
        await instantiateCandidate(
          candidate,
          { countryId, db, snapshot, targetCountryRecord },
          result
        );
      }

      // Log the evaluation
      result.executionTimeMs = Date.now() - startTime;
      await logEvaluation(countryId, db, snapshot, result);
    } catch (err) {
      result.errors.push(`Evaluation failed: ${(err as Error).message}`);
    }

    result.executionTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Check if an evaluation is needed (debounced on the nation's realm clock: `now`, its now when omitted).
   * Returns true if the last evaluation was longer ago than the debounce.
   */
  static async shouldEvaluate(countryId: string, db: PrismaClient, now?: number): Promise<boolean> {
    const config = getNationalIssuesConfig();
    const currentIxTime = now ?? (await clockForCountry(db, countryId)).now();
    const sevenIxDaysMs = 7 * 24 * 60 * 60 * 1000;
    const weekAgoIxTime = currentIxTime - sevenIxDaysMs;

    // Count issues created for this country in the last 7 IxDays
    const weeklyCount = await db.nationalIssue.count({
      where: { countryId, createdIxTime: { gte: weekAgoIxTime } },
    });

    if (weeklyCount >= config.maxIssuesPerWeek) {
      return false; // Skip evaluation entirely if weekly cap reached
    }

    const lastLog = await db.issueGenerationLog.findFirst({
      where: { countryId },
      orderBy: { createdAt: "desc" },
      select: { ixTimeAtEvaluation: true },
    });

    if (!lastLog) return true;

    // Statecraft spine wants a weekly trickle, not a burst: space evaluations ~2 IxDays
    // apart so a country's weekly allotment arrives over the week, not all at once.
    // (The maxIssuesPerWeek cap above still bounds the total.) See plans/statecraft-stage1.md.
    const debounceMs = GAMEPLAY_FLAGS.statecraftSpine ? 2 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
    return currentIxTime - lastLog.ixTimeAtEvaluation > debounceMs;
  }

  /**
   * Instantiate a specific template for a country, bypassing trigger conditions.
   * Used for admin testing and follow-up chain generation.
   */
  static async forceGenerate(
    templateId: string,
    countryId: string,
    db: PrismaClient,
    parentIssueId?: string
  ): Promise<string | null> {
    const template = await db.nationalIssueTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) return null;

    const snapshot = await this.buildCountrySnapshot(countryId, db);
    if (!snapshot) return null;

    const rendered = renderIssueTemplate(template, snapshot);
    if (!rendered) return null;

    const issue = await db.nationalIssue.create({
      data: {
        templateId: template.id,
        countryId,
        title: rendered.title,
        description: rendered.description,
        longDescription: rendered.longDescription,
        domain: template.domain,
        category: template.category,
        severity: template.baseSeverity,
        urgency: template.baseUrgency,
        deadlineIxTime: rendered.deadlineIxTime,
        status: "pending",
        autoResolveOptionId: rendered.autoResolveOption?.id ?? null,
        autoResolveLabel: rendered.autoResolveOption?.label ?? null,
        responseOptions: JSON.stringify(rendered.options),
        contextSnapshot: JSON.stringify({
          gdp: snapshot.currentTotalGdp,
          population: snapshot.currentPopulation,
          approval: snapshot.publicApproval,
          stability: snapshot.stabilityScore,
        }),
        triggerReason: parentIssueId
          ? `Follow-up from issue ${parentIssueId}`
          : "Force-generated by admin",
        aiConfidence: 100,
        parentIssueId: parentIssueId ?? null,
        createdIxTime: snapshot.currentIxTime,
      },
    });

    return issue.id;
  }
}
