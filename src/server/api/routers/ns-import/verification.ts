/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/nationstates/api-client";
import { TRPCError } from "@trpc/server";

export const nsImportVerificationRouter = createTRPCRouter({
  /**
   * Request verification for nation ownership
   * Returns the URL the user should visit to get their verification code
   */
  requestVerification: rateLimitedMutationProcedure
    .input(
      z.object({
        nationName: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if nation exists
      const exists = await nsApiClient.verifyNation(input.nationName);
      if (!exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nation not found on NationStates",
        });
      }

      // Check for existing pending verification
      const existingVerification = await ctx.db.nSVerification.findFirst({
        where: {
          userId: ctx.user.id,
          nationName: input.nationName,
          verified: false,
        },
      });

      if (existingVerification) {
        return {
          verificationUrl: nsApiClient.getVerificationUrl(input.nationName),
          verificationId: existingVerification.id,
          nationName: input.nationName,
        };
      }

      // Create new verification record
      const verification = await ctx.db.nSVerification.create({
        data: {
          id: `nsv_${Date.now()}_${ctx.user.id}`,
          userId: ctx.user.id,
          nationName: input.nationName,
          verificationCode: "", // Will be provided by user from NS
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      return {
        verificationUrl: nsApiClient.getVerificationUrl(input.nationName),
        verificationId: verification.id,
        nationName: input.nationName,
      };
    }),

  /**
   * Verify nation ownership with checksum code from NS
   */
  checkVerification: rateLimitedMutationProcedure
    .input(
      z.object({
        verificationId: z.string(),
        checksum: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const verification = await ctx.db.nSVerification.findUnique({
        where: { id: input.verificationId },
      });

      if (!verification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Verification not found",
        });
      }

      if (verification.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not your verification",
        });
      }

      if (verification.verified) {
        return {
          verified: true,
          nationName: verification.nationName,
        };
      }

      // Verify with NS API
      const isVerified = await nsApiClient.verifyOwnership(verification.nationName, input.checksum);

      if (isVerified) {
        // Mark as verified
        await ctx.db.nSVerification.update({
          where: { id: input.verificationId },
          data: {
            verified: true,
            verifiedAt: new Date(),
            verificationCode: input.checksum,
          },
        });

        return {
          verified: true,
          nationName: verification.nationName,
        };
      }

      return {
        verified: false,
        nationName: verification.nationName,
      };
    }),
});
