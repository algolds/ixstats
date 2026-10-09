import type { PrismaClient } from "@prisma/client";

const DEFAULT_STASH_NAME = "My Stash";
/** Used when the user already has a non-default stash called "My Stash" (`@@unique([userId, name])`). */
const FALLBACK_DEFAULT_STASH_NAME = "My Stash (default)";

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

/**
 * The user's default stash (looked up across all their ids), created under `userId` on first use.
 * Two first stashes at once, or a non-default stash already named "My Stash", make the create hit the
 * unique constraint: re-read the winner's row, or create the default under another name.
 */
export async function getOrCreateDefaultStash(
  db: Pick<PrismaClient, "stash">,
  userIds: string[],
  userId: string
) {
  const findDefault = () =>
    db.stash.findFirst({
      where: { userId: { in: userIds }, isDefault: true },
      orderBy: { createdAt: "asc" },
    });

  const existing = await findDefault();
  if (existing) return existing;

  try {
    return await db.stash.create({
      data: { userId, name: DEFAULT_STASH_NAME, color: "#3b82f6", isDefault: true },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  const winner = await findDefault();
  if (winner) return winner;
  return db.stash.create({
    data: { userId, name: FALLBACK_DEFAULT_STASH_NAME, color: "#3b82f6", isDefault: true },
  });
}
