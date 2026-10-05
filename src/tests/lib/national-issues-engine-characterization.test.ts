/**
 * Characterization test for NationalIssuesEngine.buildCountrySnapshot and
 * NationalIssuesEngine.evaluateCountry (plan 315).
 *
 * Every DB call (in order, with its arguments) and the returned value are pinned
 * for fixed fixtures, with IxTime, Math.random and the config held constant, so a
 * refactor of the engine must keep the exact same queries, writes and results.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() calls
// on the global, not on a `jest` imported from @jest/globals.
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { createHash } from "crypto";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

const mockConfig = { maxIssuesPerSession: 4, maxIssuesPerWeek: 10 };
jest.mock("~/lib/national-issues/config", () => ({
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
  snapshotRich: async () => {
    const calls: Call[] = [];
    const value = await NationalIssuesEngine.buildCountrySnapshot(
      "c-astria",
      richDb(calls, { targetIntent: true }) as never
    );
    return { value, calls };
  },
  snapshotMissingCountry: async () => {
    const calls: Call[] = [];
    const db = makeDb({ country: { findUnique: () => null } }, calls);
    const value = await NationalIssuesEngine.buildCountrySnapshot("nope", db as never);
    return { value, calls };
  },
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
  evaluateMissingCountry: async () => {
    const calls: Call[] = [];
    const db = makeDb({ country: { findUnique: () => null } }, calls);
    const value = await NationalIssuesEngine.evaluateCountry("nope", db as never);
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
  evaluateTemplateQueryThrows: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: true });
    db.nationalIssueTemplate!.findMany = async () => {
      throw new Error("db offline");
    };
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
  forceGenerateAdmin: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: true });
    const value = await NationalIssuesEngine.forceGenerate("t7", "c-astria", db as never);
    return { value, calls };
  },
  forceGenerateInvalidOptions: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: true });
    const value = await NationalIssuesEngine.forceGenerate("t6", "c-astria", db as never);
    return { value, calls };
  },
  forceGenerateMissingTemplate: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: true });
    const value = await NationalIssuesEngine.forceGenerate("nope", "c-astria", db as never);
    return { value, calls };
  },
  forceGenerateMissingCountry: async () => {
    const calls: Call[] = [];
    const db = richDb(calls, { targetIntent: true });
    db.country!.findUnique = async (...args: Where[]) => {
      calls.push(["country.findUnique", args]);
      return null;
    };
    const value = await NationalIssuesEngine.forceGenerate("t1", "nope", db as never);
    return { value, calls };
  },
};

const EXPECTED: Record<
  string,
  { summary: { value: ScenarioValue; callNames: string[] }; digest: string }
> = {
  snapshotRich: {
    summary: {
      value: {
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
        actualGdpGrowth: 1.4,
        unemploymentRate: 6.2,
        inflationRate: 0,
        tradeBalance: -12000000,
        taxRevenueGDPPercent: 31,
        budgetDeficitSurplus: 0,
        totalDebtGDPRatio: 64,
        debtPerCapita: 0,
        publicApproval: 47,
        povertyRate: 11,
        incomeInequalityGini: 0,
        lifeExpectancy: 70,
        literacyRate: 97,
        urbanPopulationPercent: 50,
        infrastructureRating: 58,
        politicalStability: 61,
        democracyIndex: 50,
        governmentEffectiveness: 50,
        ruleOfLaw: 70,
        corruptionIndex: 50,
        politicalPolarization: 55,
        stabilityScore: 75,
        crimeRate: 5,
        protestFrequency: 5,
        riotRisk: 10,
        socialCohesion: 70,
        ethnicTension: 20,
        trustInGovernment: 50,
        activeEmbassyCount: 3,
        activeAllianceCount: 2,
        activePolicyCount: 3,
        pendingIssueCount: 2,
        recentCrisisCount: 1,
        activeTreatyCount: 0,
        activeComponents: [
          "REGIONAL_INTEGRATION",
          "INTERNATIONAL_LAW",
          "FREE_MARKET_SYSTEM",
          "digital_filing",
        ],
        implementingComponents: ["DEVELOPMENT_AID", "STATE_CAPITALISM", "withholding_system"],
        civilServiceCapacity: 101,
        consumedStaff: 540,
        currentIxTime: 2223374400000,
        currentIxYear: 2040,
        currentIxMonth: 6,
        activePoliciesList: ["green-deal-v2", "harbour-reform-", "plain-old-policy"],
        policySettings: { "green-deal-v2": { rate: 3 } },
        activeIntents: ["grow_exports", "calm_streets"],
        activeIntentCategories: ["economy", "social"],
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
        minister: { name: "Mira Holt", title: "Minister of Finance" },
        fiscal: { salesTaxRate: 12, corporateTaxRate: null },
        partners: [{ name: "Nordland", band: "ALLY", strength: 80 }],
        embassyPartners: ["Nordland"],
        worldEvents: [],
        crises: ["Harbour strike"],
        neighbors: [{ name: "Valeria", countryId: "c-valeria" }],
        activeIntentGoals: ["grow_exports", "calm_streets"],
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
      ],
    },
    digest: "e9f1ff1efc4a53e7ad8242a435fe890bc0577e12f66d9824fdb9a565a1f8016a",
  },
  snapshotMissingCountry: {
    summary: { value: null, callNames: ["country.findUnique"] },
    digest: "d6eb1621a147a3d267b4b42275ea01fdef6d15708584ee6bf8a07930a9007fc7",
  },
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
    digest: "62cf98dfd6be8e961c65a25e04f0fb61e73b972a3d47325f16fbadced8bcf61b",
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
    digest: "9eae36692c9a39e87fad891a46bb31c9bc41e0a33e9842c308b284df0e396639",
  },
  evaluateMissingCountry: {
    summary: {
      value: {
        issuesGenerated: 0,
        issuesSkippedCooldown: 0,
        issuesSkippedMaxActive: 0,
        templatesEvaluated: 0,
        templatesPassed: 0,
        executionTimeMs: 0,
        errors: ["Country nope not found"],
      },
      callNames: ["country.findUnique"],
    },
    digest: "6258efbc58592dcc880840bb8e526120d97ed33e298fc9438fc51d9b26585f10",
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
    digest: "208981d2890df13f7cc689af9baa4605f3e68f3cbe2dfdd0df30f74953db2587",
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
    digest: "7992a266a47e19fd629b742eaa79d73d4db33dff65fc9c607f1901532d2797e2",
  },
  evaluateTemplateQueryThrows: {
    summary: {
      value: {
        issuesGenerated: 1,
        issuesSkippedCooldown: 0,
        issuesSkippedMaxActive: 0,
        templatesEvaluated: 0,
        templatesPassed: 0,
        executionTimeMs: 0,
        errors: ["Evaluation failed: db offline"],
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
      ],
    },
    digest: "a07a1a2b9aae1b49b9f7b1d4df136ab1b9d09802773c507030b45a9fc428d68c",
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
    digest: "b20bf46e0627b382b764a4f13b03820fd1b198a3d9bd343c9e2131eef565e64f",
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
    digest: "6b3405fcaf3a6127b0d4160aa23a8429652d8f74bee5eba2aae1b7cc86e54161",
  },
  forceGenerateAdmin: {
    summary: {
      value: "issue_t7",
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
    digest: "9501fe9554bc562e842d44aecb718af2644bd364b781e0e76360f85ec43c8395",
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
    digest: "4efc8366812a5b0b2e90b0ce18fdde955b50775ec921879755f5a731ad149c46",
  },
  forceGenerateMissingTemplate: {
    summary: { value: null, callNames: ["nationalIssueTemplate.findUnique"] },
    digest: "dd9c7add0d9240fbfad383a6e719b266362cd032b6032b729899cae3843cc67c",
  },
  forceGenerateMissingCountry: {
    summary: { value: null, callNames: ["nationalIssueTemplate.findUnique", "country.findUnique"] },
    digest: "ec772a0ba991cbf84ebbba7d49a683e5eeec9529cbef0ad098b8d7a28a791ce0",
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
