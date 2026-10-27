/**
 * The moderation log (M16): one append-only row per moderator action, written through the transaction client the
 * action runs in, so the change and its row commit together. Nothing updates or deletes a row
 * (src/tests/architecture/forum-mod-log-append-only.test.ts; Postgres rules in the phase 3 migration).
 */
import type { PrismaClient } from "@prisma/client";
import { MOD_LOG_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import { ForumError } from "./errors";
import {
  listingScope,
  pageWindow,
  scopeColumns,
  scopedRowsWhere,
  type CategoryScopeDb,
  type ModScope,
} from "./mod-scope";

export type ModLogDb = Pick<PrismaClient, "forumModLog">;
/** The listing also reads who wrote reported content (`withoutOwnReportNotes`). */
type ModLogListDb = ModLogDb & CategoryScopeDb & Pick<PrismaClient, "forumThread" | "forumPost">;
export type ModLogDetail = Record<string, string | number | boolean | null>;

export interface ModLogEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  scope: ModScope;
  detail?: ModLogDetail;
}

export const LOG_PER_PAGE = MOD_LOG_PER_PAGE;
const TEXT_MAX = 1000;

/** Writes one row through the transaction client the caller is already in. Never update or delete (M16). */
export async function logModAction(tx: ModLogDb, entry: ModLogEntry): Promise<void> {
  await tx.forumModLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      ...scopeColumns(entry.scope),
      detail: entry.detail ? JSON.stringify(entry.detail) : null,
    },
  });
}

/** A moderator's reason: trimmed, 1 to 1000 characters. */
export function modReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 1 || trimmed.length > TEXT_MAX) {
    throw new ForumError("BAD_REQUEST", `A reason is 1 to ${TEXT_MAX} characters.`);
  }
  return trimmed;
}

/** An optional moderator note: trimmed, at most 1000 characters, null when blank. */
export function modNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  if (trimmed.length > TEXT_MAX)
    throw new ForumError("BAD_REQUEST", `A note is at most ${TEXT_MAX} characters.`);
  return trimmed || null;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isDetail(value: JsonValue): value is ModLogDetail {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => v === null || typeof v !== "object");
}

/** A stored detail as flat values; anything else (bad JSON, nesting) reads as null. Also read by appeals (raisers). */
export function parseDetail(raw: string | null): ModLogDetail | null {
  if (raw === null) return null;
  try {
    const value: JsonValue = JSON.parse(raw);
    return isDetail(value) ? value : null;
  } catch {
    return null;
  }
}

const REPORT_HANDLING = new Set(["report.resolve", "report.dismiss"]);

/** The reported content a report-handling row names (its detail's targetType and targetId). */
function reportedContent(row: { action: string; detail: ModLogDetail | null }) {
  const { targetType, targetId } = row.detail ?? {};
  if (!REPORT_HANDLING.has(row.action) || typeof targetId !== "string") return null;
  return targetType === "thread" || targetType === "post" ? { targetType, targetId } : null;
}

/**
 * The queue keeps reports about a moderator's own content from them (mod-report-queue.ts), and the handler's note
 * could hint at who filed one, so a non-admin moderator gets those rows with the note withheld. The row itself
 * stays: it names the content's id, not its author, so leaving it out would need every report row in scope read
 * up front to keep the page and total right. Site admins see every note, as they see those reports in the queue.
 * Returns the `type:id` keys of the page's reported content the viewer wrote.
 */
async function ownReportedContent(
  db: Pick<ModLogListDb, "forumThread" | "forumPost">,
  viewer: ForumViewer,
  rows: ReadonlyArray<{ action: string; detail: ModLogDetail | null }>
): Promise<Set<string>> {
  if (viewer === null || isSiteAdmin(viewer)) return new Set();
  const named = rows.flatMap((row) => reportedContent(row) ?? []);
  const ids = (type: string) => named.filter((n) => n.targetType === type).map((n) => n.targetId);
  const mine = { authorUserId: viewer.id };
  const [threads, posts] = await Promise.all([
    ids("thread").length
      ? db.forumThread.findMany({
          where: { id: { in: ids("thread") }, ...mine },
          select: { id: true },
        })
      : [],
    ids("post").length
      ? db.forumPost.findMany({ where: { id: { in: ids("post") }, ...mine }, select: { id: true } })
      : [],
  ]);
  return new Set([...threads.map((t) => `thread:${t.id}`), ...posts.map((p) => `post:${p.id}`)]);
}

/**
 * The log, newest first. Site admins see everything (optionally one realm's rows and its categories' rows); other
 * moderators see rows in their realms and in the categories they moderate, with the handler's note withheld on
 * report rows about their own content (`ownReportedContent`).
 */
export async function listModLog(
  db: ModLogListDb,
  viewer: ForumViewer,
  filter: { realmId?: string | null },
  page: number
) {
  const where = scopedRowsWhere(await listingScope(db, viewer, filter.realmId));
  const [rows, total] = await Promise.all([
    db.forumModLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageWindow(page, LOG_PER_PAGE),
    }),
    db.forumModLog.count({ where }),
  ]);
  const parsed = rows.map((row) => ({ ...row, detail: parseDetail(row.detail) }));
  const own = await ownReportedContent(db, viewer, parsed);
  const isOwn = (row: (typeof parsed)[number]) => {
    const content = reportedContent(row);
    return content !== null && own.has(`${content.targetType}:${content.targetId}`);
  };
  return {
    rows: parsed.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      scope: row.scope,
      scopeId: row.scopeId,
      detail: row.detail && isOwn(row) ? { ...row.detail, note: null } : row.detail,
      createdAt: row.createdAt,
    })),
    total,
  };
}
