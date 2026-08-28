/**
 * Forum Module — XenForo integration, BBCode rendering, and caching.
 *
 * Server-side only. Pure client formatting utilities (rarity colors, formatValue, etc.)
 * live in ~/shared/forum-utils so client components don't pull in this module.
 */

// ─── Services ────────────────────────────────────────────────────────────────
export {
  getForumActivity,
  getForumTrendingThreads,
  searchForumThreads,
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
  type XFNodeForum,
  type XFPaginatedResponse,
  type XFForumsResponse,
  type XFThreadsResponse,
  type XFThreadResponse,
  type XFPostsResponse,
  type XFForum,
} from "./services/xenforo-service";

export {
  setupForumCustomFields,
  lookupForumUser,
  syncUserToForum,
  linkForumAccount,
} from "./services/xenforo-user-sync";

export {
  requireForumUser,
  getForumUserByClerkId,
  getForumUserByInternalId,
} from "./services/linked-user";

export { forumBridge } from "./services/forum-bridge";
export type { BridgeAdapter, BridgeSyncResult } from "~/server/shared/bridge-types";

// ─── Lib / Utilities ─────────────────────────────────────────────────────────
export { transformBBCode, transformPosts, type TransformedPost } from "./lib/bbcode-transformer";
export {
  cacheKey,
  cacheGet,
  cacheSet,
  cacheInvalidate,
  invalidateThread,
  cacheClear,
  cachedFetch,
  FORUM_CACHE_TTL,
} from "./lib/cache";
