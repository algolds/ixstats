import type { PrismaClient } from "@prisma/client";

export type RecipientRef = { countryId: string } | { handle: string };

/**
 * Who a `/messages?country=` or `?user=` link means: the nation's owner, or the player with that
 * Passport handle (stored lowercase). Null when there is none. Starting the conversation still goes
 * through `createConversation`, which applies blocks and direct-message settings.
 */
export async function resolveRecipient(
  db: Pick<PrismaClient, "country" | "user">,
  ref: RecipientRef
): Promise<{ clerkUserId: string } | null> {
  if ("countryId" in ref) {
    const country = await db.country.findUnique({
      where: { id: ref.countryId },
      select: { owner: { select: { clerkUserId: true } } },
    });
    return country?.owner ? { clerkUserId: country.owner.clerkUserId } : null;
  }
  const user = await db.user.findUnique({
    where: { handle: ref.handle.trim().toLowerCase() },
    select: { clerkUserId: true },
  });
  return user;
}
