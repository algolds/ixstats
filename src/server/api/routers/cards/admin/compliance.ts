import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  declineTakedown,
  fileTakedown,
  hideTakedownArt,
  listLicenceReview,
  listTakedowns,
  restoreTakedown,
  setCardLicence,
} from "~/server/modules/cards/cards.compliance";
import { adminActor } from "~/server/shared/admin-actor";

const takedownInput = z.object({ takedownId: z.string().min(1) });
const limit = z.number().int().min(1).max(200).default(100);

export const cardsAdminComplianceRouter = createTRPCRouter({
  takedowns: adminProcedure
    .input(z.object({ status: z.enum(["OPEN", "HIDDEN", "ANSWERED"]).default("OPEN"), limit }))
    .query(({ ctx, input }) => listTakedowns(ctx.db, input)),
  // NationStates self-service takedowns are filed by their flag owners, never by an admin
  file: adminProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        origin: z.enum(["AUTHOR_REQUEST", "ADMIN", "LICENCE_REVIEW"]),
        reason: z.string().trim().min(3).max(1000),
        contact: z.string().trim().max(200).optional(),
        receivedAt: z.date().optional(),
        hideNow: z.boolean().default(false),
      })
    )
    .mutation(({ ctx, input }) => fileTakedown(ctx.db, adminActor(ctx), input)),
  hide: adminProcedure
    .input(takedownInput)
    .mutation(({ ctx, input }) => hideTakedownArt(ctx.db, adminActor(ctx), input.takedownId)),
  decline: adminProcedure
    .input(takedownInput.extend({ note: z.string().trim().min(3).max(1000) }))
    .mutation(({ ctx, input }) => declineTakedown(ctx.db, adminActor(ctx), input)),
  restore: adminProcedure
    .input(takedownInput)
    .mutation(({ ctx, input }) => restoreTakedown(ctx.db, adminActor(ctx), input.takedownId)),
  licences: adminProcedure
    .input(z.object({ status: z.enum(["UNKNOWN", "RESTRICTED"]).default("UNKNOWN"), limit }))
    .query(({ ctx, input }) => listLicenceReview(ctx.db, input)),
  setLicence: adminProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        status: z.enum(["OPEN", "RESTRICTED"]),
        licence: z.string().trim().min(1).max(200),
        note: z.string().trim().max(500).optional(),
      })
    )
    .mutation(({ ctx, input }) => setCardLicence(ctx.db, adminActor(ctx), input)),
});
