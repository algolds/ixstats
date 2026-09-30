/**
 * @jest-environment node
 */
import type { PrismaClient, ScheduledChange } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notifications/api";
import {
  applyDueScheduledChanges,
  applyScheduledChangeForUser,
} from "~/server/modules/scheduled-changes/service";

jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn() },
}));

const NOW = new Date("2026-09-25T12:00:00.000Z");
const PAST = new Date("2026-09-24T12:00:00.000Z");
const FUTURE = new Date("2026-09-26T12:00:00.000Z");
const FIXED_IXTIME_MS = Date.UTC(2042, 5, 15);

interface EffectRow {
  countryId: string | null;
  ixTimeTimestamp: Date;
  inputType: string;
  value: number;
  description: string | null;
  duration: number | null;
  isActive: boolean;
  createdBy: string | null;
}

interface ChangeWhere {
  id?: string;
  status?: string;
  scheduledFor?: { lte?: Date };
}

function makeChange(overrides: Partial<ScheduledChange> = {}): ScheduledChange {
  return {
    id: "change_1",
    userId: "user_a",
    countryId: "country_1",
    changeType: "next_day",
    impactLevel: "medium",
    fieldPath: "currentPopulation",
    oldValue: "1000000",
    newValue: "1100000",
    scheduledFor: PAST,
    appliedAt: null,
    status: "pending",
    warnings: null,
    metadata: null,
    createdAt: PAST,
    updatedAt: PAST,
    ...overrides,
  };
}

function matches(row: ScheduledChange, where: ChangeWhere): boolean {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.status !== undefined && row.status !== where.status) return false;
  if (where.scheduledFor?.lte !== undefined && row.scheduledFor > where.scheduledFor.lte) {
    return false;
  }
  return true;
}

/**
 * In-memory Prisma stand-in. Rows/effects are replaced immutably so `$transaction` can
 * roll back by restoring the previous references when the callback throws.
 */
function createMockDb(seed: ScheduledChange[]) {
  let rows = seed.map((r) => ({ ...r }));
  let effects: EffectRow[] = [];
  let failEffectCreate = false;

  const scheduledChange = {
    findUnique: jest.fn(
      async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null
    ),
    findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error(`No ScheduledChange ${where.id}`);
      return row;
    }),
    findMany: jest.fn(async ({ where }: { where: ChangeWhere }) =>
      rows.filter((r) => matches(r, where))
    ),
    updateMany: jest.fn(
      async ({ where, data }: { where: ChangeWhere; data: Partial<ScheduledChange> }) => {
        let count = 0;
        rows = rows.map((r) => {
          if (!matches(r, where)) return r;
          count += 1;
          return { ...r, ...data };
        });
        return { count };
      }
    ),
  };
  const storytellerEffect = {
    create: jest.fn(async ({ data }: { data: EffectRow }) => {
      if (failEffectCreate) throw new Error("connection reset");
      effects = [...effects, data];
      return { id: `effect_${effects.length}`, ...data };
    }),
  };
  const tx = { scheduledChange, storytellerEffect };
  const $transaction = jest.fn(async <T>(cb: (t: typeof tx) => Promise<T>): Promise<T> => {
    const rowsSnapshot = rows;
    const effectsSnapshot = effects;
    try {
      return await cb(tx);
    } catch (error) {
      rows = rowsSnapshot;
      effects = effectsSnapshot;
      throw error;
    }
  });
  const client = { ...tx, $transaction };

  return {
    client,
    db: client as never as PrismaClient,
    rows: () => rows,
    effects: () => effects,
    failEffectCreate: () => {
      failEffectCreate = true;
    },
  };
}

describe("scheduled-changes service (plan 329)", () => {
  beforeEach(() => {
    jest.spyOn(IxTime, "getCurrentIxTime").mockReturnValue(FIXED_IXTIME_MS);
    jest.mocked(notificationAPI.create).mockReset().mockResolvedValue("notification_1");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("applyScheduledChangeForUser", () => {
    it("owner applies a due change: applied, one correctly dated relative-change effect", async () => {
      const mock = createMockDb([makeChange()]);

      const applied = await applyScheduledChangeForUser(mock.db, {
        changeId: "change_1",
        userId: "user_a",
        now: NOW,
      });

      expect(applied.status).toBe("applied");
      expect(applied.appliedAt).toEqual(NOW);
      expect(mock.rows()[0]?.status).toBe("applied");

      const effects = mock.effects();
      expect(effects).toHaveLength(1);
      const effect = effects[0]!;
      expect(effect.ixTimeTimestamp.getTime()).toBe(FIXED_IXTIME_MS);
      expect(effect.ixTimeTimestamp.getUTCFullYear()).toBeLessThan(3000);
      expect(effect.value).toBeCloseTo(0.1, 10);
      expect(effect.inputType).toBe("population_adjustment");
      expect(effect.duration).toBe(2);
      expect(effect.isActive).toBe(true);
      expect(effect.countryId).toBe("country_1");
      expect(effect.createdBy).toBe("user_a");
      expect(notificationAPI.create).toHaveBeenCalledTimes(1);
    });

    it("non-owner is FORBIDDEN: no effect, row still pending", async () => {
      const mock = createMockDb([makeChange()]);

      await expect(
        applyScheduledChangeForUser(mock.db, { changeId: "change_1", userId: "user_b", now: NOW })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(mock.effects()).toHaveLength(0);
      expect(mock.rows()[0]?.status).toBe("pending");
      expect(mock.client.$transaction).not.toHaveBeenCalled();
      expect(notificationAPI.create).not.toHaveBeenCalled();
    });

    it("not yet due is BAD_REQUEST: no effect", async () => {
      const mock = createMockDb([makeChange({ scheduledFor: FUTURE })]);

      await expect(
        applyScheduledChangeForUser(mock.db, { changeId: "change_1", userId: "user_a", now: NOW })
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Change is not due yet" });

      expect(mock.effects()).toHaveLength(0);
      expect(mock.rows()[0]?.status).toBe("pending");
    });

    it("missing change is NOT_FOUND; already applied is BAD_REQUEST", async () => {
      const mock = createMockDb([makeChange({ status: "applied", appliedAt: PAST })]);

      await expect(
        applyScheduledChangeForUser(mock.db, { changeId: "nope", userId: "user_a", now: NOW })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        applyScheduledChangeForUser(mock.db, { changeId: "change_1", userId: "user_a", now: NOW })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(mock.effects()).toHaveLength(0);
    });

    it("race: two concurrent owner applies produce exactly one effect and one CONFLICT", async () => {
      const mock = createMockDb([makeChange()]);
      const args = { changeId: "change_1", userId: "user_a", now: NOW };

      const results = await Promise.allSettled([
        applyScheduledChangeForUser(mock.db, args),
        applyScheduledChangeForUser(mock.db, args),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const reason = rejected[0]!.reason;
      expect(reason).toBeInstanceOf(TRPCError);
      expect(["CONFLICT", "BAD_REQUEST"]).toContain((reason as TRPCError).code);
      expect(mock.effects()).toHaveLength(1);
      expect(mock.rows()[0]?.status).toBe("applied");
      expect(notificationAPI.create).toHaveBeenCalledTimes(1);
    });

    it("zero oldValue is a deterministic failure: BAD_REQUEST and row marked failed", async () => {
      const mock = createMockDb([makeChange({ oldValue: "0", newValue: "5" })]);

      await expect(
        applyScheduledChangeForUser(mock.db, { changeId: "change_1", userId: "user_a", now: NOW })
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/oldValue is 0/) });

      expect(mock.rows()[0]?.status).toBe("failed");
      expect(mock.effects()).toHaveLength(0);
      expect(mock.client.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("applyDueScheduledChanges", () => {
    it("invalid field path: row becomes failed, reported once, not retried on the next run", async () => {
      const mock = createMockDb([makeChange({ fieldPath: "name", oldValue: '"A"', newValue: '"B"' })]);

      const first = await applyDueScheduledChanges({ db: mock.db, now: NOW });
      expect(first.appliedCount).toBe(0);
      expect(first.failedCount).toBe(1);
      expect(first.errors).toEqual([
        { changeId: "change_1", error: expect.stringContaining('Invalid field path: "name"') },
      ]);
      expect(mock.rows()[0]?.status).toBe("failed");
      expect(mock.effects()).toHaveLength(0);

      const second = await applyDueScheduledChanges({ db: mock.db, now: NOW });
      expect(second.failedCount).toBe(0);
      expect(second.errors).toHaveLength(0);
      expect(mock.client.scheduledChange.updateMany).toHaveBeenCalledTimes(1);
    });

    it("applies 2 due changes, leaves a future and a cancelled one untouched", async () => {
      const mock = createMockDb([
        makeChange({ id: "due_1", countryId: "country_1" }),
        makeChange({
          id: "due_2",
          countryId: "country_2",
          userId: "user_b",
          fieldPath: "inflationRate",
          oldValue: "0.04",
          newValue: "0.03",
          impactLevel: "high",
        }),
        makeChange({ id: "future_1", scheduledFor: FUTURE }),
        makeChange({ id: "cancelled_1", status: "cancelled" }),
      ]);

      const result = await applyDueScheduledChanges({ db: mock.db, now: NOW });

      expect(result).toMatchObject({
        appliedCount: 2,
        failedCount: 0,
        skippedCount: 0,
        errors: [],
        appliedChanges: ["due_1", "due_2"],
      });
      expect([...result.affectedCountries].sort()).toEqual(["country_1", "country_2"]);
      expect(mock.effects()).toHaveLength(2);
      expect(mock.effects()[1]?.value).toBeCloseTo(-0.25, 10);
      expect(mock.effects()[1]?.duration).toBe(4);

      const byId = new Map(mock.rows().map((r) => [r.id, r]));
      expect(byId.get("due_1")?.status).toBe("applied");
      expect(byId.get("due_2")?.status).toBe("applied");
      expect(byId.get("future_1")?.status).toBe("pending");
      expect(byId.get("future_1")?.appliedAt).toBeNull();
      expect(byId.get("cancelled_1")?.status).toBe("cancelled");
      expect(notificationAPI.create).toHaveBeenCalledTimes(2);
    });

    it("effect creation failure rolls back: row stays pending, one error, no notification", async () => {
      const mock = createMockDb([makeChange()]);
      mock.failEffectCreate();

      const result = await applyDueScheduledChanges({ db: mock.db, now: NOW });

      expect(result.appliedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toEqual([{ changeId: "change_1", error: "connection reset" }]);
      expect(mock.rows()[0]?.status).toBe("pending");
      expect(mock.rows()[0]?.appliedAt).toBeNull();
      expect(mock.effects()).toHaveLength(0);
      expect(notificationAPI.create).not.toHaveBeenCalled();
    });

    it("counts a row claimed by someone else between read and claim as skipped", async () => {
      const mock = createMockDb([makeChange({ status: "applied", appliedAt: PAST })]);
      mock.client.scheduledChange.findMany.mockResolvedValueOnce([makeChange()]);

      const result = await applyDueScheduledChanges({ db: mock.db, now: NOW });

      expect(result).toMatchObject({ appliedCount: 0, skippedCount: 1, failedCount: 0, errors: [] });
      expect(mock.effects()).toHaveLength(0);
      expect(notificationAPI.create).not.toHaveBeenCalled();
    });
  });
});
