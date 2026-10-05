import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { PrismaClient } from "@prisma/client";

type JobLockOutcome<T> = { ran: true; result: T } | { ran: false };
interface JobLockOptions {
  /** How long the lease lasts. Keep it above the job's worst-case run time. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30 * 60_000;

/**
 * Single-flight a scheduled job across processes with a lease row (`job_leases`).
 *
 * Acquiring is one atomic upsert that only takes the row when it is absent or its lease has
 * expired; the run then holds nothing open on the database (the earlier advisory-lock version
 * kept an interactive transaction, and a pooled connection, open for the whole run, up to an
 * hour for db-backup). The lease is deleted when `fn` settles, and a crashed holder's lease
 * simply expires after `timeoutMs`. A run that outlives its lease can overlap the next one, so
 * keep `timeoutMs` above the job's worst case.
 */
export async function withJobLock<T>(
  db: PrismaClient,
  name: string,
  fn: () => Promise<T>,
  opts: JobLockOptions = {}
): Promise<JobLockOutcome<T>> {
  const holder = `${hostname()}:${process.pid}:${randomUUID()}`;
  const leaseSeconds = (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000;
  const rows = await db.$queryRaw<Array<{ holder: string }>>`
    INSERT INTO "job_leases" ("name", "holder", "acquiredAt", "expiresAt")
    VALUES (${name}, ${holder}, now(), now() + make_interval(secs => ${leaseSeconds}::double precision))
    ON CONFLICT ("name") DO UPDATE
      SET "holder" = EXCLUDED."holder",
          "acquiredAt" = EXCLUDED."acquiredAt",
          "expiresAt" = EXCLUDED."expiresAt"
      WHERE "job_leases"."expiresAt" < now()
    RETURNING "holder"`;
  if (rows[0]?.holder !== holder) return { ran: false };

  try {
    return { ran: true, result: await fn() };
  } finally {
    await db.$executeRaw`DELETE FROM "job_leases" WHERE "name" = ${name} AND "holder" = ${holder}`.catch(
      (error: unknown) => console.warn(`[job-lock] Failed to release lease "${name}":`, error)
    );
  }
}
