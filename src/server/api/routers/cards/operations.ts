/** Unified card-system operations log: sync runs and admin audit trail in one feed. */

import type { AuditLog, SyncLog } from "@prisma/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

const CATEGORIES = [
  "imports",
  "designer",
  "lore_batch",
  "explorer",
  "settings",
  "duplicates",
  "admin",
] as const;

type LogCategory = (typeof CATEGORIES)[number];

interface UnifiedLogItem {
  id: string;
  timestamp: string;
  category: LogCategory;
  action: string;
  actor?: string | null;
  target?: string | null;
  status: "SUCCESS" | "FAILED" | "PAUSED" | "RUNNING" | "INFO";
  level: "info" | "warn" | "error" | "success";
  title: string;
  message: string;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
}

type SyncOutcome = Pick<UnifiedLogItem, "status" | "level">;

const DEFAULT_SYNC_STATUS: SyncOutcome = { status: "SUCCESS", level: "info" };

const SYNC_STATUS: Record<string, SyncOutcome> = {
  FAILED: { status: "FAILED", level: "error" },
  PAUSED: { status: "PAUSED", level: "warn" },
  RUNNING: { status: "RUNNING", level: "info" },
};

const SYNC_TYPES: Record<string, { category: LogCategory; label: string }> = {
  "lore-card-generation": { category: "lore_batch", label: "Lore Card Batch Generation" },
  "commons-flags-sync": { category: "imports", label: "Commons Flags Import" },
  "duplicate-purge": { category: "duplicates", label: "Duplicate Cards Purge" },
  "custom-card-creation": { category: "designer", label: "Card Designer Studio Mint" },
};

/** First matching rule wins; anything else is a plain admin action. */
const AUDIT_CATEGORY_KEYWORDS: ReadonlyArray<readonly [LogCategory, readonly string[]]> = [
  ["designer", ["DESIGNER", "CUSTOM_CARD"]],
  ["lore_batch", ["LORE", "WIKI_CARD"]],
  ["imports", ["IMPORT", "SYNC", "FLAG"]],
  ["explorer", ["TAKEDOWN", "RETIRE", "VISIBILITY", "TRANSFER"]],
  ["settings", ["VALUATION", "SETTING", "BONUS", "PACK"]],
  ["duplicates", ["DUPLICATE", "PURGE"]],
];

function syncLogItem(log: SyncLog): UnifiedLogItem {
  const classified = log.syncType.startsWith("NS_")
    ? {
        category: "imports" as const,
        label: log.syncType.replace("NS_REGION_", "Region Sync: ").replace(/_/g, " "),
      }
    : (SYNC_TYPES[log.syncType] ?? { category: "imports" as const, label: log.syncType });

  const processed = log.cardsProcessed ?? log.itemsProcessed ?? 0;
  const failed = log.itemsFailed ?? 0;
  let message = `Processed ${processed} cards (Created: +${log.cardsCreated ?? 0}, Updated: +${log.cardsUpdated ?? 0})`;
  if (failed > 0) message += `, Errors: ${failed}`;
  if (log.errorMessage) message += ` — ${log.errorMessage.slice(0, 120)}`;

  return {
    id: `sync-${log.id}`,
    timestamp: (log.completedAt || log.startedAt).toISOString(),
    category: classified.category,
    action: classified.label,
    ...(SYNC_STATUS[log.status] ?? DEFAULT_SYNC_STATUS),
    title: `[${classified.category.toUpperCase()}] ${classified.label}`,
    message,
    details: log.errorMessage || null,
    metadata: (log.metadata as Record<string, unknown>) || null,
  };
}

function auditLogItem(log: AuditLog): UnifiedLogItem {
  const actionUpper = log.action.toUpperCase();
  const category =
    AUDIT_CATEGORY_KEYWORDS.find(([, words]) => words.some((w) => actionUpper.includes(w)))?.[0] ??
    "admin";
  const action = log.action.replace(/_/g, " ");
  return {
    id: `audit-${log.id}`,
    timestamp: log.timestamp.toISOString(),
    category,
    action,
    actor: log.userId,
    target: log.target,
    status: log.success ? "SUCCESS" : "FAILED",
    level: log.success ? "info" : "error",
    title: `[${category.toUpperCase()}] ${action}`,
    message: log.details || `Admin action performed on ${log.target || log.entityType || "system"}`,
    details: log.error || log.details || null,
    metadata: { ipAddress: log.ipAddress, entityType: log.entityType },
  };
}

export const cardsOperationsRouter = createTRPCRouter({
  /**
   * Get unified operations log and audit trail across all card systems
   */
  getUnifiedAuditLogs: adminProcedure
    .input(
      z.object({
        category: z.enum(["all", ...CATEGORIES]).default("all"),
        limit: z.number().int().min(1).max(250).default(100),
        offset: z.number().int().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const [syncLogs, auditLogs] = await Promise.all([
          ctx.db.syncLog.findMany({ take: 200, orderBy: { startedAt: "desc" } }),
          ctx.db.auditLog.findMany({ take: 200, orderBy: { timestamp: "desc" } }),
        ]);

        const unifiedLogs = [...syncLogs.map(syncLogItem), ...auditLogs.map(auditLogItem)].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const stats = {
          all: unifiedLogs.length,
          ...Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
        } as Record<"all" | LogCategory, number>;
        for (const log of unifiedLogs) stats[log.category]++;

        let filtered =
          input.category === "all"
            ? unifiedLogs
            : unifiedLogs.filter((l) => l.category === input.category);

        const q = input.search?.trim().toLowerCase();
        if (q) {
          filtered = filtered.filter((l) =>
            [l.action, l.title, l.message, l.details, l.actor].some((field) =>
              field?.toLowerCase().includes(q)
            )
          );
        }

        return {
          logs: filtered.slice(input.offset, input.offset + input.limit),
          total: filtered.length,
          stats,
        };
      } catch (error) {
        console.error("[CARDS_OPERATIONS] Error in getUnifiedAuditLogs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch unified audit logs",
        });
      }
    }),
});
