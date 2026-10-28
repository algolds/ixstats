/**
 * A user asking to delete their account (Privacy 5.2): the request starts a 14-day grace (`User.deletionRequestedAt`),
 * cancellable until the account-erasure cron erases the account (server/orchestration/account-erasure.ts).
 * Confirmed by typing the Passport handle, or the Clerk username or email local part when there is none.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  confirmationMatches,
  erasesAt,
  requestedBefore,
  type ConfirmationNames,
} from "~/lib/account/deletion";

type DeletionDb = Pick<PrismaClient, "user">;

/** The Clerk username and primary email of an account, for users without a handle. */
export type LoadClerkNames = (
  clerkUserId: string
) => Promise<Pick<ConfirmationNames, "username" | "email">>;

export interface AccountDeletionState {
  requestedAt: Date | null;
  erasesAt: Date | null;
}

const stateOf = (requestedAt: Date | null): AccountDeletionState => ({
  requestedAt,
  erasesAt: erasesAt(requestedAt),
});

const loadClerkNames: LoadClerkNames = async (clerkUserId) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { username: null, email: null };
  const { createClerkClient } = await import("@clerk/backend");
  const clerkUser = await createClerkClient({ secretKey }).users.getUser(clerkUserId);
  return {
    username: clerkUser.username,
    email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
  };
};

/** Staff playing as the user may neither ask for nor cancel a deletion: only the account holder decides. */
function refuseImpersonation(impersonating: boolean): void {
  if (impersonating)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the account holder can delete their account or keep it.",
    });
}

export async function getAccountDeletion(
  db: DeletionDb,
  userId: string
): Promise<AccountDeletionState> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { deletionRequestedAt: true },
  });
  return stateOf(user?.deletionRequestedAt ?? null);
}

/**
 * Start the grace, once the typed name matches. A request already pending keeps its date (asking again never
 * moves the erasure later). Staff playing as the user are refused: only the account holder may ask.
 */
export async function requestAccountDeletion(
  db: DeletionDb,
  input: {
    user: { id: string; clerkUserId: string };
    confirmHandle: string;
    impersonating: boolean;
  },
  clerkNames: LoadClerkNames = loadClerkNames
): Promise<AccountDeletionState> {
  refuseImpersonation(input.impersonating);
  const row = await db.user.findUnique({
    where: { id: input.user.id },
    select: { handle: true, deletionRequestedAt: true },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "No account found." });
  const names: ConfirmationNames = row.handle
    ? { handle: row.handle, username: null, email: null }
    : { handle: null, ...(await clerkNames(input.user.clerkUserId)) };
  if (!confirmationMatches(input.confirmHandle, names))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: row.handle
        ? "Type your handle to confirm."
        : "Type your username, or your email address before the @, to confirm.",
    });
  if (row.deletionRequestedAt) return stateOf(row.deletionRequestedAt);
  const requestedAt = new Date();
  await db.user.update({
    where: { id: input.user.id },
    data: { deletionRequestedAt: requestedAt },
  });
  return stateOf(requestedAt);
}

/**
 * Clear a pending request while it is still in its grace. Once the grace has passed the account-erasure cron may
 * already be erasing it (the Clerk user deleted first), so a late cancel is refused rather than racing it.
 */
export async function cancelAccountDeletion(
  db: DeletionDb,
  input: { userId: string; impersonating: boolean },
  now: Date = new Date()
): Promise<AccountDeletionState> {
  refuseImpersonation(input.impersonating);
  const { count } = await db.user.updateMany({
    where: {
      id: input.userId,
      OR: [{ deletionRequestedAt: null }, { deletionRequestedAt: { gt: requestedBefore(now) } }],
    },
    data: { deletionRequestedAt: null },
  });
  if (count === 0)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Your account is already being deleted.",
    });
  return stateOf(null);
}
