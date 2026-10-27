import { notificationAPI, type NotificationType } from "~/lib/notifications/api";
import { guardNotificationEvent } from "~/lib/notifications/guard";

/** Where proposal / invite notifications send the player: the MyCountry diplomacy inbox. */
const DIPLOMACY_INBOX_HREF = "/mycountry/diplomacy";

interface OwnerLookupDb {
  country: { findMany: (args: any) => Promise<any[]> };
}

/**
 * Notify the owners of the given countries (by Clerk user id, which notifications key on).
 * Best effort: failures are logged and never fail the calling mutation. Respects the admin
 * toggle for the "onDiplomaticEvent" notification hook.
 */
export async function notifyCountryOwners(
  db: OwnerLookupDb,
  countryIds: string[],
  input: {
    title: string;
    message: string;
    type?: NotificationType;
    priority?: "high" | "medium" | "low";
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const ids = [...new Set(countryIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    if (!(await guardNotificationEvent("onDiplomaticEvent"))) return;
    const countries = await db.country.findMany({
      where: { id: { in: ids } },
      select: { id: true, owner: { select: { clerkUserId: true } } },
    });
    for (const country of countries) {
      const userId = country?.owner?.clerkUserId;
      if (!userId) continue;
      await notificationAPI.create({
        userId,
        countryId: country.id,
        title: input.title,
        message: input.message,
        type: input.type ?? "info",
        category: "diplomatic",
        priority: input.priority ?? "medium",
        href: DIPLOMACY_INBOX_HREF,
        actionable: true,
        metadata: input.metadata,
      });
    }
  } catch (err) {
    console.warn("[Diplomacy] Proposal notification failed", input.title, err);
  }
}
