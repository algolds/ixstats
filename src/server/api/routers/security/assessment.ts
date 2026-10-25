// Security assessment, derived on read (owner decision 4): military strength from the force
// structure against the nation's neighbours and rivals, threats from its conflicts, the hostile
// foreign-policy actions against it and its active crises. Nothing is stored.

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { loadThreatPicture } from "~/lib/military/threat-picture-loader";

export const securityAssessmentRouter = createTRPCRouter({
  getSecurityAssessment: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const picture = await loadThreatPicture(ctx.db, input.countryId);
      return {
        countryId: input.countryId,
        overallSecurityScore: picture.overallSecurityScore,
        securityLevel: picture.securityLevel,
        militaryStrength: picture.militaryStrength,
        combatStrength: picture.combatStrength,
        borderSecurity: picture.borderSecurity,
        activeThreatCount: picture.activeThreatCount,
        highSeverityThreats: picture.highSeverityThreats,
        activeThreats: picture.threats,
      };
    }),
});
