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
import { isRoutineSlug } from "~/lib/national-issues/evaluators/pacing";
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

const all = NATIONAL_ISSUE_TEMPLATES.map((t) => ({
  ...t,
  trigger: JSON.parse(t.triggerConditions) as TriggerCondition,
}));
/** State-driven templates; the routine ones (any nation, fallback only) are checked on their own below. */
const templates = all.filter((t) => !isRoutineSlug(t.slug));
const routine = all.filter((t) => isRoutineSlug(t.slug));
const ANY_NATION = { field: "currentPopulation", op: ">=", value: 0 };
type Option = {
  id: string;
  label: string;
  description: string;
  outcomeText: string;
  isAutoResolveDefault?: boolean;
  consequences: Array<{ targetModel: string; targetField: string; operation: string; value: number }>;
};

describe("the seeded issue templates", () => {
  it("have unique slugs and a known severity", () => {
    expect(new Set(all.map((t) => t.slug)).size).toBe(all.length);
    for (const t of all) expect(["low", "medium", "high", "critical"]).toContain(t.baseSeverity);
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
          .filter((l): l is Extract<Leaf, { rank: unknown }> => "rank" in l)
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

describe("the routine templates (fallback when nothing else qualifies)", () => {
  /** Every consequence target the state-driven templates already use: the spine knows how to apply these. */
  const knownTargets = new Set(
    templates.flatMap((t) =>
      (JSON.parse(t.responseOptions) as Option[]).flatMap((o) =>
        o.consequences.map((c) => `${c.targetModel}.${c.targetField}.${c.operation}`)
      )
    )
  );
  const copy = (t: (typeof routine)[number]) => {
    const options = JSON.parse(t.responseOptions) as Option[];
    return [t.title, t.description, t.longDescription ?? "", ...options.flatMap((o) => [o.label, o.description, o.outcomeText])];
  };

  it("are a small set any nation qualifies for, in engine domains, low severity, slow to repeat", () => {
    expect(routine.length).toBeGreaterThanOrEqual(8);
    expect(routine.length).toBeLessThanOrEqual(12);
    for (const t of routine) {
      expect(t.trigger).toEqual(ANY_NATION);
      expect(["diplomatic", "foreign"]).not.toContain(t.domain);
      expect(t.category).not.toBe("diplomatic");
      expect(t.baseSeverity).toBe("low");
      expect(t.cooldownDays).toBeGreaterThanOrEqual(28);
    }
    expect(new Set(routine.map((t) => t.domain)).size).toBeGreaterThanOrEqual(5);
  });

  it("give three real choices with known consequences and one default", () => {
    for (const t of routine) {
      const options = JSON.parse(t.responseOptions) as Option[];
      expect(options).toHaveLength(3);
      expect(options.filter((o) => o.isAutoResolveDefault)).toHaveLength(1);
      expect(options.filter((o) => o.consequences.length > 0).length).toBeGreaterThanOrEqual(2);
      for (const c of options.flatMap((o) => o.consequences)) {
        expect(knownTargets).toContain(`${c.targetModel}.${c.targetField}.${c.operation}`);
        expect(Math.abs(c.value)).toBeLessThanOrEqual(c.targetField === "publicApproval" ? 4 : 3);
      }
    }
  });

  it("are written plainly: no em dashes, emoji or shouting, sentence-case titles", () => {
    for (const t of routine) {
      for (const text of copy(t)) {
        expect(text).not.toMatch(/\u2014|\u2013/);
        expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(text).not.toMatch(/\b[A-Z]{4,}\b|!/);
      }
      const words = t.title.replace(/\{\{\w+\}\}/g, "X").split(" ").slice(1);
      expect(words.filter((w) => /^[A-Z][a-z]/.test(w))).toEqual([]);
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

  it("inserts or refreshes every routine template, keyed by slug", () => {
    for (const t of routine) {
      expect(sql).toContain(`'${t.slug}'`);
      expect(sql).toContain(`'${t.triggerConditions}'`);
      expect(sql).toContain(`'${t.responseOptions.replace(/'/g, "''")}'`);
    }
    expect(sql.match(/ON CONFLICT \(slug\) DO UPDATE/g)).toHaveLength(routine.length);
  });

  it("drops the doubled % after the rate variables the text already formats with %", () => {
    for (const v of ["unemploymentRate", "inflationRate", "gdpGrowth"]) {
      expect(sql).toContain(`replace(title, '{{${v}}}%', '{{${v}}}')`);
    }
    const text = templates.map((t) => [t.title, t.description, t.longDescription ?? ""].join(" ")).join(" ");
    expect(text).not.toMatch(/\{\{(unemploymentRate|inflationRate|gdpGrowth)\}\}%/);
  });
});
