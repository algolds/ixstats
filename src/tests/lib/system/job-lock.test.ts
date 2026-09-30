/**
 * withJobLock (plan 328): cross-process single-flight for scheduled jobs.
 *
 * The lock is a transaction-scoped Postgres advisory lock taken inside a
 * dedicated interactive transaction; these tests fake `$transaction` and
 * `$queryRaw` and check the contract, not Postgres.
 */

import type { PrismaClient } from "@prisma/client";
import { withJobLock } from "~/lib/system/job-lock";

interface TxOptions {
  maxWait?: number;
  timeout?: number;
}

type LockRows = Array<{ locked: boolean }>;

function makeDb(lockRows: LockRows) {
  const tx = { $queryRaw: jest.fn().mockResolvedValue(lockRows) };
  const $transaction = jest.fn(async (cb: (t: typeof tx) => Promise<unknown>, _opts?: TxOptions) =>
    cb(tx)
  );
  return { db: { $transaction } as unknown as PrismaClient, tx, $transaction };
}

describe("withJobLock", () => {
  it("runs fn and returns its result when the lock is free", async () => {
    const { db, tx } = makeDb([{ locked: true }]);
    const fn = jest.fn().mockResolvedValue(42);

    const outcome = await withJobLock(db, "passive-income", fn);

    expect(outcome).toEqual({ ran: true, result: 42 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    // Tagged template: (strings, ...values) — the only value is the namespaced key.
    expect(tx.$queryRaw.mock.calls[0][1]).toBe("ixstats:job:passive-income");
  });

  it("skips fn when the lock is held", async () => {
    const { db } = makeDb([{ locked: false }]);
    const fn = jest.fn().mockResolvedValue(42);

    const outcome = await withJobLock(db, "passive-income", fn);

    expect(outcome).toEqual({ ran: false });
    expect(fn).not.toHaveBeenCalled();
  });

  it("two concurrent runs → exactly one executes", async () => {
    const held = new Set<string>();
    const $transaction = jest.fn(async (cb: (t: { $queryRaw: jest.Mock }) => Promise<unknown>) => {
      let acquired: string | null = null;
      const tx = {
        $queryRaw: jest.fn(async (_strings: TemplateStringsArray, key: string) => {
          const locked = !held.has(key);
          if (locked) {
            held.add(key);
            acquired = key;
          }
          return [{ locked }];
        }),
      };
      try {
        return await cb(tx);
      } finally {
        if (acquired) held.delete(acquired);
      }
    });
    const db = { $transaction } as unknown as PrismaClient;

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fn = jest.fn(async () => {
      await gate;
      return "done";
    });

    const first = withJobLock(db, "lorewards", fn);
    const second = withJobLock(db, "lorewards", fn);
    // Let the second call reach its lock probe before the first releases.
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();

    const outcomes = await Promise.all([first, second]);

    expect(outcomes.filter((o) => o.ran)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ran)).toHaveLength(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(held.size).toBe(0);
  });

  it("passes the timeout to $transaction", async () => {
    const { db, $transaction } = makeDb([{ locked: true }]);

    await withJobLock(db, "card-value", async () => null, { timeoutMs: 123 });

    const opts = $transaction.mock.calls[0]?.[1];
    expect(opts?.timeout).toBe(123);
    expect(opts?.maxWait).toBeDefined();
  });

  it("propagates fn errors", async () => {
    const { db } = makeDb([{ locked: true }]);
    const boom = new Error("job exploded");
    const fn = jest.fn().mockRejectedValue(boom);

    await expect(withJobLock(db, "trade-expiry", fn)).rejects.toBe(boom);
  });
});
