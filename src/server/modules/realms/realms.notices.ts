/**
 * Notifications the realms system sends to one player. Each goes through `notificationAPI.create`, which honours
 * the recipient's preferences (Settings → Notifications: the category switch and the minimum urgency) via
 * `recipientAccepts`, and the admin switch for the `realmsNotification` event.
 */
import { notificationAPI } from "~/lib/notifications/api";
import type { ClaimRejectedEvent } from "./realms.claims";

/** AT-5: a rejected claimant is told which nation and why, with a link to the realm's nations. */
export async function notifyClaimRejected(event: ClaimRejectedEvent): Promise<void> {
  await notificationAPI.create({
    userId: event.clerkUserId,
    title: "Claim rejected",
    message: `Your claim for ${event.nationName} was rejected: ${event.reason}`,
    category: "system",
    type: "warning",
    priority: "medium",
    href: event.realmSlug ? `/r/${encodeURIComponent(event.realmSlug)}/nations` : "/realms",
    source: "realms",
    actionable: true,
    metadata: { nationName: event.nationName, realmSlug: event.realmSlug },
  });
}
