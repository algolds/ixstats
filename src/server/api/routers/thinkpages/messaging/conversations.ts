/**
 * ThinkPages Messaging Router — Conversations (Plan 163 Legacy Adapter)
 *
 * Provides backward-compatible ThinkShare conversation procedures.
 * All operations delegate to the canonical MessagingService.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { createMessagingService } from "~/server/modules/messaging";
import { notificationAPI } from "~/lib/notifications/api";
import { getThinkPagesServer } from "~/server/websocket-server";
import { forumBridge } from "~/server/modules/forum";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";

export const thinkpagesMessagingConversationsRouter = createTRPCRouter({
  /**
   * Create a conversation (legacy ThinkPages procedure).
   */
  createConversation: protectedProcedure
    .input(
      z.object({
        participantIds: z.array(z.string()).min(1),
        type: z.enum(["direct", "group"]).optional().default("direct"),
        name: z.string().optional(),
        isEncrypted: z.boolean().optional().default(false),
        channelType: z.enum(["BILATERAL", "MULTILATERAL", "EMERGENCY"]).optional(),
        source: z.string().optional().default("thinkshare"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      return await messagingService.createConversation(ctx.auth.userId, {
        participantIds: input.participantIds,
        subject: input.name,
        source: (input.source as any) || "thinkshare",
      });
    }),

  /**
   * Get conversations for a user (legacy ThinkPages procedure).
   */
  getConversations: publicProcedure
    .input(
      z
        .object({
          userId: z.string().optional().default(""),
          limit: z.number().min(1).max(50).optional().default(20),
          cursor: z.string().optional(),
        })
        .optional()
        .default(() => ({ userId: "", limit: 20 }))
    )
    .query(async ({ ctx, input }) => {
      const actorId = input?.userId || ctx.auth?.userId || "";
      if (!actorId || actorId.trim() === "" || actorId === "INVALID") {
        return {
          conversations: [],
          nextCursor: undefined,
        };
      }

      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      return await messagingService.getConversationsLegacy(actorId, {
        limit: input?.limit,
        cursor: input?.cursor,
      });
    }),

  /**
   * Create a conversation between two countries' official accounts.
   */
  createConversationByCountries: protectedProcedure
    .input(
      z.object({
        fromCountryId: z.string(),
        toCountryId: z.string(),
        initialMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      return await messagingService.createConversationByCountries(ctx.auth.userId, {
        countryIds: [input.fromCountryId, input.toCountryId],
        initialMessage: input.initialMessage,
      });
    }),
});
