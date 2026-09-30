import { z } from "zod";
import {
  createTRPCRouter,
  lightMutationProcedure,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  getCountryRibbons,
  getHistory,
  getOwnPassportSettings,
  getPassport,
  getRealms,
  getRibbons,
  getWork,
  updateOwnPassportSettings,
} from "~/server/modules/identity/identity.service";
import {
  MAX_PINNED_RIBBONS,
  MAX_SIGNATURE_LENGTH,
} from "~/server/modules/identity/identity.privacy";
import type {
  IdentityForumGateway,
  IdentityForumMember,
} from "~/server/modules/identity/identity.types";

/** Forum access for the identity module, which may not import the forum module itself. */
const forumGateway: IdentityForumGateway = {
  lookupUser: async (name) => (await import("~/server/modules/forum")).lookupForumUser(name),
  getMember: async (userId) => {
    const { cachedFetch, cacheKey, xfFetch } = await import("~/server/modules/forum");
    const response = await cachedFetch(cacheKey("member", userId), "member", () =>
      xfFetch<{ user: IdentityForumMember }>(`/users/${userId}/`)
    );
    return response?.user ?? null;
  },
};

const handleInput = z.object({ handle: z.string().min(1).max(200) });

const visibilityInput = z
  .object({
    accolades: z.boolean(),
    impact: z.boolean(),
    forumStats: z.boolean(),
    vaultCards: z.boolean(),
    historyStream: z.boolean(),
    achievements: z.boolean(),
  })
  .partial();

const settingsInput = z.object({
  visibility: visibilityInput.optional(),
  signature: z.string().max(MAX_SIGNATURE_LENGTH).nullable().optional(),
  pinnedRibbonKeys: z.array(z.string().min(1).max(100)).max(MAX_PINNED_RIBBONS).optional(),
});

/**
 * Public passport (plan 188). A passport is public by design: every read procedure is readable
 * signed-out, and the viewer id only decides ownership (owner-only drafts, the edit control).
 * Sections the owner hides in their passport settings are stripped server-side from every read.
 */
export const ixnayidPassportRouter = createTRPCRouter({
  getPassport: publicProcedure.input(handleInput).query(({ ctx, input }) =>
    getPassport({ handle: input.handle, viewerClerkId: ctx.auth?.userId ?? null }, forumGateway)
  ),

  getRealms: publicProcedure
    .input(handleInput.extend({ realm: z.string().min(1).max(100).optional() }))
    .query(({ ctx, input }) => getRealms({ ...input, viewerClerkId: ctx.auth?.userId ?? null })),

  getWork: publicProcedure
    .input(handleInput)
    .query(({ ctx, input }) => getWork({ ...input, viewerClerkId: ctx.auth?.userId ?? null })),

  getHistory: publicProcedure
    .input(
      handleInput.extend({
        limit: z.number().int().min(1).max(200).default(50),
        cursor: z.string().max(300).nullish(),
      })
    )
    .query(({ ctx, input }) => getHistory({ ...input, viewerClerkId: ctx.auth?.userId ?? null })),

  /** A passport holder's ribbons (one per unlocked achievement), pinned first. */
  getRibbons: publicProcedure
    .input(handleInput)
    .query(({ ctx, input }) => getRibbons({ ...input, viewerClerkId: ctx.auth?.userId ?? null })),

  /** The country page's ribbon rack: the owning user's top ribbons, empty when there are none. */
  getCountryRibbons: publicProcedure
    .input(z.object({ countrySlug: z.string().min(1).max(200) }))
    .query(({ input }) => getCountryRibbons(input.countrySlug)),

  /** The signed-in user's own passport settings and the ribbons they can pin. */
  getPassportSettings: protectedProcedure.query(({ ctx }) => getOwnPassportSettings(ctx.user)),

  /** Save the signed-in user's passport visibility, signature and pinned ribbons. */
  updatePassportSettings: lightMutationProcedure
    .input(settingsInput)
    .mutation(({ ctx, input }) => updateOwnPassportSettings(ctx.user, input)),
});
