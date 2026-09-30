import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";
import {
  DRAFT_DIRECTIVE_TIER,
  PUBLIC_DIRECTIVE_STATUSES,
  PUBLIC_ISSUE_STATUSES,
  toPublicDirectives,
  toPublicIssueOutcomes,
} from "~/lib/country/public-record";

/**
 * The country profile's public record (`/countries/[slug]`), readable by anyone, signed out
 * included. Only enacted directives and resolved national issues leave the server, and only
 * their public fields: no drafts, abandoned directives, open/expired/dismissed issues, package
 * line items, budgets, CivCap or applied consequences (`~/lib/country/public-record`).
 */
export const publicRecordProcedures = {
  getPublicRecord: publicProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        directiveLimit: z.number().int().min(1).max(100).default(50),
        issueLimit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const [intents, issues] = await Promise.all([
        ctx.db.intent.findMany({
          where: {
            countryId: input.countryId,
            status: { in: [...PUBLIC_DIRECTIVE_STATUSES] },
            tier: { not: DRAFT_DIRECTIVE_TIER },
          },
          orderBy: { createdIxTime: "desc" },
          take: input.directiveLimit,
          select: {
            id: true,
            goal: true,
            summary: true,
            tier: true,
            category: true,
            status: true,
            progress: true,
            createdIxTime: true,
          },
        }),
        ctx.db.nationalIssue.findMany({
          where: {
            countryId: input.countryId,
            status: { in: [...PUBLIC_ISSUE_STATUSES] },
          },
          orderBy: { respondedAt: "desc" },
          take: input.issueLimit,
          select: {
            id: true,
            title: true,
            domain: true,
            status: true,
            chosenOptionLabel: true,
            autoResolveLabel: true,
            consequenceLog: true,
            respondedIxTime: true,
            createdIxTime: true,
          },
        }),
      ]);

      return {
        directives: toPublicDirectives(intents),
        issueOutcomes: toPublicIssueOutcomes(issues),
      };
    }),
};
