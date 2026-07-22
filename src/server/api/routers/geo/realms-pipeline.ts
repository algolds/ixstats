/**
 * Realms Map Pipeline tRPC Router
 *
 * Exposes multi-tenant realm map operations:
 * - `generateProceduralRealmMap`: Runs Azgaar procedural generation & enrichment for a realm.
 * - `processUploadedRealmMap`: Processing uploaded PNG/SVG map files.
 * - `commitRealmMap`: Persists an enriched map package into PostGIS under a specific realmId.
 * - `submitTerritoryClaim`: Submits a click-to-claim territory application for admin approval.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { generateWorld } from "~/lib/worldgen/engine";
import { normalizeAzgaarGraph } from "~/lib/map-pipeline/azgaar-normalizer";
import { enrichMapDataset } from "~/lib/map-pipeline/enrichment-pipeline";
import { commitRealmMapToDatabase } from "~/lib/map-pipeline/realm-map-committer";

export const realmsPipelineRouter = createTRPCRouter({
  /**
   * Generate a procedural realm map (Azgaar pipeline + enrichment).
   */
  generateProceduralRealmMap: protectedProcedure
    .input(
      z.object({
        realmId: z.string(),
        seed: z.number().default(() => Math.floor(Math.random() * 100000)),
        cellCount: z.number().min(100).max(10000).default(1000),
        landCoverage: z.number().min(15).max(75).default(35),
        countryCount: z.number().min(3).max(50).default(12),
        commitImmediately: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check realm ownership or staff status
      const realm = await ctx.db.realm.findUnique({
        where: { id: input.realmId },
      });
      if (!realm) throw new TRPCError({ code: "NOT_FOUND", message: "Realm not found" });

      if (realm.ownerId !== ctx.auth.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Only the realm owner can generate map data" });
      }

      // 1. Run Azgaar procedural engine
      const world = generateWorld({
        seed: input.seed,
        cellCount: input.cellCount,
        countryCount: input.countryCount,
      });

      // 2. Normalize graph into GeoJSON & nation/city/river structures
      const normalized = normalizeAzgaarGraph(world.graph, input.seed);

      // 3. Run enrichment pipeline
      const enrichedPackage = enrichMapDataset(normalized.layers, normalized.countries, input.realmId);

      // 4. Commit to database if requested
      let commitResult = null;
      if (input.commitImmediately) {
        commitResult = await commitRealmMapToDatabase(ctx.db as any, {
          realmId: input.realmId,
          enrichedPackage,
          countries: normalized.countries,
          cities: normalized.cities,
          rivers: normalized.rivers,
          replaceExisting: true,
        });

        // Update realm status to active
        await ctx.db.realm.update({
          where: { id: input.realmId },
          data: {
            status: "active",
            seed: input.seed,
            generationParams: {
              cellCount: input.cellCount,
              landCoverage: input.landCoverage,
              countryCount: input.countryCount,
            } as any,
          },
        });
      }

      return {
        realmId: input.realmId,
        seed: input.seed,
        stats: normalized.metadata,
        commitResult,
        log: enrichedPackage.log,
      };
    }),

  /**
   * Submit a territory claim for an unclaimed polygon in a realm.
   */
  submitTerritoryClaim: protectedProcedure
    .input(
      z.object({
        realmId: z.string(),
        mapLayerFeatureId: z.string(),
        nationName: z.string().min(2).max(100),
        governmentType: z.string().optional(),
        capitalName: z.string().optional(),
        flagUrl: z.string().optional(),
        details: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if feature exists in MapLayer for this realm
      const feature = await ctx.db.mapLayer.findFirst({
        where: {
          worldId: input.realmId,
          layerType: "political",
          featureId: input.mapLayerFeatureId,
        },
      });

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Territory polygon not found on map" });
      }

      // Check if territory is already claimed by an approved country
      if (feature.countryId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This territory is already claimed by an active country" });
      }

      // Check if user already has a pending claim in this realm
      const existingUserClaim = await ctx.db.territoryClaim.findFirst({
        where: {
          realmId: input.realmId,
          userId: ctx.auth.userId,
          status: "pending",
        },
      });

      if (existingUserClaim) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a pending territory claim in this realm" });
      }

      // Create territory claim
      const claim = await ctx.db.territoryClaim.create({
        data: {
          realmId: input.realmId,
          mapLayerFeatureId: input.mapLayerFeatureId,
          userId: ctx.auth.userId,
          nationName: input.nationName,
          governmentType: input.governmentType,
          capitalName: input.capitalName,
          flagUrl: input.flagUrl,
          details: input.details as any,
          status: "pending",
        },
      });

      return {
        success: true,
        claimId: claim.id,
        message: "Territory claim submitted for realm admin review",
      };
    }),

  /**
   * Admin/Realm Owner workflow: Approve or Reject a territory claim.
   */
  reviewTerritoryClaim: protectedProcedure
    .input(
      z.object({
        claimId: z.string(),
        action: z.enum(["approve", "reject"]),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.territoryClaim.findUnique({
        where: { id: input.claimId },
        include: { realm: true },
      });

      if (!claim) throw new TRPCError({ code: "NOT_FOUND", message: "Claim not found" });

      // Verify permission: realm owner or system owner
      if (claim.realm.ownerId !== ctx.auth.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Only the realm owner can review territory claims" });
      }

      if (input.action === "reject") {
        const updated = await ctx.db.territoryClaim.update({
          where: { id: input.claimId },
          data: {
            status: "rejected",
            reviewedBy: ctx.auth.userId,
            reviewedAt: new Date(),
            rejectionReason: input.rejectionReason || "Claim rejected by realm admin",
          },
        });
        return { success: true, status: "rejected", claimId: updated.id };
      }

      // APPROVAL FLOW: Create Country and link user
      const slug = claim.nationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const country = await ctx.db.country.create({
        data: {
          name: claim.nationName,
          slug,
          realmId: claim.realmId,
          color: "#3b82f6",
        },
      });

      // Link MapLayer feature to Country
      await ctx.db.mapLayer.updateMany({
        where: {
          worldId: claim.realmId,
          layerType: "political",
          featureId: claim.mapLayerFeatureId,
        },
        data: { countryId: country.id },
      });

      // Link User to Country
      await ctx.db.user.upsert({
        where: { clerkUserId: claim.userId },
        update: { countryId: country.id },
        create: { clerkUserId: claim.userId, countryId: country.id },
      });

      // Update claim status
      await ctx.db.territoryClaim.update({
        where: { id: input.claimId },
        data: {
          status: "approved",
          reviewedBy: ctx.auth.userId,
          reviewedAt: new Date(),
        },
      });

      return {
        success: true,
        status: "approved",
        countryId: country.id,
        nationName: country.name,
      };
    }),
});
