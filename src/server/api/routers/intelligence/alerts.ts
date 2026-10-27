/**
 * Intelligence alerts: the country owner's inbox for the threshold-breach alerts raised by
 * `server/shared/intelligence-alert-thresholds.ts`. MyCountry's overview reads them
 * (`IntelligenceAlertsCard`); the owner marks them read or dismisses them.
 *
 * Owner / privileged roles only: alerts reveal a nation's private metrics.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  assertCountryResourceWriteAccess,
  assertCountryWriteAccess,
} from "~/server/shared/country-authorization";
import type { db } from "~/server/db";

/** Fields the MyCountry alerts card needs. */
const ALERT_SELECT = {
  id: true,
  title: true,
  description: true,
  severity: true,
  category: true,
  alertType: true,
  currentValue: true,
  expectedValue: true,
  detectedAt: true,
  readAt: true,
  isResolved: true,
  resolvedAt: true,
} as const;

/** Most severe first; the enum carries both cases from older writers. */
const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function severityRank(severity: string): number {
  return SEVERITY_RANK[severity.toLowerCase()] ?? 4;
}

/** Older threshold alerts carried a leading siren emoji in the title; show the words only. */
export function cleanAlertTitle(title: string): string {
  return title.replace(/^[^\p{L}\p{N}]+/u, "").trim() || title;
}

type AlertCtx = Parameters<typeof assertCountryWriteAccess>[0] & { db: typeof db };

/** Loads an alert after checking the caller may act for its country. */
async function loadOwnedAlert(ctx: AlertCtx, id: string) {
  const alert = await ctx.db.intelligenceAlert.findUnique({
    where: { id },
    select: { id: true, countryId: true, readAt: true, isResolved: true },
  });
  await assertCountryResourceWriteAccess(ctx, alert?.countryId, "Alert");
  if (!alert) throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
  return alert;
}

export const intelAlertsRouter = createTRPCRouter({
  /** The nation's alerts: open ones by default, most severe and newest first, plus counts. */
  getMyAlerts: protectedProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        includeResolved: z.boolean().default(false),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      const openWhere = { countryId: input.countryId, isActive: true, isResolved: false };
      const [rows, openCount, unreadCount] = await Promise.all([
        ctx.db.intelligenceAlert.findMany({
          where: input.includeResolved ? { countryId: input.countryId } : openWhere,
          orderBy: { detectedAt: "desc" },
          take: input.limit,
          select: ALERT_SELECT,
        }),
        ctx.db.intelligenceAlert.count({ where: openWhere }),
        ctx.db.intelligenceAlert.count({ where: { ...openWhere, readAt: null } }),
      ]);

      const alerts = rows
        .map((a) => ({ ...a, title: cleanAlertTitle(a.title) }))
        .sort(
          (a, b) =>
            Number(a.isResolved) - Number(b.isResolved) ||
            severityRank(a.severity) - severityRank(b.severity) ||
            b.detectedAt.getTime() - a.detectedAt.getTime()
        );

      return { alerts, openCount, unreadCount };
    }),

  /** Marks one alert read. Already-read alerts keep their first read time. */
  markAlertRead: rateLimitedMutationProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const alert = await loadOwnedAlert(ctx, input.id);
      if (!alert.readAt) {
        await ctx.db.intelligenceAlert.update({
          where: { id: input.id },
          data: { readAt: new Date() },
        });
      }
      return { success: true };
    }),

  /** Marks every open alert of the nation read. */
  markAllAlertsRead: rateLimitedMutationProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const { count } = await ctx.db.intelligenceAlert.updateMany({
        where: { countryId: input.countryId, isResolved: false, readAt: null },
        data: { readAt: new Date() },
      });
      return { success: true, count };
    }),

  /**
   * Dismisses (resolves) an alert. If the metric is still out of range, the next threshold
   * evaluation raises a fresh alert, since it only skips breaches with an open alert.
   */
  dismissAlert: rateLimitedMutationProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const alert = await loadOwnedAlert(ctx, input.id);
      if (!alert.isResolved) {
        const now = new Date();
        await ctx.db.intelligenceAlert.update({
          where: { id: input.id },
          data: { isResolved: true, isActive: false, resolvedAt: now, readAt: alert.readAt ?? now },
        });
      }
      return { success: true };
    }),
});
