// Border security, derived on read (owner decision 4) from the nation's map neighbours: each
// neighbour's threat comes from its combat strength against ours, the relation with it, and any
// conflict or hostile action between us. Nothing is stored.

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { loadThreatPicture } from "~/lib/military/threat-picture-loader";

export const securityBordersRouter = createTRPCRouter({
  getBorderSecurity: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const picture = await loadThreatPicture(ctx.db, input.countryId);
      return {
        countryId: input.countryId,
        overallSecurityLevel: picture.borderSecurity,
        securityStatus: picture.borderStatus,
        landBorders: picture.landBorders,
        activeThreatCount: picture.activeThreatCount,
        neighborThreats: picture.neighborThreats,
      };
    }),
});
