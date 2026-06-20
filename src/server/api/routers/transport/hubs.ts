/**
 * transport.ts — tRPC router for transport infrastructure.
 *
 * Provides CRUD for transport routes and hubs, plus procedural
 * route generation using terrain-aware pathfinding.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";
import { standardMutationCountryOwnerProcedure } from "~/server/api/trpc";

export async function syncTransportEconomicModifiers(db: any, countryId: string) {
  const routes = await db.transportRoute.findMany({
    where: { countryId, status: "operational" },
  });

  const hubs = await db.transportHub.findMany({
    where: { countryId },
  });

  let totalLengthKm = 0;
  let totalMaintenanceCost = 0;

  for (const route of routes) {
    totalLengthKm += route.lengthKm ?? 0;
    const props = (route.properties as Record<string, any>) || {};
    totalMaintenanceCost += props.maintenanceCost !== undefined ? Number(props.maintenanceCost) : 0;
  }

  const gdpBonus = Math.min(0.15, totalLengthKm * 0.0001 + hubs.length * 0.01);
  const tradeBonus = Math.min(0.2, totalLengthKm * 0.00015 + hubs.length * 0.015);
  const syncDate = new Date();

  // GDP modifier effect
  const gdpEffectName = "transport_gdp_bonus";
  const existingGdp = await db.storytellerEffect.findFirst({
    where: { countryId, inputType: gdpEffectName, createdBy: "system_transport_sync" },
  });
  if (existingGdp) {
    await db.storytellerEffect.update({
      where: { id: existingGdp.id },
      data: {
        value: gdpBonus,
        description: `GDP growth bonus from transport network (${totalLengthKm.toFixed(1)} km operational routes, ${hubs.length} hubs)`,
        isActive: gdpBonus > 0,
        ixTimeTimestamp: syncDate,
      },
    });
  } else if (gdpBonus > 0) {
    await db.storytellerEffect.create({
      data: {
        countryId,
        inputType: gdpEffectName,
        value: gdpBonus,
        description: `GDP growth bonus from transport network (${totalLengthKm.toFixed(1)} km operational routes, ${hubs.length} hubs)`,
        isActive: true,
        createdBy: "system_transport_sync",
        ixTimeTimestamp: syncDate,
      },
    });
  }

  // Trade modifier effect
  const tradeEffectName = "transport_trade_bonus";
  const existingTrade = await db.storytellerEffect.findFirst({
    where: { countryId, inputType: tradeEffectName, createdBy: "system_transport_sync" },
  });
  if (existingTrade) {
    await db.storytellerEffect.update({
      where: { id: existingTrade.id },
      data: {
        value: tradeBonus,
        description: `Trade efficiency bonus from transport network (${totalLengthKm.toFixed(1)} km operational routes, ${hubs.length} hubs)`,
        isActive: tradeBonus > 0,
        ixTimeTimestamp: syncDate,
      },
    });
  } else if (tradeBonus > 0) {
    await db.storytellerEffect.create({
      data: {
        countryId,
        inputType: tradeEffectName,
        value: tradeBonus,
        description: `Trade efficiency bonus from transport network (${totalLengthKm.toFixed(1)} km operational routes, ${hubs.length} hubs)`,
        isActive: true,
        createdBy: "system_transport_sync",
        ixTimeTimestamp: syncDate,
      },
    });
  }

  // Maintenance cost effect
  const maintenanceEffectName = "transport_infra_maintenance";
  const existingMaintenance = await db.storytellerEffect.findFirst({
    where: { countryId, inputType: maintenanceEffectName, createdBy: "system_transport_sync" },
  });
  if (existingMaintenance) {
    await db.storytellerEffect.update({
      where: { id: existingMaintenance.id },
      data: {
        value: -totalMaintenanceCost,
        description: `Annual transport network maintenance cost (${totalMaintenanceCost.toFixed(3)} billion IxCredits)`,
        isActive: totalMaintenanceCost > 0,
        ixTimeTimestamp: syncDate,
      },
    });
  } else if (totalMaintenanceCost > 0) {
    await db.storytellerEffect.create({
      data: {
        countryId,
        inputType: maintenanceEffectName,
        value: -totalMaintenanceCost,
        description: `Annual transport network maintenance cost (${totalMaintenanceCost.toFixed(3)} billion IxCredits)`,
        isActive: true,
        createdBy: "system_transport_sync",
        ixTimeTimestamp: syncDate,
      },
    });
  }
}

export const transportHubsRouter = createTRPCRouter({
  /**
   * Get transport hubs for a country.
   */
  getCountryHubs: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.transportHub.findMany({
        where: { countryId: input.countryId },
        include: { city: { select: { name: true, population: true } } },
        orderBy: { connections: "desc" },
      });
    }),

  // ── Hub Management ──

  /**
   * Get a single hub by ID.
   */
  getHubById: cachedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.transportHub.findUnique({
        where: { id: input.id },
        include: {
          city: { select: { id: true, name: true, population: true } },
          country: { select: { id: true, name: true } },
        },
      });
    }),

  /**
   * Create a transport hub manually.
   */
  createHub: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string(),
        hubType: z.enum(["station", "port", "airport", "junction", "interchange"]),
        coordinates: z.tuple([z.number(), z.number()]),
        cityId: z.string().optional(),
        throughput: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transportHub.create({
        data: {
          countryId: input.countryId,
          name: input.name,
          hubType: input.hubType,
          coordinates: input.coordinates,
          cityId: input.cityId,
          throughput: input.throughput,
        },
      });
    }),

  /**
   * Update a transport hub.
   */
  updateHub: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        id: z.string(),
        countryId: z.string(),
        name: z.string().optional(),
        hubType: z.enum(["station", "port", "airport", "junction", "interchange"]).optional(),
        throughput: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, countryId: _cid, ...data } = input;
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) updates[k] = v;
      }
      return ctx.db.transportHub.update({ where: { id }, data: updates });
    }),

  /**
   * Delete a transport hub.
   */
  deleteHub: standardMutationCountryOwnerProcedure
    .input(z.object({ id: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transportHub.delete({ where: { id: input.id } });
    }),
});

// ── Helpers ──────────────────────────────────────────────────────

function extractBoundaryCoords(geometry: import("geojson").Geometry): [number, number][] {
  const coords: [number, number][] = [];
  function walk(obj: unknown): void {
    if (coords.length >= 200) return;
    if (!Array.isArray(obj)) return;
    if (obj.length >= 2 && typeof obj[0] === "number" && typeof obj[1] === "number") {
      coords.push([obj[0] as number, obj[1] as number]);
    } else {
      for (const item of obj) walk(item);
    }
  }
  if ("coordinates" in geometry) walk(geometry.coordinates);
  return coords;
}
