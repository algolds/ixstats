/**
 * The admin side of the WikiOS editing switch (editing-switch.ts): status for /admin/wikios-settings, and the flip,
 * which refuses to turn editing on before the mirror can write, writes an AdminAuditLog row, and DMs the admin.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { sendAdminDm } from "~/lib/discord/admin-dm";
import {
  isWikiosEditingEnabled,
  isWikiosEditingForcedByEnv,
  refreshWikiosEditingFlag,
  setWikiosEditingFlag,
} from "~/lib/wiki-os/editing-switch";
import { db } from "~/server/db";
import { mirrorMissingSettings } from "./mirror-admin";
import { MIRROR_SOURCE } from "./mirror-outbox";

export interface EditingStatus {
  enabled: boolean;
  forcedByEnv: boolean;
  mirrorConfigured: boolean;
  missing: string[];
}

export async function getEditingStatus(): Promise<EditingStatus> {
  await refreshWikiosEditingFlag(true);
  const missing = mirrorMissingSettings();
  return {
    enabled: isWikiosEditingEnabled(),
    forcedByEnv: isWikiosEditingForcedByEnv(),
    mirrorConfigured: missing.length === 0,
    missing,
  };
}

function refuse(message: string): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}

export async function setEditing(
  auditDb: Pick<PrismaClient, "adminAuditLog">,
  actor: { id: string; clerkUserId: string; name: string },
  enabled: boolean
): Promise<EditingStatus> {
  const before = await getEditingStatus();
  if (before.forcedByEnv)
    refuse("WIKIOS_V1_ENABLED forces WikiOS editing on; change it in the environment.");
  if (before.enabled === enabled) return before;
  if (enabled && !before.mirrorConfigured) {
    refuse(`The MediaWiki mirror is not configured: ${before.missing.join(", ")}.`);
  }

  await setWikiosEditingFlag(enabled);
  await auditDb.adminAuditLog.create({
    data: {
      action: enabled ? "wikios.editing.enable" : "wikios.editing.disable",
      targetType: "wikios",
      targetId: "wikios_editing_enabled",
      targetName: "WikiOS editing",
      changes: JSON.stringify({ from: before.enabled, to: enabled }),
      adminId: actor.id,
      adminName: actor.name,
    },
  });
  void notify(actor.name, enabled);
  return { ...before, enabled };
}

/** Fire-and-forget: a Discord or database hiccup must never fail a switch that already happened. */
async function notify(name: string, enabled: boolean): Promise<void> {
  try {
    const waiting = enabled
      ? 0
      : await db.wikiMirrorJob.count({
          where: { source: MIRROR_SOURCE, state: { in: ["pending", "running"] } },
        });
    const tail = enabled ? "" : ` (${waiting} mirror jobs still draining to MediaWiki)`;
    await sendAdminDm(`WikiOS editing turned ${enabled ? "on" : "off"} by ${name}${tail}`);
  } catch (error) {
    console.warn(
      "[wikios] editing switch DM failed:",
      error instanceof Error ? error.message : error
    );
  }
}
