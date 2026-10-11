/**
 * Notifications the realms system sends to one player. Each goes through `notificationAPI.create`, which honours
 * the recipient's preferences (Settings → Notifications: the category switch and the minimum urgency) via
 * `recipientAccepts`, and the admin switch for the `realmsNotification` event.
 */
import { notificationAPI } from "~/lib/notifications/api";
import { emailConfig } from "~/lib/notifications/delivery/config";
import { clerkPrimaryEmail, notificationEmail } from "~/lib/notifications/delivery/deliver";
import { sendEmail } from "~/lib/notifications/delivery/email";
import { RECLAIM_WINDOW_DAYS } from "~/lib/realms/realm-content";
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

/** ToS §2.8: the warning before an inactive nation's release, and the release itself. */
export interface InactivityNotice {
  kind: "warning" | "released";
  clerkUserId: string;
  nationName: string;
  realmName: string;
  realmSlug: string;
  /** The release date (warning) or the end of the reclaim window (released). */
  date: Date;
  /** The realm's inactivity period. */
  days: number;
  /** The realm keeps the nation for its former holder during the window. */
  exclusiveWindow: boolean;
}

const longDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** The notice's title, text and link. */
export function inactivityNoticeContent(notice: InactivityNotice) {
  const slug = encodeURIComponent(notice.realmSlug);
  if (notice.kind === "warning")
    return {
      title: `${notice.nationName} will be released soon`,
      message: `You have not signed in for ${notice.days} days. Sign in before ${longDate(notice.date)} to keep ${notice.nationName} in ${notice.realmName}. If it is released, you can claim it back with its flag and arms for ${RECLAIM_WINDOW_DAYS} days.`,
      href: `/r/${slug}`,
    };
  const unless = notice.exclusiveWindow ? "" : ", unless another player claims it first";
  return {
    title: `${notice.nationName} was released`,
    message: `${notice.nationName} in ${notice.realmName} was released because you had not signed in. Its flag and arms are hidden, not deleted. Claim it again before ${longDate(notice.date)} to get them back${unless}.`,
    href: `/r/${slug}/nations`,
  };
}

/**
 * In the app, and by email to the account's address whatever the player's notification settings: the terms
 * promise both. Email is skipped when it is not configured or the account has no address.
 */
export async function notifyInactivity(notice: InactivityNotice): Promise<void> {
  const content = inactivityNoticeContent(notice);
  await notificationAPI.create({
    userId: notice.clerkUserId,
    ...content,
    category: "system",
    type: "warning",
    priority: "medium",
    source: "realms",
    actionable: true,
    metadata: { nationName: notice.nationName, realmSlug: notice.realmSlug, kind: notice.kind },
  });
  const config = emailConfig();
  const to = config ? await clerkPrimaryEmail(notice.clerkUserId) : null;
  if (config && to)
    await sendEmail(config, notificationEmail(to, { userId: notice.clerkUserId, ...content }));
}
