import type { IdentityForumGateway } from "~/server/modules/identity/identity.types";
import { db } from "~/server/db";

/**
 * Forum access for the identity module, which may not import the forum module itself. Native since phase 4b: old
 * forum names resolve through imported content, activity is counted on the ThinkPages forum. Loaded on demand, as
 * only the passport needs the forum module.
 */
export const forumGateway: IdentityForumGateway = {
  lookupUser: async (name) =>
    (await import("~/server/modules/thinkpages-forum")).importedAuthorByName(db, name),
  getActivity: async (userId) =>
    (await import("~/server/modules/thinkpages-forum")).forumActivityOf(db, userId),
};
