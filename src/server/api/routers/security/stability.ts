// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  calculateStabilityMetrics,
  type EconomicData,
  type GovernmentData,
  type DemographicData,
  type PoliticalData,
  type RecentPolicy,
} from "~/lib/statecraft/stability-formulas";

import { notificationAPI } from "~/lib/notifications/api";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";

// ===========================
// Input Validation Schemas
// ===========================

// ===========================
// Security Router
// ===========================

export const securityStabilityRouter = createTRPCRouter({
  // ===========================
  // Internal Stability Endpoints
  // ===========================

  getInternalStability: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get country data for calculations
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
      });

      if (!country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country not found",
        });
      }

      // Get real economic data from the database
      const economicData: EconomicData = {
        gdpGrowth: country.realGDPGrowthRate ?? country.adjustedGdpGrowth ?? 2.5,
        unemploymentRate: country.unemploymentRate ?? 5.0,
        giniIndex: country.incomeInequalityGini ?? 35,
        inflationRate: country.inflationRate ?? 2.0,
        gdpPerCapita: country.currentGdpPerCapita ?? 35000,
        povertyRate: country.povertyRate ?? 12,
      };

      // Get EconomicProfile for corruption data
      const economicProfile = await ctx.db.economicProfile.findUnique({
        where: { countryId: input.countryId },
      });

      // Get government data - TODO: integrate with government ministry when available
      const governmentData: GovernmentData = {
        policingBudget: country.currentPopulation * 200,
        educationBudget: country.currentPopulation * 1500,
        socialServicesBudget: country.currentPopulation * 800,
        totalBudget: country.currentPopulation * 5000,
        corruptionIndex: economicProfile?.corruptionIndex ?? 30,
      };

      // Get diversity data from Demographics
      const demographics = await ctx.db.demographics.findUnique({
        where: { countryId: input.countryId },
        select: {
          ethnicDiversity: true,
          religiousDiversity: true,
          linguisticDiversity: true,
          culturalDiversity: true,
        },
      });

      const demographicData: DemographicData = {
        population: country.currentPopulation,
        ethnicDiversity: demographics?.ethnicDiversity ?? 50,
        religiousDiversity: demographics?.religiousDiversity ?? 50,
        urbanizationRate: country.urbanPopulationPercent ?? 75,
        youthUnemployment: (country.unemploymentRate ?? 5) * 2, // Youth unemployment is typically 2x general
        populationDensity: country.populationDensity ?? 100,
      };

      // Get political metrics from GovernmentStructure
      const government = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        select: {
          politicalStability: true,
          politicalPolarization: true,
          democracyIndex: true,
          electionCycle: true,
          governmentEffectiveness: true,
          ruleOfLaw: true,
          corruptionIndex: true,
        },
      });

      const politicalData: PoliticalData = {
        politicalStability: government?.politicalStability ?? 0.5,
        politicalPolarization: government?.politicalPolarization ?? 50,
        electionCycle: government?.electionCycle ?? 4,
        democracyIndex: government?.democracyIndex ?? 50,
        protestFrequency: 8, // Will be overwritten by calculation
      };

      // TODO: Get recent policies from database
      const recentPolicies: RecentPolicy[] = [];

      // Calculate real stability metrics
      const calculatedMetrics = calculateStabilityMetrics(
        economicData,
        governmentData,
        demographicData,
        politicalData,
        recentPolicies
      );

      // Update or create metrics in database
      const metrics = await ctx.db.internalStabilityMetrics.upsert({
        where: { countryId: input.countryId },
        create: {
          countryId: input.countryId,
          stabilityScore: calculatedMetrics.stabilityScore,
          crimeRate: calculatedMetrics.crimeRate,
          violentCrimeRate: calculatedMetrics.violentCrimeRate,
          propertyCrimeRate: calculatedMetrics.propertyCrimeRate,
          organizedCrimeLevel: calculatedMetrics.organizedCrimeLevel,
          policingEffectiveness: calculatedMetrics.policingEffectiveness,
          justiceSystemEfficiency: calculatedMetrics.justiceSystemEfficiency,
          protestFrequency: calculatedMetrics.protestFrequency,
          riotRisk: calculatedMetrics.riotRisk,
          civilDisobedience: calculatedMetrics.civilDisobedience,
          socialCohesion: calculatedMetrics.socialCohesion,
          ethnicTension: calculatedMetrics.ethnicTension,
          politicalPolarization: calculatedMetrics.politicalPolarization,
          trustInGovernment: calculatedMetrics.trustInGovernment,
          trustInPolice: calculatedMetrics.trustInPolice,
          fearOfCrime: calculatedMetrics.fearOfCrime,
          stabilityTrend: calculatedMetrics.stabilityTrend,
          lastCalculated: new Date(),
        },
        update: {
          stabilityScore: calculatedMetrics.stabilityScore,
          crimeRate: calculatedMetrics.crimeRate,
          violentCrimeRate: calculatedMetrics.violentCrimeRate,
          propertyCrimeRate: calculatedMetrics.propertyCrimeRate,
          organizedCrimeLevel: calculatedMetrics.organizedCrimeLevel,
          policingEffectiveness: calculatedMetrics.policingEffectiveness,
          justiceSystemEfficiency: calculatedMetrics.justiceSystemEfficiency,
          protestFrequency: calculatedMetrics.protestFrequency,
          riotRisk: calculatedMetrics.riotRisk,
          civilDisobedience: calculatedMetrics.civilDisobedience,
          socialCohesion: calculatedMetrics.socialCohesion,
          ethnicTension: calculatedMetrics.ethnicTension,
          politicalPolarization: calculatedMetrics.politicalPolarization,
          trustInGovernment: calculatedMetrics.trustInGovernment,
          trustInPolice: calculatedMetrics.trustInPolice,
          fearOfCrime: calculatedMetrics.fearOfCrime,
          stabilityTrend: calculatedMetrics.stabilityTrend,
          lastCalculated: new Date(),
        },
      });

      const activeEvents = await ctx.db.securityEvent.findMany({
        where: {
          countryId: input.countryId,
          status: "active",
        },
        orderBy: { startDate: "desc" },
      });

      return { metrics, activeEvents };
    }),

  resolveSecurityEvent: premiumProcedure
    .input(
      z.object({
        id: z.string(),
        resolutionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const event = await ctx.db.securityEvent.findUnique({
        where: { id: input.id },
        include: { country: { select: { name: true } } },
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Security event not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== event.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only resolve your own country's security events",
        });
      }

      const resolved = await ctx.db.securityEvent.update({
        where: { id: input.id },
        data: {
          status: "resolved",
          endDate: new Date(),
          resolutionNotes: input.resolutionNotes,
        },
      });

      // Notification: security event resolved (fire-and-forget)
      try {
        if (ctx.auth?.userId) {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            countryId: event.countryId,
            title: "Threat Resolved",
            message: "A security event has been successfully resolved",
            type: "info",
            category: "security",
            priority: "medium",
            metadata: { eventId: input.id },
          });
        }
      } catch (err) {
        console.warn("[Stability] Resolution notification failed for event", input.id, err);
      }

      // Canon news: security/stability event resolved
      void generateDiplomaticNews(ctx.db as any, event.countryId, "security_event_resolved", {
        countryName: event.country?.name ?? "A nation",
        eventType: resolved.eventType,
        severity: resolved.severity,
        notes: input.resolutionNotes,
      });

      return resolved;
    }),
});
