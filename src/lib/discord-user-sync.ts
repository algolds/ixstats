/**
 * IxnayID — Discord Account Linking Service
 *
 * Links IxStats users to their Discord accounts by extracting the
 * Discord snowflake ID from Clerk's OAuth external accounts.
 * No user input needed — the Discord ID comes from Clerk.
 */

import { db } from "~/server/db";
import { isSystemOwner } from "~/lib/system-owner-constants";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract Discord user info from Clerk's external accounts.
 * Uses the Clerk backend SDK to read the user's OAuth connections.
 */
export async function extractDiscordFromClerk(
  clerkUserId: string
): Promise<{ discordUserId: string; discordUsername: string } | null> {
  try {
    const { createClerkClient } = await import("@clerk/backend");
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

    const clerkUser = await clerk.users.getUser(clerkUserId);

    // Find Discord OAuth external account
    const discordAccount = clerkUser.externalAccounts?.find(
      (a) =>
        a.provider === "oauth_discord" ||
        a.provider === "discord" ||
        a.verification?.strategy === "oauth_discord"
    );

    if (!discordAccount) return null;

    // externalId is the Discord snowflake user ID
    const discordUserId = discordAccount.externalId;
    // Username may be in different fields depending on Clerk version
    const discordUsername =
      discordAccount.username ??
      (`${discordAccount.firstName ?? ""}${discordAccount.lastName ? `#${discordAccount.lastName}` : ""}`.trim() ||
        discordUserId);

    if (!discordUserId) return null;

    return { discordUserId, discordUsername };
  } catch (error) {
    console.error("[Discord Sync] Failed to extract Discord from Clerk:", error);
    return null;
  }
}

/**
 * Link an IxStats user to their Discord account.
 * Pulls the Discord ID from Clerk automatically — no user input needed.
 */
export async function linkDiscordAccount(
  userId: string,
  clerkUserId: string
): Promise<{ success: boolean; discordUserId?: string; discordUsername?: string; error?: string }> {
  // Extract Discord info from Clerk
  const discordInfo = await extractDiscordFromClerk(clerkUserId);
  if (!discordInfo) {
    return {
      success: false,
      error:
        "No Discord account found in your login. Connect Discord as a sign-in method in your account settings first.",
    };
  }

  // System owners can link the same Discord account to multiple IxStats users
  if (!isSystemOwner(clerkUserId)) {
    const existingLink = await db.user.findFirst({
      where: {
        discordUserId: discordInfo.discordUserId,
        id: { not: userId },
      },
      select: { id: true },
    });

    if (existingLink) {
      return {
        success: false,
        error: "This Discord account is already linked to another IxStats user",
      };
    }
  }

  // Store the link
  // For system owners: clear the discordUserId from any previous owner first
  // to avoid unique constraint violations when re-linking across dev/prod accounts
  if (isSystemOwner(clerkUserId)) {
    await db.user.updateMany({
      where: {
        discordUserId: discordInfo.discordUserId,
        id: { not: userId },
      },
      data: {
        discordUserId: null,
        discordUsername: null,
        lastDiscordSync: null,
      },
    });
  }

  await db.user.update({
    where: { id: userId },
    data: {
      discordUserId: discordInfo.discordUserId,
      discordUsername: discordInfo.discordUsername,
      lastDiscordSync: new Date(),
    },
  });

  return {
    success: true,
    discordUserId: discordInfo.discordUserId,
    discordUsername: discordInfo.discordUsername,
  };
}
