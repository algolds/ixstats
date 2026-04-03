/**
 * Demo Mode API Router
 *
 * Admin-only endpoints for managing the live demo system.
 * Creates a cloned demo country with seeded data across all subsystems.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { DemoSeedService } from "~/lib/demo-seed";
import { isSystemOwner } from "~/lib/system-owner-constants";

// SystemConfig keys for demo mode state
const DEMO_ACTIVE_KEY = "demo_mode_active";
const DEMO_COUNTRY_KEY = "demo_country_id";
const DEMO_SOURCE_KEY = "demo_source_country_id";

/** Read a SystemConfig value */
async function getConfig(prisma: any, key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Upsert a SystemConfig value */
async function setConfig(prisma: any, key: string, value: string, description?: string) {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value, description },
  });
}

/** Delete a SystemConfig value */
async function deleteConfig(prisma: any, key: string) {
  await prisma.systemConfig.deleteMany({ where: { key } });
}

export const demoModeRouter = createTRPCRouter({
  /**
   * Get demo mode state. Only returns real data for system owners.
   * Used by DemoModeContext on the client.
   */
  getDemoState: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId || !isSystemOwner(userId)) {
      return { isActive: false, demoCountryId: null };
    }

    const [activeValue, countryId] = await Promise.all([
      getConfig(ctx.db, DEMO_ACTIVE_KEY),
      getConfig(ctx.db, DEMO_COUNTRY_KEY),
    ]);

    const isActive = activeValue === "true" && !!countryId;

    // Verify the demo country still exists
    if (isActive && countryId) {
      const exists = await ctx.db.country.findFirst({
        where: { id: countryId, isDemo: true },
        select: { id: true },
      });
      if (!exists) {
        // Country was deleted externally, clean up config
        await setConfig(ctx.db, DEMO_ACTIVE_KEY, "false");
        return { isActive: false, demoCountryId: null };
      }
    }

    return { isActive, demoCountryId: isActive ? countryId : null };
  }),

  /**
   * Get full demo mode status with stats. Admin only.
   */
  getStatus: adminProcedure.query(async ({ ctx }) => {
    const [activeValue, configCountryId] = await Promise.all([
      getConfig(ctx.db, DEMO_ACTIVE_KEY),
      getConfig(ctx.db, DEMO_COUNTRY_KEY),
    ]);

    // Also check for orphaned demo countries not tracked in SystemConfig
    let demoCountry = null;
    if (configCountryId) {
      demoCountry = await ctx.db.country.findFirst({
        where: { id: configCountryId, isDemo: true },
        select: { id: true, name: true, createdAt: true },
      });
    }
    if (!demoCountry) {
      demoCountry = await ctx.db.country.findFirst({
        where: { isDemo: true },
        select: { id: true, name: true, createdAt: true },
      });
      // Sync config if we found an orphaned demo country
      if (demoCountry) {
        await setConfig(ctx.db, DEMO_COUNTRY_KEY, demoCountry.id, "ID of the demo country");
      }
    }

    const isActive = activeValue === "true" && !!demoCountry;
    let seedStats = null;

    if (demoCountry) {
      seedStats = await DemoSeedService.getSeedStats(ctx.db, demoCountry.id);
    }

    return {
      isActive,
      demoCountryId: demoCountry?.id ?? null,
      demoCountryName: demoCountry?.name ?? null,
      createdAt: demoCountry?.createdAt ?? null,
      seedStats,
    };
  }),

  /**
   * Activate demo mode: clone source country + seed data.
   */
  activate: adminProcedure
    .input(z.object({ sourceCountryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Auto-destroy any existing demo country (config-tracked or orphaned)
      const existingId = await getConfig(ctx.db, DEMO_COUNTRY_KEY);
      const existingDemo = existingId
        ? await ctx.db.country.findFirst({ where: { id: existingId, isDemo: true }, select: { id: true } })
        : await ctx.db.country.findFirst({ where: { isDemo: true }, select: { id: true } });

      if (existingDemo) {
        await DemoSeedService.destroyDemoCountry(ctx.db, existingDemo.id);
        await deleteConfig(ctx.db, DEMO_ACTIVE_KEY);
        await deleteConfig(ctx.db, DEMO_COUNTRY_KEY);
      }

      // Clone the source country
      const demoCountryId = await DemoSeedService.createDemoCountry(ctx.db, input.sourceCountryId);

      // Seed all subsystems (clone-first from source country)
      const stats = await DemoSeedService.seedAllSubsystems(ctx.db, demoCountryId, userId, input.sourceCountryId);

      // Set config
      await setConfig(ctx.db, DEMO_ACTIVE_KEY, "true", "Whether demo mode is active");
      await setConfig(ctx.db, DEMO_COUNTRY_KEY, demoCountryId, "ID of the demo country");
      await setConfig(ctx.db, DEMO_SOURCE_KEY, input.sourceCountryId, "Source country for demo cloning");

      return { demoCountryId, stats };
    }),

  /**
   * Deactivate demo mode (keeps data for re-activation).
   */
  deactivate: adminProcedure.mutation(async ({ ctx }) => {
    await setConfig(ctx.db, DEMO_ACTIVE_KEY, "false");
    return { success: true };
  }),

  /**
   * Re-activate demo mode (if demo country still exists).
   */
  reactivate: adminProcedure.mutation(async ({ ctx }) => {
    const countryId = await getConfig(ctx.db, DEMO_COUNTRY_KEY);
    if (!countryId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No demo country exists. Use activate first." });
    }

    const exists = await ctx.db.country.findFirst({
      where: { id: countryId, isDemo: true },
    });
    if (!exists) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Demo country no longer exists. Use activate to create a new one." });
    }

    await setConfig(ctx.db, DEMO_ACTIVE_KEY, "true");
    return { success: true, demoCountryId: countryId };
  }),

  /**
   * Re-seed: wipe and regenerate all demo data.
   */
  reseed: adminProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const countryId = await getConfig(ctx.db, DEMO_COUNTRY_KEY);
    if (!countryId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No demo country exists." });
    }

    const sourceCountryId = await getConfig(ctx.db, DEMO_SOURCE_KEY);
    if (!sourceCountryId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Source country ID not stored. Destroy and re-activate." });
    }

    // Wipe existing subsystem data
    await DemoSeedService.cleanupDemoData(ctx.db, countryId);

    // Delete cascade-linked models explicitly since we're NOT deleting the country itself
    await ctx.db.nationalIssue.deleteMany({ where: { countryId } });
    await ctx.db.militaryOperation.deleteMany({ where: { countryId } });
    await ctx.db.thinkpagesAccount.deleteMany({ where: { countryId } });
    await ctx.db.militaryBranch.deleteMany({ where: { countryId } });
    await ctx.db.politicalParty.deleteMany({ where: { countryId } });
    await ctx.db.legislature.deleteMany({ where: { countryId } });
    await ctx.db.embassy.deleteMany({ where: { OR: [{ hostCountryId: countryId }, { guestCountryId: countryId }] } });
    // New models added by clone-first system
    await ctx.db.governmentComponent.deleteMany({ where: { countryId } });
    await ctx.db.economicComponent.deleteMany({ where: { countryId } });
    await ctx.db.taxComponent.deleteMany({ where: { countryId } });
    await ctx.db.crossBuilderSynergy.deleteMany({ where: { countryId } });
    await ctx.db.securityThreat.deleteMany({ where: { countryId } });
    await ctx.db.territory.deleteMany({ where: { countryId } });
    await ctx.db.subdivision.deleteMany({ where: { countryId } });
    await ctx.db.historicalDataPoint.deleteMany({ where: { countryId } });
    // Tax system tree (cascade from taxSystem)
    await ctx.db.taxSystem.deleteMany({ where: { countryId } });
    // Border security (cascade from borderSecurity)
    await ctx.db.borderSecurity.deleteMany({ where: { countryId } });
    // Government tree (cascade from governmentStructure departments)
    const govStructure = await ctx.db.governmentStructure.findFirst({
      where: { countryId }, select: { id: true },
    });
    if (govStructure) {
      await ctx.db.governmentDepartment.deleteMany({ where: { governmentStructureId: govStructure.id } });
    }
    // 1:1 economic models
    await ctx.db.demographics.deleteMany({ where: { countryId } });
    await ctx.db.economicProfile.deleteMany({ where: { countryId } });
    await ctx.db.laborMarket.deleteMany({ where: { countryId } });
    await ctx.db.fiscalSystem.deleteMany({ where: { countryId } });
    await ctx.db.incomeDistribution.deleteMany({ where: { countryId } });
    await ctx.db.governmentBudget.deleteMany({ where: { countryId } });
    await ctx.db.defenseBudget.deleteMany({ where: { countryId } });
    await ctx.db.securityAssessment.deleteMany({ where: { countryId } });
    await ctx.db.atomicEffectiveness.deleteMany({ where: { countryId } });
    await ctx.db.nationalIdentity.deleteMany({ where: { countryId } });
    await ctx.db.cardBackgroundImage.deleteMany({ where: { countryId } });
    await ctx.db.intelligenceAlertThreshold.deleteMany({ where: { countryId } });
    await ctx.db.intelligenceAlert.deleteMany({ where: { countryId } });
    // Activity Feed and User Achievements
    await ctx.db.activityFeed.deleteMany({ where: { countryId } });
    const reseedUser = await ctx.db.user.findFirst({
      where: { countryId }, select: { clerkUserId: true },
    }).catch((err: unknown) => { console.error("[DemoMode] Background op failed:", (err as Error).message); return null; });
    if (reseedUser?.clerkUserId) {
      await ctx.db.userAchievement.deleteMany({ where: { userId: reseedUser.clerkUserId } });
    }
    // NPC Personality Assignment
    await ctx.db.nPCPersonalityAssignment.deleteMany({ where: { countryId } });

    // Re-seed from source
    const stats = await DemoSeedService.seedAllSubsystems(ctx.db, countryId, userId, sourceCountryId);

    return { stats };
  }),

  /**
   * Destroy: permanently delete demo country and ALL related data.
   */
  destroy: adminProcedure.mutation(async ({ ctx }) => {
    // Check SystemConfig first, then fall back to DB scan for orphaned demo countries
    let countryId = await getConfig(ctx.db, DEMO_COUNTRY_KEY);
    if (!countryId) {
      const orphaned = await ctx.db.country.findFirst({
        where: { isDemo: true },
        select: { id: true },
      });
      if (!orphaned) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No demo country exists." });
      }
      countryId = orphaned.id;
    }

    await DemoSeedService.destroyDemoCountry(ctx.db, countryId);

    // Clear config
    await deleteConfig(ctx.db, DEMO_ACTIVE_KEY);
    await deleteConfig(ctx.db, DEMO_COUNTRY_KEY);
    await deleteConfig(ctx.db, DEMO_SOURCE_KEY);

    return { success: true };
  }),

  /**
   * Get seed stats for the current demo country.
   */
  getSeedStats: adminProcedure.query(async ({ ctx }) => {
    const countryId = await getConfig(ctx.db, DEMO_COUNTRY_KEY);
    if (!countryId) return null;

    return DemoSeedService.getSeedStats(ctx.db, countryId);
  }),
});
