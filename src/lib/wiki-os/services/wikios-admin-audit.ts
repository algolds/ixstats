/**
 * wikios-admin-audit.ts — the AdminAuditLog row of an administrator's action on the WikiOS sync: a dead mirror job
 * requeued or discarded (one, or in bulk), a quarantined inbound step retried, dismissed or its page resynced. Each row
 * says who did it, what, and on which id or how many, as the editing switch's row does (editing-admin.ts).
 */
import type { PrismaClient } from "@prisma/client";

export type WikiosAdminAction =
  | "wikios.mirror.requeue"
  | "wikios.mirror.discard"
  | "wikios.mirror.requeue-bulk"
  | "wikios.mirror.discard-bulk"
  | "wikios.quarantine.retry"
  | "wikios.quarantine.dismiss"
  | "wikios.quarantine.resync";

export interface WikiosAdminActor {
  id: string;
  name: string;
}

export interface WikiosAdminEntry {
  action: WikiosAdminAction;
  /** A mirror job or a quarantined step by id; a bulk action by its title, or "all". */
  targetId: string;
  /** What `changes` says the action did: the id, the title and how many, the outcome. */
  changes: Readonly<Record<string, string | number | null>>;
}

const TARGET: Readonly<Record<WikiosAdminAction, { type: string; name: string }>> = {
  "wikios.mirror.requeue": { type: "wikiMirrorJob", name: "Dead mirror job" },
  "wikios.mirror.discard": { type: "wikiMirrorJob", name: "Dead mirror job" },
  "wikios.mirror.requeue-bulk": { type: "wikiMirrorJob", name: "Dead mirror jobs" },
  "wikios.mirror.discard-bulk": { type: "wikiMirrorJob", name: "Dead mirror jobs" },
  "wikios.quarantine.retry": { type: "wikiSyncDeadLetter", name: "Quarantined sync step" },
  "wikios.quarantine.dismiss": { type: "wikiSyncDeadLetter", name: "Quarantined sync step" },
  "wikios.quarantine.resync": { type: "wikiSyncDeadLetter", name: "Quarantined sync step" },
};

/** Writes the audit row of an action that was done. */
export async function auditWikiosAdmin(
  auditDb: Pick<PrismaClient, "adminAuditLog">,
  actor: WikiosAdminActor,
  entry: WikiosAdminEntry
): Promise<void> {
  const target = TARGET[entry.action];
  await auditDb.adminAuditLog.create({
    data: {
      action: entry.action,
      targetType: target.type,
      targetId: entry.targetId,
      targetName: target.name,
      changes: JSON.stringify(entry.changes),
      adminId: actor.id,
      adminName: actor.name,
    },
  });
}
