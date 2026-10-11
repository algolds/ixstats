/**
 * Writing forum notices to the IxStates bell (spec section 4): category "social", source "thinkpages-forum" (the guard
 * key admins switch the whole forum off with), a plain-path href (`createMany` applies the base path). `createMany` has
 * no event guard of its own, so the switch is read here, as the WikiOS watchlist does. Best effort: it returns whether
 * the notices are settled (written, or switched off) and never throws, so a post is never failed by a notice.
 */
import { notificationAPI } from "~/lib/notifications/api";
import { isNotificationEventEnabled } from "~/lib/notifications/guard";

export const FORUM_NOTICE_SOURCE = "thinkpages-forum";
const EVENT_KEY = `${FORUM_NOTICE_SOURCE}Notification`;
/** Notices per write: well inside PostgreSQL's bind-parameter limit. */
const CHUNK = 500;

export interface ForumNotice {
  /** The recipient's Clerk id: the bell is addressed by it. */
  clerkUserId: string;
  title: string;
  message: string;
  href: string;
  priority: "medium" | "low";
  metadata: {
    kind: "mention" | "quote" | "reply" | "watch" | "reaction";
    postId: string;
    threadId: string;
    /** `<post id>:<reactor user id>` on a reaction notice: a reaction toggled off and on tells the owner once. */
    reactionKey?: string;
  };
}

/** Whether the admin source switch lets forum notices through; the watcher step reads it before it claims anything. */
export const forumNoticesEnabled = (): Promise<boolean> => isNotificationEventEnabled(EVENT_KEY);

export async function sendForumNotices(notices: readonly ForumNotice[]): Promise<boolean> {
  if (notices.length === 0) return true;
  try {
    if (!(await forumNoticesEnabled())) return true;
    for (let at = 0; at < notices.length; at += CHUNK) {
      await notificationAPI.createMany(
        notices.slice(at, at + CHUNK).map((notice) => ({
          userId: notice.clerkUserId,
          title: notice.title,
          message: notice.message,
          href: notice.href,
          category: "social" as const,
          priority: notice.priority,
          source: FORUM_NOTICE_SOURCE,
          metadata: notice.metadata,
        }))
      );
    }
    return true;
  } catch (error) {
    console.error("[thinkpages-forum] Notices failed:", error);
    return false;
  }
}
