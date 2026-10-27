/**
 * Recruits: the distinct players who joined a realm by someone's invite link (approved claims naming them as
 * inviter). Counted per player, not per claim, so abandoning and re-claiming through the same link, or one
 * player claiming in several realms, counts once. Shared by the passport's "Recruited N" and the recruiter
 * achievements. Server only (takes the Prisma client).
 */
import type { PrismaClient } from "@prisma/client";

/** Distinct claimants of approved claims whose inviter is `inviterUserId` (User.id). */
export async function countRecruits(
  db: Pick<PrismaClient, "realmClaim">,
  inviterUserId: string
): Promise<number> {
  const recruits = await db.realmClaim.findMany({
    where: { invitedByUserId: inviterUserId, status: "approved" },
    distinct: ["userId"],
    select: { userId: true },
  });
  return recruits.length;
}
