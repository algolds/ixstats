/**
 * XenForo User Profile Sync Service
 *
 * Syncs IxStats data (cards, vault value, credits, country) to XenForo forum
 * user profiles via custom user fields. Provides:
 *   - One-time custom field setup via XenForo REST API
 *   - User lookup by forum username
 *   - Profile data sync (card count, vault value, credits, country)
 *   - Debounced sync to avoid excessive API calls
 */

import { db } from "~/server/db";
import { getXfApiKey, getXfApiUrl, xfPost } from "./xenforo-service";
import { isSystemOwner } from "~/lib/system-owner-constants";

// ─── Custom Field Definitions ────────────────────────────────────────────────

const IXSTATS_CUSTOM_FIELDS = {
  ixstats_cards_owned: {
    title: "Cards Owned",
    description: "Total IxCards in vault",
    display_group: "personal",
  },
  ixstats_vault_value: {
    title: "Vault Value",
    description: "Total IxCards vault value (IX Points)",
    display_group: "personal",
  },
  ixstats_credits: {
    title: "IxCredits",
    description: "IxCredits balance",
    display_group: "personal",
  },
  ixstats_country: {
    title: "Country",
    description: "IxStats country",
    display_group: "personal",
  },
} as const;

// ─── Debounce Tracking ──────────────────────────────────────────────────────

const SYNC_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes
const lastSyncTimes = new Map<string, number>();

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * One-time admin setup: create IxStats custom user fields in XenForo.
 * Idempotent — XenForo returns 400 if the field already exists (ignored).
 */
export async function setupForumCustomFields(): Promise<{
  created: string[];
  errors: string[];
}> {
  if (!getXfApiKey()) {
    return { created: [], errors: ["XENFORO_API_KEY not configured"] };
  }

  const created: string[] = [];
  const errors: string[] = [];

  for (const [fieldId, config] of Object.entries(IXSTATS_CUSTOM_FIELDS)) {
    const result = await xfPost("/custom-user-fields/", {
      field_id: fieldId,
      title: config.title,
      description: config.description,
      display_group: config.display_group,
      display_order: "100",
      field_type: "textbox",
      viewable_profile: "1",
      viewable_message: "1",
    });

    if (result) {
      created.push(fieldId);
      console.log(`[XF Sync] Created custom field: ${fieldId}`);
    } else {
      errors.push(fieldId);
      console.warn(`[XF Sync] Failed to create field (may already exist): ${fieldId}`);
    }
  }

  return { created, errors };
}

/**
 * Look up a XenForo user by username.
 * Returns the XenForo user_id or null if not found.
 */
export async function lookupForumUser(
  username: string
): Promise<{ userId: number; username: string } | null> {
  const apiKey = getXfApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `${getXfApiUrl()}/users/find-name?username=${encodeURIComponent(username)}`;
    const response = await fetch(url, {
      headers: {
        "XF-Api-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[XF Sync] User lookup failed: HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      exact?: { user_id: number; username: string };
      recommendations?: Array<{ user_id: number; username: string }>;
    };

    if (data.exact) {
      return { userId: data.exact.user_id, username: data.exact.username };
    }

    // Try exact match in recommendations
    const exactMatch = data.recommendations?.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (exactMatch) {
      return { userId: exactMatch.user_id, username: exactMatch.username };
    }

    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[XF Sync] User lookup error:", error);
    return null;
  }
}

/**
 * Update a XenForo user's custom fields with IxStats data.
 */
async function updateForumProfile(
  xfUserId: number,
  fields: Record<string, string>
): Promise<boolean> {
  const body: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    body[`custom_fields[${key}]`] = value;
  }

  const result = await xfPost(`/users/${xfUserId}/`, body);
  return result !== null;
}

/**
 * Sync a user's IxStats data (cards, vault value, credits, country) to their
 * XenForo forum profile. Requires the user to have a linked forumUserId.
 *
 * Returns true if sync was performed, false if skipped or failed.
 */
export async function syncUserToForum(userId: string): Promise<boolean> {
  try {
    // Look up user with forum link
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        forumUserId: true,
        forumUsername: true,
        country: { select: { name: true } },
      },
    });

    if (!user?.forumUserId) {
      return false;
    }

    // Debounce: skip if synced within last 5 minutes
    const lastSync = lastSyncTimes.get(userId);
    if (lastSync && Date.now() - lastSync < SYNC_DEBOUNCE_MS) {
      return false;
    }

    // Gather stats: card ownership + vault credits
    const [ownedCards, vault] = await Promise.all([
      db.cardOwnership.findMany({
        where: { userId },
        select: {
          quantity: true,
          card: { select: { marketValue: true } },
        },
      }),
      db.myVault.findUnique({
        where: { userId },
        select: { credits: true },
      }),
    ]);

    const totalCards = ownedCards.reduce((sum, o) => sum + o.quantity, 0);
    const vaultValue = ownedCards.reduce(
      (sum, o) => sum + o.quantity * o.card.marketValue,
      0
    );

    const fields: Record<string, string> = {
      ixstats_cards_owned: String(totalCards),
      ixstats_vault_value: `${vaultValue.toLocaleString()} IX`,
      ixstats_credits: String(Math.floor(vault?.credits ?? 0)),
    };

    if (user.country?.name) {
      fields.ixstats_country = user.country.name;
    }

    const success = await updateForumProfile(user.forumUserId, fields);

    if (success) {
      lastSyncTimes.set(userId, Date.now());

      // Update lastForumSync in DB (fire-and-forget)
      db.user
        .update({
          where: { id: userId },
          data: { lastForumSync: new Date() },
        })
        .catch(() => {});
    }

    return success;
  } catch (error) {
    console.error(`[XF Sync] Failed to sync user ${userId}:`, error);
    return false;
  }
}

/**
 * Link an IxStats user account to their XenForo forum account.
 * Looks up the forum user by username and stores the forumUserId.
 * Triggers an initial sync after linking.
 */
export async function linkForumAccount(
  userId: string,
  forumUsername: string,
  clerkUserId?: string
): Promise<{ success: boolean; forumUserId?: number; error?: string }> {
  // Look up XenForo user
  const forumUser = await lookupForumUser(forumUsername);
  if (!forumUser) {
    return { success: false, error: `Forum user "${forumUsername}" not found` };
  }

  // System owners can link the same forum account to multiple IxStats users
  if (!clerkUserId || !isSystemOwner(clerkUserId)) {
    const existingLink = await db.user.findFirst({
      where: { forumUserId: forumUser.userId, id: { not: userId } },
      select: { id: true },
    });
    if (existingLink) {
      return {
        success: false,
        error: "This forum account is already linked to another IxStats user",
      };
    }
  }

  // Store the link
  await db.user.update({
    where: { id: userId },
    data: {
      forumUserId: forumUser.userId,
      forumUsername: forumUser.username,
    },
  });

  // Trigger initial sync
  await syncUserToForum(userId);

  return { success: true, forumUserId: forumUser.userId };
}
