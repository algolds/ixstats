import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Intelligence Classification Schema
const classificationSchema = z.enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL"]);

// Diplomatic Intelligence Types
const diplomaticRelationSchema = z.object({
  id: z.string(),
  countryId: z.string(),
  relatedCountryId: z.string(),
  relationType: z.enum(["alliance", "trade", "neutral", "tension"]),
  strength: z.number().min(0).max(100),
  recentActivity: z.string().optional(),
  establishedAt: z.date(),
  updatedAt: z.date(),
});

const intelligenceBriefingSchema = z.object({
  id: z.string(),
  countryId: z.string(),
  classification: classificationSchema,
  briefingType: z.enum(["daily", "weekly", "crisis", "strategic"]),
  executiveSummary: z.string(),
  keyDevelopments: z.array(
    z.object({
      type: z.enum(["economic", "diplomatic", "security", "cultural"]),
      title: z.string(),
      description: z.string(),
      priority: z.enum(["low", "medium", "high"]),
      timestamp: z.date(),
    })
  ),
  threatAssessments: z.array(
    z.object({
      category: z.string(),
      level: z.enum(["low", "moderate", "high", "critical"]),
      description: z.string(),
    })
  ),
  recommendedActions: z.array(z.string()),
  generatedAt: z.date(),
  ixTimeContext: z.number(),
});

const activityIntelligenceSchema = z.object({
  id: z.string(),
  countryId: z.string(),
  activityType: z.enum(["diplomatic", "economic", "cultural", "security"]),
  description: z.string(),
  relatedCountries: z.array(z.string()),
  importance: z.enum(["low", "medium", "high"]),
  classification: classificationSchema,
  timestamp: z.date(),
  ixTimeTimestamp: z.number(),
});

export const diplomaticIntelligenceActionsRouter = createTRPCRouter({
  // Get diplomatic intelligence briefing for a country

  // Get diplomatic network analysis

  // Get activity intelligence feed

  // Create diplomatic action
  createDiplomaticAction: protectedProcedure
    .input(
      z.object({
        targetCountryId: z.string(),
        actionType: z.enum(["follow", "message", "propose", "congratulate"]),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
      }

      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Country context required" });
      }

      const action = await ctx.db.diplomaticAction.create({
        data: {
          fromCountryId: ctx.user.countryId,
          toCountryId: input.targetCountryId,
          actionType: input.actionType,
          description: input.message,
          status: "pending",
        },
      });

      return {
        ...action,
        timestamp: action.createdAt,
      };
    }),

  // Get strategic assessment (CONFIDENTIAL clearance only)
});
