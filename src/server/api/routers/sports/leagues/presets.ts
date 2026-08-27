/**
 * Sports Leagues — Presets Router
 */

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getAllPresets } from "~/lib/sports";

export const leaguesPresetsRouter = createTRPCRouter({
  getSportPresets: publicProcedure.query(async () => {
    try {
      return getAllPresets();
    } catch (_error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch sport presets",
      });
    }
  }),
});
