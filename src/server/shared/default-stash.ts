import type { PrismaClient } from "@prisma/client";

/** The user's default stash (looked up across all their ids), created under `userId` on first use. */
export async function getOrCreateDefaultStash(
  db: Pick<PrismaClient, "stash">,
  userIds: string[],
  userId: string
) {
  const existing = await db.stash.findFirst({
    where: { userId: { in: userIds }, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  return (
    existing ??
    db.stash.create({ data: { userId, name: "My Stash", color: "#3b82f6", isDefault: true } })
  );
}
