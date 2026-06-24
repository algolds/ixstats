import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { postPollToDiscord } from "./post-to-discord";

export const pollsDiscordRouter = createTRPCRouter({
  publishToDiscord: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const poll = await ctx.db.poll.findUnique({
        where: { id: input.id },
        include: { options: true },
      });

      if (!poll) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Poll not found" });
      }

      try {
        await postPollToDiscord(poll);
      } catch (discordErr) {
        console.error("[Polls Router] Discord poll post failed:", discordErr);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: discordErr instanceof Error ? discordErr.message : "Discord post failed",
        });
      }

      return { success: true };
    }),
});
