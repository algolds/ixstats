/**
 * Per-recipient notification preferences (the switches in Settings → Notifications).
 *
 * Applied when a notification is addressed to one user. Country-wide and global
 * notifications have no single recipient and are not filtered here.
 */

import { db } from "~/server/db";

/** The UserPreferences toggle that governs each notification category. */
const CATEGORY_TOGGLE = {
  economic: "economicAlerts",
  cards: "economicAlerts",
  crisis: "crisisAlerts",
  security: "crisisAlerts",
  military: "crisisAlerts",
  diplomatic: "diplomaticAlerts",
  system: "systemAlerts",
} as const;

type CategoryToggle = (typeof CATEGORY_TOGGLE)[keyof typeof CATEGORY_TOGGLE];

export interface RecipientPreferences {
  economicAlerts: boolean;
  crisisAlerts: boolean;
  diplomaticAlerts: boolean;
  systemAlerts: boolean;
  notificationLevel: string;
}

/** Defaults shown by the settings panel and used when a user has never saved preferences. */
export const DEFAULT_RECIPIENT_PREFERENCES: RecipientPreferences = {
  economicAlerts: true,
  crisisAlerts: true,
  diplomaticAlerts: true,
  systemAlerts: true,
  notificationLevel: "low",
};

const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
/** Minimum priority rank each "Minimum urgency" option lets through. */
const LEVEL_MIN_RANK: Record<string, number> = { all: 0, low: 0, medium: 1, high: 2 };

/** Pure decision: may a notification of this category and priority reach a user with these preferences? */
export function isAllowedByPreferences(
  prefs: RecipientPreferences,
  category: string | null | undefined,
  priority: string | null | undefined
): boolean {
  const toggle: CategoryToggle | undefined =
    category && category in CATEGORY_TOGGLE
      ? CATEGORY_TOGGLE[category as keyof typeof CATEGORY_TOGGLE]
      : undefined;
  if (toggle && !prefs[toggle]) return false;

  const minRank = LEVEL_MIN_RANK[prefs.notificationLevel] ?? 0;
  const rank = PRIORITY_RANK[priority ?? "medium"] ?? PRIORITY_RANK.medium!;
  return rank >= minRank;
}

/**
 * Load a recipient's saved preferences. Notifications address users by either their
 * Clerk id or internal id, while UserPreferences is keyed by the Clerk id.
 */
async function loadRecipientPreferences(userId: string): Promise<RecipientPreferences | null> {
  const direct = await db.userPreferences.findUnique({ where: { userId } });
  if (direct) return direct;
  const user = await db.user.findFirst({
    where: { id: userId },
    select: { clerkUserId: true },
  });
  if (!user?.clerkUserId || user.clerkUserId === userId) return null;
  return db.userPreferences.findUnique({ where: { userId: user.clerkUserId } });
}

/** Whether a notification addressed to `userId` should be delivered. Fails open on DB errors. */
export async function recipientAccepts(
  userId: string | null | undefined,
  category: string | null | undefined,
  priority: string | null | undefined
): Promise<boolean> {
  if (!userId) return true;
  try {
    const prefs = (await loadRecipientPreferences(userId)) ?? DEFAULT_RECIPIENT_PREFERENCES;
    return isAllowedByPreferences(prefs, category, priority);
  } catch (error) {
    console.warn("[NotificationPreferences] Could not read preferences; delivering:", error);
    return true;
  }
}
