/**
 * The import's notification pass: notifications from the retired XenForo bridge link to its paths
 * (`[/projects/ixstates]/forum/thread/<xenforoThreadId>[#post-<xenforoPostId>]`, older rows under the old base path
 * `/projects/ixstats`), which are 404s now. Once every thread is written, each is pointed at its native page through
 * the import's public-only resolver (`forumTargets`, as the post link pass does): a post's link at the post, else at
 * its thread (a hidden post falls back to its thread). One with nothing public to point at goes to the forum home on
 * a clean run, and is kept while threads failed (or the snapshot left forums out), for the rerun. The current base
 * path is kept and the old one dropped (`rewriteNotificationHref`). Only `href` changes, and only while it is still
 * what was read (one changed meanwhile is left to the next apply). Keyset-paged and idempotent (a native path is never
 * an old link); each distinct ref is looked up once.
 */
import {
  classifyForumHref,
  mayHoldOldLink,
  rewriteNotificationHref,
} from "~/lib/thinkpages-forum/import/forum-links";
import type { NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import type { ImportDb } from "./import-db";
import { forumTargets, type ForumLinksDb } from "./import-forum-links";

const PAGE = 500;

type NotificationLinksDb = ForumLinksDb & Pick<ImportDb, "notification">;

/** Notifications that may hold an old forum link, in any case. */
const MAY_HOLD_OLD_LINK = mayHoldOldLink((href) => ({ href }));

export interface NotificationLinkRewrite {
  /** Old forum links pointed at their native page. */
  mapped: number;
  /** Old forum links sent to the forum home: nothing an anonymous visitor may read is there. */
  unresolved: number;
}

export async function rewriteNotificationLinks(
  db: NotificationLinksDb,
  opts: { nodeMap: NodeMapFile; dropUnresolved: boolean }
): Promise<NotificationLinkRewrite> {
  const targets = forumTargets(db, opts);
  const out: NotificationLinkRewrite = { mapped: 0, unresolved: 0 };
  let after = "";
  for (;;) {
    const rows = await db.notification.findMany({
      where: { ...MAY_HOLD_OLD_LINK, id: { gt: after } },
      orderBy: { id: "asc" },
      take: PAGE,
      select: { id: true, href: true },
    });
    if (!rows.length) return out;
    after = rows[rows.length - 1]!.id;
    for (const row of rows) {
      const href = row.href ?? "";
      await targets.load(classifyForumHref(href) ?? []);
      const rewrite = rewriteNotificationHref(href, targets.targetOf, targets.unresolved);
      if (!rewrite) continue;
      const { count } = await db.notification.updateMany({
        where: { id: row.id, href: row.href },
        data: { href: rewrite.href },
      });
      if (!count) continue;
      if (rewrite.mapped) out.mapped += 1;
      else out.unresolved += 1;
    }
  }
}
