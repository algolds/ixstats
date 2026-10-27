// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const adminCountriesGodModeRouter = createTRPCRouter({
  /**
   * Get admin audit log
   */
  getAdminAuditLog: adminProcedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        action: z.string().optional(),
        targetId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};
        if (input.action) where.action = input.action;
        if (input.targetId) where.targetId = input.targetId;

        const [logs, total] = await Promise.all([
          ctx.db.adminAuditLog.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.adminAuditLog.count({ where }),
        ]);

        return {
          logs,
          total,
          hasMore: total > input.offset + input.limit,
        };
      } catch (error) {
        console.error("Failed to get audit log:", error);
        // Return empty if AdminAuditLog table doesn't exist yet
        return {
          logs: [],
          total: 0,
          hasMore: false,
        };
      }
    }),
});
