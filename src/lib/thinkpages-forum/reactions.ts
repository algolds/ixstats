/**
 * Forum reactions (docs/superpowers/specs/2026-10-10-thinkpages-forum-reactions-design.md): which reaction types
 * exist, the stored `{type: count}` map, and the count arithmetic the browser's optimistic update shares with the
 * server's recount. Pure, so the server, the board wire and the browser read one definition.
 *
 * A type is one of the Dashboard's six built-in reactions (`sad` has no icon and is not offered), or a Discord emoji:
 * `discord:<name>` or `discord:<name>:<id>`.
 */

export const BUILTIN_REACTIONS = [
  "like",
  "laugh",
  "angry",
  "fire",
  "thumbsup",
  "thumbsdown",
] as const;
export type BuiltinReaction = (typeof BUILTIN_REACTIONS)[number];

/** What the React button adds. */
export const DEFAULT_REACTION: BuiltinReaction = "like";

/** `discord:` (8) + a 32-character name + `:` + a 25-digit id is the longest valid type (66). */
export const REACTION_TYPE_MAX = 70;
/** The reactors dialog shows this many people per reaction type. */
export const REACTORS_PER_TYPE = 50;
/** The reactors list covers this many types, most reacted first. */
export const REACTOR_TYPES_MAX = 12;

const BUILTIN: ReadonlySet<string> = new Set(BUILTIN_REACTIONS);
const DISCORD_TYPE = /^discord:([A-Za-z0-9_]{2,32})(?::([0-9]{1,25}))?$/;

export function isReactionType(value: string): boolean {
  return value.length <= REACTION_TYPE_MAX && (BUILTIN.has(value) || DISCORD_TYPE.test(value));
}

/** The name and optional id of a Discord reaction type; null for anything else. */
export function discordReaction(type: string): { name: string; id: string | null } | null {
  const match = DISCORD_TYPE.exec(type);
  const name = match?.[1];
  return match && name ? { name, id: match[2] ?? null } : null;
}

/** A short name for a type: `:name:` for a Discord emoji, the type itself for a built-in. */
export function reactionLabel(type: string): string {
  const discord = discordReaction(type);
  return discord ? `:${discord.name}:` : type;
}

export type ReactionCounts = Record<string, number>;

/** What a stored counts column can be: a Prisma `Json` value, or its JSON text. */
export type CountsInput =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly CountsInput[]
  | { readonly [key: string]: CountsInput };

const isObject = (value: CountsInput): value is { readonly [key: string]: CountsInput } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (count: CountsInput): count is number =>
  typeof count === "number" && Number.isSafeInteger(count) && count > 0;

/**
 * The stored counts as a clean map: only valid types with positive whole counts survive, so a corrupt column reads
 * as no reactions (or its valid part) and a prototype key never becomes a property.
 */
export function readReactionCounts(raw: CountsInput): ReactionCounts {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as CountsInput;
    } catch {
      return {};
    }
  }
  const counts: ReactionCounts = {};
  if (!isObject(value)) return counts;
  for (const [type, count] of Object.entries(value)) {
    if (isReactionType(type) && isCount(count)) counts[type] = count;
  }
  return counts;
}

/** The map for rows grouped by type, as the server recounts a post. */
export function countsFromGroups(
  groups: ReadonlyArray<{ type: string; count: number }>
): ReactionCounts {
  const counts: ReactionCounts = {};
  for (const { type, count } of groups) {
    if (isReactionType(type) && isCount(count)) counts[type] = count;
  }
  return counts;
}

const countOf = (counts: ReactionCounts, type: string): number =>
  Object.hasOwn(counts, type) ? (counts[type] ?? 0) : 0;

/**
 * The counts after one member's reaction goes from `from` to `to` (null: none). A type that reaches zero is removed;
 * the same type, or nothing to remove, changes nothing. Returns a new object.
 */
export function applyReactionChange(
  counts: ReactionCounts,
  from: string | null,
  to: string | null
): ReactionCounts {
  const next: ReactionCounts = { ...counts };
  const before = isReactionType(from ?? "") ? from : null;
  const after = isReactionType(to ?? "") ? to : null;
  if (before === after) return next;
  if (before !== null) {
    const left = countOf(next, before) - 1;
    if (left > 0) next[before] = left;
    else delete next[before];
  }
  if (after !== null) next[after] = countOf(next, after) + 1;
  return next;
}

/** The types that have reactions, most reacted first, then by type. */
export function sortedReactionTypes(counts: ReactionCounts): string[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([typeA, a], [typeB, b]) => b - a || (typeA < typeB ? -1 : typeA > typeB ? 1 : 0))
    .map(([type]) => type);
}

export function reactionTotal(counts: ReactionCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}
