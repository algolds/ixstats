/**
 * User Logging and Analytics tRPC Router
 *
 * Provides endpoints for accessing user activity logs, analytics,
 * and behavior insights.
 */

import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { ErrorLogger, FeedbackLogger } from "~/lib/logging";
import { SYSTEM_OWNER_IDS } from "~/lib/auth/system-owner-constants";
import { notificationAPI } from "~/lib/notifications/api";
import { TRPCError } from "@trpc/server";

export const userLoggingRouter = createTRPCRouter({
  /**
   * Submit user feedback with diagnostic logs
   */
  submitFeedback: rateLimitedMutationProcedure
    .input(
      z.object({
        feedbackType: z.string(),
        message: z.string(),
        url: z.string(),
        userAgent: z.string(),
        logs: z.array(
          z.object({
            type: z.string(),
            message: z.string(),
            timestamp: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // 1. Route to file log in logs/feedback
        FeedbackLogger.logFeedback({
          timestamp: new Date().toISOString(),
          userId: ctx.user.id,
          username: (ctx.user as any).username || (ctx.user as any).clerkUserId || ctx.user.id,
          countryId: ctx.user.countryId || null,
          feedbackType: input.feedbackType,
          message: input.message,
          url: input.url,
          userAgent: input.userAgent,
          logsCount: input.logs?.length ?? 0,
          logs: input.logs,
        });

        // 2. Persist to systemLog database table
        await ctx.db.systemLog.create({
          data: {
            level: "INFO",
            category: "USER_FEEDBACK",
            message: `Feedback (${input.feedbackType}): ${input.message.slice(0, 200)}`,
            userId: ctx.user.id,
            countryId: ctx.user.countryId || null,
            userAgent: input.userAgent.slice(0, 255),
            metadata: JSON.stringify({
              feedbackType: input.feedbackType,
              message: input.message,
              url: input.url,
              consoleLogs: input.logs,
            }),
          },
        });

        // 3. Dispatch alert and direct messages to all administrators
        const admins = await ctx.db.user.findMany({
          where: {
            OR: [
              { role: { name: { in: ["admin", "system-owner", "owner", "staff"] } } },
              { clerkUserId: { in: Array.from(SYSTEM_OWNER_IDS) } },
              { id: { in: Array.from(SYSTEM_OWNER_IDS) } },
            ],
          },
          select: { id: true, clerkUserId: true, wikiUsername: true, discordUsername: true },
        });

        const submitterName =
          (ctx.user as any).username || (ctx.user as any).clerkUserId || ctx.user.id || "User";
        const feedbackHeadline = `[Feedback] ${input.feedbackType.toUpperCase()} from ${submitterName}`;
        const feedbackContent = `📬 **New User Feedback (${input.feedbackType.toUpperCase()})**\n\n**Submitted by:** ${submitterName} (\`${ctx.user.id}\`)\n**Origin Page:** ${input.url}\n\n**Message:**\n${input.message}\n\n*Diagnostic logs attached: ${input.logs?.length ?? 0} entries*`;

        // Send notifications to all admins
        if (admins.length > 0) {
          await Promise.allSettled(
            admins.map((admin) =>
              notificationAPI.create({
                title: feedbackHeadline,
                message: input.message.slice(0, 160) + (input.message.length > 160 ? "..." : ""),
                category: "system",
                priority: "high",
                type: "alert",
                userId: admin.id,
                metadata: {
                  feedbackType: input.feedbackType,
                  url: input.url,
                  submittedByUserId: ctx.user.id,
                },
              })
            )
          );
        }

        // Deliver direct message in ThinkShare for each admin
        for (const admin of admins) {
          if (admin.id === ctx.user.id) continue;
          try {
            let conv = await ctx.db.thinkshareConversation.findFirst({
              where: {
                type: "direct",
                source: "system",
                participants: {
                  every: {
                    userId: { in: [ctx.user.id, admin.id] },
                  },
                },
              },
            });

            if (!conv) {
              conv = await ctx.db.thinkshareConversation.create({
                data: {
                  name: `Feedback: ${input.feedbackType}`,
                  type: "direct",
                  source: "system",
                  lastActivity: new Date(),
                  participants: {
                    create: [
                      { userId: ctx.user.id, role: "member" },
                      { userId: admin.id, role: "admin" },
                    ],
                  },
                },
              });
            } else {
              await ctx.db.thinkshareConversation.update({
                where: { id: conv.id },
                data: { lastActivity: new Date() },
              });
            }

            await ctx.db.thinkshareMessage.create({
              data: {
                conversationId: conv.id,
                userId: ctx.user.id,
                content: feedbackContent,
                source: "system",
                isSystem: true,
              },
            });
          } catch (msgErr) {
            console.error(`[Feedback] Failed to dispatch DM to admin ${admin.id}:`, msgErr);
          }
        }

        return {
          success: true,
          message: "Feedback submitted successfully",
        };
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          component: "UserLoggingRouter",
          action: "SUBMIT_FEEDBACK",
          userId: ctx.user?.id,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit feedback",
        });
      }
    }),
});
