/** @jest-environment node */
/**
 * The country-scoped writes the security area's country-write-ownership table does not hold, one row each: a
 * signed-out visitor is refused, and so is a player writing another nation, both before anything is written. Below the
 * table, what each write does for its owner: a cabinet meeting concludes once with one decision per agenda item of its
 * own (each on the event spine), a repeal releases an enacted policy's bandwidth and growth effect, the tax system
 * validates brackets before writing and an update replaces its categories, an economic profile takes integer ranks
 * only, and the first-steps checklist ticks from the rows each console writes while its dismissal leaves the nation's
 * updatedAt (the editor's stale-write check) alone.
 *
 * Folds meetings-conclude, policies-repeal, tax-system-router, economics-router, mycountry-first-steps and
 * government-start-budget-year (its owner's copy is in budget-year-rollover).
 */
jest.mock("~/server/services/builderIntegrationService", () => ({
  __esModule: true,
  detectTaxConflicts: jest.fn().mockResolvedValue([]),
  syncTaxData: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: {
    onTaxSystemChange: jest.fn().mockResolvedValue(undefined),
    onVitalityScoreChange: jest.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { meetingsRouter } from "~/server/api/routers/meetings";
import { policiesRouter } from "~/server/api/routers/policies";
import { taxSystemRouter } from "~/server/api/routers/taxSystem";
import { economicsRouter } from "~/server/api/routers/economics";
import { governmentRouter } from "~/server/api/routers/government";
import { myCountryFirstStepsRouter } from "~/server/api/routers/mycountry/first-steps";
import {
  FOUNDING_GRACE_MS,
  shouldShowFirstSteps,
  type FirstSteps,
} from "~/lib/mycountry/first-steps";
import { syncTaxData } from "~/server/services/builderIntegrationService";
import { notificationHooks } from "~/lib/notifications/hooks";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockCallerContext, type MockCallerContext } from "~/tests/helpers/router-context";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

type Db = Record<string, object>;

function meetingsDb(countryId: string, status = "scheduled") {
  const state = {
    meeting: {
      id: "m1",
      countryId,
      status,
      title: "Spring cabinet",
      notes: null as string | null,
      completedAt: null as Date | null,
    },
    agendaItems: [
      { id: "a1", title: "Budget review", status: "pending", outcome: null as string | null },
      { id: "a2", title: "Port expansion", status: "pending", outcome: null as string | null },
    ],
    decisions: [] as Array<Record<string, unknown>>,
  };
  const db = {
    state,
    cabinetMeeting: {
      findUnique: jest.fn(async () => ({
        ...state.meeting,
        agendaItems: state.agendaItems.map((a) => ({ ...a })),
        decisions: [...state.decisions],
      })),
      updateMany: jest.fn(
        async ({ where, data }: { where: { status: { notIn: string[] } }; data: object }) => {
          if (where.status.notIn.includes(state.meeting.status)) return { count: 0 };
          Object.assign(state.meeting, data);
          return { count: 1 };
        }
      ),
    },
    meetingDecision: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `d${state.decisions.length + 1}`, ...data };
        state.decisions.push(row);
        return row;
      }),
    },
    countryChangeLog: { create: jest.fn(async (_args: { data: object }) => ({})) },
    meetingAgendaItem: {
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: object }) => {
        const item = state.agendaItems.find((a) => a.id === where.id)!;
        Object.assign(item, data);
        return item;
      }),
    },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(db));
  return db;
}

function policiesDb(countryId: string, status = "active") {
  const state = {
    policy: { id: "pol_1", countryId, name: "Universal Stipend", status, execBandwidthCost: 15 },
  };
  return {
    state,
    policy: {
      findUnique: jest.fn(async () => ({ ...state.policy })),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { status: { in: string[] } };
          data: { status: string };
        }) => {
          if (!where.status.in.includes(state.policy.status)) return { count: 0 };
          state.policy = { ...state.policy, ...data };
          return { count: 1 };
        }
      ),
    },
    storytellerEffect: {
      findMany: jest.fn(async (_args: object) => [
        {
          countryId,
          inputType: "gdp_level_adjustment",
          value: 0.02,
          duration: 1,
          description: "Active policy: Policy",
          createdBy: "POLICY:pol_1",
          worldEventId: null,
        },
      ]),
      createMany: jest.fn(async (args: { data: object[] }) => ({ count: args.data.length })),
      updateMany: jest.fn(async (_args: object) => ({ count: 1 })),
    },
    policyEffectLog: { create: jest.fn(async (_args: object) => ({})) },
  };
}

function taxState(brackets: Array<{ minIncome: number; maxIncome?: number; rate: number }> = []) {
  return {
    taxSystem: {
      taxSystemName: "National Revenue",
      fiscalYear: "calendar",
      progressiveTax: true,
      alternativeMinTax: false,
    },
    categories: [
      {
        categoryName: "Income",
        categoryType: "income",
        isActive: true,
        calculationMethod: "progressive" as const,
        deductionAllowed: true,
        priority: 1,
      },
    ],
    brackets: {
      "0": brackets.map((b, i) => ({ ...b, marginalRate: true, isActive: true, priority: i + 1 })),
    },
    exemptions: [],
    deductions: {},
    selectedAtomicTaxComponents: [] as string[],
  };
}

function taxDb() {
  const db = createMockPrisma();
  // createIdorContext copies the delegates it is given, so name the ones the update path reaches
  db.taxCategory.deleteMany.mockResolvedValue({ count: 0 });
  db.taxComponent.deleteMany.mockResolvedValue({ count: 0 });
  db.taxSystem.create.mockResolvedValue({
    id: "ts1",
    countryId: CALLER_COUNTRY,
    taxCategories: [],
  });
  db.taxSystem.update.mockResolvedValue({
    id: "ts1",
    countryId: CALLER_COUNTRY,
    taxCategories: [],
  });
  return db;
}

const NOW = Date.now();
const FOUNDED = new Date(NOW - 2 * 24 * 60 * 60 * 1000);
/** A write founding made, a moment after the nation was created. */
const DURING_FOUNDING = new Date(FOUNDED.getTime() + 2_000);
/** A write the player made later, from a console. */
const LATER = new Date(FOUNDED.getTime() + FOUNDING_GRACE_MS + 60_000);

function firstStepsDb(
  rows: {
    /** `lastReviewed`: the owner's last budget edit (founding writes it during the grace window). */
    budgetAllocations?: Array<{ lastReviewed: Date }>;
    fiscal?: { updatedAt: Date } | null;
    tax?: { updatedAt: Date } | null;
    officials?: number;
    wikiArticle?: { id: string } | null;
    capital?: { coordinates: unknown } | null;
  } = {}
) {
  const own = {
    id: CALLER_COUNTRY,
    name: "Testland",
    createdAt: FOUNDED,
    ownedSince: FOUNDED,
    updatedAt: FOUNDED,
    wikiPageTitle: null,
    wikiSource: "ixwiki",
    firstStepsDismissedAt: null,
  };
  return {
    country: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === CALLER_COUNTRY ? own : { id: where.id, ownerUserId: "db_user_someone_else" }
      ),
      update: jest.fn(async (_args: { where: { id: string }; data: object }) => own),
    },
    budgetAllocation: {
      // Mirrors the `lastReviewed > threshold` filter the query sends.
      findFirst: jest.fn(async ({ where }: { where: { lastReviewed: { gt: Date } } }) =>
        (rows.budgetAllocations ?? []).some((row) => row.lastReviewed > where.lastReviewed.gt)
          ? { id: "alloc_1" }
          : null
      ),
    },
    fiscalSystem: { findUnique: jest.fn(async () => rows.fiscal ?? null) },
    taxSystem: { findUnique: jest.fn(async () => rows.tax ?? null) },
    governmentOfficial: { count: jest.fn(async () => rows.officials ?? 0) },
    wikiArticle: {
      findFirst: jest.fn(async (_args: { where: object }) => rows.wikiArticle ?? null),
    },
    city: { findFirst: jest.fn(async () => rows.capital ?? null) },
  };
}

const meetings = createCallerFactory(meetingsRouter);
const policies = createCallerFactory(policiesRouter);
const taxSystem = createCallerFactory(taxSystemRouter);
const economics = createCallerFactory(economicsRouter);
const government = createCallerFactory(governmentRouter);
const firstSteps = createCallerFactory(myCountryFirstStepsRouter);

interface Row {
  name: string;
  db: () => Db;
  run: (ctx: MockCallerContext, countryId: string) => Promise<unknown>;
  /** The writes this procedure guards. */
  writes: (db: Db) => jest.Mock[];
}
const mock = (db: Db, model: string, method: string) =>
  (db[model] as Record<string, jest.Mock>)[method]!;

const ROWS: Row[] = [
  {
    name: "meetings.concludeMeeting",
    db: () => meetingsDb(FOREIGN_COUNTRY),
    run: (ctx) => meetings(ctx).concludeMeeting({ meetingId: "m1", outcome: "Done" }),
    writes: (db) => [
      mock(db, "cabinetMeeting", "updateMany"),
      mock(db, "meetingDecision", "create"),
    ],
  },
  {
    name: "policies.repealPolicy",
    db: () => policiesDb(FOREIGN_COUNTRY),
    run: (ctx) => policies(ctx).repealPolicy({ policyId: "pol_1" }),
    writes: (db) => [
      mock(db, "policy", "updateMany"),
      mock(db, "storytellerEffect", "createMany"),
      mock(db, "storytellerEffect", "updateMany"),
    ],
  },
  ...(["update", "delete"] as const).map((procedure) => ({
    name: `taxSystem.${procedure}`,
    db: taxDb,
    run: (ctx: MockCallerContext, countryId: string) =>
      procedure === "delete"
        ? taxSystem(ctx).delete({ countryId })
        : taxSystem(ctx).update({ countryId, data: taxState() }),
    writes: (db: Db) => ["create", "upsert", "delete"].map((m) => mock(db, "taxSystem", m)),
  })),
  {
    name: "economics.updateFiscalSystem",
    db: () => createMockPrisma(),
    run: (ctx, countryId) => economics(ctx).updateFiscalSystem({ countryId, salesTaxRate: 0 }),
    writes: (db) => [mock(db, "fiscalSystem", "upsert"), mock(db, "country", "update")],
  },
  {
    name: "economics.updateEconomicProfile",
    db: () => createMockPrisma(),
    run: (ctx, countryId) =>
      economics(ctx).updateEconomicProfile({ countryId, innovationIndex: 99 }),
    writes: (db) => [mock(db, "economicProfile", "upsert"), mock(db, "country", "update")],
  },
  {
    name: "government.startBudgetYear",
    db: () => ({
      budgetAllocation: {
        findFirst: jest.fn().mockResolvedValue({ budgetYear: 2000 }),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }),
    run: (ctx, countryId) => government(ctx).startBudgetYear({ countryId }),
    writes: (db) => [mock(db, "budgetAllocation", "createMany")],
  },
  {
    name: "mycountry.getFirstSteps",
    db: () => firstStepsDb(),
    run: (ctx, countryId) => firstSteps(ctx).getFirstSteps({ countryId }),
    writes: (db) => [mock(db, "country", "update")],
  },
  {
    name: "mycountry.dismissFirstSteps",
    db: () => firstStepsDb(),
    run: (ctx, countryId) => firstSteps(ctx).dismissFirstSteps({ countryId }),
    writes: (db) => [mock(db, "country", "update")],
  },
];

/** The code a refusal carries: a TRPCError's own, or the AppError a middleware threw. */
const codeOf = (error: unknown) => {
  const { code, cause } = error as { code?: string; cause?: { trpcCode?: string; code?: string } };
  return cause?.trpcCode ?? cause?.code ?? code;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("country-scoped writes", () => {
  it.each(ROWS)(
    "$name refuses a signed-out visitor and another player's nation, writing nothing",
    async ({ db, run, writes }) => {
      const attempt = async (ctxFor: (db: Db) => MockCallerContext, countryId: string) => {
        const store = db();
        const result = await run(ctxFor(store), countryId).then(
          () => "written",
          (error: unknown) => codeOf(error)
        );
        return { result, wrote: writes(store).some((m) => m.mock.calls.length > 0) };
      };
      expect({
        signedOut: await attempt(
          (store) => createMockCallerContext({ db: store, auth: null, user: null }),
          CALLER_COUNTRY
        ),
        foreign: await attempt((store) => createIdorContext(store), FOREIGN_COUNTRY),
      }).toEqual({
        signedOut: { result: "UNAUTHORIZED", wrote: false },
        foreign: { result: "FORBIDDEN", wrote: false },
      });
    }
  );
});

describe("meetings.concludeMeeting", () => {
  it("records a decision per agenda item on the event spine and completes the meeting", async () => {
    const db = meetingsDb(CALLER_COUNTRY);
    const result = await meetingsRouter.createCaller(createIdorContext(db)).concludeMeeting({
      meetingId: "m1",
      outcome: "Budget passed; port plan sent back for costing.",
      decisions: [
        { agendaItemId: "a1", decision: "approved" },
        { agendaItemId: "a2", decision: "deferred", notes: "Needs costing" },
      ],
    });

    expect(db.state.meeting).toMatchObject({
      status: "completed",
      notes: "Budget passed; port plan sent back for costing.",
      completedAt: expect.any(Date),
    });
    expect(db.state.decisions).toEqual([
      expect.objectContaining({
        meetingId: "m1",
        agendaItemId: "a1",
        title: "Budget review",
        description: "Approved",
        decisionType: "approved",
      }),
      expect.objectContaining({
        agendaItemId: "a2",
        description: "Needs costing",
        decisionType: "deferred",
      }),
    ]);
    expect(db.state.agendaItems.map((a) => a.status)).toEqual(["decided", "deferred"]);
    expect(result?.decisions).toHaveLength(2);
    expect(db.countryChangeLog.create.mock.calls.map(([args]) => args.data)).toEqual([
      expect.objectContaining({
        countryId: CALLER_COUNTRY,
        sourceType: "meeting",
        sourceId: "d1",
        description: 'Cabinet meeting "Spring cabinet": Budget review approved',
      }),
      expect.objectContaining({
        sourceId: "d2",
        description: 'Cabinet meeting "Spring cabinet": Port expansion deferred (Needs costing)',
      }),
    ]);
  });

  it("refuses a meeting that is already over, and writes nothing to the spine", async () => {
    const db = meetingsDb(CALLER_COUNTRY, "completed");
    await expect(
      meetingsRouter.createCaller(createIdorContext(db)).concludeMeeting({
        meetingId: "m1",
        outcome: "Again",
        decisions: [{ agendaItemId: "a1", decision: "approved" }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.meetingDecision.create).not.toHaveBeenCalled();
    expect(db.countryChangeLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ["an agenda item of another meeting", [{ agendaItemId: "elsewhere", decision: "approved" }]],
    [
      "two decisions on one item",
      [
        { agendaItemId: "a1", decision: "approved" },
        { agendaItemId: "a1", decision: "rejected" },
      ],
    ],
  ] as const)("refuses %s and leaves the meeting open", async (_label, decisions) => {
    const db = meetingsDb(CALLER_COUNTRY);
    await expect(
      meetingsRouter.createCaller(createIdorContext(db)).concludeMeeting({
        meetingId: "m1",
        outcome: "Done",
        decisions: [...decisions],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.state.meeting.status).toBe("scheduled");
  });
});

describe("policies.repealPolicy", () => {
  it("repeals an enacted policy, releasing its executive bandwidth and growth effect", async () => {
    const db = policiesDb(CALLER_COUNTRY);
    await expect(
      policiesRouter.createCaller(createIdorContext(db)).repealPolicy({
        policyId: "pol_1",
        reason: "Too costly",
      })
    ).resolves.toEqual({ id: "pol_1", status: "repealed", execBandwidthReleased: 15 });
    expect(db.state.policy.status).toBe("repealed");
    // The policy's +2% GDP level is unwound from now on, not deleted from the projected past.
    expect(db.storytellerEffect.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          createdBy: "POLICY:pol_1",
          inputType: "gdp_level_adjustment",
          value: -0.019608,
          description: "Ended: Active policy: Policy",
        }),
      ],
    });
    expect(db.policyEffectLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ policyId: "pol_1", notes: "repealed: Too costly" }),
    });
  });

  it.each(["draft", "repealed"])("refuses a %s policy and releases nothing", async (status) => {
    const db = policiesDb(CALLER_COUNTRY, status);
    await expect(
      policiesRouter.createCaller(createIdorContext(db)).repealPolicy({ policyId: "pol_1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();
    expect(db.storytellerEffect.updateMany).not.toHaveBeenCalled();
  });
});

describe("taxSystem and economics", () => {
  const taxAs = (db: ReturnType<typeof taxDb>) => taxSystem(createIdorContext(db));

  it("returns bracket errors without writing anything", async () => {
    const db = taxDb();
    const result = await taxAs(db).create({
      countryId: CALLER_COUNTRY,
      data: taxState([
        { minIncome: 0, maxIncome: 20000, rate: 10 },
        { minIncome: 10000, maxIncome: 50000, rate: 20 },
      ]),
    });
    expect(result.taxSystem).toBeNull();
    expect((result as { errors: Array<{ message: string }> }).errors[0]!.message).toMatch(
      /overlaps previous bracket/
    );
    expect(db.taxSystem.create).not.toHaveBeenCalled();
    expect(syncTaxData).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a bracket rate above 100",
      () =>
        taxAs(taxDb()).create({
          countryId: CALLER_COUNTRY,
          data: taxState([{ minIncome: 0, rate: 150 }]),
        }),
    ],
    [
      "a fractional competitiveness rank",
      () =>
        economics(createIdorContext(createMockPrisma())).updateEconomicProfile({
          countryId: CALLER_COUNTRY,
          competitivenessRank: 1.5,
        }),
    ],
    ...(
      [
        ["a negative export share", { exportsGDPPercent: -50 }],
        ["a 1e308% import share", { importsGDPPercent: 1e308 }],
        ["a complexity score below zero", { economicComplexity: -1e9 }],
        ["a 200 KB sector breakdown", { sectorBreakdown: "x".repeat(200_000) }],
      ] as const
    ).map(
      ([label, fields]) =>
        [
          label,
          () =>
            economics(createIdorContext(createMockPrisma())).updateEconomicProfile({
              countryId: CALLER_COUNTRY,
              ...fields,
            }),
        ] as const
    ),
    // WP-B2: fiscal rates are bounded by the Fiscal policy channel ranges.
    [
      "a 50% VAT (the channel allows 30%)",
      () =>
        economics(createIdorContext(createMockPrisma())).updateFiscalSystem({
          countryId: CALLER_COUNTRY,
          salesTaxRate: 50,
        }),
    ],
    [
      "a negative wealth tax",
      () =>
        economics(createIdorContext(createMockPrisma())).updateFiscalSystem({
          countryId: CALLER_COUNTRY,
          wealthTaxRate: -5,
        }),
    ],
    [
      "a 10,000% income tax inside the JSON field",
      () =>
        economics(createIdorContext(createMockPrisma())).updateFiscalSystem({
          countryId: CALLER_COUNTRY,
          personalIncomeTaxRates: JSON.stringify({ incomeRate: 10_000 }),
        }),
    ],
    [
      "arbitrary JSON in a rate field",
      () =>
        economics(createIdorContext(createMockPrisma())).updateFiscalSystem({
          countryId: CALLER_COUNTRY,
          exciseTaxRates: JSON.stringify({ tariffRate: 5, note: { anything: "goes" } }),
        }),
    ],
  ])("refuses %s at input validation", async (_label, run) => {
    await expect(run()).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("saves fiscal rates inside the channel ranges, builder excise entries included", async () => {
    const db = createMockPrisma();
    db.fiscalSystem.upsert.mockResolvedValue({});
    await economics(createIdorContext(db)).updateFiscalSystem({
      countryId: CALLER_COUNTRY,
      salesTaxRate: 30,
      personalIncomeTaxRates: JSON.stringify({ incomeRate: 22 }),
      exciseTaxRates: JSON.stringify([
        { type: "tobacco", rate: 150 },
        { type: "tariff", rate: 12 },
      ]),
    });
    expect(db.fiscalSystem.upsert).toHaveBeenCalledTimes(1);
  });

  it("creates the tax row if missing, then replaces its categories and atomic components", async () => {
    const db = taxDb();
    db.taxSystem.findMany.mockResolvedValue([{ id: "ts1" }]);
    await taxAs(db).update({ countryId: CALLER_COUNTRY, data: taxState() });
    expect(db.taxSystem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: CALLER_COUNTRY }, update: {} })
    );
    expect(db.taxCategory.deleteMany).toHaveBeenCalled();
    expect(db.taxComponent.deleteMany).toHaveBeenCalledWith({
      where: { countryId: CALLER_COUNTRY },
    });
    expect(db.taxComponent.createMany).not.toHaveBeenCalled();
    expect(notificationHooks.onTaxSystemChange).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: "updated" })
    );
  });
});

describe("the first-steps checklist", () => {
  it("ticks each step from the rows its console writes, not the rows founding wrote", async () => {
    const db = firstStepsDb({
      budgetAllocations: [{ lastReviewed: DURING_FOUNDING }, { lastReviewed: LATER }],
      fiscal: { updatedAt: LATER },
      tax: { updatedAt: DURING_FOUNDING },
      officials: 2,
      wikiArticle: { id: "article_1" },
      capital: { coordinates: [12.5, 41.9] },
    });
    const steps = (await myCountryFirstStepsRouter
      .createCaller(createIdorContext(db))
      .getFirstSteps()) as FirstSteps | null;
    expect(Object.fromEntries((steps?.items ?? []).map((item) => [item.id, item.done]))).toEqual({
      budget: true,
      tax: true,
      cabinet: true,
      wiki: true,
      capital: true,
    });
    expect(db.budgetAllocation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ governmentStructure: { countryId: CALLER_COUNTRY } }),
      })
    );
    expect(db.wikiArticle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: "ixwiki", title: "Testland" }),
      })
    );
    expect(shouldShowFirstSteps(steps)).toBe(false);
  });

  it("stores the dismissal on the nation without touching its updatedAt", async () => {
    const db = firstStepsDb();
    await expect(
      myCountryFirstStepsRouter.createCaller(createIdorContext(db)).dismissFirstSteps()
    ).resolves.toEqual({ dismissed: true });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: CALLER_COUNTRY },
      data: { firstStepsDismissedAt: expect.any(Date), updatedAt: FOUNDED },
    });
  });
});
