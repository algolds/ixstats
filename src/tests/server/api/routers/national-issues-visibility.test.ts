/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see intent-outcome.test.ts): the
// hoisted jest.mock() factories rely on the ambient global.
//
// A nation's issue inbox is private: open issues, their consequences and response options,
// counts, recon and the resistance issues linked to a directive are readable (and actionable)
// only by the nation's owner or a privileged role. Other players get FORBIDDEN; signed-out
// callers UNAUTHORIZED. Visitors read resolved outcomes through countries.getPublicRecord
// (country-public-record.test.ts).
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
jest.mock("~/lib/gameplay-flags", () => {
  const actual = jest.requireActual("~/lib/gameplay-flags") as Record<string, any>;
  return {
    __esModule: true,
    ...actual,
    GAMEPLAY_FLAGS: {
      ...actual.GAMEPLAY_FLAGS,
      issuesAutoGenerate: false,
      issuesEnforceDeadlines: false,
      statecraftSpine: true,
    },
  };
});
jest.mock("~/lib/national-issues", () => ({
  __esModule: true,
  NationalIssuesEngine: { shouldEvaluate: jest.fn(), evaluateCountry: jest.fn() },
  NationalIssuesConsequences: {
    resolveIssue: jest.fn(async () => ({ success: true })),
    recomputeIntentProgress: jest.fn(),
  },
}));
jest.mock("~/lib/government/civcap", () => ({
  __esModule: true,
  ...(jest.requireActual("~/lib/government/civcap") as Record<string, unknown>),
  loadCivCapState: jest.fn(async () => ({
    componentTypes: [],
    departmentCategories: [],
    capacity: 100,
    used: 0,
    available: 100,
    overCapacity: false,
    effectiveness: 80,
  })),
}));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn() },
}));
jest.mock("~/lib/achievements/queue", () => ({
  __esModule: true,
  queueAchievementCheck: jest.fn(),
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { nationalIssuesPlayerRouter } from "~/server/api/routers/national-issues/player";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const COUNTRY = "country_owned";
const ISSUE = "issue_1";
const INTENT = "intent_1";

const issueRow = {
  id: ISSUE,
  countryId: COUNTRY,
  title: "Harbour strike",
  status: "pending",
  severity: "low",
  urgency: 20,
  deadlineIxTime: null,
  intentId: null,
  reconReadyIxTime: null,
  responseOptions: '[{"id":"opt_a","label":"Meet the unions","consequences":[]}]',
  template: null,
  consequences: [{ id: "cons_1", targetField: "budget", value: -40 }],
};

function makeDb({ ownerUserId = "owner_db" }: { ownerUserId?: string } = {}) {
  return {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { clerkUserId: string } }) =>
        where.clerkUserId === "owner_clerk"
          ? { id: "owner_db", countryId: COUNTRY, role: { name: "member" } }
          : { id: "other_db", countryId: "country_other", role: { name: "member" } }
      ),
      update: jest.fn(async () => ({})),
    },
    country: {
      findUnique: jest.fn(async () => ({ id: COUNTRY, ownerUserId })),
    },
    intent: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === INTENT ? { countryId: COUNTRY } : null
      ),
    },
    policy: { findFirst: jest.fn(async () => null) },
    nationalIssue: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === ISSUE ? issueRow : null
      ),
      findMany: jest.fn(async () => [issueRow]),
      count: jest.fn(async () => 1),
      update: jest.fn(async (_args: object) => ({})),
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

const issuesCaller = createCallerFactory(nationalIssuesPlayerRouter);
const intentCaller = createCallerFactory(intentRouter);

type Ctx = ReturnType<typeof owner>;

interface Case {
  name: string;
  call: (ctx: Ctx) => Promise<unknown>;
  /** The DB effect a rejected caller must never reach. */
  effect: (db: Db) => jest.Mock;
}

const CASES: Case[] = [
  {
    name: "nationalIssues.getMyIssues",
    call: (ctx) => issuesCaller(ctx).getMyIssues({ countryId: COUNTRY }),
    effect: (db) => db.nationalIssue.findMany,
  },
  {
    name: "nationalIssues.getIssue",
    call: (ctx) => issuesCaller(ctx).getIssue({ id: ISSUE }),
    // The issue is loaded to learn its country; the check is that nothing is returned.
    effect: (db) => db.nationalIssue.update,
  },
  {
    name: "nationalIssues.markViewed",
    call: (ctx) => issuesCaller(ctx).markViewed({ id: ISSUE }),
    effect: (db) => db.nationalIssue.update,
  },
  {
    name: "nationalIssues.getPendingCount",
    call: (ctx) => issuesCaller(ctx).getPendingCount({ countryId: COUNTRY }),
    effect: (db) => db.nationalIssue.count,
  },
  {
    name: "nationalIssues.commissionRecon",
    call: (ctx) => issuesCaller(ctx).commissionRecon({ issueId: ISSUE }),
    effect: (db) => db.nationalIssue.update,
  },
  {
    name: "nationalIssues.getReconReveal",
    call: (ctx) => issuesCaller(ctx).getReconReveal({ issueId: ISSUE }),
    effect: (db) => db.nationalIssue.update,
  },
  {
    name: "nationalIssues.respond",
    call: (ctx) => issuesCaller(ctx).respond({ issueId: ISSUE, optionId: "opt_a" }),
    effect: (db) => db.policy.findFirst,
  },
  {
    name: "nationalIssues.dismiss",
    call: (ctx) => issuesCaller(ctx).dismiss({ id: ISSUE }),
    effect: (db) => db.nationalIssue.update,
  },
  {
    name: "intent.getLinkedIssues",
    call: (ctx) => intentCaller(ctx).getLinkedIssues({ intentId: INTENT }),
    effect: (db) => db.nationalIssue.findMany,
  },
];

describe.each(CASES)("$name", ({ call, effect }) => {
  it("serves the nation's owner", async () => {
    await expect(call(owner(makeDb()))).resolves.toBeTruthy();
  });

  it("serves an owner who is not acting as the nation (Country.ownerUserId)", async () => {
    await expect(call(otherPlayer(makeDb({ ownerUserId: "other_db" })))).resolves.toBeTruthy();
  });

  it("serves admins", async () => {
    await expect(call(admin(makeDb()))).resolves.toBeTruthy();
  });

  it("is FORBIDDEN for another player", async () => {
    const db = makeDb();
    await expect(call(otherPlayer(db))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(effect(db)).not.toHaveBeenCalled();
  });

  it("is UNAUTHORIZED when signed out", async () => {
    const db = makeDb();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    // authMiddleware throws an AppError; the errorFormatter sends its code (UNAUTHORIZED) over
    // the wire, while a direct caller sees it as the cause.
    await expect(call(signedOut(db))).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
    warn.mockRestore();
    expect(effect(db)).not.toHaveBeenCalled();
  });
});

describe("nationalIssues id lookups", () => {
  it("returns NOT_FOUND for a missing issue, to privileged roles too", async () => {
    const db = makeDb();
    await expect(issuesCaller(owner(db)).getIssue({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(issuesCaller(admin(db)).getIssue({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("leaves another nation's pending issue pending", async () => {
    const db = makeDb();
    await expect(issuesCaller(otherPlayer(db)).markViewed({ id: ISSUE })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.nationalIssue.update).not.toHaveBeenCalled();

    await issuesCaller(owner(db)).markViewed({ id: ISSUE });
    expect(db.nationalIssue.update).toHaveBeenCalledWith({
      where: { id: ISSUE },
      data: { status: "viewed" },
    });
  });
});
