/**
 * Issue instantiation for the National Issues engine: target-country resolution,
 * template rendering, persistence of selected candidates and evaluation logging.
 */

import type { Category, Priority, PrismaClient } from "@prisma/client";
import { formatCurrency } from "~/lib/utils";
import type { CountrySnapshot, EvaluationResult } from "../types";
import {
  substituteVariables,
  type ResponseOptionTemplate,
  type TemplateCandidate,
} from "./issue-generator";

type CandidateTemplate = TemplateCandidate["template"];
type TargetCountryRecord = {
  name: string;
  leader: string | null;
  currentGdpPerCapita: number;
  continent: string | null;
};

const IX_DAY_MS = 24 * 60 * 60 * 1000;
const TARGET_COUNTRY_SELECT = {
  name: true,
  leader: true,
  currentGdpPerCapita: true,
  continent: true,
} as const;

function findCountryByName(
  db: PrismaClient,
  name: string,
  realmId: string
): Promise<TargetCountryRecord | null> {
  return db.country.findFirst({
    where: { realmId, name: { mode: "insensitive", equals: name } },
    select: TARGET_COUNTRY_SELECT,
  });
}

async function pickRandomOtherCountry(
  countryId: string,
  realmId: string,
  db: PrismaClient
): Promise<TargetCountryRecord | null> {
  const otherCountries = await db.country.findMany({
    where: { realmId, id: { not: countryId } },
    select: TARGET_COUNTRY_SELECT,
    take: 20,
  });
  if (otherCountries.length === 0) return null;
  return otherCountries[Math.floor(Math.random() * otherCountries.length)] ?? null;
}

/**
 * Resolve target country statistics for foreign/diplomatic issues: the active
 * intent's target first, then grounded neighbors/partners (plan 002 §6C), then a
 * random other country — always from the subject nation's own realm (ruling E-p). Never throws.
 */
export async function resolveTargetCountryRecord(
  countryId: string,
  db: PrismaClient,
  snapshot: CountrySnapshot
): Promise<TargetCountryRecord | null> {
  let targetCountryRecord: TargetCountryRecord | null = null;
  try {
    const subject = await db.country.findUnique({
      where: { id: countryId },
      select: { realmId: true },
    });
    if (!subject) return null;
    const { realmId } = subject;
    const activeIntentsWithTarget = await db.intent.findMany({
      where: { countryId, status: "active", target: { not: null } },
      select: { target: true },
    });
    const targetName = activeIntentsWithTarget[0]?.target;
    if (activeIntentsWithTarget.length > 0 && targetName) {
      targetCountryRecord = await findCountryByName(db, targetName, realmId);
    }
    if (!targetCountryRecord) {
      const preferredName = snapshot.neighbors?.[0]?.name || snapshot.partners?.[0]?.name;
      if (preferredName) {
        targetCountryRecord = await findCountryByName(db, preferredName, realmId);
      }
    }
    if (!targetCountryRecord) {
      targetCountryRecord = await pickRandomOtherCountry(countryId, realmId, db);
    }
  } catch (err) {
    console.warn("[IssuesEngine] Failed to resolve target country record:", err);
  }
  return targetCountryRecord;
}

function targetCountryVars(record: TargetCountryRecord | null): Record<string, string> {
  if (!record) {
    return {
      targetCountryName: "a neighboring state",
      targetCountryLeader: "the Foreign Leader",
      targetCountryGdpPerCapita: "$30,000",
      targetCountryContinent: "the region",
    };
  }
  return {
    targetCountryName: record.name,
    targetCountryLeader: record.leader || "the Foreign Leader",
    targetCountryGdpPerCapita: formatCurrency(record.currentGdpPerCapita),
    targetCountryContinent: record.continent || "the region",
  };
}

type RenderableTemplate = Pick<
  CandidateTemplate,
  "title" | "description" | "longDescription" | "responseOptions" | "deadlineDaysBase"
>;

interface RenderedIssue {
  title: string;
  description: string;
  longDescription: string | null;
  options: ResponseOptionTemplate[];
  deadlineIxTime: number | null;
  autoResolveOption: ResponseOptionTemplate | undefined;
}

/**
 * Render a template's text and response options with {{variable}} substitution and
 * compute its deadline. Returns null when the response options JSON is invalid.
 */
export function renderIssueTemplate(
  template: RenderableTemplate,
  snapshot: CountrySnapshot,
  vars?: Record<string, string>
): RenderedIssue | null {
  const title = substituteVariables(template.title, snapshot, vars);
  const description = substituteVariables(template.description, snapshot, vars);
  const longDescription = template.longDescription
    ? substituteVariables(template.longDescription, snapshot, vars)
    : null;

  let responseOptions: ResponseOptionTemplate[];
  try {
    responseOptions = JSON.parse(template.responseOptions) as ResponseOptionTemplate[];
  } catch {
    return null;
  }

  const options = responseOptions.map((opt) => ({
    ...opt,
    label: substituteVariables(opt.label, snapshot, vars),
    description: substituteVariables(opt.description, snapshot, vars),
    outcomeText: substituteVariables(opt.outcomeText, snapshot, vars),
  }));

  const deadlineIxTime =
    template.deadlineDaysBase != null
      ? snapshot.currentIxTime + template.deadlineDaysBase * IX_DAY_MS
      : null;

  return {
    title,
    description,
    longDescription,
    options,
    deadlineIxTime,
    autoResolveOption: options.find((o) => o.isAutoResolveDefault),
  };
}

/**
 * Render and persist one selected candidate. Failures are recorded on `result`.
 */
export async function instantiateCandidate(
  candidate: TemplateCandidate,
  ctx: {
    countryId: string;
    db: PrismaClient;
    snapshot: CountrySnapshot;
    targetCountryRecord: TargetCountryRecord | null;
  },
  result: EvaluationResult
): Promise<void> {
  const { template, probability } = candidate;
  const { countryId, db, snapshot } = ctx;
  try {
    // Each issue gets its own random variable set for variety
    const rendered = renderIssueTemplate(
      template,
      snapshot,
      targetCountryVars(ctx.targetCountryRecord)
    );
    if (!rendered) {
      result.errors.push(`Invalid response options JSON for template ${template.slug}`);
      return;
    }

    await db.nationalIssue.create({
      data: {
        templateId: template.id,
        countryId,
        title: rendered.title,
        description: rendered.description,
        longDescription: rendered.longDescription,
        domain: template.domain,
        category: template.category as Category,
        severity: template.baseSeverity as Priority,
        urgency: template.baseUrgency,
        deadlineIxTime: rendered.deadlineIxTime,
        status: "pending",
        autoResolveOptionId: rendered.autoResolveOption?.id ?? null,
        autoResolveLabel: rendered.autoResolveOption?.label ?? null,
        responseOptions: JSON.stringify(rendered.options),
        contextSnapshot: JSON.stringify({
          gdp: snapshot.currentTotalGdp,
          gdpPerCapita: snapshot.currentGdpPerCapita,
          population: snapshot.currentPopulation,
          unemployment: snapshot.unemploymentRate,
          inflation: snapshot.inflationRate,
          approval: snapshot.publicApproval,
          stability: snapshot.stabilityScore,
        }),
        triggerReason: `Template ${template.slug} triggered (probability: ${(probability * 100).toFixed(1)}%)`,
        aiConfidence: probability * 100,
        createdIxTime: snapshot.currentIxTime,
      },
    });

    result.issuesGenerated++;
  } catch (err) {
    result.errors.push(`Failed to instantiate ${template.slug}: ${(err as Error).message}`);
  }
}

/**
 * Persist an evaluation log row when anything was generated or went wrong.
 * Non-critical: a failed write never fails the evaluation.
 */
export async function logEvaluation(
  countryId: string,
  db: PrismaClient,
  snapshot: CountrySnapshot,
  result: EvaluationResult
): Promise<void> {
  if (!(result.issuesGenerated > 0 || result.errors.length > 0)) return;
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
