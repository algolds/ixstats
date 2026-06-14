// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { createIntelligenceFromThreat } from "~/lib/defense-integration";
import { notificationAPI } from "~/lib/notification-api";

// ===========================
// Input Validation Schemas
// ===========================

// Base schema with all fields
const militaryBranchBaseSchema = z.object({
  branchType: z.enum([
    "army",
    "navy",
    "air_force",
    "space_force",
    "marines",
    "coast_guard",
    "cyber_command",
    "special_forces",
  ]),
  name: z.string().min(1, "Branch name is required"),
  description: z.string().optional(),
  motto: z.string().optional(),
  imageUrl: z.string().optional(),
  established: z.string().optional(),
  activeDuty: z.number().int().nonnegative().default(0),
  reserves: z.number().int().nonnegative().default(0),
  civilianStaff: z.number().int().nonnegative().default(0),
  annualBudget: z.number().nonnegative().default(0),
  budgetPercent: z.number().min(0).max(100).default(0),
  readinessLevel: z.number().min(0).max(100).default(50),
  technologyLevel: z.number().min(0).max(100).default(50),
  trainingLevel: z.number().min(0).max(100).default(50),
  morale: z.number().min(0).max(100).default(50),
  deploymentCapacity: z.number().min(0).max(100).default(50),
  sustainmentCapacity: z.number().min(0).max(100).default(50),
  isActive: z.boolean().default(true),
});

// Create schema - all required fields with defaults
// eslint-disable-next-line unused-imports/no-unused-vars
const militaryBranchCreateSchema = militaryBranchBaseSchema;

// Update schema - all fields optional
// eslint-disable-next-line unused-imports/no-unused-vars
const militaryBranchUpdateSchema = militaryBranchBaseSchema.partial();

// eslint-disable-next-line unused-imports/no-unused-vars
const militaryUnitInputSchema = z.object({
  name: z.string().min(1),
  unitType: z.string(),
  designation: z.string().optional(),
  description: z.string().optional(),
  personnel: z.number().int().nonnegative().default(0),
  commanderName: z.string().optional(),
  commanderRank: z.string().optional(),
  headquarters: z.string().optional(),
  readiness: z.number().min(0).max(100).default(50),
  imageUrl: z.string().optional(),
});

// eslint-disable-next-line unused-imports/no-unused-vars
const militaryAssetInputSchema = z.object({
  assetType: z.enum(["aircraft", "ship", "vehicle", "weapon_system", "installation"]),
  category: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  operational: z.number().int().nonnegative().default(1),
  capability: z.string().optional(),
  status: z.enum(["operational", "maintenance", "reserve", "retired"]).default("operational"),
  modernizationLevel: z.number().min(0).max(100).default(50),
  acquisitionCost: z.number().nonnegative().default(0),
  maintenanceCost: z.number().nonnegative().default(0),
  imageUrl: z.string().optional(),
});

const securityThreatInputSchema = z.object({
  threatName: z.string().min(1),
  threatType: z.enum([
    "military",
    "terrorism",
    "insurgency",
    "cyber",
    "organized_crime",
    "espionage",
    "nuclear",
    "biological",
    "natural_disaster",
  ]),
  description: z.string().min(10),
  severity: z.enum(["existential", "critical", "high", "moderate", "low"]),
  likelihood: z.number().min(0).max(100).default(50),
  urgency: z.enum(["low", "medium", "high", "immediate"]).default("medium"),
  actorType: z.enum(["state", "non-state", "terrorist", "criminal", "unknown"]).optional(),
  actorName: z.string().optional(),
  actorLocation: z.string().optional(),
  actorCapability: z.number().min(0).max(100).default(50),
  potentialCasualties: z.number().int().nonnegative().default(0),
  economicImpact: z.number().nonnegative().default(0),
  politicalImpact: z.string().optional(),
  infrastructureRisk: z.number().min(0).max(100).default(0),
  responseLevel: z.enum(["minimal", "standard", "elevated", "maximum"]).default("standard"),
  intelligenceSource: z.string().optional(),
  confidenceLevel: z.number().min(0).max(100).default(50),
  estimatedTimeline: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// eslint-disable-next-line unused-imports/no-unused-vars
const neighborThreatInputSchema = z.object({
  neighborName: z.string().min(1),
  neighborCountryId: z.string().optional(),
  borderType: z.enum(["land", "maritime", "both"]),
  borderLength: z.number().nonnegative().optional(),
  threatLevel: z.enum(["minimal", "low", "moderate", "high", "critical"]).default("low"),
  threatScore: z.number().min(0).max(100).default(20),
  militaryThreat: z.number().min(0).max(100).default(10),
  terrorismRisk: z.number().min(0).max(100).default(15),
  smugglingRisk: z.number().min(0).max(100).default(25),
  refugeeFlow: z.number().min(0).max(100).default(20),
  politicalStability: z.number().min(0).max(100).default(60),
  diplomaticRelations: z
    .enum(["hostile", "tense", "neutral", "friendly", "allied"])
    .default("neutral"),
  tradeVolume: z.number().nonnegative().default(0),
  treatyStatus: z.string().optional(),
  notes: z.string().optional(),
});

// ===========================
// Security Router
// ===========================

export const securityAssessmentRouter = createTRPCRouter({
  // ===========================
  // Security Assessment Endpoints
  // ===========================

  getSecurityAssessment: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      let assessment = await ctx.db.securityAssessment.findUnique({
        where: { countryId: input.countryId },
      });

      if (!assessment) {
        // Create default assessment
        assessment = await ctx.db.securityAssessment.create({
          data: {
            countryId: input.countryId,
            overallSecurityScore: 60,
            securityLevel: "moderate",
            securityTrend: "stable",
            militaryStrength: 60,
            internalStability: 60,
            borderSecurity: 60,
            cybersecurity: 50,
            counterTerrorism: 55,
            militaryReadiness: 65,
            emergencyResponse: 60,
            disasterPreparedness: 55,
          },
        });
      }

      // Get related data
      const [internalStability, borderSecurity, activeThreats, militaryBranches] =
        await Promise.all([
          ctx.db.internalStabilityMetrics.findUnique({
            where: { countryId: input.countryId },
          }),
          ctx.db.borderSecurity.findUnique({
            where: { countryId: input.countryId },
            include: { neighborThreats: true },
          }),
          ctx.db.securityThreat.findMany({
            where: {
              countryId: input.countryId,
              isActive: true,
            },
          }),
          ctx.db.militaryBranch.findMany({
            where: {
              countryId: input.countryId,
              isActive: true,
            },
          }),
        ]);

      return {
        ...assessment,
        internalStability,
        borderSecurity,
        activeThreats,
        militaryBranches,
      };
    }),

  updateSecurityAssessment: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate ownership
      if (ctx.user?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify other countries' security assessments",
        });
      }

      // Calculate security score based on components
      const [internalStability, borderSecurity, threats, militaryBranches] = await Promise.all([
        ctx.db.internalStabilityMetrics.findUnique({
          where: { countryId: input.countryId },
        }),
        ctx.db.borderSecurity.findUnique({
          where: { countryId: input.countryId },
        }),
        ctx.db.securityThreat.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.militaryBranch.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
      ]);

      const stabilityScore = internalStability?.stabilityScore ?? 60;
      const borderScore = borderSecurity?.overallSecurityLevel ?? 60;
      const militaryScore =
        militaryBranches.length > 0
          ? militaryBranches.reduce((sum, b) => sum + b.readinessLevel, 0) / militaryBranches.length
          : 60;

      const highSeverityThreats = threats.filter(
        (t) => t.severity === "critical" || t.severity === "existential"
      ).length;

      const overallScore = stabilityScore * 0.3 + borderScore * 0.3 + militaryScore * 0.4;

      let securityLevel = "moderate";
      if (overallScore >= 80) securityLevel = "very_secure";
      else if (overallScore >= 65) securityLevel = "secure";
      else if (overallScore >= 40) securityLevel = "moderate";
      else if (overallScore >= 25) securityLevel = "high_risk";
      else securityLevel = "critical";

      return ctx.db.securityAssessment.upsert({
        where: { countryId: input.countryId },
        create: {
          countryId: input.countryId,
          overallSecurityScore: overallScore,
          securityLevel,
          militaryStrength: militaryScore,
          internalStability: stabilityScore,
          borderSecurity: borderScore,
          activeThreatCount: threats.length,
          highSeverityThreats,
          militaryReadiness: militaryScore,
        },
        update: {
          overallSecurityScore: overallScore,
          securityLevel,
          militaryStrength: militaryScore,
          internalStability: stabilityScore,
          borderSecurity: borderScore,
          activeThreatCount: threats.length,
          highSeverityThreats,
          militaryReadiness: militaryScore,
          lastAssessed: new Date(),
        },
      });
    }),

  // ===========================
  // Military Branch Endpoints
  // ===========================

  // ===========================
  // Military Unit Endpoints
  // ===========================

  // ===========================
  // Military Asset Endpoints
  // ===========================

  // ===========================
  // Defense Budget Endpoints
  // ===========================

  // ===========================
  // Internal Stability Endpoints
  // ===========================

  // ===========================
  // Border Security Endpoints
  // ===========================

  // ===========================
  // Security Threats Endpoints
  // ===========================

  getSecurityThreats: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        activeOnly: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.securityThreat.findMany({
        where: {
          countryId: input.countryId,
          ...(input.activeOnly ? { isActive: true } : {}),
        },
        include: {
          incidents: {
            orderBy: { occurredAt: "desc" },
            take: 5,
          },
        },
        orderBy: [{ severity: "desc" }, { likelihood: "desc" }],
      });
    }),

  createSecurityThreat: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string(),
        threat: securityThreatInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create threats for your own country",
        });
      }

      const tagsJson = input.threat.tags ? JSON.stringify(input.threat.tags) : null;

      const threat = await ctx.db.securityThreat.create({
        data: {
          countryId: input.countryId,
          userId: input.userId,
          ...input.threat,
          tags: tagsJson,
        },
      });

      // 🔔 Notify country about new security threat
      try {
        const priorityMap: Record<string, "high" | "medium" | "low"> = {
          existential: "high",
          critical: "high",
          high: "high",
          moderate: "medium",
          low: "low",
        };

        await notificationAPI.create({
          title: "🚨 Security Threat Detected",
          message: `${input.threat.severity.toUpperCase()} threat: ${input.threat.threatName} (${input.threat.threatType})`,
          countryId: input.countryId,
          category: "security",
          priority: priorityMap[input.threat.severity] || "high",
          type:
            input.threat.severity === "existential" || input.threat.severity === "critical"
              ? "error"
              : "warning",
          href: "/mycountry/security",
          source: "security-system",
          actionable: true,
          metadata: {
            threatId: threat.id,
            severity: input.threat.severity,
            threatType: input.threat.threatType,
          },
        });
      } catch (error) {
        console.error("[Security] Failed to send threat notification:", error);
      }

      return threat;
    }),

  updateSecurityThreat: premiumProcedure
    .input(
      z.object({
        id: z.string(),
        threat: securityThreatInputSchema.partial().extend({
          status: z.enum(["monitoring", "responding", "contained", "resolved"]).optional(),
          mitigationActions: z.array(z.string()).optional(),
          resourcesAllocated: z.number().nonnegative().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const threat = await ctx.db.securityThreat.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!threat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Security threat not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== threat.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own security threats",
        });
      }

      const { tags, mitigationActions, ...rest } = input.threat;

      return ctx.db.securityThreat.update({
        where: { id: input.id },
        data: {
          ...rest,
          ...(tags ? { tags: JSON.stringify(tags) } : {}),
          ...(mitigationActions ? { mitigationActions: JSON.stringify(mitigationActions) } : {}),
          lastUpdated: new Date(),
        },
      });
    }),

  deleteSecurityThreat: premiumProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const threat = await ctx.db.securityThreat.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!threat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Security threat not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== threat.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own security threats",
        });
      }

      return ctx.db.securityThreat.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  createThreatIncident: premiumProcedure
    .input(
      z.object({
        threatId: z.string(),
        title: z.string().min(1),
        description: z.string(),
        incidentType: z.enum(["attack", "attempt", "intelligence", "warning", "activity"]),
        casualties: z.number().int().nonnegative().default(0),
        damage: z.number().nonnegative().default(0),
        location: z.string().optional(),
        responseActions: z.array(z.string()).optional(),
        effectiveness: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership of threat
      const threat = await ctx.db.securityThreat.findUnique({
        where: { id: input.threatId },
        select: { countryId: true },
      });

      if (!threat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Security threat not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== threat.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create incidents for your own threats",
        });
      }

      const { responseActions, ...rest } = input;

      const incident = await ctx.db.threatIncident.create({
        data: {
          ...rest,
          responseActions: responseActions ? JSON.stringify(responseActions) : null,
        },
      });

      // 🔔 Notify country about threat incident
      try {
        const isCritical =
          input.incidentType === "attack" || input.casualties > 0 || input.damage > 1000000;
        await notificationAPI.create({
          title: `⚠️ Threat Incident: ${input.title}`,
          message: `${input.incidentType.toUpperCase()} reported${input.casualties > 0 ? ` - ${input.casualties} casualties` : ""}${input.damage > 0 ? ` - $${(input.damage / 1e6).toFixed(1)}M damage` : ""}`,
          countryId: threat.countryId,
          category: "security",
          priority: isCritical ? "high" : "medium",
          type: isCritical ? "error" : "warning",
          href: "/mycountry/security",
          source: "security-system",
          actionable: true,
          metadata: {
            incidentId: incident.id,
            threatId: input.threatId,
            incidentType: input.incidentType,
            casualties: input.casualties,
            damage: input.damage,
          },
        });
      } catch (error) {
        console.error("[Security] Failed to send incident notification:", error);
      }

      return incident;
    }),

  // ===========================
  // Integration Endpoints
  // ===========================

  createThreatIntelligence: premiumProcedure
    .input(
      z.object({
        threatId: z.string(),
        countryId: z.string(),
        title: z.string(),
        content: z.string(),
        priority: z.enum(["low", "medium", "high", "critical"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create intelligence for your own country",
        });
      }

      return createIntelligenceFromThreat(input);
    }),

  // ============================================================
  // Military Operations (Phase 4)
  // ============================================================

  // Get active and past operations

  // Create a military operation and deploy units/assets

  // Recall a deployment / end an operation

  // Propose a PvP conflict (requires mutual acceptance)

  // Accept or decline a PvP conflict

  // Get conflicts involving a country

  // Resolve a PvNPC conflict automatically
});
