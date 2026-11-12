/**
 * Message reactions, stored in `ThinkshareMessage.reactions` as a JSON map of emoji to the Clerk ids that used
 * it: `{ "👍": ["user_a", "user_b"] }`. A user holds an emoji at most once per message.
 */

/** Longest emoji string accepted (a ZWJ sequence runs to a dozen or so UTF-16 units). */
export const MAX_REACTION_LENGTH = 32;
/** Most different emojis one message may carry. */
export const MAX_REACTION_KINDS = 20;

export type ReactionMap = Record<string, string[]>;

/** The map held in a stored `reactions` string; anything that is not a map of string lists reads as empty. */
export function parseReactions(raw: string | null | undefined): ReactionMap {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const map: ReactionMap = {};
  for (const [emoji, users] of Object.entries(parsed)) {
    if (!Array.isArray(users)) continue;
    const ids = users.filter((u): u is string => typeof u === "string");
    if (ids.length > 0) map[emoji] = [...new Set(ids)];
  }
  return map;
}

/** The string to store for a map, or null when no one has reacted. */
export function serializeReactions(map: ReactionMap): string | null {
  return Object.keys(map).length === 0 ? null : JSON.stringify(map);
}

/** The map with `userId` holding `emoji`; the same map when they already did. */
export function withReaction(map: ReactionMap, userId: string, emoji: string): ReactionMap {
  const users = map[emoji] ?? [];
  if (users.includes(userId)) return map;
  return { ...map, [emoji]: [...users, userId] };
}

/** The map with `userId` no longer holding `emoji`; the same map when they did not. */
export function withoutReaction(map: ReactionMap, userId: string, emoji: string): ReactionMap {
  const users = map[emoji];
  if (!users?.includes(userId)) return map;
  const rest = users.filter((u) => u !== userId);
  const { [emoji]: _removed, ...others } = map;
  return rest.length === 0 ? others : { ...others, [emoji]: rest };
}

/** What a client renders: a count per emoji, and which of those the viewer reacted with. */
export function reactionsForViewer(
  raw: string | null | undefined,
  viewerId: string
): { reactions: Record<string, number>; myReactions: string[] } {
  const map = parseReactions(raw);
  const reactions: Record<string, number> = {};
  const myReactions: string[] = [];
  for (const [emoji, users] of Object.entries(map)) {
    reactions[emoji] = users.length;
    if (users.includes(viewerId)) myReactions.push(emoji);
  }
  return { reactions, myReactions };
}
