import type {
  IdentityForumGateway,
  IdentityForumMember,
} from "~/server/modules/identity/identity.types";

/** Forum access for the identity module, which may not import the forum module itself. */
export const forumGateway: IdentityForumGateway = {
  lookupUser: async (name) => (await import("~/server/modules/forum")).lookupForumUser(name),
  getMember: async (userId) => {
    const { cachedFetch, cacheKey, xfFetch } = await import("~/server/modules/forum");
    const response = await cachedFetch(cacheKey("member", userId), "member", () =>
      xfFetch<{ user: IdentityForumMember }>(`/users/${userId}/`)
    );
    return response?.user ?? null;
  },
};
