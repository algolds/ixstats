/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the
// hoisted jest.mock() factories rely on the ambient global.
//
// Who sees what of a nation's statecraft, enforced on the server. Owner-only, one row per procedure: open issues and
// their detail, recon and delegation (nationalIssues.*), the issue history, the directive status/suggest/linked-issue
// reads, executive bandwidth (policies.getPolicyReconContext) and the threshold alerts (intelligence.*). Each row runs
// the owner, an admin (the dev "view as" toolbar is system-owner only, which is privileged the same way), the
// nation's owner while acting as another nation (Country.ownerUserId), another player (refused before any private read
// or write) and a signed-out visitor (refused before any lookup). The public side: the public record and the intent
// tree give everyone else enacted directives and resolved issues only, redacted; outcomes and policies hide drafts.
//
// Folds country-public-record and intelligence-alerts.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));
jest.mock("~/lib/activity", () => ({
  __esModule: true,
  CountryEventSpine: { recordCountryEvent: jest.fn() },
}));
jest.mock("~/lib/intent/resistance", () => ({
  __esModule: true,
  spawnIntentResistance: jest.fn(),
}));
jest.mock("~/lib/intent/intent-summation", () => ({
  __esModule: true,
  generateIntentSummationDraft: jest.fn(async () => ({ postId: "post_1" })),
}));
jest.mock("~/lib/national-issues", () => ({
  __esModule: true,
  NationalIssuesEngine: {
    shouldEvaluate: jest.fn(async () => false),
    evaluateCountry: jest.fn(async () => undefined),
  },
  NationalIssuesConsequences: {
    resolveIssue: jest.fn(async () => ({ success: true })),
    recomputeIntentProgress: jest.fn(async () => undefined),
  },
}));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn(async () => undefined) },
}));
jest.mock("~/lib/achievements/queue", () => ({
  __esModule: true,
  queueAchievementCheck: jest.fn(),
}));
jest.mock("~/lib/gameplay-flags", () => {
  const actual = jest.requireActual("~/lib/gameplay-flags");
  return {
    __esModule: true,
    ...actual,
    GAMEPLAY_FLAGS: { ...actual.GAMEPLAY_FLAGS, statecraftSpine: true },
  };
});
// Bandwidth capacity reads the projected population; the projection itself is not under test here.
jest.mock("~/server/shared/projected-population", () => ({
  __esModule: true,
  loadProjectedPopulation: jest.fn(async () => 10_000_000),
}));
jest.mock("~/lib/government/exec-bandwidth", () => {
  const actual = jest.requireActual("~/lib/government/exec-bandwidth");
  return {
    __esModule: true,
    ...actual,
    loadExecBandwidthState: jest.fn(async () => ({
      componentTypes: [],
      departmentCategories: [],
      capacity: 100,
      used: 10,
      available: 90,
      overCapacity: false,
      effectiveness: 80,
      breakdown: {},
    })),
  };
});

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { intelligenceRouter } from "~/server/api/routers/intelligence";
import { nationalIssuesPlayerRouter } from "~/server/api/routers/national-issues/player";
import { policiesRouter } from "~/server/api/routers/policies";
import { publicRecordProcedures } from "~/server/api/routers/countries/public-record";
import { NationalIssuesConsequences } from "~/lib/national-issues";
import { loadExecBandwidthState } from "~/lib/government/exec-bandwidth";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const COUNTRY = "country_owned";

const ISSUE = {
  id: "issue_open",
  countryId: COUNTRY,
  title: "Harbour strike",
  status: "pending",
  severity: "low",
  urgency: 10,
  deadlineIxTime: null,
  intentId: null,
  reconReadyIxTime: null,
  responseOptions: "[]",
  template: { slug: "strike", tags: [], domain: "economy" },
  consequences: [],
};

const intentRow = (overrides: Record<string, unknown>) => ({
  id: "i",
  countryId: COUNTRY,
  goal: "Goal",
  tier: "measured",
  category: "economy",
  target: null,
  status: "active",
  changesJson: '[{"field":"budget","delta":5}]',
  summary: null,
  riskRating: "stable",
  progress: 40,
  parentId: null,
  cooldownUntil: 123,
  execBandwidthCost: 12,
  createdIxTime: 1_000,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});
const INTENTS = [
  intentRow({ id: "in_force", status: "active", createdIxTime: 3_000 }),
  intentRow({ id: "done", status: "completed", createdIxTime: 2_000 }),
  intentRow({ id: "draft", status: "proposed", tier: "proposed" }),
  intentRow({ id: "withdrawn", status: "abandoned" }),
];

const RESOLVED_ISSUES = [
  {
    id: "resolved",
    title: "Harbour strike",
    domain: "economy",
    status: "responded",
    chosenOptionLabel: "Meet the unions",
    autoResolveLabel: null,
    consequenceLog: "Wages rose; the ports reopened.",
    respondedIxTime: 5_000,
    createdIxTime: 4_000,
    appliedConsequences: '{"budget":-40}',
  },
  {
    id: "lapsed",
    title: "Drought relief",
    domain: "social",
    status: "auto_resolved",
    chosenOptionLabel: null,
    autoResolveLabel: "Do nothing",
    consequenceLog: null,
    respondedIxTime: 6_000,
    createdIxTime: 4_500,
  },
  { id: "open", title: "Open issue", domain: "economy", status: "pending" },
  { id: "gone", title: "Dismissed issue", domain: "economy", status: "dismissed" },
];

const ALERT = {
  id: "a_medium",
  countryId: COUNTRY,
  title: "gdpGrowthRate breached medium threshold",
  description: "Current value: 1.00",
  category: "ECONOMIC",
  alertType: "threshold_breach",
  severity: "MEDIUM",
  currentValue: 1,
  expectedValue: 2,
  isResolved: false,
  resolvedAt: null,
  readAt: null,
  detectedAt: new Date("2026-10-04T00:00:00Z"),
};

type Where = Record<string, unknown>;
/** A row matches when every equality, `in` and `not` condition holds (the filters the routers send). */
const matches = (row: Record<string, unknown>, where: Where = {}) =>
  Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === "object" && "in" in cond)
      return (cond as { in: unknown[] }).in.includes(row[key]);
    if (cond && typeof cond === "object" && "not" in cond)
      return row[key] !== (cond as { not: unknown }).not;
    return cond === undefined || typeof cond === "object" || row[key] === cond;
  });

function makeDb({ ownerUserId = "owner_db" }: { ownerUserId?: string } = {}) {
  return {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { clerkUserId: string } }) =>
        where.clerkUserId === "owner_clerk"
          ? { id: "owner_db", countryId: COUNTRY, role: { name: "member" } }
          : where.clerkUserId === "admin_clerk"
            ? { id: "admin_db", countryId: null, role: { name: "admin" } }
            : { id: "other_db", countryId: "country_other", role: { name: "member" } }
      ),
      update: jest.fn(async () => ({})),
    },
    country: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === COUNTRY ? { id: COUNTRY, ownerUserId } : null
      ),
    },
    nationalIssue: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === ISSUE.id ? ISSUE : null
      ),
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        where.status
          ? RESOLVED_ISSUES.filter((row) => matches(row, { status: where.status }))
          : [ISSUE]
      ),
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => 1),
      update: jest.fn(async (_args: object) => ISSUE),
    },
    intent: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) =>
          INTENTS.find((i) => i.id === where.id) ?? null
      ),
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        INTENTS.filter((row) => matches(row, where))
      ),
    },
    countryChangeLog: { findMany: jest.fn(async () => []) },
    storytellerEffect: { findMany: jest.fn(async () => []) },
    governmentComponent: { findMany: jest.fn(async () => []) },
    budgetAllocation: { findMany: jest.fn(async () => []) },
    governmentStructure: { findUnique: jest.fn(async () => null) },
    policy: {
      findMany: jest.fn(async (_args: object) => []),
      findFirst: jest.fn(async () => null),
    },
    intelligenceAlert: {
      findMany: jest.fn(async (_args: object) => [ALERT]),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === ALERT.id
          ? { id: ALERT.id, countryId: COUNTRY, readAt: null, isResolved: false }
          : null
      ),
      count: jest.fn(async () => 1),
      update: jest.fn(async (_args: object) => ({})),
      updateMany: jest.fn(async (_args: object) => ({ count: 1 })),
    },
  };
}

type Db = ReturnType<typeof makeDb>;

const signedOut = (db: Db) => createMockRouterContext({ db, auth: null, user: null }) as never;
const owner = (db: Db) =>
  createMockRouterContext({
    db,
    auth: { userId: "owner_clerk" },
    user: {
      id: "owner_db",
      clerkUserId: "owner_clerk",
      countryId: COUNTRY,
      role: { name: "member" },
    },
  }) as never;
const otherPlayer = (db: Db) =>
  createMockRouterContext({
    db,
    auth: { userId: "other_clerk" },
    user: {
      id: "other_db",
      clerkUserId: "other_clerk",
      countryId: "country_other",
      role: { name: "member" },
    },
  }) as never;
const admin = (db: Db) =>
  createMockRouterContext({
    db,
    auth: { userId: "admin_clerk" },
    user: { id: "admin_db", clerkUserId: "admin_clerk", countryId: null, role: { name: "admin" } },
  }) as never;

const issues = createCallerFactory(nationalIssuesPlayerRouter);
const intents = createCallerFactory(intentRouter);
const policies = createCallerFactory(policiesRouter);
const intelligence = createCallerFactory(intelligenceRouter);
const publicRecord = createCallerFactory(createTRPCRouter(publicRecordProcedures));

type Ctx = (db: Db) => never;
type Call = (ctx: never) => Promise<unknown>;

/** The code a refusal carries: a TRPCError's own, or the AppError a middleware threw. */
const codeOf = (error: unknown) => {
  const { code, cause } = error as { code?: string; cause?: { trpcCode?: string; code?: string } };
  return cause?.trpcCode ?? cause?.code ?? code;
};
const outcomeOf = (call: Call, ctx: never) =>
  call(ctx).then(
    () => "served",
    (error: unknown) => codeOf(error)
  );

/** Owner-only procedures: the call, and the DB read or write a refused caller must not reach. */
const OWNER_ONLY: Array<[string, Call, (db: Db) => jest.Mock]> = [
  [
    "nationalIssues.getMyIssues",
    (ctx) => issues(ctx).getMyIssues({ countryId: COUNTRY }),
    (db) => db.nationalIssue.findMany,
  ],
  [
    "nationalIssues.getIssue",
    (ctx) => issues(ctx).getIssue({ id: ISSUE.id }),
    (db) => db.nationalIssue.findUnique,
  ],
  [
    "nationalIssues.markViewed",
    (ctx) => issues(ctx).markViewed({ id: ISSUE.id }),
    (db) => db.nationalIssue.update,
  ],
  [
    "nationalIssues.getPendingCount",
    (ctx) => issues(ctx).getPendingCount({ countryId: COUNTRY }),
    (db) => db.nationalIssue.count,
  ],
  [
    "nationalIssues.respond",
    (ctx) => issues(ctx).respond({ issueId: ISSUE.id, optionId: "a" }),
    () => NationalIssuesConsequences.resolveIssue as unknown as jest.Mock,
  ],
  [
    "nationalIssues.dismiss",
    (ctx) => issues(ctx).dismiss({ id: ISSUE.id }),
    (db) => db.nationalIssue.update,
  ],
  [
    "nationalIssues.commissionRecon",
    (ctx) => issues(ctx).commissionRecon({ issueId: ISSUE.id }),
    (db) => db.nationalIssue.update,
  ],
  [
    "nationalIssues.getReconReveal",
    (ctx) => issues(ctx).getReconReveal({ issueId: ISSUE.id }),
    (db) => db.nationalIssue.update,
  ],
  [
    "nationalIssues.getHistory",
    (ctx) => issues(ctx).getHistory({ countryId: COUNTRY }),
    (db) => db.nationalIssue.findMany,
  ],
  [
    "intent.getStatus",
    (ctx) => intents(ctx).getStatus({ countryId: COUNTRY }),
    (db) => db.intent.findMany,
  ],
  [
    "intent.suggest",
    (ctx) => intents(ctx).suggest({ countryId: COUNTRY, goal: "Create industrial jobs" }),
    (db) => db.intent.findMany,
  ],
  [
    "intent.getLinkedIssues",
    (ctx) => intents(ctx).getLinkedIssues({ intentId: "in_force" }),
    (db) => db.nationalIssue.findMany,
  ],
  [
    "policies.getPolicyReconContext",
    (ctx) => policies(ctx).getPolicyReconContext({ countryId: COUNTRY }),
    () => loadExecBandwidthState as unknown as jest.Mock,
  ],
  [
    "intelligence.getMyAlerts",
    (ctx) => intelligence(ctx).getMyAlerts({ countryId: COUNTRY }),
    (db) => db.intelligenceAlert.findMany,
  ],
  [
    "intelligence.markAlertRead",
    (ctx) => intelligence(ctx).markAlertRead({ id: ALERT.id }),
    (db) => db.intelligenceAlert.update,
  ],
  [
    "intelligence.markAllAlertsRead",
    (ctx) => intelligence(ctx).markAllAlertsRead({ countryId: COUNTRY }),
    (db) => db.intelligenceAlert.updateMany,
  ],
  [
    "intelligence.dismissAlert",
    (ctx) => intelligence(ctx).dismissAlert({ id: ALERT.id }),
    (db) => db.intelligenceAlert.update,
  ],
];

let warn: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("owner-only statecraft", () => {
  it.each(OWNER_ONLY)(
    "%s serves the owner, an admin and the owner acting as another nation; refuses everyone else",
    async (_name, call, guarded) => {
      const served = {
        owner: await outcomeOf(call, owner(makeDb())),
        admin: await outcomeOf(call, admin(makeDb())),
        ownerActingElsewhere: await outcomeOf(
          call,
          otherPlayer(makeDb({ ownerUserId: "other_db" }))
        ),
      };
      // The refused player's call alone: how far it got past the check
      const refused = makeDb();
      const guard = guarded(refused);
      const before = guard.mock.calls.length;
      const otherPlayerOutcome = await outcomeOf(call, otherPlayer(refused));
      const reached = guard.mock.calls.length - before;
      const visitor = makeDb();
      expect({
        ...served,
        otherPlayer: otherPlayerOutcome,
        signedOut: await outcomeOf(call, signedOut(visitor)),
      }).toEqual({
        owner: "served",
        admin: "served",
        ownerActingElsewhere: "served",
        otherPlayer: "FORBIDDEN",
        signedOut: "UNAUTHORIZED",
      });
      // A single-issue read loads the issue to find its country; nothing past that may run.
      expect(reached).toBeLessThanOrEqual(guard === refused.nationalIssue.findUnique ? 1 : 0);
      expect(visitor.user.findUnique).not.toHaveBeenCalled();
    }
  );

  it("answers NOT_FOUND for a missing issue, to players and admins alike", async () => {
    for (const ctxFor of [owner, admin]) {
      await expect(issues(ctxFor(makeDb())).getIssue({ id: "missing" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  });

  it("scopes a directive's linked issues to its own country", async () => {
    const db = makeDb();
    await intents(owner(db)).getLinkedIssues({ intentId: "in_force" });
    expect(db.nationalIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { intentId: "in_force", countryId: COUNTRY } })
    );
  });

  it("refuses to draft a summation of another country's directive under the caller's own countryId", async () => {
    await expect(
      intents(otherPlayer(makeDb())).generateSummationDraft({
        intentId: "draft",
        countryId: "country_other",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      intents(owner(makeDb())).generateSummationDraft({ intentId: "in_force", countryId: COUNTRY })
    ).resolves.toEqual({ postId: "post_1" });
  });
});

describe("the public side", () => {
  it("serves a signed-out visitor the public record: enacted directives and resolved issues, public fields only", async () => {
    const db = makeDb();
    const record = await publicRecord(signedOut(db)).getPublicRecord({ countryId: COUNTRY });

    expect(record.directives.map((d) => d.id)).toEqual(["in_force", "done"]);
    expect(Object.keys(record.directives[0]!).sort()).toEqual(
      ["category", "createdIxTime", "goal", "id", "progress", "status", "summary", "tier"].sort()
    );
    expect(record.issueOutcomes.map((o) => o.id)).toEqual(["lapsed", "resolved"]);
    expect(record.issueOutcomes.find((o) => o.id === "resolved")).toEqual({
      id: "resolved",
      title: "Harbour strike",
      domain: "economy",
      decision: "Meet the unions",
      outcome: "Wages rose; the ports reopened.",
      resolvedBy: "government",
      ixTime: 5_000,
    });
    expect(record.issueOutcomes.find((o) => o.id === "lapsed")).toMatchObject({
      decision: "Do nothing",
      resolvedBy: "default",
    });
    // The selects never ask for the private columns
    const [{ select: intentSelect }] = db.intent.findMany.mock.calls[0] as unknown as [
      { select: Record<string, boolean> },
    ];
    expect(intentSelect).not.toHaveProperty("changesJson");
    expect(intentSelect).not.toHaveProperty("execBandwidthCost");
    const [{ select: issueSelect }] = db.nationalIssue.findMany.mock.calls[0] as unknown as [
      { select: Record<string, boolean> },
    ];
    expect(issueSelect).not.toHaveProperty("appliedConsequences");
    expect(issueSelect).not.toHaveProperty("responseOptions");
  });

  it("gives the owner the whole intent tree, drafts and abandoned directives included", async () => {
    const tree = await intents(owner(makeDb())).getTree({ countryId: COUNTRY });
    expect(tree.allIntents.map((i) => i.id).sort()).toEqual(
      ["done", "draft", "in_force", "withdrawn"].sort()
    );
    expect(tree.allIntents.find((i) => i.id === "draft")?.changesJson).toContain("budget");
  });

  it("gives another player and a signed-out visitor the redacted public tree only", async () => {
    const publicTree = async (ctxFor: Ctx) => {
      const tree = await intents(ctxFor(makeDb())).getTree({ countryId: COUNTRY });
      return {
        ids: tree.allIntents.map((i) => i.id).sort(),
        roots: tree.roots.length,
        redacted: tree.allIntents.every(
          (i) => i.changesJson === "[]" && i.execBandwidthCost === null && i.cooldownUntil === null
        ),
      };
    };
    const expected = { ids: ["done", "in_force"], roots: 2, redacted: true };
    expect({
      otherPlayer: await publicTree(otherPlayer),
      signedOut: await publicTree(signedOut),
    }).toEqual({ otherPlayer: expected, signedOut: expected });
  });

  it("shows a directive's outcome to everyone once enacted, and a draft or abandoned one to the owner and admins only", async () => {
    const outcomes = async (ctxFor: Ctx) => {
      const of = (intentId: string) =>
        outcomeOf((ctx) => intents(ctx).getOutcome({ intentId }), ctxFor(makeDb()));
      return {
        in_force: await of("in_force"),
        draft: await of("draft"),
        withdrawn: await of("withdrawn"),
      };
    };
    const hidden = { in_force: "served", draft: "NOT_FOUND", withdrawn: "NOT_FOUND" };
    const shown = { in_force: "served", draft: "served", withdrawn: "served" };
    expect({
      otherPlayer: await outcomes(otherPlayer),
      signedOut: await outcomes(signedOut),
      owner: await outcomes(owner),
      admin: await outcomes(admin),
    }).toEqual({ otherPlayer: hidden, signedOut: hidden, owner: shown, admin: shown });
  });

  it("lists policies without drafts for everyone but the owner and admins", async () => {
    const whereFor = async (ctxFor: Ctx) => {
      const db = makeDb();
      await policies(ctxFor(db)).getPolicies({ countryId: COUNTRY });
      return (db.policy.findMany.mock.calls[0]![0] as { where: Where }).where;
    };
    const published = { countryId: COUNTRY, status: { not: "draft" } };
    expect({
      otherPlayer: await whereFor(otherPlayer),
      signedOut: await whereFor(signedOut),
      owner: await whereFor(owner),
      admin: await whereFor(admin),
    }).toEqual({
      otherPlayer: published,
      signedOut: published,
      owner: { countryId: COUNTRY },
      admin: { countryId: COUNTRY },
    });
  });

  it("never serves another player's drafts even when asked for them", async () => {
    const db = makeDb();
    await expect(
      policies(otherPlayer(db)).getPolicies({ countryId: COUNTRY, status: "draft" })
    ).resolves.toEqual([]);
    expect(db.policy.findMany).not.toHaveBeenCalled();
  });
});
