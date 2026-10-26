/**
 * Intent router: the directive record. A nation's decision tree, what a directive changed, and the
 * resistance issues it raised.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  assertCountryResourceWriteAccess,
  hasCountryWriteAccess,
} from "~/server/shared/country-authorization";
import {
  DRAFT_DIRECTIVE_TIER,
  PUBLIC_DIRECTIVE_STATUSES,
  isPublicDirective,
} from "~/lib/country/public-record";

export const intentRecordRouter = createTRPCRouter({
  /**
   * Return a country's intents structured as a branching decision tree.
   *
   * The owner (and privileged roles) get every intent, drafts and abandoned ones included.
   * Everyone else — other players and signed-out visitors — gets the public record only:
   * enacted directives (`active`/`completed`, never the draft tier) with the package line items,
   * Executive bandwidth and cooldown redacted (`~/lib/country/public-record`).
   */
  getTree: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fullAccess = await hasCountryWriteAccess(ctx, input.countryId);
      const found = await ctx.db.intent.findMany({
        where: fullAccess
          ? { countryId: input.countryId }
          : {
              countryId: input.countryId,
              status: { in: [...PUBLIC_DIRECTIVE_STATUSES] },
              tier: { not: DRAFT_DIRECTIVE_TIER },
            },
        orderBy: { createdAt: "asc" },
      });
      const intents = fullAccess
        ? found
        : found.map((intent) => ({
            ...intent,
            changesJson: "[]",
            execBandwidthCost: null,
            cooldownUntil: null,
          }));

      const intentMap = new Map(intents.map((i) => [i.id, { ...i, children: [] as any[] }]));
      const roots: any[] = [];

      for (const intent of intentMap.values()) {
        if (intent.parentId && intentMap.has(intent.parentId)) {
          intentMap.get(intent.parentId)!.children.push(intent);
        } else {
          roots.push(intent);
        }
      }

      return { roots, allIntents: Array.from(intentMap.values()) };
    }),

  /**
   * What a directive actually changed: its CountryEventSpine ledger rows (sourceId = intent id)
   * and the GDP level effect commit() recorded (`createdBy: intent:<id>`). Read-only; the same
   * rows already surface in `mycountry.getCanonFeed`. The owner and privileged roles read any
   * directive's outcome; everyone else only an enacted one (`isPublicDirective`), NOT_FOUND
   * otherwise.
   */
  getOutcome: publicProcedure
    .input(z.object({ intentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const intent = await ctx.db.intent.findUnique({
        where: { id: input.intentId },
        select: { id: true, countryId: true, status: true, tier: true },
      });
      if (!intent) throw new TRPCError({ code: "NOT_FOUND" });
      if (!isPublicDirective(intent) && !(await hasCountryWriteAccess(ctx, intent.countryId))) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [ledger, gdpEffects] = await Promise.all([
        ctx.db.countryChangeLog.findMany({
          where: { countryId: intent.countryId, sourceId: intent.id },
          orderBy: { appliedIxTime: "asc" },
          take: 50,
          select: {
            id: true,
            targetField: true,
            previousValue: true,
            newValue: true,
            deltaValue: true,
            appliedIxTime: true,
          },
        }),
        ctx.db.storytellerEffect.findMany({
          where: { countryId: intent.countryId, createdBy: `intent:${intent.id}` },
          take: 10,
          select: { id: true, value: true, duration: true, isActive: true },
        }),
      ]);

      const toNumber = (raw: string | null): number | null => {
        if (raw == null) return null;
        const n = Number(JSON.parse(raw));
        return Number.isFinite(n) ? n : null;
      };

      return {
        ledger: ledger.map((row) => {
          let previousValue: number | null = null;
          let newValue: number | null = null;
          try {
            previousValue = toNumber(row.previousValue);
            newValue = toNumber(row.newValue);
          } catch {
            /* non-numeric ledger value — show the delta only */
          }
          return {
            id: row.id,
            targetField: row.targetField,
            deltaValue: row.deltaValue,
            previousValue,
            newValue,
            appliedIxTime: row.appliedIxTime,
          };
        }),
        gdpEffects,
      };
    }),

  /**
   * Return resistance issues linked to an intent (progress traceability for the drill sheet).
   * Owner / privileged roles only: open issues are private.
   */
  getLinkedIssues: protectedProcedure
    .input(z.object({ intentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const intent = await ctx.db.intent.findUnique({
        where: { id: input.intentId },
        select: { countryId: true },
      });
      await assertCountryResourceWriteAccess(ctx, intent?.countryId, "Intent");
      if (!intent) throw new TRPCError({ code: "NOT_FOUND", message: "Intent not found" });

      const issues = await ctx.db.nationalIssue.findMany({
        where: { intentId: input.intentId, countryId: intent.countryId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          severity: true,
          domain: true,
          deadlineIxTime: true,
          respondedAt: true,
          chosenOptionLabel: true,
          createdAt: true,
        },
      });

      const resolved = issues.filter((i) =>
        ["responded", "auto_resolved", "dismissed"].includes(i.status)
      ).length;

      return {
        issues,
        resolvedCount: resolved,
        totalCount: issues.length,
        progress: issues.length === 0 ? 0 : Math.round((resolved / issues.length) * 100),
      };
    }),
});
