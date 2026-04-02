/**
 * Forum Module — XenForo integration, BBCode rendering, and caching.
 *
 * This module encapsulates all forum-related services, utilities, and types.
 * Non-forum code should import from this barrel export rather than reaching
 * into the module's internal directories.
 */

// ─── Services ────────────────────────────────────────────────────────────────
export {
  getForumActivity,
  getForumTrendingThreads,
  searchForumThreads,
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
} from "./services/xenforo-service";

export {
  setupForumCustomFields,
  lookupForumUser,
  syncUserToForum,
  linkForumAccount,
} from "./services/xenforo-user-sync";

export { forumBridge } from "./services/forum-bridge";
export type { BridgeAdapter, BridgeSyncResult } from "./services/bridge-types";

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
export {
  RARITY_INLINE_COLORS,
  rarityRank,
  getRarityColors,
  formatValue,
  resolveArtworkUrl,
  computeRarityCounts,
} from "./lib/forum-widget-utils";
