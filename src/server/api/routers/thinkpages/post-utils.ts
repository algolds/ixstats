/**
 * Shared helpers for ThinkPages post reads.
 */

/** Visibilities that anyone holding the post id may read (the feed itself lists only "public"). */
const LINK_READABLE_VISIBILITIES = new Set(["public", "unlisted"]);

/**
 * Whether a viewer may read a post by id. Private and draft posts are readable only by the
 * account owner (matched on Clerk user id); public and unlisted posts are readable by anyone.
 */
export function canViewPost(
  post: { visibility?: string | null; account?: { clerkUserId?: string | null } | null },
  viewerClerkUserId?: string | null
): boolean {
  if (LINK_READABLE_VISIBILITIES.has(post.visibility ?? "public")) return true;
  return !!viewerClerkUserId && post.account?.clerkUserId === viewerClerkUserId;
}

/**
 * Reaction tally for a post.
 *
 * `reactionCounts` (JSON) is the authoritative denormalised tally: the add/remove reaction
 * mutations keep it in step with the `PostReaction` rows, and the Discord sync and auto-post
 * writers overwrite it with the full count. Adding the row tally on top double-counted every
 * native reaction, so rows are only used as a fallback when the JSON is missing or empty.
 */
export function resolveReactionCounts(
  stored: unknown,
  reactions?: Array<{ reactionType: string }> | null
): Record<string, number> {
  let counts: Record<string, number> = {};
  try {
    if (stored) {
      const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
      if (parsed && typeof parsed === "object") counts = { ...(parsed as Record<string, number>) };
    }
  } catch {
    // ignore malformed JSON
  }
  if (Object.keys(counts).length > 0) return counts;
  return (reactions ?? []).reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.reactionType] = (acc[reaction.reactionType] || 0) + 1;
    return acc;
  }, {});
}

/** A persona's name as shown in notification titles: display name, else `@username`. */
export function personaDisplayName(account: {
  displayName?: string | null;
  username?: string | null;
}): string | undefined {
  return account.displayName?.trim() || (account.username ? `@${account.username}` : undefined);
}
