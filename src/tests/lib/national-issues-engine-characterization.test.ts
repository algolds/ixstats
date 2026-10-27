/**
 * The national issues engine corpus.
 *
 * NationalIssuesEngine.evaluateCountry (with the snapshot it builds) and forceGenerate are pinned (plan 315): every DB
 * call (in order, with its arguments) and the returned value for fixed fixtures, with IxTime, Math.random and the
 * config held constant, so a refactor keeps the exact queries, writes and results. Below it: the trigger condition
 * evaluator over a realistic snapshot (one row per operator, aggregation and path shape), variable substitution, the
 * GDP-units regression (#49), the weekly cap that stops the cron evaluating, a partial config save keeping spawnMode,
 * and the consequence-to-level-effect mapping (compounding, caps, the dropped shapes).
 *
 * Folds national-issues-evaluator, national-issues-limits, national-issues-config and the cap and compounding cases of
 * national-issues-projection-effects (its +X pp, multiplier and dropped cases are in national-issue-response).
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() calls
// on the global, not on a `jest` imported from @jest/globals.
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { createHash } from "crypto";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

const mockConfig = { maxIssuesPerSession: 4, maxIssuesPerWeek: 10 };
jest.mock("~/lib/national-issues/config", () => ({
  ...jest.requireActual("~/lib/national-issues/config"),
  getNationalIssuesConfig: () => mockConfig,
}));

jest.mock("~/lib/national-issues/snapshot", () => ({
  buildGroundedContext: async () => ({
    geo: {
      isLandlocked: false,
      isIsland: true,
      dominantClimate: "maritime",
      terrainRoughness: null,
      arableLandPercent: 22,
      coastlineKm: 1400,
      neighborCount: 1,
    },
    identity: {
      capitalCity: "Port Aster",
      largestCity: null,
      languages: "Astrian",
      religion: null,
    },
    party: { name: "Unity Party", ideology: "centrist", support: 41 },
    oppositionParty: null,
    minister: { name: "Mira Holt", title: "Minister of Finance" },
    official: null,
    labor: null,
    fiscal: { salesTaxRate: 12, corporateTaxRate: null },
    economy: null,
    partners: [{ name: "Nordland", band: "ALLY", strength: 80 }],
    embassyPartners: ["Nordland"],
    worldEvents: [],
    crises: ["Harbour strike"],
    neighbors: [],
  }),
}));

jest.mock("~/lib/national-issues/neighbors", () => ({
  resolveNeighbors: async () => [{ name: "Valeria", countryId: "c-valeria" }],
}));

import {
  NationalIssuesEngine,
  type CountrySnapshot,
  type EvaluationResult,
} from "~/lib/national-issues";
import {
  completeNationalIssuesConfig,
  type NationalIssuesConfig,
} from "~/lib/national-issues/config";
import {
  evaluateTriggerCondition,
  type TriggerCondition,
} from "~/lib/national-issues/evaluators/condition-evaluator";
import { substituteVariables } from "~/lib/national-issues/evaluators/issue-generator";
import { growthDecimalToPercent } from "~/lib/national-issues/country-snapshot";
import {
  issueConsequenceToEffect,
  MAX_ISSUE_GDP_LEVEL_SHIFT,
  MAX_ISSUE_POPULATION_LEVEL_SHIFT,
} from "~/lib/national-issues/projection-effects";
import type { ConsequenceDefinition } from "~/lib/national-issues/types";
import { IxTime } from "~/lib/ixtime";

type Json = string | number | boolean | null | undefined | Date | Json[] | { [key: string]: Json };
type Where = { where?: { [key: string]: Json }; data?: { [key: string]: Json } };
type Call = [string, Where[]];
type Impl = (args: Where) => Json;
type ScenarioValue = CountrySnapshot | EvaluationResult | string | null;

const FIXED_IX_TIME = Date.UTC(2040, 5, 15, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function makeDb(overrides: Record<string, Record<string, Impl>>, calls: Call[]) {
  const db: Record<string, Record<string, (...args: Where[]) => Promise<Json>>> = {};
  for (const [model, methods] of Object.entries(overrides)) {
    db[model] = {};
    for (const [method, impl] of Object.entries(methods)) {
      db[model]![method] = async (...args: Where[]) => {
        calls.push([`${model}.${method}`, args]);
        return impl(args[0] ?? {});
      };
    }
  }
  return db;
}

const RICH_COUNTRY = {
  id: "c-astria",
  name: "Astria",
  leader: "Chancellor Rhee",
  governmentType: "Parliamentary Republic",
  economicTier: "Developed",
  populationTier: "Small",
  continent: "Oriente",
  region: null,
  currentPopulation: 200000,
  currentGdpPerCapita: 38000,
  currentTotalGdp: 7600000000,
  actualGdpGrowth: 0.014, // stored as a decimal; the snapshot reports 1.4 (%)
  unemploymentRate: 6.2,
  inflationRate: null,
  tradeBalance: -12000000,
  taxRevenueGDPPercent: 31,
  budgetDeficitSurplus: null,
  totalDebtGDPRatio: 64,
  debtPerCapita: null,
  publicApproval: 47,
  povertyRate: 11,
  incomeInequalityGini: null,
  lifeExpectancy: null,
  literacyRate: 97,
  urbanPopulationPercent: null,
  infrastructureRating: 58,
  governmentStructure: {
    politicalStability: 61,
    democracyIndex: null,
    governmentEffectiveness: 50,
    ruleOfLaw: 70,
    corruptionIndex: null,
    politicalPolarization: 55,
  },
  stabilityMetrics: null,
  activeAlliances: 2,
  activeTreaties: null,
};

function template(id: string, overrides: { [key: string]: Json }) {
  return {
    id,
    slug: `slug_${id}`,
    title: `Crisis in {{countryName}} (${id})`,
    description: "{{leaderName}} faces {{targetCountryName}} over {{sectorName}}.",
    longDescription: null,
    domain: "social",
    category: "governance",
    baseSeverity: "medium",
    baseUrgency: 50,
    deadlineDaysBase: null,
    triggerConditions: JSON.stringify({ field: "publicApproval", op: "<", value: 60 }),
    cooldownDays: 10,
    maxActivePerCountry: 1,
    responseOptions: JSON.stringify([
      {
        id: "a",
        label: "Back {{partyName}}",
        description: "Spend {{amountSmall}} in {{cityName}}",
        consequences: [],
        previewEffects: {},
        outcomeText: "{{countryName}} moves on with {{targetCountryLeader}}.",
        isAutoResolveDefault: true,
      },
      {
        id: "b",
        label: "Ignore",
        description: "Do nothing",
        consequences: [],
        previewEffects: {},
        outcomeText: "Nothing happens.",
      },
    ]),
    followUpTemplateIds: null,
    personalityModifiers: null,
    variableDefinitions: null,
    ...overrides,
  };
}

const RICH_TEMPLATES = [
  template("t1", {
    domain: "economic",
    baseUrgency: 40,
    deadlineDaysBase: 7,
    longDescription: "In {{capitalCity}}, {{ministerName}} warns of {{percentageSmall}}% losses.",
    personalityModifiers: JSON.stringify({ aggression: 1.5, caution: 0.5, missingTrait: 2 }),
  }),
  template("t2", { baseUrgency: 90 }),
  template("t3", { baseUrgency: 80, cooldownDays: 0 }),
  template("t4", { triggerConditions: "{not json" }),
  template("t5", {
    triggerConditions: JSON.stringify({ field: "publicApproval", op: ">", value: 90 }),
  }),
  template("t6", { baseUrgency: 70, responseOptions: "[broken" }),
  template("t7", { baseUrgency: 65, personalityModifiers: "{bad" }),
  template("t8", { baseUrgency: 30, category: "security" }),
  template("t9", { baseUrgency: 5 }),
];

function richDb(calls: Call[], opts: { targetIntent: boolean; failCreateFor?: string }) {
  return makeDb(
    {
      country: {
        findUnique: () => RICH_COUNTRY,
        findFirst: (args: Where) =>
          (args.where?.name as { equals: string }).equals === "Rivalia"
            ? { name: "Rivalia", leader: null, currentGdpPerCapita: 21000, continent: "Oriente" }
            : null,
        findMany: () => [
          { name: "Farland", leader: "Queen Ost", currentGdpPerCapita: 15000, continent: null },
          { name: "Nearland", leader: null, currentGdpPerCapita: 52000, continent: "Occidente" },
        ],
      },
      embassy: { count: () => 3 },
      policy: {
        count: () => 3,
        findMany: () => [
          {
            id: "p1",
            name: "Green Deal",
            calculatedEffects: JSON.stringify({
              decretalKey: "green-deal-v2",
              settings: { rate: 3 },
            }),
          },
          { id: "p2", name: "Harbour Reform!", calculatedEffects: JSON.stringify({ other: 1 }) },
          { id: "p3", name: "Broken Policy", calculatedEffects: "{nope" },
          { id: "p4", name: "Plain Old Policy", calculatedEffects: null },
        ],
      },
      nationalIssue: {
        count: (args: Where) => {
          const where = args.where ?? {};
          if ("createdIxTime" in where) return 3;
          if ("templateId" in where) return 0;
          return 2;
        },
        findMany: () => [
          { templateId: "t2", createdIxTime: FIXED_IX_TIME - 2 * DAY, status: "responded" },
          { templateId: "t3", createdIxTime: FIXED_IX_TIME - 40 * DAY, status: "pending" },
          { templateId: "t1", createdIxTime: FIXED_IX_TIME - 40 * DAY, status: "expired" },
        ],
        create: (args: Where) => {
          if (args.data?.templateId === opts.failCreateFor) throw new Error("unique violation");
          return { id: `issue_${String(args.data?.templateId)}` };
        },
      },
      crisisEvent: { count: () => 1 },
      governmentComponent: {
        findMany: () => [
          { componentType: "REGIONAL_INTEGRATION", isActive: true, implementationDate: null },
          {
            componentType: "INTERNATIONAL_LAW",
            isActive: false,
            implementationDate: new Date(FIXED_IX_TIME - 5 * DAY),
          },
          {
            componentType: "DEVELOPMENT_AID",
            isActive: false,
            implementationDate: new Date(FIXED_IX_TIME + 5 * DAY),
          },
        ],
      },
      economicComponent: {
        findMany: () => [
          { componentType: "FREE_MARKET_SYSTEM", isActive: true, implementationDate: null },
          { componentType: "STATE_CAPITALISM", isActive: false, implementationDate: null },
        ],
      },
      taxComponent: {
        findMany: () => [
          { componentType: "E_FILING_SYSTEM", isActive: true, implementationDate: null },
          { componentType: "WITHHOLDING_SYSTEM", isActive: false, implementationDate: null },
        ],
      },
      intent: {
        findMany: (args: Where) =>
          args.where && "target" in args.where
            ? opts.targetIntent
              ? [{ target: "Rivalia" }]
              : []
            : [
                { goal: "grow_exports", category: "economy" },
                { goal: "calm_streets", category: "social" },
              ],
      },
      nPCPersonalityAssignment: {
        findUnique: () => ({ personality: { aggression: 80, caution: 30 } }),
      },
      nationalIssueTemplate: {
        findMany: () => RICH_TEMPLATES,
        findUnique: (args: Where) => RICH_TEMPLATES.find((t) => t.id === args.where?.id) ?? null,
        upsert: () => ({
          id: "t_staff",
          title: "Government Staffing Shortage",
          description: "{{countryName}} is short-staffed",
          longDescription: null,
          domain: "political",
          category: "governance",
          baseSeverity: "high",
          baseUrgency: 70,
          responseOptions: "[]",
        }),
      },
      issueGenerationLog: { create: () => ({}) },
    },
    calls
  );
}

function scrub<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, v: Json) => (key === "executionTimeMs" ? 0 : v))
  ) as T;
}

type Scenario = () => Promise<{ value: ScenarioValue; calls: Call[] }>;

const SCENARIOS: Record<string, Scenario> = {
  evaluateRichWithTarget: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: true, failCreateFor: "t8" });
    const value = await NationalIssuesEngine.evaluateCountry("c-astria", db as never);
    return { value, calls };
  },
  evaluateNeighborFallbackForcedDomain: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: false });
    const value = await NationalIssuesEngine.evaluateCountry("c-astria", db as never, {
      forceDomain: "social",
      maxIssues: 2,
      bypassLimits: true,
    });
    return { value, calls };
  },
  evaluatePendingCap: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: true });
    db.nationalIssue!.count = async (...args: Where[]) => {
      calls.push(["nationalIssue.count", args]);
      return 12;
    };
    const value = await NationalIssuesEngine.evaluateCountry("c-astria", db as never);
    return { value, calls };
  },
  evaluateWeeklyCapReached: async () => {
    const calls: Call[] = [];
    mockConfig.maxIssuesPerWeek = 3;
    const db = richDb(calls, { targetIntent: true });
    const value = await NationalIssuesEngine.evaluateCountry("c-astria", db as never);
    return { value, calls };
  },
  evaluateTargetLookupThrows: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: false });
    db.country!.findMany = async () => {
      throw new Error("lookup failed");
    };
    const value = await NationalIssuesEngine.evaluateCountry("c-astria", db as never, {
      maxIssues: 1,
    });
    return { value, calls };
  },
  forceGenerateFollowUp: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: true });
    const value = await NationalIssuesEngine.forceGenerate("t1", "c-astria", db as never, "i-9");
    return { value, calls };
  },
  forceGenerateInvalidOptions: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: true });
    const value = await NationalIssuesEngine.forceGenerate("t6", "c-astria", db as never);
    return { value, calls };
  },
};

const EXPECTED: Record<
  string,
  { summary: { value: ScenarioValue; callNames: string[] }; digest: string }
> = {
  evaluateRichWithTarget: {
    summary: {
      value: {
        issuesGenerated: 3,
        issuesSkippedCooldown: 1,
        issuesSkippedMaxActive: 1,
        templatesEvaluated: 9,
        templatesPassed: 5,
        executionTimeMs: 0,
        errors: [
          "Invalid trigger JSON for template slug_t4",
          "Invalid response options JSON for template slug_t6",
          "Failed to instantiate slug_t8: unique violation",
        ],
      },
      callNames: [
        "country.findUnique",
        "embassy.count",
        "policy.count",
        "nationalIssue.count",
        "crisisEvent.count",
        "governmentComponent.findMany",
        "economicComponent.findMany",
        "taxComponent.findMany",
        "policy.findMany",
        "intent.findMany",
        "nationalIssueTemplate.upsert",
        "nationalIssue.count",
        "nationalIssue.create",
        "nationalIssue.count",
        "nationalIssueTemplate.findMany",
        "nationalIssue.findMany",
        "nPCPersonalityAssignment.findUnique",
        "country.findUnique",
        "intent.findMany",
        "country.findFirst",
        "nationalIssue.create",
        "nationalIssue.create",
        "nationalIssue.create",
        "issueGenerationLog.create",
      ],
    },
    digest: "74eafa6df862a1487f0fd4c828eaa42a24c57d29a532431eab5a65a3fd92148d",
  },
  evaluateNeighborFallbackForcedDomain: {
    summary: {
      value: {
        issuesGenerated: 2,
        issuesSkippedCooldown: 1,
        issuesSkippedMaxActive: 1,
        templatesEvaluated: 9,
        templatesPassed: 5,
        executionTimeMs: 0,
        errors: [
          "Invalid trigger JSON for template slug_t4",
          "Invalid response options JSON for template slug_t6",
        ],
      },
      callNames: [
        "country.findUnique",
        "embassy.count",
        "policy.count",
        "nationalIssue.count",
        "crisisEvent.count",
        "governmentComponent.findMany",
        "economicComponent.findMany",
        "taxComponent.findMany",
        "policy.findMany",
        "intent.findMany",
        "nationalIssueTemplate.upsert",
        "nationalIssue.count",
        "nationalIssue.create",
        "nationalIssueTemplate.findMany",
        "nationalIssue.findMany",
        "nPCPersonalityAssignment.findUnique",
        "country.findUnique",
        "intent.findMany",
        "country.findFirst",
        "country.findMany",
        "nationalIssue.create",
        "issueGenerationLog.create",
      ],
    },
    digest: "e5afd8151fe54b19f6e714d7042eaff04f1ac0ea276aebb3ea526715da3d318e",
  },
  evaluatePendingCap: {
    summary: {
      value: {
        issuesGenerated: 0,
        issuesSkippedCooldown: 0,
        issuesSkippedMaxActive: 0,
        templatesEvaluated: 0,
        templatesPassed: 0,
        executionTimeMs: 0,
        errors: ["Issue cap reached (10+ pending)"],
      },
      callNames: [
        "country.findUnique",
        "embassy.count",
        "policy.count",
        "nationalIssue.count",
        "crisisEvent.count",
        "governmentComponent.findMany",
        "economicComponent.findMany",
        "taxComponent.findMany",
        "policy.findMany",
        "intent.findMany",
        "nationalIssueTemplate.upsert",
        "nationalIssue.count",
      ],
    },
    digest: "e1ed18e37fd98df4b1bdca46ddd119c992cb95ab805803d97c193cc0c5b96362",
  },
  evaluateWeeklyCapReached: {
    summary: {
      value: {
        issuesGenerated: 1,
        issuesSkippedCooldown: 1,
        issuesSkippedMaxActive: 1,
        templatesEvaluated: 9,
        templatesPassed: 5,
        executionTimeMs: 0,
        errors: ["Invalid trigger JSON for template slug_t4"],
      },
      callNames: [
        "country.findUnique",
        "embassy.count",
        "policy.count",
        "nationalIssue.count",
        "crisisEvent.count",
        "governmentComponent.findMany",
        "economicComponent.findMany",
        "taxComponent.findMany",
        "policy.findMany",
        "intent.findMany",
        "nationalIssueTemplate.upsert",
        "nationalIssue.count",
        "nationalIssue.create",
        "nationalIssue.count",
        "nationalIssueTemplate.findMany",
        "nationalIssue.findMany",
        "nPCPersonalityAssignment.findUnique",
        "country.findUnique",
        "intent.findMany",
        "country.findFirst",
        "issueGenerationLog.create",
      ],
    },
    digest: "264eb4ed685fd83f67621794a18576ae93989f5946c899d807f5780077e3d3b6",
  },
  evaluateTargetLookupThrows: {
    summary: {
      value: {
        issuesGenerated: 2,
        issuesSkippedCooldown: 1,
        issuesSkippedMaxActive: 1,
        templatesEvaluated: 9,
        templatesPassed: 5,
        executionTimeMs: 0,
        errors: ["Invalid trigger JSON for template slug_t4"],
      },
      callNames: [
        "country.findUnique",
        "embassy.count",
        "policy.count",
        "nationalIssue.count",
        "crisisEvent.count",
        "governmentComponent.findMany",
        "economicComponent.findMany",
        "taxComponent.findMany",
        "policy.findMany",
        "intent.findMany",
        "nationalIssueTemplate.upsert",
        "nationalIssue.count",
        "nationalIssue.create",
        "nationalIssue.count",
        "nationalIssueTemplate.findMany",
        "nationalIssue.findMany",
        "nPCPersonalityAssignment.findUnique",
        "country.findUnique",
        "intent.findMany",
        "country.findFirst",
        "nationalIssue.create",
        "issueGenerationLog.create",
      ],
    },
    digest: "9d6c8bba07883789a648872e8f3fdae5924c05eb2b8a33685bfbd7fee05a91fa",
  },
  forceGenerateFollowUp: {
    summary: {
      value: "issue_t1",
      callNames: [
        "nationalIssueTemplate.findUnique",
        "country.findUnique",
        "embassy.count",
        "policy.count",
        "nationalIssue.count",
        "crisisEvent.count",
        "governmentComponent.findMany",
        "economicComponent.findMany",
        "taxComponent.findMany",
        "policy.findMany",
        "intent.findMany",
        "nationalIssue.create",
      ],
    },
    digest: "3f8fdb12f5632b76e8027dd79cc779afb16c5500d11c01b8957536b24f18df27",
  },
  forceGenerateInvalidOptions: {
    summary: {
      value: null,
      callNames: [
        "nationalIssueTemplate.findUnique",
        "country.findUnique",
        "embassy.count",
        "policy.count",
        "nationalIssue.count",
        "crisisEvent.count",
        "governmentComponent.findMany",
        "economicComponent.findMany",
        "taxComponent.findMany",
        "policy.findMany",
        "intent.findMany",
      ],
    },
    digest: "9244c8c52fc6215215e1cde6a86a26acc62f616a642b9280a3892630d8ebcdf6",
  },
};

describe("NationalIssuesEngine characterization (fixed fixtures)", () => {
  let seed = 0;

  beforeEach(() => {
    mockConfig.maxIssuesPerSession = 4;
    mockConfig.maxIssuesPerWeek = 10;
    seed = 42;
    jest.spyOn(IxTime, "getCurrentIxTime").mockReturnValue(FIXED_IX_TIME);
    jest.spyOn(Math, "random").mockImplementation(() => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    });
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  for (const [name, run] of Object.entries(SCENARIOS)) {
    it(`${name} is identical to the pinned behaviour`, async () => {
      const { value, calls } = await run();
      const scrubbed = scrub({ value, calls });
      const actual = {
        summary: scrub({ value, callNames: calls.map(([callName]) => callName) }),
        digest: createHash("sha256").update(JSON.stringify(scrubbed)).digest("hex"),
      };
      if (process.env.CHARACTERIZE === "1") {
        console.log(`CHAR ${name} ${JSON.stringify(actual)}`);
        return;
      }
      expect(actual).toEqual(EXPECTED[name]);
    });
  }
});

const SNAPSHOT: CountrySnapshot = {
  id: "c-1",
  name: "Aethelgard",
  leader: "High Chancellor Vane",
  governmentType: "Constitutional Republic",
  economicTier: "Developed",
  populationTier: "Medium",
  continent: "Oriente",
  region: "Northern Coast",
  currentPopulation: 45000000,
  currentGdpPerCapita: 42000,
  currentTotalGdp: 1890000000000,
  actualGdpGrowth: 2.5,
  unemploymentRate: 4.8,
  inflationRate: 2.1,
  tradeBalance: 15000000000,
  taxRevenueGDPPercent: 28.5,
  budgetDeficitSurplus: -5000000000,
  totalDebtGDPRatio: 45.2,
  debtPerCapita: 19000,
  publicApproval: 68.4,
  povertyRate: 8.2,
  incomeInequalityGini: 32.5,
  lifeExpectancy: 81.2,
  literacyRate: 99.1,
  urbanPopulationPercent: 78.4,
  infrastructureRating: 84.5,
  politicalStability: 75.0,
  democracyIndex: 82.0,
  governmentEffectiveness: 80.0,
  ruleOfLaw: 85.0,
  corruptionIndex: 18.0,
  politicalPolarization: 35.0,
  stabilityScore: 78.0,
  crimeRate: 22.0,
  protestFrequency: 10.0,
  riotRisk: 5.0,
  socialCohesion: 72.0,
  ethnicTension: 15.0,
  trustInGovernment: 64.0,
  activeEmbassyCount: 12,
  activeAllianceCount: 3,
  activePolicyCount: 15,
  pendingIssueCount: 2,
  recentCrisisCount: 0,
  activeTreatyCount: 5,
  currentIxYear: 2026,
  currentIxMonth: 8,
  currentIxTime: 1772412800000,
  civilServiceCapacity: 2500,
  consumedStaff: 1800,
  activeComponents: ["comp-1", "comp-2", "comp-3"],
  implementingComponents: ["comp-4"],
  activePoliciesList: ["tax_reform_policy"],
  policySettings: { "universal-basic-income": { stipend: 2, funding: 1 } },
  activeIntents: ["intent-1"],
  activeIntentCategories: ["economy", "defense"],
  activeIntentGoals: ["economic_growth", "border_security"],
  partners: [
    { name: "Nordland", band: "ALLY", strength: 80 },
    { name: "Valeria", band: "HOSTILE", strength: 70 },
  ],
  neighbors: [{ name: "Nordland", countryId: "c-2" }],
};

describe("the trigger condition evaluator over a realistic snapshot", () => {
  it.each<[string, TriggerCondition, boolean]>([
    [">", { field: "currentPopulation", op: ">", value: 40_000_000 }, true],
    [">= at the value", { field: "unemploymentRate", op: ">=", value: 4.8 }, true],
    ["in", { field: "economicTier", op: "in", value: ["Developed", "Advanced"] }, true],
    ["between (outside)", { field: "actualGdpGrowth", op: "between", value: 3, value2: 6 }, false],
    ["array == is membership", { field: "activeComponents", op: "==", value: "comp-2" }, true],
    ["count", { count: { field: "activeComponents", op: ">=", value: 3 } }, true],
    [
      "any over objects",
      { any: { field: "partners", condition: { field: "band", op: "==", value: "HOSTILE" } } },
      true,
    ],
    [
      "or",
      {
        or: [
          { field: "publicApproval", op: "<", value: 20 },
          { field: "democracyIndex", op: ">", value: 70 },
        ],
      },
      true,
    ],
    ["not", { not: { field: "publicApproval", op: "<", value: 50 } }, true],
    [
      "a dotted policy setting",
      { field: "policySettings.universal-basic-income.stipend", op: "==", value: 2 },
      true,
    ],
    [
      "a missing dotted path",
      { field: "policySettings.surveillance-oversight.surveillance", op: "==", value: 0 },
      false,
    ],
  ])("evaluates %s", (_label, condition, expected) => {
    expect(evaluateTriggerCondition(condition, SNAPSHOT)).toBe(expected);
  });

  it.each([
    [
      "Relations with {{allyName}} flourish while {{rivalName}} poses border friction.",
      undefined,
      "Relations with Nordland flourish while Valeria poses border friction.",
    ],
    [
      "Target state {{targetCountryName}} has approached {{countryName}}.",
      { targetCountryName: "Zandaria" },
      "Target state Zandaria has approached Aethelgard.",
    ],
  ])("renders %p", (text, extra, rendered) => {
    expect(substituteVariables(text, SNAPSHOT, extra)).toBe(rendered);
  });

  it("compares and renders a stored decimal GDP growth rate in percent (#49)", () => {
    // Country.actualGdpGrowth is stored as a decimal; templates compare it in percent.
    const stored = (growth: number): CountrySnapshot => ({
      ...SNAPSHOT,
      actualGdpGrowth: growthDecimalToPercent(growth),
    });
    const boom: TriggerCondition = { field: "actualGdpGrowth", op: ">", value: 3 };
    const slump: TriggerCondition = { field: "actualGdpGrowth", op: "<", value: 0.5 };
    expect(evaluateTriggerCondition(boom, stored(0.035))).toBe(true);
    expect(evaluateTriggerCondition(boom, stored(0.02))).toBe(false);
    // 2% growth is not a slump; compared raw (0.02 < 0.5) it used to be.
    expect(evaluateTriggerCondition(slump, stored(0.02))).toBe(false);
    expect(evaluateTriggerCondition(slump, stored(0.003))).toBe(true);
    expect(substituteVariables("{{gdpGrowth}}", stored(0.035))).toBe("3.5%");
  });
});

describe("limits and configuration", () => {
  it("evaluates a nation below its weekly cap and stops once the week's issues reach it", async () => {
    mockConfig.maxIssuesPerWeek = 5;
    const dbWith = (weekly: number) =>
      makeDb(
        { nationalIssue: { count: () => weekly }, issueGenerationLog: { findFirst: () => null } },
        []
      );
    await expect(
      NationalIssuesEngine.shouldEvaluate("c-astria", dbWith(4) as never, FIXED_IX_TIME)
    ).resolves.toBe(true);
    await expect(
      NationalIssuesEngine.shouldEvaluate("c-astria", dbWith(5) as never, FIXED_IX_TIME)
    ).resolves.toBe(false);
  });

  it("keeps spawnMode when a partial config is saved", () => {
    expect(completeNationalIssuesConfig({ maxIssuesPerSession: 7 })).toEqual({
      maxIssuesPerSession: 7,
      maxIssuesPerWeek: 5,
      spawnMode: "probability",
    } satisfies NationalIssuesConfig);
  });
});

describe("issue consequences become level effects", () => {
  const consequence = (
    targetField: string,
    operation: ConsequenceDefinition["operation"],
    value: number,
    extra: Partial<ConsequenceDefinition> = {}
  ): ConsequenceDefinition => ({ targetModel: "Country", targetField, operation, value, ...extra });

  it.each<[string, ConsequenceDefinition, Record<string, unknown> | null]>([
    [
      "growth compounding over whole IxTime years",
      consequence("actualGdpGrowth", "add", 1, { durationDays: 730, effectType: "gradual" }),
      { inputType: "gdp_level_adjustment", duration: 2, value: expect.closeTo(0.0201, 4) },
    ],
    [
      "a short growth consequence (at least a year)",
      consequence("actualGdpGrowth", "add", 1, { durationDays: 30 }),
      { duration: 1 },
    ],
    [
      "growth capped",
      consequence("actualGdpGrowth", "add", 4),
      { value: MAX_ISSUE_GDP_LEVEL_SHIFT },
    ],
    [
      "a population multiplier",
      consequence("currentPopulation", "multiply", 1.002),
      { inputType: "population_level_adjustment", value: 0.002, duration: null },
    ],
    [
      "a population multiplier capped",
      consequence("currentPopulation", "multiply", 0.5),
      { value: -MAX_ISSUE_POPULATION_LEVEL_SHIFT },
    ],
    [
      "a growth multiplier (no faithful mapping)",
      consequence("actualGdpGrowth", "multiply", 1.1),
      null,
    ],
    ["an absolute GDP add (no faithful mapping)", consequence("currentTotalGdp", "add", 1e9), null],
  ])("maps %s", (_label, input, expected) => {
    const effect = issueConsequenceToEffect(input);
    if (expected === null) expect(effect).toBeNull();
    else expect(effect).toMatchObject(expected);
  });
});
