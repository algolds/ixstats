/**
 * Play-as ("impersonation") decision logic, extracted from `createTRPCContext` to keep that
 * function under the repo's cyclomatic/cognitive complexity thresholds and to make the
 * privilege-escalation rules independently testable.
 */

import { Cache } from "~/lib/cache";
import { isDatabaseReadOnly } from "~/server/db";

export type PlayAsDeniedReason =
  | "not-staff"
  | "target-is-system-owner"
  | "target-not-found"
  | "target-outranks";

export type PlayAsDecision =
  | { kind: "none" }
  | { kind: "granted"; targetUserId: string }
  | { kind: "denied"; reason: PlayAsDeniedReason };

export interface DecidePlayAsInput {
  realUserId: string;
  requestedUserId: string | null;
  requesterRole: { name?: string | null; level?: number | null } | null;
  target: { clerkUserId: string; role: { level?: number | null } | null } | null;
  isSystemOwner: (id: string) => boolean;
}

const STAFF_ROLE_NAMES = new Set(["owner", "admin", "staff"]);

export function isRequesterStaff(
  realUserId: string,
  requesterRole: DecidePlayAsInput["requesterRole"],
  isSystemOwnerFn: (id: string) => boolean
): boolean {
  if (isSystemOwnerFn(realUserId)) return true;
  const roleName = requesterRole?.name ?? null;
  if (roleName && STAFF_ROLE_NAMES.has(roleName)) return true;
  const roleLevel = requesterRole?.level ?? null;
  return roleLevel != null && roleLevel <= 20;
}

/**
 * Decides whether a "play as" (impersonation) request should be granted.
 *
 * Rules, evaluated in order:
 * 1. No header, or the header targets the requester's own ID -> `none` (nothing to decide).
 * 2. The requester must be staff (system owner, role name owner/admin/staff, or level <= 20) ->
 *    otherwise `denied/not-staff`.
 * 3. The target may never be the system owner -> `denied/target-is-system-owner`.
 * 4. The target must exist in the database (prevents `getOrCreateUser` from minting a row for an
 *    arbitrary ID) -> otherwise `denied/target-not-found`.
 * 5. The target must not outrank (or equal) the requester's effective level -> otherwise
 *    `denied/target-outranks`. The system owner's effective level is treated as -1 (higher than
 *    any role level in the database).
 */
export function decidePlayAs(input: DecidePlayAsInput): PlayAsDecision {
  const { realUserId, requestedUserId, requesterRole, target, isSystemOwner } = input;

  if (!requestedUserId || requestedUserId === realUserId) {
    return { kind: "none" };
  }

  if (!isRequesterStaff(realUserId, requesterRole, isSystemOwner)) {
    return { kind: "denied", reason: "not-staff" };
  }

  if (isSystemOwner(requestedUserId)) {
    return { kind: "denied", reason: "target-is-system-owner" };
  }

  if (!target) {
    return { kind: "denied", reason: "target-not-found" };
  }

  const requesterLevel = isSystemOwner(realUserId) ? -1 : (requesterRole?.level ?? 999);
  const targetLevel = target.role?.level ?? 999;

  if (targetLevel <= requesterLevel) {
    return { kind: "denied", reason: "target-outranks" };
  }

  return { kind: "granted", targetUserId: requestedUserId };
}

export interface RecordPlayAsAuditEntry {
  realUserId: string;
  requestedUserId: string;
  kind: "granted" | "denied";
  reason?: PlayAsDeniedReason;
  ip: string | null;
  userAgent: string | null;
}

interface AuditDb {
  auditLog: {
    create: (args: {
      data: {
        userId: string;
        action: string;
        target: string;
        details: string;
        success: boolean;
      };
    }) => Promise<unknown>;
  };
}

// Dedupe repeated identical audit entries (same requester/target/outcome) within a short window
// so a chatty client (e.g. polling while impersonating) doesn't flood the audit log.
const playAsAuditDedupeCache = new Cache<true>({
  defaultTtlMs: 600_000, // 10 minutes
  maxSize: 500,
});

/**
 * Records a play-as decision to the audit log, at most once per
 * (realUserId, requestedUserId, kind) tuple per 10 minutes.
 */
export async function recordPlayAsAudit(db: AuditDb, entry: RecordPlayAsAuditEntry): Promise<void> {
  const dedupeKey = `${entry.realUserId}:${entry.requestedUserId}:${entry.kind}`;
  if (playAsAuditDedupeCache.has(dedupeKey)) {
    return;
  }
  playAsAuditDedupeCache.set(dedupeKey, true);

  if (isDatabaseReadOnly) {
    return;
  }

  try {
    await db.auditLog.create({
      data: {
        userId: entry.realUserId,
        action: entry.kind === "granted" ? "impersonation.play_as" : "impersonation.play_as_denied",
        target: entry.requestedUserId,
        details: JSON.stringify({
          reason: entry.reason ?? null,
          ip: entry.ip,
          userAgent: entry.userAgent,
        }),
        success: entry.kind === "granted",
      },
    });
  } catch (dbError) {
    console.error("[PlayAsAudit] Failed to persist audit log:", dbError);
  }
}
