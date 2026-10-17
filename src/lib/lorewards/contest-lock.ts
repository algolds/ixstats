import type { Prisma } from "@prisma/client";

/** Arbitrary constant; identifies these locks in pg_locks (the card serial locks use 7331). */
const CONTEST_PLACE_LOCK_NAMESPACE = 7332;

/**
 * Must be called inside `$transaction`. Serializes whatever pays, mints or grants one place of one contest
 * (`contestPlaceKey`) for the life of the transaction (the advisory lock is released at commit or rollback), so
 * two overlapping syncs act on that place at most once.
 *
 * `$executeRaw`, not `$queryRaw`: Prisma cannot deserialize the `void` column `pg_advisory_xact_lock` returns.
 */
export async function lockContestPlace(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CONTEST_PLACE_LOCK_NAMESPACE}::int, hashtext(${key}))`;
}
