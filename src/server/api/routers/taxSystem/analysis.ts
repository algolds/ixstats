import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { TaxBuilderState } from "~/types/builder/tax-builder";
import { detectTaxConflicts } from "~/server/services/builderIntegrationService";
import { TaxBuilderStateSchema } from "~/types/tax-system";

export const taxSystemAnalysisRouter = createTRPCRouter({
  // Check for conflicts before creating/updating
  checkConflicts: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: TaxBuilderStateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const warnings = await detectTaxConflicts(
        ctx.db as any,
        input.countryId,
        input.data as TaxBuilderState
      );
      return { warnings };
    }),
});
