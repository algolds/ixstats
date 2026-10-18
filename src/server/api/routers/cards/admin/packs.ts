import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  PackEditorSchema,
  PackPreviewSchema,
  listPacks,
  previewPackPool,
  savePack,
  setPackActive,
} from "~/server/modules/cards/cards.packs";
import { adminActor } from "~/server/shared/admin-actor";

export const cardsAdminPacksRouter = createTRPCRouter({
  list: adminProcedure.query(({ ctx }) => listPacks(ctx.db)),
  save: adminProcedure
    .input(PackEditorSchema)
    .mutation(({ ctx, input }) => savePack(ctx.db, adminActor(ctx), input)),
  setActive: adminProcedure
    .input(z.object({ packId: z.string().min(1), isActive: z.boolean() }))
    .mutation(({ ctx, input }) => setPackActive(ctx.db, adminActor(ctx), input)),
  preview: adminProcedure
    .input(PackPreviewSchema)
    .query(({ ctx, input }) => previewPackPool(ctx.db, input)),
});
