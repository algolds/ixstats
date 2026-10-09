/**
 * The moderators' report queue (phase 3, M11): reports in the categories the viewer moderates (every category for
 * site admins), optionally one realm's, newest first. Targets and categories are loaded in batches per page.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import type { ForumViewer } from "./access";
import { listingScope, pageWindow } from "./mod-scope";
import { canonicalRealm, IXWORLD_REALM, REALM_SELECT } from "./realm-access";

export type ReportQueueDb = Pick<
  PrismaClient,
  "forumReport" | "forumThread" | "forumPost" | "forumCategory" | "realm"
>;
export type ReportStatus = "open" | "resolved" | "dismissed";

export const REPORTS_PER_PAGE = 25;
const EXCERPT_MAX = 160;

interface TargetSummary {
  threadId: string;
  threadTitle: string;
  excerpt: string;
}

const excerptOf = (text: string): string => text.slice(0, EXCERPT_MAX);
const targetKey = (type: string, id: string): string => `${type}:${id}`;

/** The reported threads and posts in two batched queries, keyed `thread:<id>` / `post:<id>`. */
async function summarizeTargets(
  db: ReportQueueDb,
  rows: ReadonlyArray<{ targetType: string; targetId: string }>
): Promise<Map<string, TargetSummary>> {
  const idsOf = (type: string) => rows.filter((r) => r.targetType === type).map((r) => r.targetId);
  const [threadIds, postIds] = [idsOf("thread"), idsOf("post")];
  const [threads, posts] = await Promise.all([
    threadIds.length
      ? db.forumThread.findMany({
          where: { id: { in: threadIds } },
          select: { id: true, title: true },
        })
      : [],
    postIds.length
      ? db.forumPost.findMany({
          where: { id: { in: postIds } },
          select: {
            id: true,
            threadId: true,
            plainText: true,
            thread: { select: { title: true } },
          },
        })
      : [],
  ]);
  return new Map([
    ...threads.map((t): [string, TargetSummary] => [
      targetKey("thread", t.id),
      { threadId: t.id, threadTitle: t.title, excerpt: excerptOf(t.title) },
    ]),
    ...posts.map((p): [string, TargetSummary] => [
      targetKey("post", p.id),
      { threadId: p.threadId, threadTitle: p.thread.title, excerpt: excerptOf(p.plainText) },
    ]),
  ]);
}

interface ReportCategory {
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
    categories.map((c) => [
      c.id,
      { key: c.key, name: c.name, realm: c.scope === "realm" ? realmOf(c.realmId) : null },
    ])
  );
}

/**
 * The moderator's queue, newest first: reports in categories they moderate (all for site admins), optionally one
 * realm's. Each row carries its target's thread, title and a 160-character excerpt (null when the target is gone),
 * and its category with the realm's slug and name (null when the category is gone).
 */
export async function listReports(
  db: ReportQueueDb,
  viewer: ForumViewer,
  filter: { status: ReportStatus; realmId?: string | null },
  page: number
) {
  const listing = await listingScope(db, viewer, filter.realmId);
  const where = {
    status: filter.status,
    ...(listing === null ? {} : { categoryId: { in: listing.categoryIds } }),
  };
  const [rows, total] = await Promise.all([
    db.forumReport.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageWindow(page, REPORTS_PER_PAGE),
    }),
    db.forumReport.count({ where }),
  ]);
  const [targets, categories] = await Promise.all([
    summarizeTargets(db, rows),
    summarizeCategories(
      db,
      rows.map((r) => r.categoryId)
    ),
  ]);
  return {
    rows: rows.map((row) => {
      const target = targets.get(targetKey(row.targetType, row.targetId));
      return {
        id: row.id,
        targetType: row.targetType,
        targetId: row.targetId,
        threadId: target?.threadId ?? null,
        threadTitle: target?.threadTitle ?? null,
        excerpt: target?.excerpt ?? null,
        categoryId: row.categoryId,
        category: categories.get(row.categoryId) ?? null,
        reporterId: row.reporterId,
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
