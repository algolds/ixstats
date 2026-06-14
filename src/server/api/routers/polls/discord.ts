import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { discordWebhook } from "~/lib/discord-webhook";

const _pollTypeSchema = z.enum(["choice", "feature-poll", "feature-voting"]);

export const pollsDiscordRouter = createTRPCRouter({
  // Create a new poll (Admin only)

  // List polls (Admin management)

  // Toggle active status (Admin only)

  // Delete a poll (Admin only)

  // Register user vote

  // Get status of a poll for the current user

  publishToDiscord: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const poll = await ctx.db.poll.findUnique({
        where: { id: input.id },
        include: {
          options: true,
        },
      });

      if (!poll) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Poll not found" });
      }

      const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
      const TARGET_CHANNEL_ID = "557016199427522561";

      if (DISCORD_BOT_TOKEN) {
        try {
          const optionsStr = poll.options.map((o: { label: string }) => `• ${o.label}`).join("\n");
          const embed = {
            title: `🗳️ Poll: ${poll.question}`,
            description: poll.description || "A poll has been posted on IxStats!",
            color: 0x0099ff, // Blue
            fields: [
              {
                name: "Type",
                value:
                  poll.pollType === "choice"
                    ? "Choice Poll"
                    : poll.pollType === "feature-poll"
                      ? "Feature Poll"
                      : "Feature Voting",
                inline: true,
              },
              {
                name: "Selection Mode",
                value: poll.multiple ? "Multiple Choice" : "Single Choice",
                inline: true,
              },
              {
                name: "Scope",
                value: poll.countryId ? "Targeted Country citizens" : "Global (All users)",
                inline: true,
              },
              {
                name: "Options",
                value: optionsStr || "No options defined",
                inline: false,
              },
              {
                name: "Expires",
                value: poll.endDate ? poll.endDate.toLocaleString() : "Never",
                inline: true,
              },
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: "IxStats Poll System",
            },
          };

          const res = await fetch(
            `https://discord.com/api/v10/channels/${TARGET_CHANNEL_ID}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                embeds: [embed],
              }),
              signal: AbortSignal.timeout(10000),
            }
          );

          if (!res.ok) {
            throw new Error(`Discord API returned ${res.status} ${res.statusText}`);
          }
        } catch (discordErr) {
          console.error("[Polls Router] Discord Bot notification failed:", discordErr);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Discord Bot API failed: ${discordErr instanceof Error ? discordErr.message : "Unknown error"}`,
          });
        }
      } else if (discordWebhook.isEnabled()) {
        try {
          const optionsStr = poll.options.map((o: { label: string }) => `• ${o.label}`).join("\n");
          await discordWebhook.sendEmbed({
            title: `🗳️ Poll: ${poll.question}`,
            description: poll.description || "A poll has been posted on IxStats!",
            color: 0x0099ff, // Blue
            fields: [
              {
                name: "Type",
                value:
                  poll.pollType === "choice"
                    ? "Choice Poll"
                    : poll.pollType === "feature-poll"
                      ? "Feature Poll"
                      : "Feature Voting",
                inline: true,
              },
              {
                name: "Selection Mode",
                value: poll.multiple ? "Multiple Choice" : "Single Choice",
                inline: true,
              },
              {
                name: "Scope",
                value: poll.countryId ? "Targeted Country citizens" : "Global (All users)",
                inline: true,
              },
              {
                name: "Options",
                value: optionsStr || "No options defined",
                inline: false,
              },
              {
                name: "Expires",
                value: poll.endDate ? poll.endDate.toLocaleString() : "Never",
                inline: true,
              },
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: "IxStats Poll System",
            },
          });
        } catch (discordErr) {
          console.error("[Polls Router] Discord webhook notification failed:", discordErr);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Discord webhook failed: ${discordErr instanceof Error ? discordErr.message : "Unknown error"}`,
          });
        }
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Discord notification not configured or enabled.",
        });
      }

      return { success: true };
    }),
});
