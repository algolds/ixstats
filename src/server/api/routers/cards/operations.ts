/**
 * Unified Cards Operations Log & Audit Trail Router
 *
 * Aggregates and traces all card system actions and admin audit logs:
 * - Card Designer creations and mints
 * - Lore Card Batch Studio mints, preset crawlers, and user request reviews
 * - Import Studio runs (NationStates, Wiki Lore, Commons Flags)
 * - Card Explorer management (details, stats, visibility, transfers, takedowns)
 * - Card Settings, Valuations, and Pack configurations
 * - Duplicate purging operations
 * - General Admin actions & audit trails
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export interface UnifiedLogItem {
  id: string;
  timestamp: string;
  category:
    | "all"
    | "imports"
    | "designer"
    | "lore_batch"
    | "explorer"
    | "settings"
    | "duplicates"
    | "admin";
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

export const cardsOperationsRouter = createTRPCRouter({
  /**
   * Get unified operations log and audit trail across all card systems
   */
  getUnifiedAuditLogs: adminProcedure
    .input(
      z.object({
        category: z
          .enum([
            "all",
            "imports",
            "designer",
            "lore_batch",
            "explorer",
            "settings",
            "duplicates",
            "admin",
          ])
          .default("all"),
        limit: z.number().int().min(1).max(250).default(100),
        offset: z.number().int().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const [syncLogs, auditLogs] = await Promise.all([
          ctx.db.syncLog.findMany({
            take: 200,
            orderBy: { startedAt: "desc" },
          }),
          ctx.db.auditLog.findMany({
            take: 200,
            orderBy: { timestamp: "desc" },
          }),
        ]);

        const unifiedLogs: UnifiedLogItem[] = [];

        // 1. Ingest SyncLogs
        for (const log of syncLogs) {
          let category: UnifiedLogItem["category"] = "imports";
          let actionLabel = log.syncType;
          let level: UnifiedLogItem["level"] = "info";
          let status: UnifiedLogItem["status"] = "SUCCESS";

          if (log.status === "FAILED") {
            level = "error";
            status = "FAILED";
          } else if (log.status === "PAUSED") {
            level = "warn";
            status = "PAUSED";
          } else if (log.status === "RUNNING") {
            level = "info";
            status = "RUNNING";
          }

          if (log.syncType.startsWith("NS_REGION_") || log.syncType.startsWith("NS_")) {
            category = "imports";
            actionLabel = log.syncType.replace("NS_REGION_", "Region Sync: ").replace(/_/g, " ");
          } else if (log.syncType === "lore-card-generation") {
            category = "lore_batch";
            actionLabel = "Lore Card Batch Generation";
          } else if (log.syncType === "commons-flags-sync") {
            category = "imports";
            actionLabel = "Commons Flags Import";
          } else if (log.syncType === "duplicate-purge") {
            category = "duplicates";
            actionLabel = "Duplicate Cards Purge";
          } else if (log.syncType === "custom-card-creation") {
            category = "designer";
            actionLabel = "Card Designer Studio Mint";
          }

          const processed = log.cardsProcessed ?? log.itemsProcessed ?? 0;
          const created = log.cardsCreated ?? 0;
          const updated = log.cardsUpdated ?? 0;
          const failed = log.itemsFailed ?? 0;

          let msg = `Processed ${processed} cards (Created: +${created}, Updated: +${updated})`;
          if (failed > 0) msg += `, Errors: ${failed}`;
          if (log.errorMessage) msg += ` — ${log.errorMessage.slice(0, 120)}`;

          unifiedLogs.push({
            id: `sync-${log.id}`,
            timestamp: (log.completedAt || log.startedAt).toISOString(),
            category,
            action: actionLabel,
            status,
            level,
            title: `[${category.toUpperCase()}] ${actionLabel}`,
            message: msg,
            details: log.errorMessage || null,
            metadata: (log.metadata as Record<string, unknown>) || null,
          });
        }

        // 2. Ingest AuditLogs
        for (const log of auditLogs) {
          let category: UnifiedLogItem["category"] = "admin";
          const actionUpper = log.action.toUpperCase();

          if (actionUpper.includes("DESIGNER") || actionUpper.includes("CUSTOM_CARD")) {
            category = "designer";
          } else if (actionUpper.includes("LORE") || actionUpper.includes("WIKI_CARD")) {
            category = "lore_batch";
          } else if (
            actionUpper.includes("IMPORT") ||
            actionUpper.includes("SYNC") ||
            actionUpper.includes("FLAG")
          ) {
            category = "imports";
          } else if (
            actionUpper.includes("TAKEDOWN") ||
            actionUpper.includes("RETIRE") ||
            actionUpper.includes("VISIBILITY") ||
            actionUpper.includes("TRANSFER")
          ) {
            category = "explorer";
          } else if (
            actionUpper.includes("VALUATION") ||
            actionUpper.includes("SETTING") ||
            actionUpper.includes("BONUS") ||
            actionUpper.includes("PACK")
          ) {
            category = "settings";
          } else if (actionUpper.includes("DUPLICATE") || actionUpper.includes("PURGE")) {
            category = "duplicates";
          }

          const level: UnifiedLogItem["level"] = log.success ? "info" : "error";
          const status: UnifiedLogItem["status"] = log.success ? "SUCCESS" : "FAILED";

          unifiedLogs.push({
            id: `audit-${log.id}`,
            timestamp: log.timestamp.toISOString(),
            category,
            action: log.action.replace(/_/g, " "),
            actor: log.userId,
            target: log.target,
            status,
            level,
            title: `[${category.toUpperCase()}] ${log.action.replace(/_/g, " ")}`,
            message:
              log.details ||
              `Admin action performed on ${log.target || log.entityType || "system"}`,
            details: log.error || log.details || null,
            metadata: {
              ipAddress: log.ipAddress,
              entityType: log.entityType,
            },
          });
        }

        // Sort by timestamp descending
        unifiedLogs.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Category breakdown stats
        const stats = {
          all: unifiedLogs.length,
          imports: unifiedLogs.filter((l) => l.category === "imports").length,
          designer: unifiedLogs.filter((l) => l.category === "designer").length,
          lore_batch: unifiedLogs.filter((l) => l.category === "lore_batch").length,
          explorer: unifiedLogs.filter((l) => l.category === "explorer").length,
          settings: unifiedLogs.filter((l) => l.category === "settings").length,
          duplicates: unifiedLogs.filter((l) => l.category === "duplicates").length,
          admin: unifiedLogs.filter((l) => l.category === "admin").length,
        };

        // Filter by category
        let filtered = unifiedLogs;
        if (input.category !== "all") {
          filtered = filtered.filter((l) => l.category === input.category);
        }

        // Search query filter
        if (input.search?.trim()) {
          const q = input.search.trim().toLowerCase();
          filtered = filtered.filter(
            (l) =>
              l.action.toLowerCase().includes(q) ||
              l.title.toLowerCase().includes(q) ||
              l.message.toLowerCase().includes(q) ||
              (l.details && l.details.toLowerCase().includes(q)) ||
              (l.actor && l.actor.toLowerCase().includes(q))
          );
        }

        const paginated = filtered.slice(input.offset, input.offset + input.limit);

        return {
          logs: paginated,
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
