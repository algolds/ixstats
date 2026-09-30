/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see intent-outcome.test.ts): the
// hoisted jest.mock() factories rely on the ambient global.
//
// The country profile's visibility rules, enforced on the server:
// - countries.getPublicRecord: anyone (signed out included) reads enacted directives and resolved
//   issues, public fields only.
// - intent.getTree: the owner and privileged roles get every intent; everyone else the public
//   record, redacted.
// - nationalIssues.getHistory: the owner (or a privileged role) only; FORBIDDEN otherwise.
// The rest of the owner-only reads and writes are covered in country-private-record.test.ts.
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

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { nationalIssuesPlayerRouter } from "~/server/api/routers/national-issues/player";
import { publicRecordProcedures } from "~/server/api/routers/countries/public-record";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const COUNTRY = "country_owned";

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
  civCapCost: 12,
  createdIxTime: 1_000,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const ALL_INTENTS = [
  intentRow({ id: "in_force", status: "active", createdIxTime: 3_000 }),
  intentRow({ id: "done", status: "completed", createdIxTime: 2_000 }),
  intentRow({ id: "draft", status: "proposed", tier: "proposed" }),
  intentRow({ id: "withdrawn", status: "abandoned" }),
];

/** A Prisma double that applies the `status`/`tier` filters the routers send. */
function makeDb({ ownerUserId = "owner_db" }: { ownerUserId?: string } = {}) {
  const matches = (row: Record<string, any>, where: Record<string, any>) =>
    Object.entries(where).every(([key, cond]) => {
      if (cond && typeof cond === "object" && "in" in cond) return cond.in.includes(row[key]);
      if (cond && typeof cond === "object" && "not" in cond) return row[key] !== cond.not;
      return row[key] === cond;
    });
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
      findMany: jest.fn(async ({ where }: { where: Record<string, any> }) =>
        ALL_INTENTS.filter((row) => matches(row, where))
      ),
    },
    nationalIssue: {
      findMany: jest.fn(async ({ where }: { where: Record<string, any> }) =>
        [
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
        ].filter((row) => matches(row, { status: where.status }))
      ),
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

const publicRecordCaller = createCallerFactory(createTRPCRouter(publicRecordProcedures));
const intentCaller = createCallerFactory(intentRouter);
const issuesCaller = createCallerFactory(nationalIssuesPlayerRouter);

describe("countries.getPublicRecord", () => {
  it("serves signed-out visitors enacted directives and resolved issues only", async () => {
    const db = makeDb();
    const record = await publicRecordCaller(signedOut(db)).getPublicRecord({ countryId: COUNTRY });

    expect(db.intent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          countryId: COUNTRY,
          status: { in: ["active", "completed"] },
          tier: { not: "proposed" },
        },
      })
    );
    expect(db.nationalIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { countryId: COUNTRY, status: { in: ["responded", "auto_resolved"] } },
      })
    );
    expect(record.directives.map((d) => d.id)).toEqual(["in_force", "done"]);
    expect(record.issueOutcomes.map((o) => o.id)).toEqual(["lapsed", "resolved"]);
  });

  it("returns public fields only (no package, CivCap, cooldown or applied consequences)", async () => {
    const db = makeDb();
    const record = await publicRecordCaller(signedOut(db)).getPublicRecord({ countryId: COUNTRY });

    expect(Object.keys(record.directives[0]!).sort()).toEqual(
      ["category", "createdIxTime", "goal", "id", "progress", "status", "summary", "tier"].sort()
    );
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
    // The select never asks for private columns.
    const [{ select: intentSelect }] = db.intent.findMany.mock.calls[0] as unknown as [
      { select: Record<string, boolean> },
    ];
    expect(intentSelect).not.toHaveProperty("changesJson");
    expect(intentSelect).not.toHaveProperty("civCapCost");
    const [{ select: issueSelect }] = db.nationalIssue.findMany.mock.calls[0] as unknown as [
      { select: Record<string, boolean> },
    ];
    expect(issueSelect).not.toHaveProperty("appliedConsequences");
    expect(issueSelect).not.toHaveProperty("responseOptions");
  });
});

describe("intent.getTree", () => {
  it("gives the owner every intent, drafts and abandoned included", async () => {
    const db = makeDb();
    const tree = await intentCaller(owner(db)).getTree({ countryId: COUNTRY });
    expect(tree.allIntents.map((i) => i.id).sort()).toEqual(
      ["done", "draft", "in_force", "withdrawn"].sort()
    );
    expect(tree.allIntents.find((i) => i.id === "draft")?.changesJson).toContain("budget");
  });

  it("gives an owner who is not acting as the nation (Country.ownerUserId) every intent", async () => {
    const db = makeDb({ ownerUserId: "other_db" });
    const tree = await intentCaller(otherPlayer(db)).getTree({ countryId: COUNTRY });
    expect(tree.allIntents).toHaveLength(4);
  });

  it("gives admins every intent", async () => {
    const db = makeDb();
    const tree = await intentCaller(admin(db)).getTree({ countryId: COUNTRY });
    expect(tree.allIntents).toHaveLength(4);
  });

  it.each([
    ["another player", otherPlayer],
    ["a signed-out visitor", signedOut],
  ])("gives %s the redacted public record only", async (_who, ctxFor) => {
    const db = makeDb();
    const tree = await intentCaller(ctxFor(db)).getTree({ countryId: COUNTRY });

    expect(tree.allIntents.map((i) => i.id).sort()).toEqual(["done", "in_force"]);
    for (const intent of tree.allIntents) {
      expect(intent.changesJson).toBe("[]");
      expect(intent.civCapCost).toBeNull();
      expect(intent.cooldownUntil).toBeNull();
    }
    expect(tree.roots).toHaveLength(2);
  });

  it("never looks up a signed-out caller", async () => {
    const db = makeDb();
    await intentCaller(signedOut(db)).getTree({ countryId: COUNTRY });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.country.findUnique).not.toHaveBeenCalled();
  });
});

describe("nationalIssues.getHistory", () => {
  it("returns the owner's full history", async () => {
    const db = makeDb();
    const history = await issuesCaller(owner(db)).getHistory({ countryId: COUNTRY });
    expect(history.issues.map((i) => i.id)).toEqual(["resolved", "lapsed", "gone"]);
  });

  it("returns the history to admins", async () => {
    const db = makeDb();
    await expect(issuesCaller(admin(db)).getHistory({ countryId: COUNTRY })).resolves.toBeTruthy();
  });

  it("is FORBIDDEN for another player", async () => {
    const db = makeDb();
    await expect(
      issuesCaller(otherPlayer(db)).getHistory({ countryId: COUNTRY })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.nationalIssue.findMany).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    const db = makeDb();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(issuesCaller(signedOut(db)).getHistory({ countryId: COUNTRY })).rejects.toThrow(
      /Authentication required/
    );
    warn.mockRestore();
    expect(db.nationalIssue.findMany).not.toHaveBeenCalled();
  });
});
