/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see cards-archetypes-admin-auth.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
//
// intent.commit's draft-upgrade path (input.intentId) must only upgrade the caller's own country's
// draft: another country's intent id, or an already-active one (which would re-apply the package
// without a new row counting against the weekly cap), is rejected. intent.updateStatus only allows
// forward transitions, so a finished directive cannot be re-activated.
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
  generateIntentSummationDraft: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { CountryEventSpine } from "~/lib/activity";
import { IxTime } from "~/lib/ixtime";

const recordCountryEvent = CountryEventSpine.recordCountryEvent as unknown as jest.Mock;

type IntentRow = {
  id: string;
  countryId: string;
  goal: string;
  tier: string;
  status: string;
  createdIxTime: number;
  [key: string]: unknown;
};

const GOAL = "Crack down on urban crime";

/** A db whose intent table is an in-memory array, so the weekly-cap count reflects every write. */
function makeDb(seed: IntentRow[]) {
  const rows = seed.map((r) => ({ ...r }));
  let nextId = 1;
  const matches = (row: IntentRow, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => row[k] === v);

  const db = {
    rows,
    intent: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        return row ? { ...row } : null;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        return { ...row };
      }),
      // cooldownStatus: { countryId, status: { in }, createdIxTime: { gte } }
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: {
            countryId: string;
            status: { in: string[] };
            createdIxTime: { gte: number };
          };
        }) =>
          rows
            .filter(
              (r) =>
                r.countryId === where.countryId &&
                where.status.in.includes(r.status) &&
                r.createdIxTime >= where.createdIxTime.gte
            )
            .sort((a, b) => a.createdIxTime - b.createdIxTime)
            .map((r) => ({ createdIxTime: r.createdIxTime }))
      ),
      create: jest.fn(async ({ data }: { data: Omit<IntentRow, "id"> }) => {
        const row = { id: `new_${nextId++}`, ...data } as IntentRow;
        rows.push(row);
        return { ...row };
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = rows.find((r) => r.id === where.id);
          if (!row) throw new Error("not found");
          Object.assign(row, data);
          return { ...row };
        }
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const hit = rows.filter((r) => matches(r, where));
          for (const row of hit) Object.assign(row, data);
          return { count: hit.length };
        }
      ),
    },
    country: { findUnique: jest.fn(async () => ({ name: "Testland" })) },
    storytellerEffect: { create: jest.fn(async () => ({})) },
    budgetAllocation: { findFirst: jest.fn(async () => null), update: jest.fn() },
    nationalIssue: { findFirst: jest.fn(async () => null) },
  };
  return db;
}

const ctxFor = (db: ReturnType<typeof makeDb>) =>
  createMockRouterContext({
    db,
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", countryId: "c1", role: { name: "user", level: 100 } },
  }) as never;

const draft = (id: string, countryId: string): IntentRow => ({
  id,
  countryId,
  goal: GOAL,
  tier: "proposed",
  status: "proposed",
  createdIxTime: IxTime.getCurrentIxTime(),
});

describe("intent.commit draft upgrade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordCountryEvent.mockResolvedValue([]);
  });

  it("upgrades the caller's own draft and applies the package once", async () => {
    const db = makeDb([draft("d1", "c1")]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));

    const res = await caller.commit({
      countryId: "c1",
      goal: GOAL,
      tier: "measured",
      intentId: "d1",
    });

    expect(res.intent).toMatchObject({ id: "d1", countryId: "c1", status: "active" });
    expect(recordCountryEvent).toHaveBeenCalledTimes(1);
    expect(db.rows.find((r) => r.id === "d1")?.status).toBe("active");
  });

  it("rejects another country's intent id and leaves that row untouched", async () => {
    const db = makeDb([draft("d_other", "c2")]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));

    await expect(
      caller.commit({ countryId: "c1", goal: GOAL, tier: "extreme", intentId: "d_other" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.rows.find((r) => r.id === "d_other")).toMatchObject({
      countryId: "c2",
      status: "proposed",
      tier: "proposed",
    });
    expect(db.intent.updateMany).not.toHaveBeenCalled();
    expect(recordCountryEvent).not.toHaveBeenCalled();
  });

  it("rejects an unknown intent id", async () => {
    const db = makeDb([]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));

    await expect(
      caller.commit({ countryId: "c1", goal: GOAL, tier: "measured", intentId: "missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(recordCountryEvent).not.toHaveBeenCalled();
  });

  it("rejects an already-active intent id, so the package cannot be re-applied under the cap", async () => {
    const db = makeDb([draft("d1", "c1")]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));

    await caller.commit({ countryId: "c1", goal: GOAL, tier: "measured", intentId: "d1" });
    expect(recordCountryEvent).toHaveBeenCalledTimes(1);

    // The week's slot count is still 1/3, so only the draft check stops the replay.
    await expect(caller.getStatus({ countryId: "c1" })).resolves.toMatchObject({
      usedThisWeek: 1,
      canCommit: true,
    });
    for (let i = 0; i < 3; i++) {
      await expect(
        caller.commit({ countryId: "c1", goal: GOAL, tier: "extreme", intentId: "d1" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }

    expect(recordCountryEvent).toHaveBeenCalledTimes(1);
    expect(db.rows.find((r) => r.id === "d1")?.tier).toBe("measured");
  });

  it("rejects a completed or abandoned intent id", async () => {
    const db = makeDb([
      { ...draft("done", "c1"), status: "completed", tier: "measured" },
      { ...draft("gone", "c1"), status: "abandoned", tier: "measured" },
    ]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));

    for (const intentId of ["done", "gone"]) {
      await expect(
        caller.commit({ countryId: "c1", goal: GOAL, tier: "measured", intentId })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(recordCountryEvent).not.toHaveBeenCalled();
  });

  it("rejects the upgrade if the draft stopped being a draft after the pre-check", async () => {
    const db = makeDb([draft("d1", "c1")]);
    // A concurrent commit wins the row between the pre-check and the conditional write.
    db.intent.updateMany.mockResolvedValueOnce({ count: 0 });
    const caller = createCallerFactory(intentRouter)(ctxFor(db));

    await expect(
      caller.commit({ countryId: "c1", goal: GOAL, tier: "measured", intentId: "d1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(recordCountryEvent).not.toHaveBeenCalled();
  });
});

describe("intent.updateStatus transitions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const row = (status: string) => ({ ...draft("i1", "c1"), status, tier: "measured" });

  it.each([
    ["proposed", "abandoned"],
    ["active", "completed"],
    ["active", "abandoned"],
  ])("allows %s → %s", async (from, to) => {
    const db = makeDb([row(from)]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));

    await caller.updateStatus({ id: "i1", status: to as "completed" | "abandoned" });
    expect(db.rows[0]!.status).toBe(to);
  });

  it.each([
    ["abandoned", "active"],
    ["completed", "active"],
    ["completed", "abandoned"],
    ["abandoned", "completed"],
    ["proposed", "active"],
    ["proposed", "completed"],
    ["active", "proposed"],
    ["active", "active"],
  ])("rejects %s → %s", async (from, to) => {
    const db = makeDb([row(from)]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));

    await expect(
      caller.updateStatus({
        id: "i1",
        status: to as "proposed" | "active" | "completed" | "abandoned",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.rows[0]!.status).toBe(from);
    expect(db.intent.update).not.toHaveBeenCalled();
  });
});
