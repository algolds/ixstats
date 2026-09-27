import { adminProcedure } from "~/server/api/trpc";

export const managementAdminProcedures = {
  // SECURITY: Admin-only endpoint for triggering system-wide economic narratives
  triggerEconomicNarrative: adminProcedure.mutation(async ({ ctx }) => {
    console.log(`[AUDIT] Economic narrative triggered by admin userId=${ctx.auth?.userId}`);
    const { detectEconomicMilestoneAndTriggerNarrative } = await import("~/lib/activity");
    await detectEconomicMilestoneAndTriggerNarrative();
    return { success: true, message: "Economic narrative triggered" };
  }),
};
