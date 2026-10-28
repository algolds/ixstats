/**
 * Erasing an account at the end of its deletion grace (Privacy 5.2). The User row is tombstoned, never deleted:
 * deleting it would cascade into other users' data (Company → their shareholdings, CardAuction → their bids,
 * LanguagePack → their forks) and BlurbResponse refuses it. Idempotent, in this order:
 *
 * 0. the request is read again: a cancelled or not yet due one is left alone (`not-due`);
 * 1. the Clerk user's sessions are revoked and the user deleted first, so `getOrCreateUser` can never recreate the
 *    account (a session token that still verifies meets Clerk's 404 there and gets no row);
 * 2. nations are released with their material purged at once, pending claims withdrawn, founded realms go to staff;
 * 3. open market items end by their cancel paths, then personal rows are erased;
 * 4. public content is anonymised to "a former member";
 * 5. the User row is tombstoned (`clerkUserId` = `erased:<id>`), keeping `deletionRequestedAt`;
 * 6. the user's log files go (before the transaction, so no crash leaves them behind a tombstone), then the
 *    cached tRPC context is dropped.
 *
 * Steps 3-5 share one transaction, which reads the request again and rolls back if it was cancelled meanwhile
 * (cancelAccountDeletion refuses once the request is due, so only a direct edit can). A failure before it leaves the
 * account due, so the next cron run resumes (a Clerk user already deleted reads as done).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ERASED_CLERK_ID_PREFIX,
  erasedClerkId,
  isDue,
  isErasedClerkId,
  requestedBefore,
} from "~/lib/account/deletion";
import { UserLogger } from "~/lib/logging/user-logger";
import { releaseNationsForErasure } from "~/server/modules/realms/realms.erasure";
import { returnFoundedRealmsToStaff } from "~/server/modules/realms/realms.transfer";
import { closeMarketItems } from "./account-erasure.market";
import {
  anonymiseRecords,
  eraseRecords,
  personasOf,
  tombstoneUser,
  type ErasureIds,
} from "./account-erasure.records";

/** The services an erasure calls outside the database (replaced in tests). */
export interface ErasureDeps {
  deleteClerkUser: (clerkUserId: string) => Promise<void>;
  deleteLogFiles: (clerkUserId: string) => Promise<number>;
  forgetContextUser: (clerkUserId: string) => Promise<void>;
}

export interface ErasureResult {
  userId: string;
  /** `not-due`: the request was cancelled or its grace has not passed; nothing changed. */
  outcome: "erased" | "already-erased" | "not-due";
  nationsReleased: number;
  realmsReturned: number;
  marketItemsEnded: number;
}

/** The transaction's deadline: a long-lived account has many rows to sweep. */
const ERASURE_TX_TIMEOUT_MS = 120_000;

const isNotFound = (error: Error) => (error as Error & { status?: number }).status === 404;

async function deleteClerkUser(clerkUserId: string): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey)
    throw new Error("CLERK_SECRET_KEY is not set: the Clerk account cannot be deleted");
  // @clerk/backend, not @clerk/nextjs: the cron runs outside Next.js.
  const { createClerkClient } = await import("@clerk/backend");
  const clerk = createClerkClient({ secretKey });
  await revokeSessions(clerk, clerkUserId);
  try {
    await clerk.users.deleteUser(clerkUserId);
  } catch (error) {
    if (!isNotFound(error as Error)) throw error;
  }
}

type ClerkClient = ReturnType<typeof import("@clerk/backend").createClerkClient>;

/** Best effort: ends the user's live sessions so no new session token is minted before the delete lands. */
async function revokeSessions(clerk: ClerkClient, clerkUserId: string): Promise<void> {
  try {
    const { data } = await clerk.sessions.getSessionList({ userId: clerkUserId, status: "active" });
    await Promise.all(data.map((session) => clerk.sessions.revokeSession(session.id)));
  } catch (error) {
    if (!isNotFound(error as Error))
      console.warn("[account-erasure] sessions not revoked:", (error as Error).message);
  }
}

/** The tRPC context cache lives in the web server; loaded lazily so the cron never imports Next.js at startup. */
async function forgetCachedContext(clerkUserId: string): Promise<void> {
  try {
    const { forgetContextUser } = await import("~/server/api/trpc/context");
    forgetContextUser(clerkUserId);
  } catch (error) {
    console.warn("[account-erasure] context cache not cleared:", (error as Error).message);
  }
}

export const defaultErasureDeps: ErasureDeps = {
  deleteClerkUser,
  deleteLogFiles: (clerkUserId) => UserLogger.deleteUserLogFiles(clerkUserId),
  forgetContextUser: forgetCachedContext,
};

const NOTHING_DONE = { nationsReleased: 0, realmsReturned: 0, marketItemsEnded: 0 };

/** Inside the erasing transaction: refuse (rolling every row back) if the request was cancelled meanwhile. */
async function assertStillDue(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const row = await tx.user.findUnique({
    where: { id: userId },
    select: { deletionRequestedAt: true },
  });
  if (!isDue(row?.deletionRequestedAt ?? null, now))
    throw new Error(`Account deletion of ${userId} was cancelled during the erasure`);
}

/** Erase the account `userId` (see the file comment); erasing an erased account does nothing. */
export async function eraseAccount(
  db: PrismaClient,
  userId: string,
  deps: ErasureDeps = defaultErasureDeps,
  now: Date = new Date()
): Promise<ErasureResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, clerkUserId: true, deletionRequestedAt: true },
  });
  if (!user) throw new Error(`No user ${userId}`);
  if (isErasedClerkId(user.clerkUserId))
    return { userId, outcome: "already-erased", ...NOTHING_DONE };
  if (!isDue(user.deletionRequestedAt, now)) return { userId, outcome: "not-due", ...NOTHING_DONE };
  const ids: ErasureIds = { userId, clerkId: user.clerkUserId, sentinel: erasedClerkId(userId) };

  await deps.deleteClerkUser(user.clerkUserId);
  const nations = await releaseNationsForErasure(db, user, now);
  const realmsReturned = await returnFoundedRealmsToStaff(db, user);
  const marketItemsEnded = await closeMarketItems(db, user, now);
  await deps.deleteLogFiles(user.clerkUserId);
  await db.$transaction(
    async (tx) => {
      await assertStillDue(tx, userId, now);
      const personas = await personasOf(tx, ids);
      await eraseRecords(tx, ids, personas);
      await anonymiseRecords(tx, ids, personas);
      await tombstoneUser(tx, ids);
    },
    { timeout: ERASURE_TX_TIMEOUT_MS }
  );
  await deps.forgetContextUser(user.clerkUserId);
  return {
    userId,
    outcome: "erased",
    nationsReleased: nations.released,
    realmsReturned,
    marketItemsEnded,
  };
}

/**
 * Erase every account whose deletion request is past the grace at `now`. One failure is logged and never stops the
 * rest; it stays due, so the next run tries again.
 */
export async function eraseDueAccounts(
  db: PrismaClient,
  now: Date,
  erase: (db: PrismaClient, userId: string) => Promise<ErasureResult> = eraseAccount
): Promise<{ due: number; erased: number; failed: string[] }> {
  const due = await db.user.findMany({
    where: {
      deletionRequestedAt: { lte: requestedBefore(now) },
      NOT: { clerkUserId: { startsWith: ERASED_CLERK_ID_PREFIX } },
    },
    select: { id: true },
  });
  let erased = 0;
  const failed: string[] = [];
  for (const { id } of due) {
    try {
      if ((await erase(db, id)).outcome === "erased") erased++;
    } catch (error) {
      failed.push(id);
      console.error(`[account-erasure] erasing ${id} failed:`, (error as Error).message);
    }
  }
  return { due: due.length, erased, failed };
}
