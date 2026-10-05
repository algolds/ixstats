// Policy lifecycle: repeal (MC-5). Expiry runs in the policy-maintenance job.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, lightMutationProcedure } from "~/server/api/trpc";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { ENACTED_POLICY_STATUSES, endPolicy } from "~/lib/policies/lifecycle";

export const policiesLifecycleRouter = createTRPCRouter({
  /**
   * Repeal an enacted (active or suspended) policy. Its CivCap is released (only active
   * policies count toward CivCap), its growth effect is cleared, and later maintenance runs
   * stop debiting it. Country owner or privileged roles only.
   */
  repealPolicy: lightMutationProcedure
    .input(
      z.object({
        policyId: z.string().min(1),
        reason: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.findUnique({
        where: { id: input.policyId },
        select: { id: true, countryId: true, name: true, status: true, civCapCost: true },
      });
      if (!policy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Policy not found" });
      }
      await assertCountryWriteAccess(ctx, policy.countryId);

      const enacted = (ENACTED_POLICY_STATUSES as readonly string[]).includes(policy.status);
      const repealed =
        enacted &&
        (await endPolicy(ctx.db as PrismaClient, policy.id, "repealed", input.reason || undefined));
      if (!repealed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only an enacted policy can be repealed",
        });
      }

      return {
        id: policy.id,
        status: "repealed" as const,
        civCapReleased: policy.status === "active" ? policy.civCapCost : 0,
      };
    }),
});
