/**
 * The moderation log (M16): one append-only row per moderator action, written through the transaction client the
 * action runs in, so the change and its row commit together. Nothing updates or deletes a row
 * (src/tests/architecture/forum-mod-log-append-only.test.ts; Postgres rules in the phase 3 migration).
 */
import type { PrismaClient } from "@prisma/client";
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
export type ModLogDetail = Record<string, string | number | boolean | null>;

export interface ModLogEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  scope: ModScope;
  detail?: ModLogDetail;
}

export const LOG_PER_PAGE = 50;
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

/**
 * The log, newest first. Site admins see everything (optionally one realm's rows and its categories' rows); other
 * moderators see rows in their realms and in the categories they moderate.
 */
export async function listModLog(
  db: ModLogDb & CategoryScopeDb,
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
  return {
    rows: rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      scope: row.scope,
      scopeId: row.scopeId,
      detail: parseDetail(row.detail),
      createdAt: row.createdAt,
    })),
    total,
  };
}
