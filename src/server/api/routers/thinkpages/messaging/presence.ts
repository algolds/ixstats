/**
 * ThinkPages Messaging Router — Presence (Plan 163 Legacy Adapter)
 *
 * Provides backward-compatible presence procedures.
 * All operations delegate to the canonical MessagingService.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { createMessagingService } from "~/server/modules/messaging";

export const thinkpagesMessagingPresenceRouter = createTRPCRouter({
  /**
   * Update user presence / online status (legacy ThinkPages procedure).
   */
  updatePresence: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        isOnline: z.boolean(),
        status: z.enum(["available", "busy", "away", "invisible"]).optional(),
        customStatus: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = createMessagingService({ db: ctx.db });

      const statusMap: Record<string, "online" | "away" | "offline"> = {
        available: "online",
        busy: "away",
        away: "away",
        invisible: "offline",
      };

      const normalizedStatus = input.isOnline
        ? input.status
          ? statusMap[input.status] ?? "online"
          : "online"
        : "offline";

      return await messagingService.updatePresence(input.userId, {
        status: normalizedStatus,
        customStatus: input.customStatus,
      });
    }),

  /**
   * Get presence for multiple users (legacy ThinkPages procedure).
   */
  getPresenceForUsers: publicProcedure
    .input(
      z.object({
        userIds: z.array(z.string()),
      })
    )
    .query(async ({ ctx, input }) => {
      const messagingService = createMessagingService({ db: ctx.db });
      return await messagingService.getPresenceForUsers(input.userIds);
    }),
});
