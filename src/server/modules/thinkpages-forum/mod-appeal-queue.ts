/**
 * The appeals queue (M12, M14): appeals whose subject lies in the viewer's scope (site admins everything, optionally
 * one realm), newest first, each with its subject and whether this viewer may decide it (`canReview`: open, not
 * their own appeal, not a subject they issued or, for an automatic ban, raised).
 */
import type { PrismaClient } from "@prisma/client";
import type { ForumViewer } from "./access";
import {
  appealStatusOf,
  appealSubjectTypeOf,
  BAN_SUBJECT_SELECT,
  isSubjectActive,
  subjectIssuers,
  WARNING_SUBJECT_SELECT,
  type AppealStatus,
  type AppealSubject,
} from "./mod-appeal-subjects";
import {
  banScopeOf,
  listingScope,
  pageWindow,
  scopedRowsWhere,
  type ListingScope,
} from "./mod-scope";

export type AppealQueueDb = Pick<
  PrismaClient,
  "forumAppeal" | "forumBan" | "forumWarning" | "forumCategory" | "forumModLog"
>;

export const APPEALS_PER_PAGE = 25;

interface SubjectIds {
  ban: string[];
  warning: string[];
}

const idsByType = (
  rows: ReadonlyArray<{ subjectType: string; subjectId: string }>
): SubjectIds => ({
  ban: rows.filter((r) => r.subjectType === "ban").map((r) => r.subjectId),
  warning: rows.filter((r) => r.subjectType === "warning").map((r) => r.subjectId),
});

/**
 * For a scoped viewer: the appeals (of this status) whose ban lies in their realms or categories, or whose warning
 * was given in one of their categories. Site admins without a realm filter need no condition.
 */
async function inScopeWhere(db: AppealQueueDb, listing: ListingScope, status: AppealStatus) {
  if (listing === null) return {};
  const appealed = idsByType(
    await db.forumAppeal.findMany({
      where: { status },
      select: { subjectType: true, subjectId: true },
    })
  );
  const [bans, warnings] = await Promise.all([
    db.forumBan.findMany({
      where: { id: { in: appealed.ban }, ...scopedRowsWhere(listing) },
      select: { id: true },
    }),
    db.forumWarning.findMany({
      where: { id: { in: appealed.warning }, categoryId: { in: listing.categoryIds } },
      select: { id: true },
    }),
  ]);
  return {
    OR: [
      { subjectType: "ban", subjectId: { in: bans.map((b) => b.id) } },
      { subjectType: "warning", subjectId: { in: warnings.map((w) => w.id) } },
    ],
  };
}

/** The page's subjects in one query per kind, keyed `kind:id`. */
async function loadSubjects(
  db: AppealQueueDb,
  ids: SubjectIds
): Promise<Map<string, AppealSubject>> {
  const [bans, warnings] = await Promise.all([
    ids.ban.length
      ? db.forumBan.findMany({ where: { id: { in: ids.ban } }, select: BAN_SUBJECT_SELECT })
      : [],
    ids.warning.length
      ? db.forumWarning.findMany({
          where: { id: { in: ids.warning } },
          select: WARNING_SUBJECT_SELECT,
        })
      : [],
  ]);
  const subjects: AppealSubject[] = [
    ...bans.map((b) => ({ kind: "ban" as const, ...b })),
    ...warnings.map((w) => ({ kind: "warning" as const, ...w })),
  ];
  return new Map(subjects.map((s) => [`${s.kind}:${s.id}`, s]));
}

/** A subject as the queue shows it: what it was, who issued it, whether it is still in force. */
function describeSubject(subject: AppealSubject, now: Date) {
  const common = {
    reason: subject.reason,
    expiresAt: subject.expiresAt,
    issuedBy: subject.issuedBy,
    active: isSubjectActive(subject, now),
  };
  return subject.kind === "ban"
    ? {
        kind: "ban" as const,
        ...common,
        scope: banScopeOf(subject.scope),
        scopeId: subject.scopeId,
        auto: subject.auto,
      }
    : {
        kind: "warning" as const,
        ...common,
        points: subject.points,
        categoryId: subject.categoryId,
      };
}

export async function listAppeals(
  db: AppealQueueDb,
  viewer: ForumViewer,
  filter: { status: AppealStatus; realmId?: string | null },
  page: number
) {
  const listing = await listingScope(db, viewer, filter.realmId);
  const where = { status: filter.status, ...(await inScopeWhere(db, listing, filter.status)) };
  const [rows, total] = await Promise.all([
    db.forumAppeal.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageWindow(page, APPEALS_PER_PAGE),
    }),
    db.forumAppeal.count({ where }),
  ]);
  const subjects = await loadSubjects(db, idsByType(rows));
  const issuers = await subjectIssuers(db, [...subjects.values()]);
  const now = new Date();
  return {
    rows: rows.map((row) => {
      const subjectType = appealSubjectTypeOf(row.subjectType);
      const key = `${subjectType}:${row.subjectId}`;
      const subject = subjects.get(key);
      const status = appealStatusOf(row.status);
      return {
        id: row.id,
        subjectType,
        subjectId: row.subjectId,
        userId: row.userId,
        body: row.body,
        status,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt,
        response: row.response,
        createdAt: row.createdAt,
        subject: subject ? describeSubject(subject, now) : null,
        canReview:
          status === "open" &&
          subject !== undefined &&
          viewer !== null &&
          viewer.id !== row.userId &&
          !issuers.get(key)?.has(viewer.id),
      };
    }),
    total,
  };
}
