/**
 * Email and Web Push delivery of single-user notifications (SL-5).
 *
 * `notificationAPI.create` / `createMany` call `deliverNotification` after writing a row the
 * recipient accepted (`recipientAccepts`: category switches and minimum urgency). Country-wide and
 * global notifications are in-app only. Delivery never blocks or fails the write.
 *
 * - **Push**, when configured (VAPID env vars): every accepted notification goes to each of the
 *   recipient's saved browser subscriptions, unless they switched push off. A subscription the
 *   push service reports gone (404/410) is deleted.
 * - **Email**, when configured (EMAIL_* env vars): only `high` and `critical` notifications are
 *   emailed one by one, and only to a user who turned email on in Settings (`emailEnabledAt` set,
 *   `emailNotifications` true) without choosing the daily digest. Digest users get everything
 *   in one daily email instead (digest.ts). The address is the user's primary Clerk email.
 */
import type { PrismaClient } from "@prisma/client";
import { appBaseUrl, emailConfig, pushConfig, type EmailConfig, type PushConfig } from "./config";
import { escapeHtml, sendEmail, type EmailMessage } from "./email";
import { sendWebPush, type PushMessage, type PushSubscriptionKeys } from "./web-push";

const EMAIL_PRIORITIES = new Set(["high", "critical"]);

export interface DeliverableNotification {
  userId: string;
  title: string;
  message?: string | null;
  description?: string | null;
  href?: string | null;
  priority?: string | null;
}

type DeliveryDb = Pick<PrismaClient, "userPreferences" | "user" | "pushSubscription">;

export interface DeliveryDeps {
  db: DeliveryDb;
  env?: Record<string, string | undefined>;
  sendEmail?: (config: EmailConfig, message: EmailMessage) => Promise<boolean>;
  sendPush?: (
    config: PushConfig,
    subscription: PushSubscriptionKeys,
    message: PushMessage,
    options: { urgency?: "very-low" | "low" | "normal" | "high" }
  ) => Promise<{ ok: boolean; gone: boolean }>;
  resolveEmail?: (clerkUserId: string) => Promise<string | null>;
}

/** The recipient's primary email address from Clerk, or null. */
export async function clerkPrimaryEmail(clerkUserId: string): Promise<string | null> {
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const user = await (await clerkClient()).users.getUser(clerkUserId);
    return user.primaryEmailAddress?.emailAddress ?? null;
  } catch {
    return null;
  }
}

/** Notifications address users by Clerk id or internal id; preferences are keyed by Clerk id. */
async function recipientClerkId(db: DeliveryDb, userId: string): Promise<string> {
  if (userId.startsWith("user_")) return userId;
  const user = await db.user.findFirst({ where: { id: userId }, select: { clerkUserId: true } });
  return user?.clerkUserId ?? userId;
}

export function absoluteHref(
  href: string | null | undefined,
  env?: Record<string, string | undefined>
) {
  if (!href) return appBaseUrl(env);
  if (/^https?:\/\//.test(href)) return href;
  const base = appBaseUrl(env);
  return base ? `${base}${href.startsWith("/") ? "" : "/"}${href}` : null;
}

/** Plain-text and HTML email for one notification. */
export function notificationEmail(
  to: string,
  n: DeliverableNotification,
  env?: Record<string, string | undefined>
): EmailMessage {
  const body = n.message || n.description || "";
  const link = absoluteHref(n.href, env);
  return {
    to,
    subject: n.title,
    text: [body, link ? `Open: ${link}` : null].filter(Boolean).join("\n\n"),
    html: [
      `<p><strong>${escapeHtml(n.title)}</strong></p>`,
      body ? `<p>${escapeHtml(body)}</p>` : "",
      link ? `<p><a href="${escapeHtml(link)}">Open in IxStats</a></p>` : "",
    ].join(""),
  };
}

const urgencyOf = (priority?: string | null) =>
  priority === "critical" || priority === "high"
    ? "high"
    : priority === "low"
      ? "low"
      : ("normal" as const);

async function deliverPush(
  deps: DeliveryDeps,
  config: PushConfig,
  clerkId: string,
  n: DeliverableNotification
) {
  const subscriptions = await deps.db.pushSubscription.findMany({
    where: { userId: clerkId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  const send = deps.sendPush ?? sendWebPush;
  const message: PushMessage = {
    title: n.title,
    body: n.message || n.description || "",
    href: n.href ?? null,
  };
  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await send(config, sub, message, { urgency: urgencyOf(n.priority) });
      if (result.gone) {
        await deps.db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
      } else if (result.ok) {
        await deps.db.pushSubscription
          .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
          .catch(() => null);
      }
    })
  );
}

/** Sends a notification the recipient accepted by push and email, as configured and chosen. */
export async function deliverNotification(
  n: DeliverableNotification,
  deps: DeliveryDeps
): Promise<void> {
  const push = pushConfig(deps.env);
  const email = emailConfig(deps.env);
  if (!n.userId || (!push && !email)) return;
  try {
    const clerkId = await recipientClerkId(deps.db, n.userId);
    const prefs = await deps.db.userPreferences.findUnique({
      where: { userId: clerkId },
      select: {
        pushNotifications: true,
        emailNotifications: true,
        emailEnabledAt: true,
        emailDigest: true,
      },
    });
    const tasks: Promise<unknown>[] = [];
    if (push && prefs?.pushNotifications !== false) {
      tasks.push(deliverPush(deps, push, clerkId, n));
    }
    const wantsEmail =
      email &&
      prefs?.emailNotifications &&
      prefs.emailEnabledAt &&
      !prefs.emailDigest &&
      EMAIL_PRIORITIES.has(n.priority ?? "medium");
    if (wantsEmail) {
      tasks.push(
        (async () => {
          const to = await (deps.resolveEmail ?? clerkPrimaryEmail)(clerkId);
          if (to) await (deps.sendEmail ?? sendEmail)(email, notificationEmail(to, n, deps.env));
        })()
      );
    }
    await Promise.all(tasks);
  } catch (error) {
    console.warn("[NotificationDelivery] Delivery failed:", error);
  }
}
