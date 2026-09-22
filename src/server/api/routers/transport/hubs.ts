/**
 * hubs.ts — tRPC router for transport hubs.
 *
 * Provides CRUD operations for transport hubs (stations, ports, airports, junctions).
 */

import { z } from "zod/v4";
import type { Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  cachedPublicProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";

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
      const updates: Prisma.TransportHubUpdateInput = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.hubType !== undefined) updates.hubType = input.hubType;
      if (input.throughput !== undefined) updates.throughput = input.throughput;

      return ctx.db.transportHub.update({
        where: { id: input.id },
        data: updates,
      });
    }),

  /**
   * Delete a transport hub.
   */
  deleteHub: standardMutationCountryOwnerProcedure
    .input(z.object({ id: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transportHub.delete({ where: { id: input.id } });
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

  /**
   * Create a transport network node manually.
   */
  createNode: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().optional(),
        nodeType: z.enum(["city", "junction", "interchange", "waypoint", "border_crossing"]),
        coordinates: z.tuple([z.number(), z.number()]),
        cityId: z.string().optional(),
        elevation: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbAny = ctx.db as any;
      if (!dbAny.transportNode) {
        throw new Error("TransportNode model not yet initialized in database.");
      }
      return dbAny.transportNode.create({
        data: {
          countryId: input.countryId,
          name: input.name,
          nodeType: input.nodeType,
          coordinates: input.coordinates,
          cityId: input.cityId,
          elevation: input.elevation,
        },
      });
    }),

  /**
   * Update a transport network node.
   */
  updateNode: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        id: z.string(),
        countryId: z.string(),
        name: z.string().optional(),
        nodeType: z.enum(["city", "junction", "interchange", "waypoint", "border_crossing"]).optional(),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        elevation: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbAny = ctx.db as any;
      if (!dbAny.transportNode) throw new Error("TransportNode model not available");
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.nodeType !== undefined) updates.nodeType = input.nodeType;
      if (input.coordinates !== undefined) updates.coordinates = input.coordinates;
      if (input.elevation !== undefined) updates.elevation = input.elevation;

      return dbAny.transportNode.update({
        where: { id: input.id },
        data: updates,
      });
    }),

  /**
   * Delete a transport network node.
   */
  deleteNode: standardMutationCountryOwnerProcedure
    .input(z.object({ id: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dbAny = ctx.db as any;
      if (!dbAny.transportNode) throw new Error("TransportNode model not available");
      return dbAny.transportNode.delete({ where: { id: input.id } });
    }),
});
