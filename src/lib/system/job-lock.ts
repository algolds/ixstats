import type { PrismaClient } from "@prisma/client";

type JobLockOutcome<T> = { ran: true; result: T } | { ran: false };
interface JobLockOptions {
  timeoutMs?: number;
}

const LOCK_NAMESPACE = "ixstats:job:";
const DEFAULT_TIMEOUT_MS = 30 * 60_000;
const LOCK_MAX_WAIT_MS = 10_000;

/**
 * Single-flight a scheduled job across processes.
 * Holds a transaction-scoped Postgres advisory lock (pg_try_advisory_xact_lock) in a
 * dedicated interactive transaction for the job's duration; it is released on commit,
 * rollback, timeout or connection loss. Session locks are NOT used: Prisma's pool may
 * unlock on a different connection and leak the lock.
 * `fn` must use the normal client, not the lock transaction. Never nest two calls with
 * the same name — the inner one would always report "locked".
 */
export async function withJobLock<T>(
  db: PrismaClient,
  name: string,
  fn: () => Promise<T>,
  opts: JobLockOptions = {}
): Promise<JobLockOutcome<T>> {
  const key = `${LOCK_NAMESPACE}${name}`;
  return db.$transaction(
    async (tx): Promise<JobLockOutcome<T>> => {
      const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`;
      if (rows[0]?.locked !== true) return { ran: false };
      return { ran: true, result: await fn() };
    },
    { maxWait: LOCK_MAX_WAIT_MS, timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS }
  );
}
