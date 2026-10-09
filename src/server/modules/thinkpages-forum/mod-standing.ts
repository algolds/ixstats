/**
 * The member's own standing (M20): active points, warnings of the last 90 days (revoked ones too), active bans with
 * the place's name, their appeals, and what they may still appeal. Only the member's own rows, and never who issued,
 * lifted, revoked or reviewed anything: the moderator's reason and response are shown, the moderator is not.
 */
import type { PrismaClient } from "@prisma/client";
import { activePoints, DAY_MS, MODERATION_POLICY } from "~/lib/thinkpages-forum/moderation-policy";
import {
  appealStatusOf,
  appealSubjectTypeOf,
  isWarningActive,
  type AppealStatus,
  type AppealSubjectType,
} from "./mod-appeal-subjects";
import { banScopeOf } from "./mod-scope";
import { loadForumRealm } from "./realm-access";
import type { ForumActor } from "./writes";

export type StandingDb = Pick<
  PrismaClient,
  "forumWarning" | "forumBan" | "forumAppeal" | "forumCategory" | "realm"
>;

export interface StandingAppeal {
  id: string;
  subjectType: AppealSubjectType | null;
  subjectId: string;
  status: AppealStatus;
  response: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

const liveAt = (now: Date) => [{ expiresAt: null }, { expiresAt: { gt: now } }];

/** The member's appeals on these items (however old), plus any open or filed since `since`. */
async function memberAppeals(
  db: Pick<StandingDb, "forumAppeal">,
  userId: string,
  items: { warning: string[]; ban: string[] },
  since: Date
): Promise<StandingAppeal[]> {
  const rows = await db.forumAppeal.findMany({
    where: {
      userId,
      OR: [
        { status: "open" },
        { createdAt: { gt: since } },
        { subjectType: "warning", subjectId: { in: items.warning } },
        { subjectType: "ban", subjectId: { in: items.ban } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subjectType: true,
      subjectId: true,
      status: true,
      response: true,
      createdAt: true,
      reviewedAt: true,
    },
  });
  // Field by field, so nothing beyond these (never `reviewedBy`) can reach the member.
  return rows.map((row) => ({
    id: row.id,
    subjectType: appealSubjectTypeOf(row.subjectType),
    subjectId: row.subjectId,
    status: appealStatusOf(row.status),
    response: row.response,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  }));
}

/** Realm and category names for the bans' places, keyed `scope:id`; a gone place has none. */
async function placeNames(
  db: Pick<StandingDb, "forumCategory" | "realm">,
  bans: ReadonlyArray<{ scope: string; scopeId: string | null }>
): Promise<Map<string, string>> {
  const idsOf = (scope: string) => [
    ...new Set(bans.flatMap((b) => (b.scope === scope && b.scopeId ? [b.scopeId] : []))),
  ];
  const [categories, realms] = await Promise.all([
    db.forumCategory.findMany({
      where: { id: { in: idsOf("category") } },
      select: { id: true, name: true },
    }),
    Promise.all(idsOf("realm").map((id) => loadForumRealm(db, { id }))),
  ]);
  return new Map([
    ...categories.map((c): [string, string] => [`category:${c.id}`, c.name]),
    ...realms.flatMap((r): Array<[string, string]> => (r ? [[`realm:${r.id}`, r.name]] : [])),
  ]);
}

export async function myStanding(db: StandingDb, actor: ForumActor) {
  const now = new Date();
  const since = new Date(now.getTime() - MODERATION_POLICY.warningTtlDays * DAY_MS);
  const [warnings, bans] = await Promise.all([
    db.forumWarning.findMany({
      where: {
        userId: actor.id,
        OR: [{ createdAt: { gt: since } }, { revokedAt: null, expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        points: true,
        reason: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),
    db.forumBan.findMany({
      where: { userId: actor.id, liftedAt: null, OR: liveAt(now) },
      orderBy: { createdAt: "desc" },
      select: { id: true, scope: true, scopeId: true, reason: true, expiresAt: true, auto: true },
    }),
  ]);
  const items = { warning: warnings.map((w) => w.id), ban: bans.map((b) => b.id) };
  const [appeals, names] = await Promise.all([
    memberAppeals(db, actor.id, items, since),
    placeNames(db, bans),
  ]);
  const appealOf = (type: AppealSubjectType, id: string) =>
    appeals.find((a) => a.subjectType === type && a.subjectId === id) ?? null;
  return {
    activePoints: activePoints(warnings, now),
    warnings: warnings.map((w) => {
      const appeal = appealOf("warning", w.id);
      return {
        id: w.id,
        points: w.points,
        reason: w.reason,
        createdAt: w.createdAt,
        expiresAt: w.expiresAt,
        revokedAt: w.revokedAt,
        appeal,
        canAppeal: appeal === null && isWarningActive(w, now),
      };
    }),
    bans: bans.map((b) => {
      const appeal = appealOf("ban", b.id);
      return {
        id: b.id,
        scope: banScopeOf(b.scope),
        scopeName: names.get(`${b.scope}:${b.scopeId}`) ?? null,
        reason: b.reason,
        expiresAt: b.expiresAt,
        auto: b.auto,
        appeal,
        canAppeal: appeal === null,
      };
    }),
    appeals: appeals.filter((a) => a.status === "open" || a.createdAt > since),
  };
}
