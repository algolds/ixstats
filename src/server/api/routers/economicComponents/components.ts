/**
 * Economic Components Router (Phase 5 Migration)
 *
 * API layer for atomic economic component library system.
 * Provides public endpoints for component catalog with JSON field parsing.
 *
 * Database Model: EconomicComponentData (reference library)
 * Fallback Data: ATOMIC_ECONOMIC_COMPONENTS from ~/lib/atomic-economic-data
 *
 * Features:
 * - getAllComponents: Query component catalog with category filtering
 * - getComponentByType: Fetch single component details
 * - incrementComponentUsage: Track component selection for analytics
 * - JSON parsing for 7 impact fields (synergies, conflicts, governmentSynergies,
 *   governmentConflicts, taxImpact, sectorImpact, employmentImpact)
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { EconomicComponentType } from "@prisma/client";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";

import { type ParsedEconomicComponent, transformDatabaseComponent } from "./serializer";

// ============================================================================
// Input Validation Schemas
// ============================================================================

const economicComponentTypeSchema = z.nativeEnum(EconomicComponentType);
// ============================================================================
// Helper Functions
// ============================================================================
// ============================================================================
// Router Definition
// ============================================================================

export const economicComponentsComponentsRouter = createTRPCRouter({
  // ============================================================================
  // Admin Endpoints
  // ============================================================================

  /**
   * Create a new component (admin only)
   */
  createComponent: adminProcedure
    .input(
      z.object({
        type: economicComponentTypeSchema,
        name: z.string().min(1),
        description: z.string().min(1),
        category: z.string(),
        effectiveness: z.number().min(0).max(100),
        implementationCost: z.number().min(0),
        maintenanceCost: z.number().min(0),
        requiredCapacity: z.number().min(0).max(100),
        synergies: z.array(economicComponentTypeSchema).default([]),
        conflicts: z.array(economicComponentTypeSchema).default([]),
        governmentSynergies: z.array(z.string()).default([]),
        governmentConflicts: z.array(z.string()).default([]),
        taxImpact: z.object({
          optimalCorporateRate: z.number().min(0).max(50),
          optimalIncomeRate: z.number().min(0).max(60),
          revenueEfficiency: z.number().min(0).max(100),
        }),
        sectorImpact: z.object({
          services: z.number().min(0).max(2),
          finance: z.number().min(0).max(2),
          technology: z.number().min(0).max(2),
          manufacturing: z.number().min(0).max(2),
          agriculture: z.number().min(0).max(2),
          government: z.number().min(0).max(2),
        }),
        employmentImpact: z.object({
          unemploymentModifier: z.number().min(-2).max(2),
          participationModifier: z.number().min(0.5).max(2),
          wageGrowthModifier: z.number().min(0.5).max(2),
        }),
        complexity: z.enum(["Low", "Medium", "High"]),
        timeToImplement: z.string(),
        staffRequired: z.number().min(0),
        technologyRequired: z.boolean(),
        color: z.string(),
        icon: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Create component with stringified JSON fields
        const component = await ctx.db.economicComponentData.create({
          data: {
            componentType: input.type,
            name: input.name,
            description: input.description,
            category: input.category,
            effectiveness: input.effectiveness,
            synergies: JSON.stringify(input.synergies),
            conflicts: JSON.stringify(input.conflicts),
            governmentSynergies: JSON.stringify(input.governmentSynergies),
            governmentConflicts: JSON.stringify(input.governmentConflicts),
            taxImpact: JSON.stringify(input.taxImpact),
            sectorImpact: JSON.stringify(input.sectorImpact),
            employmentImpact: JSON.stringify(input.employmentImpact),
            implementationCost: input.implementationCost,
            maintenanceCost: input.maintenanceCost,
            requiredCapacity: input.requiredCapacity,
            color: input.color,
            iconName: input.icon,
            metadata: JSON.stringify({
              complexity: input.complexity,
              timeToImplement: input.timeToImplement,
              staffRequired: input.staffRequired,
              technologyRequired: input.technologyRequired,
            }),
          },
        });

        // Log the admin action
        await ctx.db.adminAuditLog.create({
          data: {
            action: "ECONOMIC_COMPONENT_CREATED",
            targetType: "economic_component",
            targetId: component.id,
            targetName: input.name,
            changes: JSON.stringify(input),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
            ipAddress:
              ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
          },
        });

        return {
          success: true,
          component: transformDatabaseComponent(component),
          message: "Component created successfully",
        };
      } catch (error) {
        console.error(`[economicComponents] Error creating component ${input.name}:`, {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.auth?.userId || "anonymous",
          adminUser: ctx.user
            ? `${(ctx.user as any).role?.name || "NO_ROLE"} (level ${(ctx.user as any).role?.level ?? "N/A"})`
            : "NO_USER",
          componentType: input.type,
          componentName: input.name,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create component "${input.name}". Please try again or contact support if the issue persists.`,
        });
      }
    }),

  /**
   * Update a component (admin only)
   */
  updateComponent: adminProcedure
    .input(
      z.object({
        componentType: economicComponentTypeSchema,
        name: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        category: z.string().optional(),
        effectiveness: z.number().min(0).max(100).optional(),
        implementationCost: z.number().min(0).optional(),
        maintenanceCost: z.number().min(0).optional(),
        requiredCapacity: z.number().min(0).max(100).optional(),
        synergies: z.array(economicComponentTypeSchema).optional(),
        conflicts: z.array(economicComponentTypeSchema).optional(),
        governmentSynergies: z.array(z.string()).optional(),
        governmentConflicts: z.array(z.string()).optional(),
        taxImpact: z
          .object({
            optimalCorporateRate: z.number().min(0).max(50),
            optimalIncomeRate: z.number().min(0).max(60),
            revenueEfficiency: z.number().min(0).max(100),
          })
          .optional(),
        sectorImpact: z.record(z.string(), z.number()).optional(),
        employmentImpact: z
          .object({
            unemploymentModifier: z.number().min(-2).max(2),
            participationModifier: z.number().min(0.5).max(2),
            wageGrowthModifier: z.number().min(0.5).max(2),
          })
          .optional(),
        complexity: z.enum(["Low", "Medium", "High"]).optional(),
        timeToImplement: z.string().optional(),
        staffRequired: z.number().min(0).optional(),
        technologyRequired: z.boolean().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Build update data with stringified JSON fields
        const updateData: Record<string, unknown> = {};
        const metadata: Record<string, unknown> = {};

        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.effectiveness !== undefined) updateData.effectiveness = input.effectiveness;
        if (input.synergies !== undefined) updateData.synergies = JSON.stringify(input.synergies);
        if (input.conflicts !== undefined) updateData.conflicts = JSON.stringify(input.conflicts);
        if (input.governmentSynergies !== undefined)
          updateData.governmentSynergies = JSON.stringify(input.governmentSynergies);
        if (input.governmentConflicts !== undefined)
          updateData.governmentConflicts = JSON.stringify(input.governmentConflicts);
        if (input.taxImpact !== undefined) updateData.taxImpact = JSON.stringify(input.taxImpact);
        if (input.sectorImpact !== undefined)
          updateData.sectorImpact = JSON.stringify(input.sectorImpact);
        if (input.employmentImpact !== undefined)
          updateData.employmentImpact = JSON.stringify(input.employmentImpact);
        if (input.implementationCost !== undefined)
          updateData.implementationCost = input.implementationCost;
        if (input.maintenanceCost !== undefined) updateData.maintenanceCost = input.maintenanceCost;
        if (input.requiredCapacity !== undefined)
          updateData.requiredCapacity = input.requiredCapacity;
        if (input.color !== undefined) updateData.color = input.color;
        if (input.icon !== undefined) updateData.iconName = input.icon;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        // Build metadata
        if (input.complexity !== undefined) metadata.complexity = input.complexity;
        if (input.timeToImplement !== undefined) metadata.timeToImplement = input.timeToImplement;
        if (input.staffRequired !== undefined) metadata.staffRequired = input.staffRequired;
        if (input.technologyRequired !== undefined)
          metadata.technologyRequired = input.technologyRequired;

        if (Object.keys(metadata).length > 0) {
          // Get existing metadata and merge
          const existing = await ctx.db.economicComponentData.findUnique({
            where: { componentType: input.componentType },
            select: { metadata: true },
          });

          const existingMetadata = existing ? JSON.parse(existing.metadata) : {};
          updateData.metadata = JSON.stringify({ ...existingMetadata, ...metadata });
        }

        // Update component
        const component = await ctx.db.economicComponentData.update({
          where: { componentType: input.componentType },
          data: updateData,
        });

        // Log the admin action
        await ctx.db.adminAuditLog.create({
          data: {
            action: "ECONOMIC_COMPONENT_UPDATED",
            targetType: "economic_component",
            targetId: component.id,
            targetName: component.name,
            changes: JSON.stringify(input),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
            ipAddress:
              ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
          },
        });

        return {
          success: true,
          component: transformDatabaseComponent(component),
          message: "Component updated successfully",
        };
      } catch (error) {
        console.error(`[economicComponents] Error updating component ${input.componentType}:`, {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.auth?.userId || "anonymous",
          adminUser: ctx.user
            ? `${(ctx.user as any).role?.name || "NO_ROLE"} (level ${(ctx.user as any).role?.level ?? "N/A"})`
            : "NO_USER",
          componentType: input.componentType,
          updateFields: Object.keys(input).join(", "),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update component ${input.componentType}. Please try again or contact support if the issue persists.`,
        });
      }
    }),

  /**
   * Delete (deactivate) a component (admin only)
   */
  deleteComponent: adminProcedure
    .input(
      z.object({
        componentType: economicComponentTypeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Soft delete by setting isActive to false
        const component = await ctx.db.economicComponentData.update({
          where: { componentType: input.componentType },
          data: { isActive: false },
        });

        // Log the admin action
        await ctx.db.adminAuditLog.create({
          data: {
            action: "ECONOMIC_COMPONENT_DELETED",
            targetType: "economic_component",
            targetId: component.id,
            targetName: component.name,
            changes: JSON.stringify({ componentType: input.componentType, isActive: false }),
            adminId: ctx.user?.id || "system",
            adminName: ctx.user?.clerkUserId || "System",
            timestamp: new Date(),
            ipAddress:
              ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown",
          },
        });

        return {
          success: true,
          message: "Component deactivated successfully",
        };
      } catch (error) {
        console.error(`[economicComponents] Error deleting component ${input.componentType}:`, {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.auth?.userId || "anonymous",
          adminUser: ctx.user
            ? `${(ctx.user as any).role?.name || "NO_ROLE"} (level ${(ctx.user as any).role?.level ?? "N/A"})`
            : "NO_USER",
          componentType: input.componentType,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete component ${input.componentType}. Please try again or contact support if the issue persists.`,
        });
      }
    }),
});
