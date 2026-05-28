import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { notificationAPI } from "~/lib/notification-api";
import { discordWebhook } from "~/lib/discord-webhook";

const pollTypeSchema = z.enum(["choice", "feature-poll", "feature-voting"]);

export const pollsRouter = createTRPCRouter({
  // Create a new poll (Admin only)
  create: adminProcedure
    .input(
      z.object({
        question: z.string().min(1).max(500),
        description: z.string().max(2000).optional(),
        pollType: pollTypeSchema.default("choice"),
        multiple: z.boolean().default(false),
        endDate: z.date().optional(),
        countryId: z.string().optional(),
        options: z.array(z.string().min(1).max(200)).min(2, "At least 2 options are required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Start transaction
      const poll = await db.$transaction(async (tx) => {
        // 1. Create the Poll
        const newPoll = await tx.poll.create({
          data: {
            question: input.question,
            description: input.description,
            pollType: input.pollType,
            multiple: input.multiple,
            endDate: input.endDate,
            countryId: input.countryId || null,
            options: {
              create: input.options.map((opt) => ({
                label: opt,
              })),
            },
          },
          include: {
            options: true,
          },
        });

        // 2. Create the associated ActivityFeed entry
        await tx.activityFeed.create({
          data: {
            type: "social",
            category: "social",
            title: newPoll.question,
            description: newPoll.description || "A new poll is open for voting!",
            priority: "medium",
            visibility: "public",
            pollId: newPoll.id,
            // Associate with the admin country if applicable
            countryId: newPoll.countryId || user.countryId || null,
            userId: user.clerkUserId,
            metadata: JSON.stringify({
              pollId: newPoll.id,
              pollType: newPoll.pollType,
            }),
          },
        });

        return newPoll;
      });

      // 3. Trigger platform notifications
      try {
        if (poll.countryId) {
          // Notify target country citizens
          await notificationAPI.notifyCountry({
            countryId: poll.countryId,
            title: `🗳️ New Poll: ${poll.question}`,
            message:
              poll.description || "A new poll is open for voting in your country. Cast your vote!",
            category: "social",
            priority: "medium",
          });
        } else {
          // Global poll notification
          await notificationAPI.notifyGlobal({
            title: `🗳️ New Poll: ${poll.question}`,
            message: poll.description || "A new platform-wide poll is open. Cast your vote!",
            category: "social",
            priority: "medium",
          });
        }
      } catch (notifyErr) {
        console.error("[Polls Router] Notification trigger failed:", notifyErr);
      }

      // 4. Send Discord Bot Channel / Webhook Embed
      const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
      const TARGET_CHANNEL_ID = "557016199427522561";

      if (DISCORD_BOT_TOKEN) {
        try {
          const optionsStr = poll.options.map((o: { label: string }) => `• ${o.label}`).join("\n");
          const embed = {
            title: `🗳️ New Poll: ${poll.question}`,
            description: poll.description || "A new poll has been posted on IxStats!",
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
            console.error(
              `[Polls Router] Discord Bot API failed to post: ${res.status} ${res.statusText}`
            );
          }
        } catch (discordErr) {
          console.error("[Polls Router] Discord Bot notification failed:", discordErr);
        }
      } else if (discordWebhook.isEnabled()) {
        try {
          const optionsStr = poll.options.map((o: { label: string }) => `• ${o.label}`).join("\n");
          await discordWebhook.sendEmbed({
            title: `🗳️ New Poll: ${poll.question}`,
            description: poll.description || "A new poll has been posted on IxStats!",
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
        }
      }

      return { success: true, pollId: poll.id };
    }),

  // List polls (Admin management)
  list: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.poll.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        options: {
          include: {
            _count: {
              select: { votes: true },
            },
          },
        },
        _count: {
          select: { votes: true },
        },
      },
    });
  }),

  // Toggle active status (Admin only)
  toggleActive: adminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const poll = await ctx.db.poll.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
      return { success: true, poll };
    }),

  // Delete a poll (Admin only)
  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    // ActivityFeed entry will be deleted automatically due to CASCADE relation
    await ctx.db.poll.delete({
      where: { id: input.id },
    });
    return { success: true };
  }),

  // Register user vote
  vote: protectedProcedure
    .input(
      z.object({
        pollId: z.string(),
        optionIds: z.array(z.string()).min(1, "Select at least one option"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      const userId = user.clerkUserId;

      const poll = await db.poll.findUnique({
        where: { id: input.pollId },
        include: { options: true },
      });

      if (!poll) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Poll not found" });
      }

      if (!poll.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This poll is no longer active" });
      }

      if (poll.endDate && new Date() > poll.endDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This poll has expired" });
      }

      // Check country targeting
      if (poll.countryId && user.countryId !== poll.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This poll is restricted to citizens of the target country.",
        });
      }

      // Validate optionIds belong to this poll
      const validOptionIds = new Set(poll.options.map((o: { id: string }) => o.id));
      for (const optId of input.optionIds) {
        if (!validOptionIds.has(optId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid option selected" });
        }
      }

      // Handle voting based on pollType
      if (poll.pollType === "feature-voting") {
        // Feature voting allows toggling upvotes (one option toggled at a time)
        const optionId = input.optionIds[0];
        if (!optionId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No option specified" });
        }

        const existingVote = await db.pollVote.findFirst({
          where: { pollId: poll.id, optionId, userId },
        });

        if (existingVote) {
          // Unvote (toggle off)
          await db.pollVote.delete({
            where: { id: existingVote.id },
          });
          return { success: true, action: "unvote" };
        } else {
          // Vote (toggle on)
          await db.pollVote.create({
            data: { pollId: poll.id, optionId, userId },
          });
          return { success: true, action: "vote" };
        }
      } else {
        // Choice poll or Feature poll (standard single/multiple ballot submission)
        // Check if user has already voted on this poll at all
        const existingVote = await db.pollVote.findFirst({
          where: { pollId: poll.id, userId },
        });

        if (existingVote) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You have already voted on this poll",
          });
        }

        // Enforce single-choice restriction if not multiple choice
        if (!poll.multiple && input.optionIds.length > 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only single choice is allowed" });
        }

        // Create votes
        await db.pollVote.createMany({
          data: input.optionIds.map((optionId) => ({
            pollId: poll.id,
            optionId,
            userId,
          })),
        });

        return { success: true, action: "vote" };
      }
    }),

  // Get status of a poll for the current user
  getPollDetails: publicProcedure
    .input(z.object({ pollId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db, auth } = ctx;
      const userId = auth?.userId;

      const poll = await db.poll.findUnique({
        where: { id: input.pollId },
        include: {
          options: {
            include: {
              _count: {
                select: { votes: true },
              },
            },
          },
        },
      });

      if (!poll) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Poll not found" });
      }

      // Check if user has voted and fetch their votes
      let userVotedOptionIds: string[] = [];
      if (userId) {
        const userVotes = await db.pollVote.findMany({
          where: { pollId: poll.id, userId },
          select: { optionId: true },
        });
        userVotedOptionIds = userVotes.map((v: { optionId: string }) => v.optionId);
      }

      // Format votes dictionary and calculate total votes
      const votes: Record<string, number> = {};
      let totalVotes = 0;
      poll.options.forEach((opt: { id: string; _count: { votes: number } }) => {
        votes[opt.id] = opt._count.votes;
        totalVotes += opt._count.votes;
      });

      return {
        id: poll.id,
        question: poll.question,
        description: poll.description,
        pollType: poll.pollType,
        multiple: poll.multiple,
        isActive: poll.isActive,
        endDate: poll.endDate,
        countryId: poll.countryId,
        options: poll.options.map(
          (o: { id: string; label: string; description: string | null }) => ({
            id: o.id,
            label: o.label,
            description: o.description,
          })
        ),
        votes,
        totalVotes,
        hasVoted: userVotedOptionIds.length > 0,
        userVotedOptionIds,
      };
    }),
});
