import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  activeSyncs,
  discoverTopRegions,
  listSyncLogs,
  pauseSync,
  resumeSync,
  startCteFilter,
  startRegionSync,
  stopSync,
  syncLogCards,
} from "~/server/modules/cards/cards.ns-sync";
import { adminActor } from "~/server/shared/admin-actor";

const syncInput = z.object({ syncLogId: z.string().min(1) });

export const cardsAdminNationStatesRouter = createTRPCRouter({
  logs: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(({ ctx, input }) => listSyncLogs(ctx.db, input.limit)),

  logCards: adminProcedure
    .input(
      z.object({
        syncLogId: z.string().min(1),
        search: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(({ ctx, input }) => syncLogCards(ctx.db, input)),

  active: adminProcedure.query(({ ctx }) => activeSyncs(ctx.db)),

  start: adminProcedure
    .input(
      z.object({
        regions: z.array(z.string().min(1).max(100)).min(1).max(20),
        seasons: z.array(z.number().int().min(1).max(100)).max(100).optional(),
      })
    )
    .mutation(({ ctx, input }) => startRegionSync(ctx.db, adminActor(ctx), input)),

  pause: adminProcedure
    .input(syncInput)
    .mutation(({ ctx, input }) => pauseSync(ctx.db, input.syncLogId)),

  resume: adminProcedure
    .input(syncInput)
    .mutation(({ ctx, input }) => resumeSync(ctx.db, input.syncLogId)),

  stop: adminProcedure
    .input(syncInput)
    .mutation(({ ctx, input }) => stopSync(ctx.db, input.syncLogId)),

  // A mutation, though it only reads: each call makes up to 31 NationStates requests, which a query would repeat.
  discoverRegions: adminProcedure
    .input(
      z.object({
        tag: z.string().trim().min(1).max(50).default("gargantuan"),
        limit: z.number().int().min(1).max(50).default(15),
      })
    )
    .mutation(({ input }) => discoverTopRegions(input.tag, input.limit)),

  filterCte: adminProcedure.mutation(({ ctx }) => startCteFilter(ctx.db, adminActor(ctx))),
});
