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

import { IxTime } from "./ixtime";
import { formatCurrency, formatPopulation } from "./chart-utils";
import type { PrismaClient } from "@prisma/client";

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

  // IxTime
  currentIxTime: number;
  currentIxYear: number;
  currentIxMonth: number;
}

export type TriggerCondition =
  | { and: TriggerCondition[] }
  | { or: TriggerCondition[] }
  | { not: TriggerCondition }
  | {
      field: string;
      op: ">" | ">=" | "<" | "<=" | "==" | "!=" | "in" | "between";
      value: number | string | boolean | (number | string)[];
      value2?: number;
    }
  | { random: number };

export interface ResponseOptionTemplate {
  id: string;
  label: string;
  description: string;
  consequences: ConsequenceDefinition[];
  previewEffects: {
    publicApproval?: number;
    economicImpact?: string;
    stabilityImpact?: string;
    diplomaticImpact?: string;
  };
  outcomeText: string;
  isAutoResolveDefault?: boolean;
  triggersFollowUp?: string[];
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

interface TemplateCandidate {
  template: {
    id: string;
    slug: string;
    title: string;
    description: string;
    longDescription: string | null;
    domain: string;
    category: string;
    baseSeverity: string;
    baseUrgency: number;
    deadlineDaysBase: number | null;
    triggerConditions: string;
    cooldownDays: number;
    maxActivePerCountry: number;
    responseOptions: string;
    followUpTemplateIds: string | null;
    personalityModifiers: string | null;
    variableDefinitions: string | null;
  };
  probability: number;
}

// ==================== VARIABLE SUBSTITUTION ====================

const SECTOR_NAMES = [
  "manufacturing",
  "mining",
  "services",
  "agriculture",
  "technology",
  "energy",
  "financial services",
  "healthcare",
  "transportation",
  "telecommunications",
];

const CITY_DESCRIPTORS = [
  "the capital",
  "the industrial heartland",
  "the southern provinces",
  "the port district",
  "the northern territories",
  "the eastern corridor",
  "the western highlands",
  "the central valley",
];

const OFFICIAL_TITLES = [
  "the Minister of Finance",
  "the Minister of Defense",
  "the Minister of Interior",
  "the Foreign Secretary",
  "the Chief Economic Advisor",
  "the Attorney General",
  "the Health Minister",
  "the Education Secretary",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type VariableResolver = (snapshot: CountrySnapshot) => string;

const BUILT_IN_VARIABLES: Record<string, VariableResolver> = {
  countryName: (s) => s.name,
  leaderName: (s) => s.leader || "the Head of State",
  governmentType: (s) => s.governmentType || "the government",
  economicTier: (s) => s.economicTier,
  populationTier: (s) => s.populationTier,
  continent: (s) => s.continent || "the region",
  region: (s) => s.region || "the area",
  gdpFormatted: (s) => formatCurrency(s.currentTotalGdp),
  gdpPerCapitaFormatted: (s) => formatCurrency(s.currentGdpPerCapita),
  populationFormatted: (s) => formatPopulation(s.currentPopulation),
  unemploymentRate: (s) => (s.unemploymentRate ?? 0).toFixed(1) + "%",
  inflationRate: (s) => (s.inflationRate ?? 0).toFixed(1) + "%",
  approvalRating: (s) => Math.round(s.publicApproval).toString() + "%",
  povertyRate: (s) => (s.povertyRate ?? 0).toFixed(1) + "%",
  gdpGrowth: (s) => (s.actualGdpGrowth ?? 0).toFixed(1) + "%",
  debtRatio: (s) => (s.totalDebtGDPRatio ?? 0).toFixed(1) + "%",
  infrastructureRating: (s) => Math.round(s.infrastructureRating).toString(),
  stabilityScore: (s) => Math.round(s.stabilityScore).toString(),
  currentYear: (s) => String(s.currentIxYear),
  // Computed random variables
  sectorName: () => randomFrom(SECTOR_NAMES),
  cityName: () => randomFrom(CITY_DESCRIPTORS),
  officialTitle: () => randomFrom(OFFICIAL_TITLES),
  percentageSmall: () => String(randomBetween(3, 12)),
  percentageMedium: () => String(randomBetween(12, 30)),
  percentageLarge: () => String(randomBetween(30, 55)),
  amountSmall: (s) => formatCurrency(s.currentTotalGdp * (randomBetween(1, 5) / 1000)),
  amountMedium: (s) => formatCurrency(s.currentTotalGdp * (randomBetween(5, 20) / 1000)),
  amountLarge: (s) => formatCurrency(s.currentTotalGdp * (randomBetween(20, 80) / 1000)),
  workerCount: (s) => formatPopulation(s.currentPopulation * (randomBetween(1, 5) / 100)),
  neighborName: () => "a neighboring state",
  oppositionParty: () =>
    randomFrom([
      "the opposition coalition",
      "reform-minded lawmakers",
      "the minority bloc",
      "progressive legislators",
      "conservative hardliners",
    ]),
  mediaOutlet: () =>
    randomFrom([
      "the national press",
      "investigative journalists",
      "a major media outlet",
      "independent reporters",
      "the state broadcaster",
    ]),
};

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
    const country = await (db as any).country.findUnique({
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

    // Run aggregate counts in parallel
    const [embassyCount, policyCount, pendingIssueCount, crisisCount] = await Promise.all([
      (db as any).embassy.count({
        where: {
          hostCountryId: countryId,
          status: "active",
        },
      }),
      (db as any).policy.count({
        where: { countryId, status: "active" },
      }),
      (db as any).nationalIssue.count({
        where: {
          countryId,
          status: { in: ["pending", "viewed"] },
        },
      }),
      (db as any).crisisEvent.count({
        where: {
          affectedCountries: { contains: countryId },
          responseStatus: { not: "resolved" },
        },
      }),
    ]);

    const currentIxTime = IxTime.getCurrentIxTime();
    const ixDate = new Date(currentIxTime);

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
      currentIxTime,
      currentIxYear: ixDate.getFullYear(),
      currentIxMonth: ixDate.getMonth() + 1,
    };
  }

  /**
   * Evaluate a trigger condition tree against a country snapshot.
   * Safe evaluation - no eval(), no injection risk.
   */
  static evaluateCondition(condition: TriggerCondition, snapshot: CountrySnapshot): boolean {
    if ("and" in condition) {
      return condition.and.every((c) => this.evaluateCondition(c, snapshot));
    }
    if ("or" in condition) {
      return condition.or.some((c) => this.evaluateCondition(c, snapshot));
    }
    if ("not" in condition) {
      return !this.evaluateCondition(condition.not, snapshot);
    }
    if ("random" in condition) {
      return Math.random() < condition.random;
    }

    // Field comparison
    const fieldValue = this.getSnapshotField(snapshot, condition.field);
    if (fieldValue === null || fieldValue === undefined) return false;

    switch (condition.op) {
      case ">":
        return (fieldValue as number) > (condition.value as number);
      case ">=":
        return (fieldValue as number) >= (condition.value as number);
      case "<":
        return (fieldValue as number) < (condition.value as number);
      case "<=":
        return (fieldValue as number) <= (condition.value as number);
      case "==":
        return fieldValue === condition.value;
      case "!=":
        return fieldValue !== condition.value;
      case "in":
        return (
          Array.isArray(condition.value) && condition.value.includes(fieldValue as string | number)
        );
      case "between":
        return (
          (fieldValue as number) >= (condition.value as number) &&
          (fieldValue as number) <= (condition.value2 ?? Infinity)
        );
      default:
        return false;
    }
  }

  /**
   * Get a field value from the snapshot by key name.
   */
  private static getSnapshotField(
    snapshot: CountrySnapshot,
    field: string
  ): number | string | boolean | null {
    if (field in snapshot) {
      return (snapshot as Record<string, any>)[field] as number | string | boolean | null;
    }
    return null;
  }

  /**
   * Substitute {{variable}} placeholders in a template string.
   */
  static substituteVariables(
    template: string,
    snapshot: CountrySnapshot,
    extraVars?: Record<string, string>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
      if (extraVars?.[varName]) return extraVars[varName];
      const resolver = BUILT_IN_VARIABLES[varName];
      if (resolver) return resolver(snapshot);
      return `{{${varName}}}`;
    });
  }

  /**
   * Main evaluation entry point. Analyzes a country's state and generates
   * appropriate issues from the template library.
   */
  static async evaluateCountry(
    countryId: string,
    db: PrismaClient,
    options?: { maxIssues?: number; forceDomain?: string }
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

      // Suppress generation if too many pending issues
      if (snapshot.pendingIssueCount >= 10) {
        result.errors.push("Issue cap reached (10+ pending)");
        return result;
      }

      const maxIssues = options?.maxIssues ?? 3;

      // Load active templates
      const whereClause: any = { isActive: true };
      if (options?.forceDomain) {
        whereClause.domain = options.forceDomain;
      }
      const templates = await (db as any).nationalIssueTemplate.findMany({
        where: whereClause,
      });
      result.templatesEvaluated = templates.length;

      // Get recent issue history for cooldown checking
      const recentIssues = await (db as any).nationalIssue.findMany({
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
      const personalityAssignment = await (db as any).nPCPersonalityAssignment.findUnique({
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

      for (const candidate of selected) {
        try {
          // Each issue gets its own random variable set for variety
          const issueVars = { ...sharedVars };

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
          await (db as any).nationalIssue.create({
            data: {
              templateId: candidate.template.id,
              countryId,
              title: renderedTitle,
              description: renderedDescription,
              longDescription: renderedLongDescription,
              domain: candidate.template.domain,
              category: candidate.template.category,
              severity: candidate.template.baseSeverity,
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
      await (db as any).issueGenerationLog
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
    const lastLog = await (db as any).issueGenerationLog.findFirst({
      where: { countryId },
      orderBy: { createdAt: "desc" },
      select: { ixTimeAtEvaluation: true },
    });

    if (!lastLog) return true;

    const currentIxTime = IxTime.getCurrentIxTime();
    const fiveIxMinutesMs = 5 * 60 * 1000;
    return currentIxTime - lastLog.ixTimeAtEvaluation > fiveIxMinutesMs;
  }

  /**
   * Find all expired issues and auto-resolve them.
   * Should be called periodically (every 15 real-world minutes).
   */
  static async autoResolveExpired(
    db: PrismaClient
  ): Promise<{ resolved: number; errors: string[] }> {
    const currentIxTime = IxTime.getCurrentIxTime();
    const errors: string[] = [];
    let resolved = 0;

    const expiredIssues = await (db as any).nationalIssue.findMany({
      where: {
        status: { in: ["pending", "viewed"] },
        deadlineIxTime: { not: null, lte: currentIxTime },
      },
    });

    for (const issue of expiredIssues) {
      try {
        if (issue.autoResolveOptionId) {
          // Auto-resolve with the default option
          await (db as any).nationalIssue.update({
            where: { id: issue.id },
            data: {
              status: "auto_resolved",
              chosenOptionId: issue.autoResolveOptionId,
              chosenOptionLabel: issue.autoResolveLabel,
              respondedAt: new Date(),
              respondedIxTime: currentIxTime,
              consequenceLog:
                "This issue was auto-resolved due to inaction. The default outcome was applied.",
            },
          });
        } else {
          // No auto-resolve option, just expire
          await (db as any).nationalIssue.update({
            where: { id: issue.id },
            data: { status: "expired" },
          });
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
    const template = await (db as any).nationalIssueTemplate.findUnique({
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

    const issue = await (db as any).nationalIssue.create({
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
