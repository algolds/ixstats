// Security assessment, derived on read (owner decision 4): military strength from the defense
// model's combat power (realm time D2a) against the nation's neighbours and rivals, threats from its conflicts, the hostile
// foreign-policy actions against it and its active crises. Nothing is stored.

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { threatPictureFor } from "~/server/modules/defense";

export const securityAssessmentRouter = createTRPCRouter({
  getSecurityAssessment: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const picture = await threatPictureFor(ctx.db, input.countryId);
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
