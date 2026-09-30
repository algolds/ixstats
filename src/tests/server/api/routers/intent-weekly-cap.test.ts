/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see cards-archetypes-admin-auth.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
//
// The weekly directive cap (3 per IxTime week) counts every directive committed in the window,
// whatever its status now: abandoning one releases its CivCap but not its slot, so
// declare → abandon → redeclare cannot exceed the cap. Drafts (tier "proposed") use no slot.
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
  CountryEventSpine: { recordCountryEvent: jest.fn(async () => []) },
}));
jest.mock("~/lib/intent/resistance", () => ({
  __esModule: true,
  spawnIntentResistance: jest.fn(),
}));
jest.mock("~/lib/intent/intent-summation", () => ({
  __esModule: true,
  generateIntentSummationDraft: jest.fn(),
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { createMockRouterContext } from "~/tests/helpers/router-context";

type Row = Record<string, unknown> & { id: string };
type Filter = { in?: unknown[]; not?: unknown; gte?: number };

/** Just enough of Prisma's `where` for the intent router: equality, `in`, `not`, `gte`. */
function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond === null || typeof cond !== "object") return value === cond;
    const f = cond as Filter;
    if (f.in && !f.in.includes(value)) return false;
    if ("not" in f && value === f.not) return false;
    if (f.gte != null && !(typeof value === "number" && value >= f.gte)) return false;
    return true;
  });
}

/** An in-memory `intent` table so commit, updateStatus and getStatus share state. */
function makeDb() {
  const rows: Row[] = [];
  let nextId = 1;
  return {
    rows,
    intent: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => matches(r, where))
      ),
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `intent_${nextId++}`, ...data };
        rows.push(row);
        return row;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = rows.find((r) => r.id === where.id)!;
          Object.assign(row, data);
          return row;
        }
      ),
    },
    nationalIssue: { findFirst: jest.fn(async () => null) },
    country: { findUnique: jest.fn(async () => ({ name: "Testland" })) },
    storytellerEffect: { create: jest.fn(async () => ({})) },
    budgetAllocation: { findFirst: jest.fn(async () => null), update: jest.fn() },
  };
}

const callerFor = (db: ReturnType<typeof makeDb>) =>
  createCallerFactory(intentRouter)(
    createMockRouterContext({
      db,
      auth: { userId: "user_1" },
      user: {
        id: "db1",
        clerkUserId: "user_1",
        countryId: "c1",
        role: { name: "user", level: 100 },
      },
    }) as never
  );

const declare = (caller: ReturnType<typeof callerFor>) =>
  caller.commit({ countryId: "c1", goal: "Crack down on urban crime", tier: "measured" });

describe("intent weekly cap", () => {
  it("keeps an abandoned directive's slot used for the rest of the week", async () => {
    const db = makeDb();
    const caller = callerFor(db);

    const { intent } = await declare(caller);
    expect((await caller.getStatus({ countryId: "c1" })).usedThisWeek).toBe(1);

    await caller.updateStatus({ id: intent.id, status: "abandoned" });

    const status = await caller.getStatus({ countryId: "c1" });
    expect(status.usedThisWeek).toBe(1);
    expect(status.canCommit).toBe(true);
  });

  it("blocks a fourth directive when one of the three was abandoned", async () => {
    const db = makeDb();
    const caller = callerFor(db);

    const first = await declare(caller);
    await caller.updateStatus({ id: first.intent.id, status: "abandoned" });
    await declare(caller);
    const third = await declare(caller);
    await caller.updateStatus({ id: third.intent.id, status: "completed" });

    const status = await caller.getStatus({ countryId: "c1" });
    expect(status).toMatchObject({ usedThisWeek: 3, cap: 3, canCommit: false });
    await expect(declare(caller)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(db.rows.filter((r) => r.tier !== "proposed")).toHaveLength(3);
  });

  it("does not count drafts that were never committed", async () => {
    const db = makeDb();
    const caller = callerFor(db);

    const draft = await caller.commit({
      countryId: "c1",
      goal: "Crack down on urban crime",
      tier: "proposed",
    });
    await caller.commit({ countryId: "c1", goal: "Build rail", tier: "proposed" });
    await caller.updateStatus({ id: draft.intent.id, status: "abandoned" });

    expect((await caller.getStatus({ countryId: "c1" })).usedThisWeek).toBe(0);
  });
});
