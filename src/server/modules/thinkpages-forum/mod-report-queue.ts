/**
 * The moderators' report queue (phase 3, M11): reports in the categories the viewer moderates (every category for
 * site admins), optionally one realm's, newest first. Targets and categories are loaded in batches per page.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { categoryVisibilityWhere } from "~/lib/thinkpages-forum/categories";
import { MOD_ROWS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import { authorModeration, type AuthorModeration, type AuthorModerationDb } from "./mod-authors";
import { listingScope, pageWindow } from "./mod-scope";
import { canonicalRealm, IXWORLD_REALM, REALM_SELECT } from "./realm-access";

export type ReportQueueDb = Pick<
  PrismaClient,
  "forumReport" | "forumThread" | "forumPost" | "forumCategory" | "realm"
> &
  AuthorModerationDb;
export type ReportStatus = "open" | "resolved" | "dismissed";

export const REPORTS_PER_PAGE = MOD_ROWS_PER_PAGE;
const EXCERPT_MAX = 160;
/** A gone target leaves nothing to hide or sanction; the report itself is still handled. */
const GONE_TARGET: AuthorModeration = { moderable: true, sanctionable: false };

interface TargetSummary {
  threadId: string;
  threadTitle: string;
  excerpt: string;
  /** Null on imported content without an IxStats author (phase 4): hideable, never sanctionable. */
  authorUserId: string | null;
  hidden: boolean;
}

type TargetRef = { targetType: string; targetId: string };

const excerptOf = (text: string): string => text.slice(0, EXCERPT_MAX);
const targetKey = (type: string, id: string): string => `${type}:${id}`;
const idsOf = (refs: readonly TargetRef[], type: string): string[] =>
  refs.filter((r) => r.targetType === type).map((r) => r.targetId);

/**
 * The reported threads and posts in two batched queries, keyed `thread:<id>` / `post:<id>`; `author` narrows them
 * to one member's content.
 */
async function loadTargets(
  db: ReportQueueDb,
  refs: readonly TargetRef[],
  author: { authorUserId?: string } = {}
): Promise<Map<string, TargetSummary>> {
  const [threadIds, postIds] = [idsOf(refs, "thread"), idsOf(refs, "post")];
  const [threads, posts] = await Promise.all([
    threadIds.length
      ? db.forumThread.findMany({
          where: { id: { in: threadIds }, ...author },
          select: { id: true, title: true, authorUserId: true, hidden: true },
        })
      : [],
    postIds.length
      ? db.forumPost.findMany({
          where: { id: { in: postIds }, ...author },
          select: {
            id: true,
            threadId: true,
            plainText: true,
            authorUserId: true,
            hidden: true,
            thread: { select: { title: true } },
          },
        })
      : [],
  ]);
  return new Map([
    ...threads.map((t): [string, TargetSummary] => [
      targetKey("thread", t.id),
      {
        threadId: t.id,
        threadTitle: t.title,
        excerpt: excerptOf(t.title),
        authorUserId: t.authorUserId,
        hidden: t.hidden,
      },
    ]),
    ...posts.map((p): [string, TargetSummary] => [
      targetKey("post", p.id),
      {
        threadId: p.threadId,
        threadTitle: p.thread.title,
        excerpt: excerptOf(p.plainText),
        authorUserId: p.authorUserId,
        hidden: p.hidden,
      },
    ]),
  ]);
}

type ReportWhere = { status: ReportStatus; categoryId?: { in: string[] } };

/**
 * A moderator never sees reports about their own content, so who reported them never reaches them; site admins
 * see every report (their own content's without the reporter, and they can't handle those, resolveReport).
 */
async function withoutOwnTargets(
  db: ReportQueueDb,
  viewer: ForumViewer,
  where: ReportWhere
): Promise<
  ReportWhere & { NOT?: { OR: Array<{ targetType: string; targetId: { in: string[] } }> } }
> {
  if (viewer === null || isSiteAdmin(viewer)) return where;
  const reported = await db.forumReport.findMany({
    where,
    select: { targetType: true, targetId: true },
    distinct: ["targetType", "targetId"],
  });
  const own = await loadTargets(db, reported, { authorUserId: viewer.id });
  const ownIds = (type: string) =>
    idsOf(reported, type).filter((id) => own.has(targetKey(type, id)));
  return {
    ...where,
    NOT: {
      OR: [
        { targetType: "thread", targetId: { in: ownIds("thread") } },
        { targetType: "post", targetId: { in: ownIds("post") } },
      ],
    },
  };
}

/**
 * M8 for handlers: the categories among `ids` whose content the viewer can read. A moderator of a category reads all
 * of its threads (canSeeThread) once they can see the category, so the category's visibility decides; a non-admin
 * appointed on a staff category moderates content they can't read, and none of its reports reach them.
 */
async function readableCategoryIds(
  db: ReportQueueDb,
  viewer: ForumViewer,
  ids: readonly string[]
): Promise<string[]> {
  const signedIn = viewer !== null;
  const rows = await db.forumCategory.findMany({
    where: {
      id: { in: [...ids] },
      ...categoryVisibilityWhere({ signedIn, siteAdmin: signedIn && isSiteAdmin(viewer) }),
    },
    select: { id: true },
  });
  return rows.map((c) => c.id);
}

interface ReportCategory {
  id: string;
  scope: string;
  realmId: string | null;
  key: string;
  name: string;
  realm: { slug: string; name: string } | null;
}

/** The reports' categories with their realm's slug and name (IxWorld without a row is synthesized, D8). */
async function summarizeCategories(
  db: ReportQueueDb,
  categoryIds: readonly string[]
): Promise<Map<string, ReportCategory>> {
  if (categoryIds.length === 0) return new Map();
  const categories = await db.forumCategory.findMany({
    where: { id: { in: [...new Set(categoryIds)] } },
    select: { id: true, key: true, name: true, scope: true, realmId: true },
  });
  const realmIds = [
    ...new Set(categories.flatMap((c) => (c.scope === "realm" && c.realmId ? [c.realmId] : []))),
  ];
  const realmRows = realmIds.length
    ? await db.realm.findMany({ where: { id: { in: realmIds } }, select: REALM_SELECT })
    : [];
  const realms = new Map(realmRows.map((r) => [r.id, canonicalRealm(r)]));
  const realmOf = (realmId: string | null) => {
    const realm = realmId ? realms.get(realmId) : undefined;
    if (realm) return { slug: realm.slug, name: realm.name };
    return realmId === DEFAULT_REALM_ID
      ? { slug: IXWORLD_REALM.slug, name: IXWORLD_REALM.name }
      : null;
  };
  return new Map(
    categories.map((c) => [c.id, { ...c, realm: c.scope === "realm" ? realmOf(c.realmId) : null }])
  );
}

/**
 * The moderator's queue, newest first: reports in categories they moderate (all for site admins), optionally one
 * realm's. Each row carries its target's thread, title and a 160-character excerpt (null when the target is gone),
 * and its category with the realm's slug and name (null when the category is gone). Reports about the viewer's own
 * content are left out for moderators and shown without the reporter to site admins (`withoutOwnTargets`), and so
 * are reports in categories the viewer moderates but can't read (`readableCategoryIds`).
 */
export async function listReports(
  db: ReportQueueDb,
  viewer: ForumViewer,
  filter: { status: ReportStatus; realmId?: string | null },
  page: number
) {
  const listing = await listingScope(db, viewer, filter.realmId);
  const categoryIds =
    listing === null ? null : await readableCategoryIds(db, viewer, listing.categoryIds);
  const where = await withoutOwnTargets(db, viewer, {
    status: filter.status,
    ...(categoryIds === null ? {} : { categoryId: { in: categoryIds } }),
  });
  const [rows, total] = await Promise.all([
    db.forumReport.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageWindow(page, REPORTS_PER_PAGE),
    }),
    db.forumReport.count({ where }),
  ]);
  const [targets, categories] = await Promise.all([
    loadTargets(db, rows),
    summarizeCategories(
      db,
      rows.map((r) => r.categoryId)
    ),
  ]);
  const moderation = await authorModeration(
    db,
    viewer,
    [...targets.values()].map((t) => t.authorUserId)
  );
  return {
    rows: rows.map((row) => {
      const target = targets.get(targetKey(row.targetType, row.targetId));
      const category = categories.get(row.categoryId) ?? null;
      const ownTarget = target?.authorUserId === viewer?.id;
      return {
        /** What the viewer may do to the target (hide; warn or ban its author), as the server would allow. */
        ...(target && category ? moderation(target.authorUserId, category) : GONE_TARGET),
        id: row.id,
        targetType: row.targetType,
        targetId: row.targetId,
        threadId: target?.threadId ?? null,
        threadTitle: target?.threadTitle ?? null,
        excerpt: target?.excerpt ?? null,
        /** Whether the reported thread or post is hidden (the queue offers Unhide instead of Hide). */
        hidden: target?.hidden ?? false,
        /** Who wrote the reported content (for "Warn author" / "Ban author"); null when it is gone. */
        targetAuthorId: target?.authorUserId ?? null,
        categoryId: row.categoryId,
        category,
        /** True on a site admin's own content: they see the report, not who filed it, and can't handle it. */
        ownTarget,
        reporterId: ownTarget ? null : row.reporterId,
        reason: row.reason,
        status: row.status,
        handledBy: row.handledBy,
        handledAt: row.handledAt,
        note: row.note,
        createdAt: row.createdAt,
      };
    }),
    total,
  };
}
