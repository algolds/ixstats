/**
 * The owner's National budget edits (owner decision 1). Thin: input checks and the write-access
 * check here, the rules in server/modules/government/government.budget.
 */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { ALLOCATION_PERCENT_MAX } from "~/lib/government/budget-math";
import { DepartmentCategorySchema } from "~/types/government";
import {
  addDepartment,
  createGovernmentStructure,
  loadPolicyMaintenance,
  removeDepartment,
  setDepartmentAllocation,
} from "~/server/modules/government/government.budget";

const countryInput = z.object({ countryId: z.string().min(1) });
const departmentInput = countryInput.extend({ departmentId: z.string().min(1) });

export const governmentBudgetRouter = createTRPCRouter({
  /** Default departments and allocations for a nation with no government departments yet. */
  createStructure: rateLimitedMutationProcedure
    .input(countryInput.extend({ revenue: z.number().finite().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return createGovernmentStructure(ctx.db, input.countryId, input.revenue);
    }),

  /** Set a department's share of the budget in effect; its amount follows the share. */
  setAllocation: rateLimitedMutationProcedure
    .input(
      departmentInput.extend({
        allocatedPercent: z.number().finite().min(0).max(ALLOCATION_PERCENT_MAX),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return setDepartmentAllocation(ctx.db, input);
    }),

  addDepartment: rateLimitedMutationProcedure
    .input(
      countryInput.extend({
        name: z.string().trim().min(1).max(120),
        category: DepartmentCategorySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return addDepartment(ctx.db, input);
    }),

  removeDepartment: rateLimitedMutationProcedure
    .input(departmentInput)
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return removeDepartment(ctx.db, input);
    }),

  /** Policy maintenance spent per budget year. Owner and privileged roles only. */
  getPolicyMaintenance: protectedProcedure.input(countryInput).query(async ({ ctx, input }) => {
    await assertCountryWriteAccess(ctx, input.countryId);
    return loadPolicyMaintenance(ctx.db, input.countryId);
  }),
});
