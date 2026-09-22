/**
 * National Issues Engine
 *
 * Core engine that dynamically generates contextual national issues (decisions/events)
 * based on country data, player actions, and world state. Inspired by NationStates' issue system.
 *
 * Architecture:
 * - Template-based with variable substitution (no LLM, no API costs)
 * - JSON expression tree for trigger conditions (safe evaluation, no eval)
 * - Lazy evaluation: runs when player opens inbox, debounced by 5 IxTime minutes
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

import { IxTime } from "~/lib/ixtime";
import { formatCurrency, formatPopulation } from "~/lib/utils";
import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";
import {
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
} from "~/lib/government/atomic-utils";
import { mapTaxComponentTypeToId } from "~/lib/enums";
import type { PrismaClient } from "@prisma/client";
import { getNationalIssuesConfig } from "./config";
import { INTENT_CATEGORY_TO_TEMPLATE } from "~/lib/intent/resistance";
import { buildGroundedContext } from "./snapshot";
import { resolveNeighbors } from "./neighbors";
import { NationalIssuesConsequences } from "./consequences";
import {
  evaluateTriggerCondition,
  type ComparisonOp,
  type TriggerCondition,
} from "./evaluators/condition-evaluator";
import {
  substituteVariables,
  maybeTriggerStaffingShortage,
  type ResponseOptionTemplate,
  type TemplateCandidate,
} from "./evaluators/issue-generator";

export type { ComparisonOp, TriggerCondition, ResponseOptionTemplate, TemplateCandidate };

// ==================== TYPES ====================

export interface CountrySnapshot {
  // Identity
  id: string;
  name: string;
  leader: string | null;
  governmentType: string | null;
  economicTier: string;
  populationTier: string;
  continent: string | null;
  region: string | null;

  // Core economic
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  actualGdpGrowth: number;
  unemploymentRate: number;
  inflationRate: number;
  tradeBalance: number;

  // Fiscal
  taxRevenueGDPPercent: number;
  budgetDeficitSurplus: number;
  totalDebtGDPRatio: number;
  debtPerCapita: number;

  // Social
  publicApproval: number;
  povertyRate: number;
  incomeInequalityGini: number;
  lifeExpectancy: number;
  literacyRate: number;
  urbanPopulationPercent: number;
  infrastructureRating: number;

  // Government structure
  politicalStability: number;
  democracyIndex: number;
  governmentEffectiveness: number;
  ruleOfLaw: number;
  corruptionIndex: number;
  politicalPolarization: number;

  // Internal stability
  stabilityScore: number;
  crimeRate: number;
  protestFrequency: number;
  riotRisk: number;
  socialCohesion: number;
  ethnicTension: number;
  trustInGovernment: number;

  // Aggregate counts
  activeEmbassyCount: number;
  activeAllianceCount: number;
  activePolicyCount: number;
  pendingIssueCount: number;
  recentCrisisCount: number;
  activeTreatyCount: number;

  // Atomic components (gov/econ use enum names; tax uses frontend ids, e.g. "blockchain_ledger").
  // activeComponents = fully rolled out; implementingComponents = still in rollout phase.
  activeComponents: string[];
  implementingComponents: string[];
  // Civil service staffing — consumedStaff counts both active and implementing components.
  civilServiceCapacity: number;
  consumedStaff: number;

  // IxTime
  currentIxTime: number;
  currentIxYear: number;
  currentIxMonth: number;

  // Active policies & settings
  activePoliciesList: string[];
  policySettings: Record<string, Record<string, number>>;
  activeIntents: string[];
  activeIntentCategories: string[];

  // ── Grounded context (Phase 3, focused-first) — all optional; filled when the
  // ── country has the data. Absent → templates that reference them won't trigger.
  geo?: {
    isLandlocked: boolean;
    isIsland: boolean;
    dominantClimate: string | null;
    terrainRoughness: number | null;
    arableLandPercent: number;
    coastlineKm: number;
    neighborCount: number;
  };
  identity?: {
    capitalCity: string | null;
    largestCity: string | null;
    languages: string | null;
    religion: string | null;
  };
  party?: {
    name: string;
    ideology: string;
    support: number;
  };
  oppositionParty?: {
    name: string;
    ideology: string;
    support: number;
  };
  minister?: { name: string; title: string } | null;
  official?: { name: string; title: string } | null;
  labor?: {
    minimumWage: number | null;
    youthUnemploymentRate: number | null;
    informalEmploymentRate: number | null;
  };
  fiscal?: {
    salesTaxRate: number | null;
    corporateTaxRate: number | null;
  };
  economy?: {
    topSector: string | null;
    exportsGDPPercent: number | null;
    economicComplexity: number | null;
  };
  partners?: Array<{ name: string; band: string; strength: number }>;
  embassyPartners?: string[];
  worldEvents?: string[];
  crises?: string[];
  neighbors?: Array<{ name: string; countryId: string | null }>;
  activeIntentGoals?: string[];
}

export interface ConsequenceDefinition {
  targetModel: string;
  targetField: string;
  operation: "add" | "subtract" | "multiply" | "set";
  value: number;
  effectType?: "immediate" | "gradual";
  durationDays?: number;
}

export interface EvaluationResult {
  issuesGenerated: number;
  issuesSkippedCooldown: number;
  issuesSkippedMaxActive: number;
  templatesEvaluated: number;
  templatesPassed: number;
  executionTimeMs: number;
  errors: string[];
}

// ==================== ENGINE ====================

export class NationalIssuesEngine {
  /**
   * Build a flattened snapshot of all relevant country data.
   * Single optimized query - all template evaluations share this.
   */
  static async buildCountrySnapshot(
    countryId: string,
    db: PrismaClient
  ): Promise<CountrySnapshot | null> {
    const country = await db.country.findUnique({
      where: { id: countryId },
      select: {
        id: true,
        name: true,
        leader: true,
        governmentType: true,
        economicTier: true,
        populationTier: true,
        continent: true,
        region: true,
        currentPopulation: true,
        currentGdpPerCapita: true,
        currentTotalGdp: true,
        actualGdpGrowth: true,
        unemploymentRate: true,
        inflationRate: true,
        tradeBalance: true,
        taxRevenueGDPPercent: true,
        budgetDeficitSurplus: true,
        totalDebtGDPRatio: true,
        debtPerCapita: true,
        publicApproval: true,
        povertyRate: true,
        incomeInequalityGini: true,
        lifeExpectancy: true,
        literacyRate: true,
        urbanPopulationPercent: true,
        infrastructureRating: true,
        governmentStructure: {
          select: {
            politicalStability: true,
            democracyIndex: true,
            governmentEffectiveness: true,
            ruleOfLaw: true,
            corruptionIndex: true,
            politicalPolarization: true,
          },
        },
        stabilityMetrics: {
          select: {
            stabilityScore: true,
            crimeRate: true,
            protestFrequency: true,
            riotRisk: true,
            socialCohesion: true,
            ethnicTension: true,
            trustInGovernment: true,
          },
        },
        activeAlliances: true,
        activeTreaties: true,
      },
    });

    if (!country) return null;

    const [
      embassyCount,
      policyCount,
      pendingIssueCount,
      crisisCount,
      govComps,
      econComps,
      taxComps,
      activePolicies,
      activeIntents,
      grounded,
      neighbors,
    ] = await Promise.all([
      db.embassy.count({
        where: {
          hostCountryId: countryId,
          status: "active",
        },
      }),
      db.policy.count({
        where: { countryId, status: "active" },
      }),
      db.nationalIssue.count({
        where: {
          countryId,
          status: { in: ["pending", "viewed"] },
        },
      }),
      db.crisisEvent.count({
        where: {
          affectedCountries: { contains: countryId },
          responseStatus: { not: "resolved" },
        },
      }),
      db.governmentComponent.findMany({
        where: { countryId },
        select: { componentType: true, isActive: true, implementationDate: true },
      }),
      db.economicComponent.findMany({
        where: { countryId },
        select: { componentType: true, isActive: true, implementationDate: true },
      }),
      db.taxComponent.findMany({
        where: { countryId },
        select: { componentType: true, isActive: true, implementationDate: true },
      }),
      db.policy.findMany({
        where: { countryId, status: "active" },
        select: { id: true, name: true, calculatedEffects: true },
      }),
      db.intent.findMany({
        where: { countryId, status: "active" },
        select: { goal: true, category: true },
      }),
      buildGroundedContext(countryId, db as any),
      resolveNeighbors(countryId, db as any),
    ]);

    const currentIxTime = IxTime.getCurrentIxTime();
    const ixDate = new Date(currentIxTime);
    // implementationDate is stored in IxTime (game time), so compare against IxTime now.
    const now = ixDate;

    // Classify components into active vs. still-implementing. A component counts as
    // active once isActive is set OR its implementationDate has elapsed.
    const isComponentActive = (c: any) =>
      c.isActive === true || (c.implementationDate && new Date(c.implementationDate) <= now);

    const activeGovTypes: string[] = [];
    const implementingGovTypes: string[] = [];
    for (const c of govComps) {
      (isComponentActive(c) ? activeGovTypes : implementingGovTypes).push(String(c.componentType));
    }

    const activeEconTypes: string[] = [];
    const implementingEconTypes: string[] = [];
    for (const c of econComps) {
      (isComponentActive(c) ? activeEconTypes : implementingEconTypes).push(
        String(c.componentType)
      );
    }

    const activeTaxIds: string[] = [];
    const implementingTaxIds: string[] = [];
    for (const c of taxComps) {
      const id = mapTaxComponentTypeToId(String(c.componentType));
      (isComponentActive(c) ? activeTaxIds : implementingTaxIds).push(id);
    }

    const activeComponents = [...activeGovTypes, ...activeEconTypes, ...activeTaxIds];
    const implementingComponents = [
      ...implementingGovTypes,
      ...implementingEconTypes,
      ...implementingTaxIds,
    ];

    // Staff is consumed by both active and implementing components (rollout still ties up staff).
    const consumedStaff = calculateTotalConsumedStaff(
      [...activeGovTypes, ...implementingGovTypes] as any[],
      [...activeEconTypes, ...implementingEconTypes] as any[],
      [...activeTaxIds, ...implementingTaxIds]
    );
    const civilServiceCapacity = calculateCivilServiceCapacity(
      country.currentPopulation ?? 0,
      country.governmentStructure?.governmentEffectiveness ?? 50
    );

    const activePoliciesList: string[] = [];
    const policySettings: Record<string, Record<string, number>> = {};

    for (const policy of activePolicies) {
      if (policy.calculatedEffects) {
        try {
          const parsed = JSON.parse(policy.calculatedEffects);
          const key = parsed.decretalKey || policy.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          activePoliciesList.push(key);
          if (parsed.settings) {
            policySettings[key] = parsed.settings;
          }
        } catch {}
      } else {
        const key = policy.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        activePoliciesList.push(key);
      }
    }

    return {
      id: country.id,
      name: country.name,
      leader: country.leader,
      governmentType: country.governmentType,
      economicTier: country.economicTier,
      populationTier: country.populationTier,
      continent: country.continent,
      region: country.region,
      currentPopulation: country.currentPopulation,
      currentGdpPerCapita: country.currentGdpPerCapita,
      currentTotalGdp: country.currentTotalGdp,
      actualGdpGrowth: country.actualGdpGrowth ?? 0,
      unemploymentRate: country.unemploymentRate ?? 0,
      inflationRate: country.inflationRate ?? 0,
      tradeBalance: country.tradeBalance ?? 0,
      taxRevenueGDPPercent: country.taxRevenueGDPPercent ?? 0,
      budgetDeficitSurplus: country.budgetDeficitSurplus ?? 0,
      totalDebtGDPRatio: country.totalDebtGDPRatio ?? 0,
      debtPerCapita: country.debtPerCapita ?? 0,
      publicApproval: country.publicApproval ?? 50,
      povertyRate: country.povertyRate ?? 0,
      incomeInequalityGini: country.incomeInequalityGini ?? 0,
      lifeExpectancy: country.lifeExpectancy ?? 70,
      literacyRate: country.literacyRate ?? 90,
      urbanPopulationPercent: country.urbanPopulationPercent ?? 50,
      infrastructureRating: country.infrastructureRating ?? 50,
      politicalStability: country.governmentStructure?.politicalStability ?? 50,
      democracyIndex: country.governmentStructure?.democracyIndex ?? 50,
      governmentEffectiveness: country.governmentStructure?.governmentEffectiveness ?? 50,
      ruleOfLaw: country.governmentStructure?.ruleOfLaw ?? 50,
      corruptionIndex: country.governmentStructure?.corruptionIndex ?? 50,
      politicalPolarization: country.governmentStructure?.politicalPolarization ?? 40,
      stabilityScore: country.stabilityMetrics?.stabilityScore ?? 75,
      crimeRate: country.stabilityMetrics?.crimeRate ?? 5,
      protestFrequency: country.stabilityMetrics?.protestFrequency ?? 5,
      riotRisk: country.stabilityMetrics?.riotRisk ?? 10,
      socialCohesion: country.stabilityMetrics?.socialCohesion ?? 70,
      ethnicTension: country.stabilityMetrics?.ethnicTension ?? 20,
      trustInGovernment: country.stabilityMetrics?.trustInGovernment ?? 50,
      activeEmbassyCount: embassyCount,
      activeAllianceCount: country.activeAlliances ?? 0,
      activePolicyCount: policyCount,
      pendingIssueCount: pendingIssueCount,
      recentCrisisCount: crisisCount,
      activeTreatyCount: country.activeTreaties ?? 0,
      activeComponents,
      implementingComponents,
      civilServiceCapacity,
      consumedStaff,
      currentIxTime,
      currentIxYear: ixDate.getFullYear(),
      currentIxMonth: ixDate.getMonth() + 1,
      activePoliciesList,
      policySettings,
      activeIntents: activeIntents.map((i: any) => i.goal),
      activeIntentCategories: activeIntents.map((i: any) => i.category),
      // Grounded context (Phase 3) — optional, focused-first.
      geo: grounded?.geo ?? undefined,
      identity: grounded?.identity ?? undefined,
      party: grounded?.party ?? undefined,
      oppositionParty: grounded?.oppositionParty ?? undefined,
      minister: grounded?.minister ?? undefined,
      official: grounded?.official ?? undefined,
      labor: grounded?.labor ?? undefined,
      fiscal: grounded?.fiscal ?? undefined,
      economy: grounded?.economy ?? undefined,
      partners: grounded?.partners ?? undefined,
      embassyPartners: grounded?.embassyPartners ?? undefined,
      worldEvents: grounded?.worldEvents ?? undefined,
      crises: grounded?.crises ?? undefined,
      neighbors,
      activeIntentGoals: activeIntents.map((i: any) => i.goal),
    };
  }

  /**
   * Evaluate a trigger condition tree against a country snapshot.
   * Safe evaluation - no eval(), no injection risk.
   */
  static evaluateCondition(condition: TriggerCondition, snapshot: CountrySnapshot): boolean {
    return evaluateTriggerCondition(condition, snapshot);
  }

  /**
   * Substitute {{variable}} placeholders in a template string.
   */
  static substituteVariables(
    template: string,
    snapshot: CountrySnapshot,
    extraVars?: Record<string, string>
  ): string {
    return substituteVariables(template, snapshot, extraVars);
  }

  /**
   * Auto-trigger a "Government Staffing Shortage" issue when active + implementing
   * component staff requirements exceed the country's civil service capacity.
   */
  private static async maybeTriggerStaffingShortage(
    countryId: string,
    db: PrismaClient,
    snapshot: CountrySnapshot,
    result: EvaluationResult
  ): Promise<void> {
    return maybeTriggerStaffingShortage(countryId, db, snapshot, result);
  }

  /**
   * Main evaluation entry point. Analyzes a country's state and generates
   * appropriate issues from the template library.
   */
  static async evaluateCountry(
    countryId: string,
    db: PrismaClient,
    options?: { maxIssues?: number; forceDomain?: string; bypassLimits?: boolean }
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
      const snapshot = await this.buildCountrySnapshot(countryId, db);
      if (!snapshot) {
        result.errors.push(`Country ${countryId} not found`);
        return result;
      }

      // Structural staffing-shortage check runs regardless of the normal pipeline cap.
      await this.maybeTriggerStaffingShortage(countryId, db, snapshot, result);

      // Suppress generation if too many pending issues
      if (snapshot.pendingIssueCount >= 10) {
        result.errors.push("Issue cap reached (10+ pending)");
        return result;
      }

      const config = getNationalIssuesConfig();
      let maxIssues = options?.maxIssues ?? config.maxIssuesPerSession;

      if (!options?.bypassLimits) {
        const sevenIxDaysMs = 7 * 24 * 60 * 60 * 1000;
        const weekAgoIxTime = IxTime.getCurrentIxTime() - sevenIxDaysMs;
        const weeklyCount = await db.nationalIssue.count({
          where: { countryId, createdIxTime: { gte: weekAgoIxTime } },
        });

        if (weeklyCount >= config.maxIssuesPerWeek) {
          // Abort normal template generation
          if (result.issuesGenerated === 0) {
            return result;
          }
        }

        const capacityRemaining = Math.max(0, config.maxIssuesPerWeek - weeklyCount);
        maxIssues = Math.min(maxIssues, capacityRemaining);
      }

      // Load active templates
      const whereClause: any = {
        isActive: true,
        NOT: [
          { domain: { in: ["diplomatic", "foreign"] } },
          { category: { in: ["DIPLOMATIC", "diplomatic"] } },
        ],
      };
      if (options?.forceDomain) {
        whereClause.domain = options.forceDomain;
      }
      const templates = await db.nationalIssueTemplate.findMany({
        where: whereClause,
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

      // Get NPC personality for modifier calculations
      const personalityAssignment = await db.nPCPersonalityAssignment.findUnique({
        where: { countryId },
        include: { personality: true },
      });

      // Evaluate each template
      const candidates: TemplateCandidate[] = [];

      for (const template of templates) {
        // Check cooldown
        const ixTimeDayMs = 24 * 60 * 60 * 1000;
        const cooldownIxTime = snapshot.currentIxTime - template.cooldownDays * ixTimeDayMs;
        const recentFromTemplate = recentIssues.filter(
          (i: any) => i.templateId === template.id && i.createdIxTime > cooldownIxTime
        );
        if (recentFromTemplate.length > 0) {
          result.issuesSkippedCooldown++;
          continue;
        }

        // Check max active per country
        const activeFromTemplate = recentIssues.filter(
          (i: any) =>
            i.templateId === template.id && (i.status === "pending" || i.status === "viewed")
        );
        if (activeFromTemplate.length >= template.maxActivePerCountry) {
          result.issuesSkippedMaxActive++;
          continue;
        }

        // Evaluate trigger conditions
        let triggerCondition: TriggerCondition;
        try {
          triggerCondition = JSON.parse(template.triggerConditions) as TriggerCondition;
        } catch {
          result.errors.push(`Invalid trigger JSON for template ${template.slug}`);
          continue;
        }

        const triggered = this.evaluateCondition(triggerCondition, snapshot);
        if (!triggered) continue;

        result.templatesPassed++;

        // Calculate base probability from urgency
        let probability = template.baseUrgency / 100;

        // Apply dynamic multiplier if an active intent category maps to this template.
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

        // Apply NPC personality modifiers
        if (personalityAssignment?.personality && template.personalityModifiers) {
          try {
            const modifiers = JSON.parse(template.personalityModifiers) as Record<string, number>;
            const traits = personalityAssignment.personality;
            for (const [trait, multiplier] of Object.entries(modifiers)) {
              const traitValue = (traits[trait as keyof typeof traits] as number) ?? 50;
              const normalizedTrait = traitValue / 100;
              probability *= 1 + (multiplier - 1) * normalizedTrait;
            }
          } catch {
            // Ignore personality modifier parsing errors
          }
        }

        candidates.push({ template, probability: Math.min(probability, 1) });
      }

      // Sort by probability (higher = more likely to be selected)
      candidates.sort((a, b) => b.probability - a.probability);

      // Select top N issues
      const selected = candidates.slice(0, maxIssues);

      // Instantiate issues
      // Resolve random variables once per evaluation to keep consistent within an issue
      const sharedVars: Record<string, string> = {};
      // Resolve target country statistics for foreign/diplomatic issues
      let targetCountryRecord: any = null;
      try {
        const activeIntentsWithTarget = await db.intent.findMany({
          where: { countryId, status: "active", target: { not: null } },
          select: { target: true },
        });
        if (activeIntentsWithTarget.length > 0 && activeIntentsWithTarget[0]?.target) {
          const targetName = activeIntentsWithTarget[0].target;
          targetCountryRecord = await db.country.findFirst({
            where: { name: { mode: "insensitive", equals: targetName } },
            select: { name: true, leader: true, currentGdpPerCapita: true, continent: true },
          });
        }
        if (!targetCountryRecord) {
          // Prefer grounded neighbors/partners over a random country (plan 002 §6C).
          const preferredName = snapshot.neighbors?.[0]?.name || snapshot.partners?.[0]?.name;
          if (preferredName) {
            targetCountryRecord = await db.country.findFirst({
              where: { name: { mode: "insensitive", equals: preferredName } },
              select: { name: true, leader: true, currentGdpPerCapita: true, continent: true },
            });
          }
        }
        if (!targetCountryRecord) {
          const otherCountries = await db.country.findMany({
            where: { id: { not: countryId } },
            select: { name: true, leader: true, currentGdpPerCapita: true, continent: true },
            take: 20,
          });
          if (otherCountries.length > 0) {
            targetCountryRecord = otherCountries[Math.floor(Math.random() * otherCountries.length)];
          }
        }
      } catch (err) {
        console.warn("[IssuesEngine] Failed to resolve target country record:", err);
      }

      for (const candidate of selected) {
        try {
          // Each issue gets its own random variable set for variety
          const issueVars = { ...sharedVars };

          if (targetCountryRecord) {
            issueVars.targetCountryName = targetCountryRecord.name;
            issueVars.targetCountryLeader = targetCountryRecord.leader || "the Foreign Leader";
            issueVars.targetCountryGdpPerCapita = formatCurrency(
              targetCountryRecord.currentGdpPerCapita
            );
            issueVars.targetCountryContinent = targetCountryRecord.continent || "the region";
          } else {
            issueVars.targetCountryName = "a neighboring state";
            issueVars.targetCountryLeader = "the Foreign Leader";
            issueVars.targetCountryGdpPerCapita = "$30,000";
            issueVars.targetCountryContinent = "the region";
          }

          const renderedTitle = this.substituteVariables(
            candidate.template.title,
            snapshot,
            issueVars
          );
          const renderedDescription = this.substituteVariables(
            candidate.template.description,
            snapshot,
            issueVars
          );
          const renderedLongDescription = candidate.template.longDescription
            ? this.substituteVariables(candidate.template.longDescription, snapshot, issueVars)
            : null;

          // Render response options
          let responseOptions: ResponseOptionTemplate[];
          try {
            responseOptions = JSON.parse(
              candidate.template.responseOptions
            ) as ResponseOptionTemplate[];
          } catch {
            result.errors.push(
              `Invalid response options JSON for template ${candidate.template.slug}`
            );
            continue;
          }

          const renderedOptions = responseOptions.map((opt) => ({
            ...opt,
            label: this.substituteVariables(opt.label, snapshot, issueVars),
            description: this.substituteVariables(opt.description, snapshot, issueVars),
            outcomeText: this.substituteVariables(opt.outcomeText, snapshot, issueVars),
          }));

          // Calculate deadline
          let deadlineIxTime: number | null = null;
          if (candidate.template.deadlineDaysBase != null) {
            const ixTimeDayMs = 24 * 60 * 60 * 1000;
            deadlineIxTime =
              snapshot.currentIxTime + candidate.template.deadlineDaysBase * ixTimeDayMs;
          }

          // Find auto-resolve option
          const autoResolveOption = renderedOptions.find((o) => o.isAutoResolveDefault);

          // Create the issue instance
          await db.nationalIssue.create({
            data: {
              templateId: candidate.template.id,
              countryId,
              title: renderedTitle,
              description: renderedDescription,
              longDescription: renderedLongDescription,
              domain: candidate.template.domain,
              category: candidate.template.category as any,
              severity: candidate.template.baseSeverity as any,
              urgency: candidate.template.baseUrgency,
              deadlineIxTime,
              status: "pending",
              autoResolveOptionId: autoResolveOption?.id ?? null,
              autoResolveLabel: autoResolveOption?.label ?? null,
              responseOptions: JSON.stringify(renderedOptions),
              contextSnapshot: JSON.stringify({
                gdp: snapshot.currentTotalGdp,
                gdpPerCapita: snapshot.currentGdpPerCapita,
                population: snapshot.currentPopulation,
                unemployment: snapshot.unemploymentRate,
                inflation: snapshot.inflationRate,
                approval: snapshot.publicApproval,
                stability: snapshot.stabilityScore,
              }),
              triggerReason: `Template ${candidate.template.slug} triggered (probability: ${(candidate.probability * 100).toFixed(1)}%)`,
              aiConfidence: candidate.probability * 100,
              createdIxTime: snapshot.currentIxTime,
            },
          });

          result.issuesGenerated++;
        } catch (err) {
          result.errors.push(
            `Failed to instantiate ${candidate.template.slug}: ${(err as Error).message}`
          );
        }
      }

      // Log the evaluation
      result.executionTimeMs = Date.now() - startTime;
      if (result.issuesGenerated > 0 || result.errors.length > 0) {
        await db.issueGenerationLog
          .create({
            data: {
              countryId,
              templatesEvaluated: result.templatesEvaluated,
              templatesPassed: result.templatesPassed,
              issuesGenerated: result.issuesGenerated,
              issuesSkippedCooldown: result.issuesSkippedCooldown,
              issuesSkippedMaxActive: result.issuesSkippedMaxActive,
              executionTimeMs: result.executionTimeMs,
              ixTimeAtEvaluation: snapshot.currentIxTime,
              errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
            },
          })
          .catch(() => {
            // Non-critical, don't fail evaluation
          });
      }
    } catch (err) {
      result.errors.push(`Evaluation failed: ${(err as Error).message}`);
    }

    result.executionTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Check if an evaluation is needed (debounced by 5 IxTime minutes).
   * Returns true if the last evaluation was more than 5 IxTime minutes ago.
   */
  static async shouldEvaluate(countryId: string, db: PrismaClient): Promise<boolean> {
    const config = getNationalIssuesConfig();
    const sevenIxDaysMs = 7 * 24 * 60 * 60 * 1000;
    const weekAgoIxTime = IxTime.getCurrentIxTime() - sevenIxDaysMs;

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

    const currentIxTime = IxTime.getCurrentIxTime();
    // Statecraft spine wants a weekly trickle, not a burst: space evaluations ~2 IxDays
    // apart so a country's weekly allotment arrives over the week, not all at once.
    // (The maxIssuesPerWeek cap above still bounds the total.) See plans/statecraft-stage1.md.
    const debounceMs = GAMEPLAY_FLAGS.statecraftSpine ? 2 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
    return currentIxTime - lastLog.ixTimeAtEvaluation > debounceMs;
  }

  /**
   * Find all expired issues and auto-resolve them.
   * Should be called periodically (every 15 real-world minutes).
   */
  static async autoResolveExpired(
    db: PrismaClient
  ): Promise<{ resolved: number; errors: string[] }> {
    // In narrative mode deadlines are not enforced; auto-resolution does nothing.
    if (!GAMEPLAY_FLAGS.issuesEnforceDeadlines) {
      return { resolved: 0, errors: [] };
    }

    const currentIxTime = IxTime.getCurrentIxTime();
    const errors: string[] = [];
    let resolved = 0;

    const expiredIssues = await db.nationalIssue.findMany({
      where: {
        status: { in: ["pending", "viewed"] },
        deadlineIxTime: { not: null, lte: currentIxTime },
      },
    });

    for (const issue of expiredIssues) {
      try {
        if (issue.autoResolveOptionId) {
          // Auto-resolve via the consequence system to apply consequences and update intent progress
          await NationalIssuesConsequences.resolveIssue(
            issue.id,
            issue.autoResolveOptionId,
            db,
            true
          );
        } else {
          // No auto-resolve option, just expire
          await db.nationalIssue.update({
            where: { id: issue.id },
            data: { status: "expired" },
          });
          if (issue.intentId) {
            await NationalIssuesConsequences.recomputeIntentProgress(issue.intentId, db);
          }
        }
        resolved++;
      } catch (err) {
        errors.push(`Failed to auto-resolve ${issue.id}: ${(err as Error).message}`);
      }
    }

    return { resolved, errors };
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

    const renderedTitle = this.substituteVariables(template.title, snapshot);
    const renderedDescription = this.substituteVariables(template.description, snapshot);
    const renderedLongDescription = template.longDescription
      ? this.substituteVariables(template.longDescription, snapshot)
      : null;

    let responseOptions: ResponseOptionTemplate[];
    try {
      responseOptions = JSON.parse(template.responseOptions) as ResponseOptionTemplate[];
    } catch {
      return null;
    }

    const renderedOptions = responseOptions.map((opt) => ({
      ...opt,
      label: this.substituteVariables(opt.label, snapshot),
      description: this.substituteVariables(opt.description, snapshot),
      outcomeText: this.substituteVariables(opt.outcomeText, snapshot),
    }));

    let deadlineIxTime: number | null = null;
    if (template.deadlineDaysBase != null) {
      const ixTimeDayMs = 24 * 60 * 60 * 1000;
      deadlineIxTime = snapshot.currentIxTime + template.deadlineDaysBase * ixTimeDayMs;
    }

    const autoResolveOption = renderedOptions.find((o) => o.isAutoResolveDefault);

    const issue = await db.nationalIssue.create({
      data: {
        templateId: template.id,
        countryId,
        title: renderedTitle,
        description: renderedDescription,
        longDescription: renderedLongDescription,
        domain: template.domain,
        category: template.category,
        severity: template.baseSeverity,
        urgency: template.baseUrgency,
        deadlineIxTime,
        status: "pending",
        autoResolveOptionId: autoResolveOption?.id ?? null,
        autoResolveLabel: autoResolveOption?.label ?? null,
        responseOptions: JSON.stringify(renderedOptions),
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
