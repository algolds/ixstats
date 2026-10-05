// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { computeInternalStability } from "~/lib/statecraft/stability-store";

import { notificationAPI } from "~/lib/notifications/api";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";

// ===========================
// Input Validation Schemas
// ===========================

// ===========================
// Security Router
// ===========================

export const securityStabilityRouter = createTRPCRouter({
  // ===========================
  // Internal Stability Endpoints
  // ===========================

  getInternalStability: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // The formula plus the stored row's event (issue/directive) deltas, computed without
      // writing (MC-13); the stat-progression job and the issue path persist it.
      const metrics = await computeInternalStability(ctx.db, input.countryId);

      if (!metrics) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country not found",
        });
      }

      const activeEvents = await ctx.db.securityEvent.findMany({
        where: {
          countryId: input.countryId,
          status: "active",
        },
        orderBy: { startDate: "desc" },
      });

      return { metrics, activeEvents };
    }),

  resolveSecurityEvent: premiumProcedure
    .input(
      z.object({
        id: z.string(),
        resolutionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const event = await ctx.db.securityEvent.findUnique({
        where: { id: input.id },
        include: { country: { select: { name: true } } },
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Security event not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== event.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only resolve your own country's security events",
        });
      }

      const resolved = await ctx.db.securityEvent.update({
        where: { id: input.id },
        data: {
          status: "resolved",
          endDate: new Date(),
          resolutionNotes: input.resolutionNotes,
        },
      });

      // Notification: security event resolved (fire-and-forget)
      try {
        if (ctx.auth?.userId) {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            countryId: event.countryId,
            title: "Threat Resolved",
            message: "A security event has been successfully resolved",
            type: "info",
            category: "security",
            priority: "medium",
            metadata: { eventId: input.id },
          });
        }
      } catch (err) {
        console.warn("[Stability] Resolution notification failed for event", input.id, err);
      }

      // Canon news: security/stability event resolved
      void generateDiplomaticNews(ctx.db as any, event.countryId, "security_event_resolved", {
        countryName: event.country?.name ?? "A nation",
        eventType: resolved.eventType,
        severity: resolved.severity,
        notes: input.resolutionNotes,
      });

      return resolved;
    }),
});
