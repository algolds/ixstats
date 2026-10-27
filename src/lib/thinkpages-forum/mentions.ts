/**
 * @mentions (spec section 5), pure. `@name` where name is 3 to 24 letters, digits or underscores, case-insensitive,
 * not glued to a word or another `@` (so an email address is no mention). The server finds them in a post's HTML text
 * (mention-html.ts), resolves them to a Passport handle or a persona (mention-links.ts) and links them.
 */
export const MENTION_CLASS = "forum-mention";
/** At most this many distinct names of a post are linked and notified; the rest stay plain text. */
export const MENTION_MAX_PER_POST = 50;
export const MENTION_NAME_MAX = 24;
export const MENTION_SUGGEST_MIN = 2;
/** The editor menu's item cap; the suggestions procedure returns at most this many. */
export const MENTION_SUGGEST_MAX = 6;

export const MENTION_PATTERN = /(?<![A-Za-z0-9_@])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])/g;

/** The names `text` mentions, lower-cased, each once, in order of first appearance. */
export function mentionNamesIn(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) names.add((match[1] ?? "").toLowerCase());
  return [...names];
}
