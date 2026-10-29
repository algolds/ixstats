/**
 * The seeded national issue templates (prisma/seeds/national-issue-templates.ts, the source of truth) and the deploy
 * SQL that carries their triggers to existing databases: every trigger parses and passes the admin editor's check,
 * names only fields the snapshot has, tests a state by realm rank (absolute conditions only for counts and urban
 * share), has no per-evaluation random roll (the cron paces issues), gives every crisis condition an absolute floor,
 * and the SQL says exactly what the seed says.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "@jest/globals";
import type { TriggerCondition } from "~/lib/national-issues/evaluators/condition-evaluator";
import { bandForSeverity, isRankedField, RANKED_FIELDS } from "~/lib/national-issues/evaluators/realm-rank";
import { triggerConditionErrors } from "~/lib/national-issues/evaluators/trigger-validation";
import type { CountrySnapshot } from "~/lib/national-issues/types";
import { NATIONAL_ISSUE_TEMPLATES } from "../../../../prisma/seeds/national-issue-templates";

const SQL_FILE = "scripts/migrations/2026-10-stress/t-issue-template-triggers.sql";

/** Every scalar field a snapshot carries (typed, so a renamed snapshot field fails to compile here). */
const SNAPSHOT_FIELDS: ReadonlyArray<keyof CountrySnapshot> = [
  "currentPopulation", "currentGdpPerCapita", "currentTotalGdp", "actualGdpGrowth", "unemploymentRate",
  "inflationRate", "tradeBalance", "taxRevenueGDPPercent", "budgetDeficitSurplus", "totalDebtGDPRatio",
  "debtPerCapita", "publicApproval", "povertyRate", "incomeInequalityGini", "lifeExpectancy", "literacyRate",
  "urbanPopulationPercent", "infrastructureRating", "politicalStability", "democracyIndex",
  "governmentEffectiveness", "ruleOfLaw", "corruptionIndex", "politicalPolarization", "stabilityScore",
  "crimeRate", "protestFrequency", "riotRisk", "socialCohesion", "ethnicTension", "trustInGovernment",
  "policingEffectiveness", "activeEmbassyCount", "activeAllianceCount", "activePolicyCount", "pendingIssueCount",
  "recentCrisisCount", "activeTreatyCount", "civilServiceCapacity", "consumedStaff",
];

/** Absolute comparisons kept on purpose: counts, and the urban share (most nations hold the 50% default). */
const ABSOLUTE_FIELDS = new Set([
  "activeAllianceCount",
  "activeEmbassyCount",
  "activeTreatyCount",
  "urbanPopulationPercent",
]);

type Leaf = Exclude<TriggerCondition, { and: unknown } | { or: unknown } | { not: unknown }>;
function leaves(c: TriggerCondition): Leaf[] {
  if ("and" in c) return c.and.flatMap(leaves);
  if ("or" in c) return c.or.flatMap(leaves);
  if ("not" in c) return leaves(c.not);
  return [c];
}

const templates = NATIONAL_ISSUE_TEMPLATES.map((t) => ({
  ...t,
  trigger: JSON.parse(t.triggerConditions) as TriggerCondition,
}));

describe("the seeded issue templates", () => {
  it("have unique slugs and a known severity", () => {
    expect(new Set(templates.map((t) => t.slug)).size).toBe(templates.length);
    for (const t of templates) expect(["low", "medium", "high", "critical"]).toContain(t.baseSeverity);
  });

  it.each(templates.map((t) => [t.slug, t] as const))("%s has a well-formed trigger", (_slug, t) => {
    expect(triggerConditionErrors(t.trigger)).toEqual([]);
  });

  it("name only snapshot fields, and test states by rank (absolute only for counts and urban share)", () => {
    const offenders = templates.flatMap((t) =>
      leaves(t.trigger).flatMap((leaf) => {
        if ("rank" in leaf) return isRankedField(leaf.rank.field) ? [] : [`${t.slug}: rank ${leaf.rank.field}`];
        if ("field" in leaf) {
          const known = (SNAPSHOT_FIELDS as readonly string[]).includes(leaf.field);
          return known && ABSOLUTE_FIELDS.has(leaf.field) ? [] : [`${t.slug}: absolute ${leaf.field}`];
        }
        return [`${t.slug}: ${Object.keys(leaf).join(",")}`];
      })
    );
    expect(offenders).toEqual([]);
  });

  it("have no per-evaluation random roll (the generation cron paces issues)", () => {
    expect(templates.filter((t) => t.triggerConditions.includes('"random"')).map((t) => t.slug)).toEqual([]);
  });

  it("give every crisis band condition a field with an absolute floor", () => {
    const missing = templates
      .filter((t) => bandForSeverity(t.baseSeverity) === "crisis")
      .flatMap((t) =>
        leaves(t.trigger)
          .filter((l): l is { rank: { field: string; side?: string; share?: number } } => "rank" in l)
          .filter((l) => l.rank.side !== "best" && l.rank.share === undefined)
          .filter((l) => !isRankedField(l.rank.field) || RANKED_FIELDS[l.rank.field].crisisFloor === null)
          .map((l) => `${t.slug}: ${l.rank.field}`)
      );
    expect(missing).toEqual([]);
  });

  it("let a nation see the same issue again within weeks, not months (cooldown 14 to 91 IxDays)", () => {
    for (const t of templates) {
      expect(t.cooldownDays).toBeGreaterThanOrEqual(14);
      expect(t.cooldownDays).toBeLessThanOrEqual(91);
    }
  });
});

describe("the deploy SQL for existing databases", () => {
  const sql = readFileSync(SQL_FILE, "utf8");
  const updates = [...sql.matchAll(/^UPDATE national_issue_templates SET "triggerConditions" = .*$/gm)].map((m) => m[0]);

  it("sets every seeded template's trigger and cooldown, keyed by slug, exactly as the seed has them", () => {
    const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
    expect(updates).toEqual(
      templates.map(
        (t) =>
          `UPDATE national_issue_templates SET "triggerConditions" = ${quote(t.triggerConditions)}, "cooldownDays" = ${t.cooldownDays} WHERE slug = ${quote(t.slug)};`
      )
    );
  });

  it("drops the doubled % after the rate variables the text already formats with %", () => {
    for (const v of ["unemploymentRate", "inflationRate", "gdpGrowth"]) {
      expect(sql).toContain(`replace(title, '{{${v}}}%', '{{${v}}}')`);
    }
    const text = templates.map((t) => [t.title, t.description, t.longDescription ?? ""].join(" ")).join(" ");
    expect(text).not.toMatch(/\{\{(unemploymentRate|inflationRate|gdpGrowth)\}\}%/);
  });
});
