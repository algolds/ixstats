/**
 * hubs.ts — tRPC router for transport hubs.
 *
 * Read endpoints for transport hubs (stations, ports, airports, junctions) and network nodes.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";

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
   * Get transport network nodes for a country.
   */
  getCountryNodes: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const dbAny = ctx.db as any;
      if (dbAny.transportNode) {
        return dbAny.transportNode.findMany({
          where: { countryId: input.countryId },
          include: { city: { select: { name: true, population: true } } },
          orderBy: { createdAt: "asc" },
        });
      }
      return ctx.db.transportHub.findMany({
        where: { countryId: input.countryId },
        include: { city: { select: { name: true, population: true } } },
      });
    }),
});
