/**
 * Daily notification email digest (SL-5): the `notification-email-digest` cron job.
 *
 * Off unless the job is named in CRON_ENABLED_JOBS, and a no-op while email is not configured.
 * For each user who turned email on and chose the digest, it emails one summary of their unread,
 * undismissed single-user notifications created since their last digest (at most the last
 * 24 hours, newest 20 listed). Those rows already passed the recipient's category and urgency
 * switches when they were written. Users with nothing new get no email. `lastEmailDigestAt`
 * advances only after a send succeeds, so a failed send is retried by the next run.
 */
import type { PrismaClient } from "@prisma/client";
import { emailConfig, type EmailConfig } from "./config";
import { escapeHtml, sendEmail, type EmailMessage } from "./email";
import { absoluteHref, clerkPrimaryEmail } from "./deliver";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LISTED = 20;
const MAX_USERS_PER_RUN = 500;

type DigestDb = Pick<PrismaClient, "userPreferences" | "user" | "notification">;

export interface DigestDeps {
  db: DigestDb;
  env?: Record<string, string | undefined>;
  now?: Date;
  sendEmail?: (config: EmailConfig, message: EmailMessage) => Promise<boolean>;
  resolveEmail?: (clerkUserId: string) => Promise<string | null>;
}

interface DigestItem {
  title: string;
  message: string | null;
  href: string | null;
}

export function digestEmail(
  to: string,
  items: DigestItem[],
  total: number,
  env?: Record<string, string | undefined>
): EmailMessage {
  const more = total > items.length ? total - items.length : 0;
  const lines = items.map((item) => {
    const link = absoluteHref(item.href, env);
    return { item, link };
  });
  return {
    to,
    subject: `Your IxStats summary: ${total} new notification${total === 1 ? "" : "s"}`,
    text: [
      ...lines.map(({ item, link }) =>
        [`- ${item.title}`, item.message ? `  ${item.message}` : null, link ? `  ${link}` : null]
          .filter(Boolean)
          .join("\n")
      ),
      more ? `And ${more} more in IxStats.` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    html: [
      "<ul>",
      ...lines.map(
        ({ item, link }) =>
          `<li><strong>${
            link
              ? `<a href="${escapeHtml(link)}">${escapeHtml(item.title)}</a>`
              : escapeHtml(item.title)
          }</strong>${item.message ? `<br>${escapeHtml(item.message)}` : ""}</li>`
      ),
      "</ul>",
      more ? `<p>And ${more} more in IxStats.</p>` : "",
    ].join(""),
  };
}

export async function runNotificationEmailDigest(deps?: Partial<DigestDeps>) {
  const db = deps?.db ?? ((await import("~/server/db")).db as unknown as DigestDb);
  const config = emailConfig(deps?.env);
  if (!config) return { skipped: "email is not configured", sent: 0 };

  const now = deps?.now ?? new Date();
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const users = await db.userPreferences.findMany({
    where: { emailDigest: true, emailNotifications: true, emailEnabledAt: { not: null } },
    select: { userId: true, lastEmailDigestAt: true },
    take: MAX_USERS_PER_RUN,
  });

  let sent = 0;
  let failed = 0;
  for (const prefs of users) {
    const since =
      prefs.lastEmailDigestAt && prefs.lastEmailDigestAt > dayAgo
        ? prefs.lastEmailDigestAt
        : dayAgo;
    const internal = await db.user.findFirst({
      where: { clerkUserId: prefs.userId },
      select: { id: true },
    });
    const where = {
      userId: { in: [prefs.userId, ...(internal ? [internal.id] : [])] },
      createdAt: { gt: since },
      read: false,
      dismissed: false,
    };
    const [total, items] = await Promise.all([
      db.notification.count({ where }),
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: MAX_LISTED,
        select: { title: true, message: true, description: true, href: true },
      }),
    ]);
    if (total === 0) continue;

    const to = await (deps?.resolveEmail ?? clerkPrimaryEmail)(prefs.userId);
    if (!to) continue;
    const message = digestEmail(
      to,
      items.map((i) => ({ title: i.title, message: i.message ?? i.description, href: i.href })),
      total,
      deps?.env
    );
    if (await (deps?.sendEmail ?? sendEmail)(config, message)) {
      sent++;
      await db.userPreferences.update({
        where: { userId: prefs.userId },
        data: { lastEmailDigestAt: now },
      });
    } else {
      failed++;
    }
  }
  return { users: users.length, sent, failed };
}
