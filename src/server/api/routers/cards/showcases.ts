/** Free-form showcases (spec §2.2 Collections): the caller's own to edit, others' through the passport switch. */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  addToShowcase,
  createShowcase,
  deleteShowcase,
  getShowcase,
  listMyShowcases,
  myDisplay,
  pinShowcase,
  removeFromShowcase,
  SHOWCASE_LIMITS,
  ShowcaseFieldsSchema,
  updateShowcase,
} from "~/lib/cards/hub/showcases";
import { vaultVisible } from "./_passport";

const Id = z.string().min(1).max(64);
const Target = z.object({ showcaseId: Id });

export const cardsShowcasesRouter = createTRPCRouter({
  listMyShowcases: protectedProcedure.query(({ ctx }) => listMyShowcases(ctx.db, ctx.user.id)),
  getShowcase: protectedProcedure
    .input(Target)
    .query(({ ctx, input }) =>
      getShowcase(ctx.db, ctx.user.id, input.showcaseId, { vaultVisible })
    ),
  getMyDisplay: protectedProcedure.query(({ ctx }) => myDisplay(ctx.db, ctx.user.id)),
  createShowcase: rateLimitedMutationProcedure
    .input(ShowcaseFieldsSchema)
    .mutation(({ ctx, input }) => createShowcase(ctx.db, ctx.user.id, input)),
  updateShowcase: rateLimitedMutationProcedure
    .input(ShowcaseFieldsSchema.extend({ showcaseId: Id }))
    .mutation(({ ctx, input: { showcaseId, ...fields } }) =>
      updateShowcase(ctx.db, ctx.user.id, showcaseId, fields)
    ),
  deleteShowcase: rateLimitedMutationProcedure
    .input(Target)
    .mutation(({ ctx, input }) => deleteShowcase(ctx.db, ctx.user.id, input.showcaseId)),
  addToShowcase: rateLimitedMutationProcedure
    .input(Target.extend({ ownershipIds: z.array(Id).min(1).max(SHOWCASE_LIMITS.items) }))
    .mutation(({ ctx, input }) =>
      addToShowcase(ctx.db, ctx.user.id, input.showcaseId, input.ownershipIds)
    ),
  removeFromShowcase: rateLimitedMutationProcedure
    .input(Target.extend({ ownershipId: Id }))
    .mutation(({ ctx, input }) =>
      removeFromShowcase(ctx.db, ctx.user.id, input.showcaseId, input.ownershipId)
    ),
  pinShowcase: rateLimitedMutationProcedure
    .input(Target.extend({ pinned: z.boolean() }))
    .mutation(({ ctx, input }) => pinShowcase(ctx.db, ctx.user.id, input.showcaseId, input.pinned)),
});
