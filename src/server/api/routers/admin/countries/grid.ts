// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const adminCountriesGridRouter = createTRPCRouter({
  // Get ThinkPages statistics (real DB values)

  // Get system status

  // Get bot status with health check

  // Get system configuration (includes all economic control parameters)

  // Save system configuration (all economic control parameters)

  // Set custom time via bot or local override

  // Bot control operations

  // Get calculation logs

  // Analyze import file

  // Import roster data

  // Sync epoch time with imported data

  // Force recalculation of all countries

  // Get system health

  // --- Clerk User-Country Mapping Endpoints ---
  // Note: User procedures are commented out until User model is properly configured

  // Sync with Discord bot

  // === ADMIN USER/COUNTRY MANAGEMENT ENDPOINTS ===

  // List all users and their claimed countries

  // List all countries and their assigned users

  // Assign a user to a country (admin override)

  // Unassign a user from a country (admin override)

  // Get navigation settings (wiki/cards/labs visibility)

  // Update navigation settings (wiki/cards/labs visibility)

  // ============================================================================
  // GOD MODE - DIRECT COUNTRY DATA MANIPULATION
  // ============================================================================

  // ============================================================================
  // DIPLOMATIC OPTIONS MANAGEMENT
  // ============================================================================

  // ============================================================================
  // PHASE 2: COUNTRY GRID & UPCOMING EVENTS
  // ============================================================================

  /**
   * Get all countries with key metrics for the admin country grid.
   * Supports sorting, filtering, and search.
   */
  getCountryGrid: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          sortBy: z
            .enum([
              "name",
              "currentTotalGdp",
              "currentGdpPerCapita",
              "realGDPGrowthRate",
              "currentPopulation",
              "economicTier",
              "updatedAt",
            ])
            .optional()
            .default("name"),
          sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
          tierFilter: z.string().optional(),
          limit: z.number().min(1).max(200).optional().default(100),
          offset: z.number().min(0).optional().default(0),
        })
        .optional()
        .default({ sortBy: "name", sortOrder: "asc", limit: 100, offset: 0 })
    )
    .query(async ({ ctx, input }) => {
      const { search, sortBy, sortOrder, tierFilter, limit, offset } = input;

      const where: Record<string, unknown> = {};
      if (search) {
        where.name = { contains: search, mode: "insensitive" };
      }
      if (tierFilter) {
        where.economicTier = tierFilter;
      }

      const [countries, total, activeStorytellerEffectsByCountry] = await Promise.all([
        ctx.db.country.findMany({
          where,
          select: {
            id: true,
            name: true,
            slug: true,
            flag: true,
            isDemo: true,
            // Economic
            currentTotalGdp: true,
            currentGdpPerCapita: true,
            realGDPGrowthRate: true,
            totalDebtGDPRatio: true,
            economicTier: true,
            inflationRate: true,
            // Population
            currentPopulation: true,
            populationGrowthRate: true,
            // Governance
            governmentType: true,
            politicalStability: true,
            publicApproval: true,
            // Vitality
            overallNationalHealth: true,
            economicVitality: true,
            // Map linkage
            landArea: true,
            // Timestamps
            lastCalculated: true,
            updatedAt: true,
            createdAt: true,
            // Owner info
            users: {
              select: {
                id: true,
                clerkUserId: true,
                isActive: true,
                updatedAt: true,
              },
            },
            // Count active interventions
            _count: {
              select: {
                storytellerEffects: { where: { isActive: true } },
              },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip: offset,
        }),
        ctx.db.country.count({ where }),
        // Get active storyteller effects count per country for alert badges
        ctx.db.storytellerEffect.groupBy({
          by: ["countryId"],
          where: { isActive: true },
          _count: {
            id: true,
          },
        }),
      ]);

      // Build a lookup for active interventions
      const effectsLookup = new Map(
        activeStorytellerEffectsByCountry
          .filter((d) => d.countryId)
          .map((d) => [d.countryId!, d._count.id])
      );

      const rows = countries.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        flag: c.flag,
        isDemo: c.isDemo,
        // Economic
        gdp: c.currentTotalGdp,
        gdpPerCapita: c.currentGdpPerCapita,
        gdpGrowthRate: c.realGDPGrowthRate,
        debtToGdpRatio: c.totalDebtGDPRatio,
        economicTier: c.economicTier,
        inflationRate: c.inflationRate,
        // Population
        population: c.currentPopulation,
        populationGrowthRate: c.populationGrowthRate,
        // Governance
        governmentType: c.governmentType,
        stability: c.politicalStability,
        approval: c.publicApproval,
        // Vitality
        nationalHealth: c.overallNationalHealth,
        economicVitality: c.economicVitality,
        // Map
        hasMap: c.landArea != null && c.landArea > 0,
        // Timestamps
        lastCalculated: c.lastCalculated,
        updatedAt: c.updatedAt,
        // Owner
        owner: c.users[0]
          ? {
              id: c.users[0].id,
              clerkUserId: c.users[0].clerkUserId,
              lastActive: c.users[0].updatedAt,
            }
          : null,
        // Alerts
        activeInterventions: effectsLookup.get(c.id) ?? c._count.storytellerEffects,
      }));

      return { rows, total, limit, offset };
    }),

  /**
   * Get full detail for a single country (admin drill-down).
   */
  getCountryDetail: adminProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          users: {
            select: {
              id: true,
              clerkUserId: true,
              membershipTier: true,
              isActive: true,
              updatedAt: true,
            },
          },
          storytellerEffects: {
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Get recent audit log entries for this country
      const auditLogs = await ctx.db.adminAuditLog.findMany({
        where: { targetId: input.countryId },
        orderBy: { timestamp: "desc" },
        take: 10,
      });

      return { country, auditLogs };
    }),

  // ============================================================================
  // STORYTELLER / WORLD EVENTS
  // ============================================================================

  // Event Chains

  // ─── Wiki Link Management ──────────────────────────────────────────
});

// getWikiDbPool is now imported from "~/lib/wiki-os/adapters/mediawiki/bridge"
