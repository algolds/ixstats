/**
 * The contest reads and the contest-place lock that the payout, the trophy mint and the trophy grant share.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { contestEntriesWhere, type ContestEntry } from "./contest-identity";

/** Arbitrary constant; identifies these locks in pg_locks (the card serial locks use 7331). */
const CONTEST_PLACE_LOCK_NAMESPACE = 7332;

/** Entries per page: an explicit `take` and `cursor` keep `~/server/db`'s 1,000-row findMany cap off. */
const PAGE = 500;

/** The entry columns a contest place is paid, minted and granted from. */
export const CONTEST_ENTRY_SELECT = {
  id: true,
  type: true,
  date: true,
  dateStart: true,
  dateEnd: true,
  winnerUser: true,
  winnerPage: true,
  runnerUpUser: true,
  runnerUpPage: true,
} as const;

export type StoredContestEntry = Prisma.LorewardEntryGetPayload<{
  select: typeof CONTEST_ENTRY_SELECT;
}>;

/** Every entry `where` selects, read in pages of 500 by id so that none is dropped. */
export async function findContestEntries(
  db: Pick<PrismaClient, "lorewardEntry">,
  where: Prisma.LorewardEntryWhereInput
): Promise<StoredContestEntry[]> {
  const rows: StoredContestEntry[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await db.lorewardEntry.findMany({
      where,
      select: CONTEST_ENTRY_SELECT,
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    rows.push(...page);
    const last = page.at(-1);
    if (page.length < PAGE || !last) return rows;
    cursor = last.id;
  }
}

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

/**
 * The ids of every entry of `entry`'s contest, whatever its status, read through `tx` after the place's lock: the
 * paid, minted and settled checks read these, never the list a run read before it waited for the lock.
 */
export async function contestEntryIds(
  tx: Prisma.TransactionClient,
  entry: Pick<ContestEntry, "type" | "date" | "dateStart">
): Promise<string[]> {
  const rows = await tx.lorewardEntry.findMany({
    where: contestEntriesWhere(entry),
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
