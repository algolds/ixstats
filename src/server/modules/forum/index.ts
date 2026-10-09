/**
 * Forum Module — XenForo integration, BBCode rendering, and caching.
 *
 * Server-side only. Pure client formatting utilities (rarity colors, formatValue, etc.)
 * live in ~/shared/forum-utils so client components don't pull in this module.
 */

export {
  getForumActivity,
  getForumTrendingThreads,
  xfFetch,
  xfFetchAsUser,
  xfPostAsUser,
  xfPost,
  xfDelete,
  getXfApiKey,
  getXfApiUrl,
  type XFUser,
  type XFThread,
  type XFPost,
  type XFForumsResponse,
  type XFThreadsResponse,
  type XFThreadResponse,
  type XFPostsResponse,
  type XFForum,
} from "./services/xenforo-service";

export { lookupForumUser, syncUserToForum } from "./services/xenforo-user-sync";

export {
  createForumLinkService,
  ForumLinkError,
  type ForumProfileProof,
} from "./services/forum-link-verification";

export {
  requireForumUser,
  getForumUserByClerkId,
  getForumUserByInternalId,
} from "./services/linked-user";

export { forumBridge } from "./services/forum-bridge";
export { transformBBCode } from "~/lib/thinkpages-forum/import/bbcode";
export { cacheKey, cacheInvalidate, invalidateThread, cachedFetch } from "./lib/cache";
