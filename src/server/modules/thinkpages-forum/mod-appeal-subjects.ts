/**
 * What an appeal is about (M12): a warning or a ban of the appellant, loaded the same way by filing, review, the
 * queue and the member's standing; whether it is still in force; the scope its log rows use; and who issued it, which
 * for an automatic ban (M2) includes every moderator whose warning raised it a tier.
 */
import type { PrismaClient } from "@prisma/client";
import { isBanActive } from "~/lib/thinkpages-forum/moderation-policy";
import { parseDetail } from "./mod-log";
import { scopeFromColumns, type ModScope } from "./mod-scope";
import { warningScope } from "./mod-warnings";

export type SubjectsDb = Pick<PrismaClient, "forumBan" | "forumWarning" | "forumModLog">;
export type AppealSubjectType = "warning" | "ban";
export type AppealStatus = "open" | "upheld" | "overturned";
export type AppealOutcome = Exclude<AppealStatus, "open">;

interface BanSubject {
  kind: "ban";
  id: string;
  userId: string;
  scope: string;
  scopeId: string | null;
  reason: string;
  issuedBy: string;
  expiresAt: Date | null;
  auto: boolean;
  liftedAt: Date | null;
}
interface WarningSubject {
  kind: "warning";
  id: string;
  userId: string;
  categoryId: string | null;
  reason: string;
  points: number;
  issuedBy: string;
  expiresAt: Date;
  revokedAt: Date | null;
}
export type AppealSubject = BanSubject | WarningSubject;

const SUBJECT_TYPES: readonly AppealSubjectType[] = ["warning", "ban"];
const STATUSES: readonly AppealStatus[] = ["open", "upheld", "overturned"];

export const BAN_SUBJECT_SELECT = {
  id: true,
  userId: true,
  scope: true,
  scopeId: true,
  reason: true,
  issuedBy: true,
  expiresAt: true,
  auto: true,
  liftedAt: true,
} as const;
export const WARNING_SUBJECT_SELECT = {
  id: true,
  userId: true,
  categoryId: true,
  reason: true,
  points: true,
  issuedBy: true,
  expiresAt: true,
  revokedAt: true,
} as const;

export const appealSubjectTypeOf = (type: string): AppealSubjectType | null =>
  SUBJECT_TYPES.find((t) => t === type) ?? null;
/** A stored status; anything malformed reads as open. */
export const appealStatusOf = (status: string): AppealStatus =>
  STATUSES.find((s) => s === status) ?? "open";

export const isWarningActive = (
  warning: { expiresAt: Date; revokedAt: Date | null },
  now: Date
): boolean => warning.revokedAt === null && warning.expiresAt.getTime() > now.getTime();

export const isSubjectActive = (subject: AppealSubject, now: Date): boolean =>
  subject.kind === "ban" ? isBanActive(subject, now) : isWarningActive(subject, now);

/** The scope the subject's own log rows use, which the review logs at too. */
export const subjectScope = (subject: AppealSubject): ModScope =>
  subject.kind === "ban"
    ? scopeFromColumns(subject.scope, subject.scopeId)
    : warningScope(subject.categoryId);

export async function loadSubject(
  db: Pick<SubjectsDb, "forumBan" | "forumWarning">,
  type: AppealSubjectType,
  id: string
): Promise<AppealSubject | null> {
  if (type === "ban") {
    const row = await db.forumBan.findUnique({ where: { id }, select: BAN_SUBJECT_SELECT });
    return row && { kind: "ban" as const, ...row };
  }
  const row = await db.forumWarning.findUnique({ where: { id }, select: WARNING_SUBJECT_SELECT });
  return row && { kind: "warning" as const, ...row };
}

/**
 * Who issued each subject: its `issuedBy`, plus, for an automatic ban, every moderator whose warning raised it a
 * tier (`ban.extend` rows, whose actor is that warning's issuer and whose detail names the ban). One log query for
 * all the automatic bans given.
 */
export async function subjectIssuers(
  db: Pick<SubjectsDb, "forumModLog">,
  subjects: readonly AppealSubject[]
): Promise<Map<string, Set<string>>> {
  const issuers = new Map(subjects.map((s) => [`${s.kind}:${s.id}`, new Set([s.issuedBy])]));
  const autoBans = subjects.filter((s) => s.kind === "ban" && s.auto);
  if (autoBans.length === 0) return issuers;
  const raises = await db.forumModLog.findMany({
    where: {
      action: "ban.extend",
      targetType: "user",
      targetId: { in: [...new Set(autoBans.map((b) => b.userId))] },
    },
    select: { actorId: true, detail: true },
  });
  for (const row of raises) {
    const banId = parseDetail(row.detail)?.banId;
    if (typeof banId === "string") issuers.get(`ban:${banId}`)?.add(row.actorId);
  }
  return issuers;
}
