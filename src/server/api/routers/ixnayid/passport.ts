import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  getHistory,
  getPassport,
  getRealms,
  getWork,
} from "~/server/modules/identity/identity.service";
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

/**
 * Public passport (plan 188). A passport is public by design: every procedure is readable
 * signed-out, and the viewer id only decides ownership (owner-only drafts, the edit control).
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
});
