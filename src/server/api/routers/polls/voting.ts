import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

const _pollTypeSchema = z.enum(["choice", "feature-poll", "feature-voting"]);

export const pollsVotingRouter = createTRPCRouter({
  // Create a new poll (Admin only)

  // List polls (Admin management)

  // Toggle active status (Admin only)

  // Delete a poll (Admin only)

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
