/** Atlas, Jobs, storage and cron health for the Atlas strip (Task 6). Site admins only. */
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { atlasHealth } from "~/server/modules/maps/atlas-health";

export const atlasHealthRouter = createTRPCRouter({
  /** Running and failed jobs, folder sizes (null = not measured in time, cached 10 minutes) and the map cron jobs. */
  summary: adminProcedure.query(({ ctx }) => atlasHealth(ctx.db)),
});
