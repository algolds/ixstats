import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";

import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticPoliciesAlliancesRouter = createTRPCRouter({
  // ============================================================
  // Alliance / Bloc System (Phase 3)
  // ============================================================

  // Get alliances a country belongs to
  getAlliances: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const memberships = await ctx.db.allianceMember.findMany({
        where: { countryId: input.countryId, isActive: true },
        include: {
          alliance: {
            include: {
              members: {
                where: { isActive: true },
                include: {
                  country: { select: { id: true, name: true, flag: true } },
                },
              },
              _count: { select: { actions: true, documents: true } },
            },
          },
        },
      });

      return memberships.map((m) => ({
        ...m.alliance,
        myRole: m.role,
        myVotingPower: m.votingPower,
        myContributionLevel: m.contributionLevel,
      }));
    }),

  // Get a single alliance dashboard
  getAllianceDashboard: publicProcedure
    .input(z.object({ allianceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const alliance = await ctx.db.alliance.findUnique({
        where: { id: input.allianceId },
        include: {
          members: {
            where: { isActive: true },
            include: {
              country: {
                select: {
                  id: true,
                  name: true,
                  flag: true,
                  currentGdpPerCapita: true,
                  currentPopulation: true,
                },
              },
            },
            orderBy: { role: "asc" },
          },
          actions: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          documents: {
            where: { isPublic: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!alliance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alliance not found" });
      }

      // Calculate aggregate stats
      const totalGdp = alliance.members.reduce((sum, m) => {
        const gdp = (m.country.currentGdpPerCapita ?? 0) * (m.country.currentPopulation ?? 0);
        return sum + gdp;
      }, 0);

      const totalPop = alliance.members.reduce(
        (sum, m) => sum + (m.country.currentPopulation ?? 0),
        0
      );

      return {
        ...alliance,
        calculatedTotalGdp: totalGdp,
        calculatedTotalPopulation: totalPop,
        pendingActions: alliance.actions.filter((a) => a.status === "proposed").length,
        activeActions: alliance.actions.filter((a) => a.status === "active").length,
      };
    }),

  // Create a new alliance
  createAlliance: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        shortName: z.string().max(10).optional(),
        type: z.enum(["military", "economic", "political", "regional"]),
        description: z.string().optional(),
        charter: z.string().optional(),
        color: z.string().optional().default("#6366f1"),
        visibility: z.enum(["public", "private", "secret"]).optional().default("public"),
        joinPolicy: z.enum(["open", "invite", "application"]).optional().default("invite"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to create an alliance.",
        });
      }

      // Create alliance and add founder as first member
      const alliance = await ctx.db.alliance.create({
        data: {
          name: input.name,
          shortName: input.shortName,
          type: input.type,
          description: input.description,
          charter: input.charter,
          color: input.color,
          visibility: input.visibility,
          joinPolicy: input.joinPolicy,
          memberCount: 1,
          members: {
            create: {
              countryId: ctx.user.countryId,
              role: "founder",
              votingPower: 2.0, // Founders get double voting power
              contributionLevel: "high",
            },
          },
        },
        include: {
          members: {
            include: {
              country: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Auto-news: alliance formed
      const founderCountry = await ctx.db.country.findUnique({
        where: { id: ctx.user.countryId },
        select: { name: true },
      });
      void generateDiplomaticNews(ctx.db, ctx.user.countryId, "alliance_formed", {
        allianceName: input.name,
        countryName: founderCountry?.name ?? "Unknown",
      });

      // Notification: alliance formed (fire-and-forget)
      try {
        if (ctx.auth?.userId) {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            countryId: ctx.user.countryId,
            title: "Alliance Formed",
            message: `You founded the ${input.name} alliance`,
            type: "info",
            category: "diplomatic",
            priority: "high",
            metadata: { allianceId: alliance.id, allianceName: input.name },
          });
        }
      } catch {}

      return alliance;
    }),

  // Invite a country to join an alliance
  inviteMember: protectedProcedure
    .input(
      z.object({
        allianceId: z.string(),
        targetCountryId: z.string(),
        role: z.enum(["member", "observer"]).optional().default("member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      // Verify requester is a leader/founder of the alliance
      const myMembership = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: input.allianceId,
            countryId: ctx.user.countryId,
          },
        },
      });

      if (!myMembership || (myMembership.role !== "founder" && myMembership.role !== "leader")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only founders and leaders can invite members.",
        });
      }

      // Check if already a member
      const existing = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: input.allianceId,
            countryId: input.targetCountryId,
          },
        },
      });

      if (existing) {
        if (existing.isActive) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Country is already a member." });
        }
        // Re-activate
        await ctx.db.allianceMember.update({
          where: { id: existing.id },
          data: { isActive: true, role: input.role },
        });
      } else {
        await ctx.db.allianceMember.create({
          data: {
            allianceId: input.allianceId,
            countryId: input.targetCountryId,
            role: input.role,
            votingPower: input.role === "observer" ? 0 : 1.0,
          },
        });
      }

      // Update member count
      const count = await ctx.db.allianceMember.count({
        where: { allianceId: input.allianceId, isActive: true },
      });

      await ctx.db.alliance.update({
        where: { id: input.allianceId },
        data: { memberCount: count },
      });

      // Notification: notify invited country (fire-and-forget)
      try {
        const targetCountry = await ctx.db.country.findUnique({
          where: { id: input.targetCountryId },
          select: { users: { select: { clerkUserId: true } } },
        });
        const targetUserId = targetCountry?.users[0]?.clerkUserId;
        const alliance = await ctx.db.alliance.findUnique({
          where: { id: input.allianceId },
          select: { name: true },
        });
        if (targetUserId) {
          await notificationAPI.create({
            userId: targetUserId,
            countryId: input.targetCountryId,
            title: "Alliance Invitation",
            message: `You've been invited to join ${alliance?.name ?? "an alliance"}`,
            type: "info",
            category: "diplomatic",
            priority: "high",
            metadata: { allianceId: input.allianceId },
          });
        }
      } catch {}

      return { success: true };
    }),

  // Leave an alliance
  leaveAlliance: protectedProcedure
    .input(z.object({ allianceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      const membership = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: input.allianceId,
            countryId: ctx.user.countryId,
          },
        },
      });

      if (!membership || !membership.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not an active member." });
      }

      await ctx.db.allianceMember.update({
        where: { id: membership.id },
        data: { isActive: false },
      });

      // Update count
      const count = await ctx.db.allianceMember.count({
        where: { allianceId: input.allianceId, isActive: true },
      });

      await ctx.db.alliance.update({
        where: { id: input.allianceId },
        data: { memberCount: count },
      });

      return { success: true };
    }),

  // Propose an alliance action (collective sanction, shared defense, etc.)
  proposeAllianceAction: protectedProcedure
    .input(
      z.object({
        allianceId: z.string(),
        actionType: z.enum([
          "collective_sanction",
          "shared_defense",
          "trade_bloc",
          "joint_statement",
        ]),
        targetId: z.string().optional(),
        title: z.string().min(2),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      // Verify membership
      const membership = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: input.allianceId,
            countryId: ctx.user.countryId,
          },
        },
      });

      if (!membership || !membership.isActive || membership.role === "observer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Observers cannot propose actions. Active members only.",
        });
      }

      // Calculate required votes: simple majority of voting members
      const votingMembers = await ctx.db.allianceMember.count({
        where: {
          allianceId: input.allianceId,
          isActive: true,
          role: { not: "observer" },
        },
      });

      const requiredVotes = Math.ceil(votingMembers / 2);

      const action = await ctx.db.allianceAction.create({
        data: {
          allianceId: input.allianceId,
          actionType: input.actionType,
          targetId: input.targetId,
          title: input.title,
          description: input.description,
          status: "proposed",
          proposedBy: ctx.user.countryId,
          requiredVotes,
        },
      });

      return action;
    }),

  // Vote on an alliance action
  voteOnAllianceAction: protectedProcedure
    .input(
      z.object({
        actionId: z.string(),
        vote: z.enum(["for", "against", "abstain"]),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      const action = await ctx.db.allianceAction.findUnique({
        where: { id: input.actionId },
        include: { alliance: true },
      });

      if (!action) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Action not found." });
      }

      if (action.status !== "proposed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Voting is closed on this action." });
      }

      // Verify voter is a member
      const membership = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: action.allianceId,
            countryId: ctx.user.countryId,
          },
        },
      });

      if (!membership || !membership.isActive || membership.role === "observer") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not eligible to vote." });
      }

      // Upsert vote
      await ctx.db.allianceVote.upsert({
        where: {
          actionId_countryId: {
            actionId: input.actionId,
            countryId: ctx.user.countryId,
          },
        },
        create: {
          allianceId: action.allianceId,
          actionId: input.actionId,
          countryId: ctx.user.countryId,
          vote: input.vote,
          votingPower: membership.votingPower,
          comment: input.comment,
        },
        update: {
          vote: input.vote,
          votingPower: membership.votingPower,
          comment: input.comment,
          votedAt: new Date(),
        },
      });

      // Tally votes
      const allVotes = await ctx.db.allianceVote.findMany({
        where: { actionId: input.actionId },
      });

      const votesFor = allVotes
        .filter((v) => v.vote === "for")
        .reduce((sum, v) => sum + v.votingPower, 0);
      const votesAgainst = allVotes
        .filter((v) => v.vote === "against")
        .reduce((sum, v) => sum + v.votingPower, 0);

      const updatedAction = await ctx.db.allianceAction.update({
        where: { id: input.actionId },
        data: {
          votesFor: Math.round(votesFor),
          votesAgainst: Math.round(votesAgainst),
          status: votesFor >= action.requiredVotes ? "approved" : "proposed",
        },
      });

      // If approved, execute the action
      if (updatedAction.status === "approved" && action.status === "proposed") {
        // For collective sanctions: create individual ForeignPolicyAction per member
        if (
          (action.actionType === "collective_sanction" || action.actionType === "trade_bloc") &&
          action.targetId
        ) {
          const members = await ctx.db.allianceMember.findMany({
            where: { allianceId: action.allianceId, isActive: true, role: { not: "observer" } },
            select: { countryId: true },
          });

          const fpType = action.actionType === "collective_sanction" ? "sanction" : "free_trade";

          for (const member of members) {
            // Skip if action already exists
            const existing = await ctx.db.foreignPolicyAction.findFirst({
              where: {
                initiatorId: member.countryId,
                targetId: action.targetId,
                actionType: fpType,
                status: "active",
              },
            });

            if (!existing) {
              await ctx.db.foreignPolicyAction.create({
                data: {
                  initiatorId: member.countryId,
                  targetId: action.targetId,
                  actionType: fpType,
                  category: "trade",
                  severity: "moderate",
                  status: "active",
                  reason: `Alliance action: ${action.title}`,
                  description: action.description,
                  relationshipDelta: fpType === "sanction" ? -15 : 10,
                },
              });
            }
          }
        }

        // Mark as active
        await ctx.db.allianceAction.update({
          where: { id: input.actionId },
          data: { status: "active" },
        });
      }

      return updatedAction;
    }),

  // Create an alliance document
  createAllianceDocument: protectedProcedure
    .input(
      z.object({
        allianceId: z.string(),
        title: z.string().min(2),
        content: z.string(),
        documentType: z
          .enum(["memo", "policy", "strategy", "communique"])
          .optional()
          .default("memo"),
        isPublic: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      // Verify membership
      const membership = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: input.allianceId,
            countryId: ctx.user.countryId,
          },
        },
      });

      if (!membership || !membership.isActive) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be an active member." });
      }

      const doc = await ctx.db.allianceDocument.create({
        data: {
          allianceId: input.allianceId,
          title: input.title,
          content: input.content,
          documentType: input.documentType,
          authorCountryId: ctx.user.countryId,
          isPublic: input.isPublic,
        },
      });

      return doc;
    }),

  // Get documents for an alliance
  getAllianceDocuments: publicProcedure
    .input(
      z.object({
        allianceId: z.string(),
        countryId: z.string().optional(), // If provided, show private docs for members
      })
    )
    .query(async ({ ctx, input }) => {
      let isMember = false;
      if (input.countryId) {
        const membership = await ctx.db.allianceMember.findUnique({
          where: {
            allianceId_countryId: {
              allianceId: input.allianceId,
              countryId: input.countryId,
            },
          },
        });
        isMember = !!membership?.isActive;
      }

      const docs = await ctx.db.allianceDocument.findMany({
        where: {
          allianceId: input.allianceId,
          ...(isMember ? {} : { isPublic: true }),
        },
        orderBy: { createdAt: "desc" },
      });

      return docs;
    }),
});
