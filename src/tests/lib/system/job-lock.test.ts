/**
 * withJobLock: cross-process single-flight for scheduled jobs via a lease row (job_leases).
 * These tests fake `$queryRaw` / `$executeRaw` and check the contract; the SQL itself was
 * exercised against PostgreSQL (one of eight concurrent runs executes, expired leases are
 * taken over, a throwing job still releases).
 */

import type { PrismaClient } from "@prisma/client";
import { withJobLock } from "~/lib/system/job-lock";

/** A fake table: the upsert returns our holder only when the lease is free. */
function makeDb(initiallyHeldBy?: string) {
  const leases = new Map<string, string>();
  if (initiallyHeldBy) leases.set("passive-income", initiallyHeldBy);
  const $queryRaw = jest.fn(
    async (_strings: TemplateStringsArray, name: string, holder: string) => {
      if (!leases.has(name)) leases.set(name, holder);
      return [{ holder: leases.get(name)! }];
    }
  );
  const $executeRaw = jest.fn(
    async (_strings: TemplateStringsArray, name: string, holder: string) => {
      if (leases.get(name) === holder) leases.delete(name);
      return 1;
    }
  );
  return { db: { $queryRaw, $executeRaw } as unknown as PrismaClient, leases, $queryRaw };
}

describe("withJobLock", () => {
  it("runs fn, returns its result and releases the lease", async () => {
    const { db, leases } = makeDb();
    const fn = jest.fn().mockResolvedValue(42);

    await expect(withJobLock(db, "passive-income", fn)).resolves.toEqual({ ran: true, result: 42 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(leases.size).toBe(0);
  });

  it("skips fn while another holder's lease is live", async () => {
    const { db, leases } = makeDb("other-runner");
    const fn = jest.fn();

    await expect(withJobLock(db, "passive-income", fn)).resolves.toEqual({ ran: false });
    expect(fn).not.toHaveBeenCalled();
    expect(leases.get("passive-income")).toBe("other-runner");
  });

  it("two concurrent runs → exactly one executes", async () => {
    const { db } = makeDb();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const fn = jest.fn(async () => {
      await gate;
      return "done";
    });

    const first = withJobLock(db, "card-value", fn);
    const second = withJobLock(db, "card-value", fn);
    await expect(second).resolves.toEqual({ ran: false });
    release();
    await expect(first).resolves.toEqual({ ran: true, result: "done" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("releases the lease when fn throws, and rethrows", async () => {
    const { db, leases } = makeDb();
    await expect(
      withJobLock(db, "passive-income", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(leases.size).toBe(0);
  });

  it("passes the lease length in seconds", async () => {
    const { db, $queryRaw } = makeDb();
    await withJobLock(db, "db-backup", async () => 1, { timeoutMs: 60 * 60_000 });
    expect($queryRaw.mock.calls[0]![3]).toBe(3600);
  });
});
