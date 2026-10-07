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

export interface RealmFounderChangedEvent {
  clerkUserId: string;
  /** `new`: they now found the realm; `previous`: staff handed their realm to someone else. */
  role: "new" | "previous";
  realmName: string;
  realmSlug: string;
  keptAsOfficer: boolean;
}

/**
 * A realm changed hands: its new founder is told, and so is a previous founder who didn't hand it over
 * themselves.
 */
export async function notifyRealmFounderChanged(event: RealmFounderChangedEvent): Promise<void> {
  const slug = encodeURIComponent(event.realmSlug);
  const isNew = event.role === "new";
  const kept = event.keptAsOfficer ? " You stay on as an officer with every power." : "";
  await notificationAPI.create({
    userId: event.clerkUserId,
    title: isNew ? `You now found ${event.realmName}` : `${event.realmName} has a new founder`,
    message: isNew
      ? `${event.realmName} was handed to you. Appoint officers, review claims and run the realm from its Manage tab.`
      : `Site staff handed ${event.realmName} to another player.${kept}`,
    category: "system",
    type: "info",
    priority: "medium",
    href: isNew ? `/r/${slug}/manage` : `/r/${slug}`,
    source: "realms",
    actionable: isNew,
    metadata: { realmSlug: event.realmSlug, role: event.role },
  });
}
