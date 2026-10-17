/**
 * The card admin's audit trail: one AuditLog row per admin action, naming the admin, the card (or job, pack or
 * player) and what happened. The Overview's activity feed reads these rows (`CARD_FEED_ACTIONS`).
 */
import type { Prisma } from "@prisma/client";

export const CARD_AUDIT_ACTIONS = [
  "CARD_REVIEW",
  "CARD_RARITY_OVERRIDE",
  "CARD_UPDATE",
  "CARD_HIDE",
  "CARD_GRANT",
  "CARD_REVOKE",
  "CARD_AUCTION_CANCEL",
  "CARD_TRADE_VOID",
  "CARD_PACK_SAVE",
  "CARD_PACK_AWARD",
  "CARD_ECONOMY_SAVE",
  "CARD_SEASON_SET",
  "CARD_TAKEDOWN",
  "CARD_LICENCE",
  "CARD_SPECIAL_SAVE",
  "CARD_SUGGESTION",
  "CARD_IMPORT",
  "TROPHY_REASSIGN",
  "TROPHY_VOID",
] as const;
export type CardAuditAction = (typeof CARD_AUDIT_ACTIONS)[number];

/** Card actions older code wrote before this trail (the designer and Lore mints, the Lore author and type backfills). */
const LEGACY_CARD_AUDIT_ACTIONS = [
  "CARD_DESIGNER_MINT",
  "CARD_AUTHORS_BACKFILLED",
  "LORE_CARD_MINT",
  "LORE_CARDS_RECLASSIFIED",
] as const;

/**
 * Every action the Overview feed reads. An exact list rather than a `CARD_` prefix, because `action IN (...)` uses the
 * AuditLog action index and a `LIKE 'CARD\_%'` does not under the database's collation.
 */
export const CARD_FEED_ACTIONS: readonly string[] = [
  ...CARD_AUDIT_ACTIONS,
  ...LEGACY_CARD_AUDIT_ACTIONS,
];

/** The admin acting: DB id for the rows they change, Clerk id for the audit row. */
export interface CardAdminActor {
  dbId: string;
  clerkId: string;
}

export interface CardAuditEntry {
  action: CardAuditAction;
  /** The admin's Clerk id, as the audit middleware records it; null for a cron. */
  actor: string | null;
  target?: string | null;
  details: string;
}

export async function recordCardAudit(
  db: Pick<Prisma.TransactionClient, "auditLog">,
  entry: CardAuditEntry
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: entry.actor,
      action: entry.action,
      entityType: "CARD",
      target: entry.target ?? null,
      details: entry.details.slice(0, 1000),
      success: true,
    },
  });
}
