/**
 * The IIWiki admin panel (/admin/iiwiki): status, the IIWiki switch, the breaker reset and the live test. Admin only.
 */
import { z } from "zod/v4";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { IIWIKI_FEATURE_IDS, type IiwikiFeature } from "~/lib/wiki-os/iiwiki-switch";
import {
  getIiwikiStatus,
  resetIiwikiCircuit,
  runIiwikiLiveTest,
  updateIiwikiSwitch,
} from "~/lib/wiki-os/services/iiwiki-admin";

const featureFlags = z.object(
  Object.fromEntries(IIWIKI_FEATURE_IDS.map((id) => [id, z.boolean()])) as Record<
    IiwikiFeature,
    z.ZodBoolean
  >
);

const actorOf = (user: { id: string; clerkUserId: string; handle: string | null }) => ({
  id: user.id,
  name: user.handle ?? user.clerkUserId,
});

export const wikiosIiwikiRouter = createTRPCRouter({
  getIiwikiStatus: adminProcedure.query(() => getIiwikiStatus()),

  setIiwikiSwitch: adminProcedure
    .input(z.object({ enabled: z.boolean(), features: featureFlags }))
    .mutation(({ ctx, input }) => updateIiwikiSwitch(ctx.db, actorOf(ctx.user), input)),

  resetIiwikiCircuit: adminProcedure.mutation(({ ctx }) =>
    resetIiwikiCircuit(ctx.db, actorOf(ctx.user))
  ),

  runIiwikiLiveTest: adminProcedure.mutation(() => runIiwikiLiveTest()),
});
