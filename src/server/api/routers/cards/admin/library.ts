import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  LibraryEditSchema,
  LibraryFilterSchema,
  bulkSetRetired,
  listLibrary,
  updateLibraryCard,
} from "~/server/modules/cards/cards.library";
import { adminActor } from "~/server/shared/admin-actor";

export const cardsAdminLibraryRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        filter: LibraryFilterSchema,
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(({ ctx, input }) => listLibrary(ctx.db, input)),

  update: adminProcedure
    .input(LibraryEditSchema)
    .mutation(({ ctx, input }) => updateLibraryCard(ctx.db, adminActor(ctx), input)),

  bulkSetRetired: adminProcedure
    .input(
      z.object({
        filter: LibraryFilterSchema,
        retired: z.boolean(),
        // The Library read it came from: its `asOf` and its count for this change.
        asOf: z.date(),
        expected: z.number().int().min(1),
        reason: z.string().trim().min(3).max(500),
      })
    )
    .mutation(({ ctx, input }) => bulkSetRetired(ctx.db, adminActor(ctx), input)),
});
