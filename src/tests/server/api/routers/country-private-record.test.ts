/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see intent-outcome.test.ts): the
// hoisted jest.mock() factories rely on the ambient global.
//
// The owner's side of a nation's statecraft, enforced on the server (the public side is
// country-public-record.test.ts). Owner-only: open issues and their detail (nationalIssues.*),
// the directive status/suggest/linked-issue reads, CivCap (policies.getPolicyReconContext) and
// draft policies. Every procedure is checked for the owner, another player, an admin (the
// dev "view as" toolbar is system-owner only, which is privileged the same way) and a
// signed-out caller.
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
jest.mock("~/lib/government/civcap", () => {
  const actual = jest.requireActual("~/lib/government/civcap");
  return {
    __esModule: true,
    ...actual,
    loadCivCapState: jest.fn(async () => ({
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
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { nationalIssuesPlayerRouter } from "~/server/api/routers/national-issues/player";
import { policiesRouter } from "~/server/api/routers/policies";
import { NationalIssuesConsequences } from "~/lib/national-issues";
import { loadCivCapState } from "~/lib/government/civcap";
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

const intentRow = (id: string, status: string, tier = "measured") => ({
  id,
  countryId: COUNTRY,
  goal: "Goal",
  tier,
  status,
});
const INTENTS: Record<string, ReturnType<typeof intentRow>> = {
  in_force: intentRow("in_force", "active"),
  draft: intentRow("draft", "proposed", "proposed"),
  withdrawn: intentRow("withdrawn", "abandoned"),
};

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
      findMany: jest.fn(async () => [ISSUE]),
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => 1),
      update: jest.fn(async () => ISSUE),
    },
    intent: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) => INTENTS[where.id] ?? null
      ),
      findMany: jest.fn(async () => []),
    },
    countryChangeLog: { findMany: jest.fn(async () => []) },
    storytellerEffect: { findMany: jest.fn(async () => []) },
    governmentComponent: { findMany: jest.fn(async () => []) },
    budgetAllocation: { findMany: jest.fn(async () => []) },
    governmentStructure: { findUnique: jest.fn(async () => null) },
    policy: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
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

type Ctx = (db: Db) => never;
type Call = (ctx: never) => Promise<unknown>;

/**
 * Owner-only procedures: the call, and the DB read/write that must not happen for a refused
 * caller.
 */
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
    "nationalIssues.getReconReveal",
    (ctx) => issues(ctx).getReconReveal({ issueId: ISSUE.id }),
    (db) => db.nationalIssue.update,
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
    () => loadCivCapState as unknown as jest.Mock,
  ],
];

let warn: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe.each(OWNER_ONLY)("%s", (_name, call, guarded) => {
  it.each([
    ["the owner", owner],
    ["an admin", admin],
  ] as Array<[string, Ctx]>)("serves %s", async (_who, ctxFor) => {
    const db = makeDb();
    await expect(call(ctxFor(db))).resolves.toBeDefined();
  });

  it("serves an owner who is not acting as the nation (Country.ownerUserId)", async () => {
    const db = makeDb({ ownerUserId: "other_db" });
    await expect(call(otherPlayer(db))).resolves.toBeDefined();
  });

  it("is FORBIDDEN for another player, before any private read or write", async () => {
    const db = makeDb();
    const guard = guarded(db);
    const before = guard.mock.calls.length;
    await expect(call(otherPlayer(db))).rejects.toMatchObject({ code: "FORBIDDEN" });
    // getIssue loads the owning country first; nothing past that may run.
    const allowed = guard === db.nationalIssue.findUnique ? 1 : 0;
    expect(guard.mock.calls.length - before).toBeLessThanOrEqual(allowed);
  });

  it("requires a session", async () => {
    const db = makeDb();
    await expect(call(signedOut(db))).rejects.toThrow(/Authentication required/);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("nationalIssues mutations", () => {
  it("markViewed updates the owner's pending issue", async () => {
    const db = makeDb();
    await issues(owner(db)).markViewed({ id: ISSUE.id });
    expect(db.nationalIssue.update).toHaveBeenCalledWith({
      where: { id: ISSUE.id },
      data: { status: "viewed" },
    });
  });

  it("dismiss is FORBIDDEN for another player and leaves the issue open", async () => {
    const db = makeDb();
    await expect(issues(otherPlayer(db)).dismiss({ id: ISSUE.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.nationalIssue.update).not.toHaveBeenCalled();
  });

  it("commissionRecon is FORBIDDEN for another player and allowed for an admin", async () => {
    const db = makeDb();
    await expect(
      issues(otherPlayer(db)).commissionRecon({ issueId: ISSUE.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.nationalIssue.update).not.toHaveBeenCalled();

    await expect(issues(admin(db)).commissionRecon({ issueId: ISSUE.id })).resolves.toHaveProperty(
      "readyIxTime"
    );
  });

  it("a missing issue is NOT_FOUND, for players and admins alike", async () => {
    const db = makeDb();
    for (const ctxFor of [owner, admin]) {
      await expect(issues(ctxFor(db)).getIssue({ id: "missing" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  });
});

describe("intent.getOutcome", () => {
  it.each([
    ["another player", otherPlayer],
    ["a signed-out visitor", signedOut],
  ] as Array<[string, Ctx]>)(
    "serves %s an enacted directive only; drafts and abandoned ones are NOT_FOUND",
    async (_who, ctxFor) => {
      const db = makeDb();
      await expect(intents(ctxFor(db)).getOutcome({ intentId: "in_force" })).resolves.toEqual({
        ledger: [],
        gdpEffects: [],
      });
      for (const intentId of ["draft", "withdrawn"]) {
        await expect(intents(ctxFor(db)).getOutcome({ intentId })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }
      expect(db.countryChangeLog.findMany).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ["the owner", owner],
    ["an admin", admin],
  ] as Array<[string, Ctx]>)("serves %s every directive's outcome", async (_who, ctxFor) => {
    const db = makeDb();
    for (const intentId of ["in_force", "draft", "withdrawn"]) {
      await expect(intents(ctxFor(db)).getOutcome({ intentId })).resolves.toBeDefined();
    }
  });
});

describe("intent.getLinkedIssues", () => {
  it("scopes the issues to the directive's own country", async () => {
    const db = makeDb();
    await intents(owner(db)).getLinkedIssues({ intentId: "in_force" });
    expect(db.nationalIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { intentId: "in_force", countryId: COUNTRY } })
    );
  });
});

describe("intent.generateSummationDraft", () => {
  it("refuses another country's directive under the caller's own countryId", async () => {
    const db = makeDb();
    const ctx = createMockRouterContext({
      db,
      auth: { userId: "other_clerk" },
      user: {
        id: "other_db",
        clerkUserId: "other_clerk",
        countryId: "country_other",
        role: { name: "member" },
      },
    }) as never;
    await expect(
      intents(ctx).generateSummationDraft({ intentId: "draft", countryId: "country_other" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("drafts the owner's own directive", async () => {
    const db = makeDb();
    await expect(
      intents(owner(db)).generateSummationDraft({ intentId: "in_force", countryId: COUNTRY })
    ).resolves.toEqual({ postId: "post_1" });
  });
});

describe("policies.getPolicies", () => {
  it.each([
    ["another player", otherPlayer],
    ["a signed-out visitor", signedOut],
  ] as Array<[string, Ctx]>)("never serves %s draft policies", async (_who, ctxFor) => {
    const db = makeDb();
    await policies(ctxFor(db)).getPolicies({ countryId: COUNTRY });
    expect(db.policy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: COUNTRY, status: { not: "draft" } } })
    );
    await expect(
      policies(ctxFor(db)).getPolicies({ countryId: COUNTRY, status: "draft" })
    ).resolves.toEqual([]);
    expect(db.policy.findMany).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["the owner", owner],
    ["an admin", admin],
  ] as Array<[string, Ctx]>)("serves %s every policy, drafts included", async (_who, ctxFor) => {
    const db = makeDb();
    await policies(ctxFor(db)).getPolicies({ countryId: COUNTRY });
    expect(db.policy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: COUNTRY } })
    );
  });
});
