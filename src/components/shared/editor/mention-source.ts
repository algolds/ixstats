/**
 * Where an editor's @ menu gets its names. A source is data and a callback rather than a hook, so the editor stays
 * hook-safe and a caller that passes none keeps the member's own personas (the editor's behaviour before this).
 */
export interface MentionSuggestion {
  kind: "user" | "persona";
  /** What follows the `@` once picked. */
  name: string;
  /** What the menu shows beside it. */
  label: string;
  avatarUrl: string | null;
}

export interface MentionSource {
  items: readonly MentionSuggestion[];
  isLoading: boolean;
  /** The text typed after the `@` as it changes; an empty string when the menu closes. */
  onQueryChange: (query: string) => void;
}

export const USER_MENTION_ICON = "👤";

export interface OwnMentionAccount {
  id: string;
  username: string;
  displayName?: string | null;
}

export interface MentionResultItem {
  type: "user";
  id: string;
  name: string;
  description: string;
  icon: string;
  raw: MentionSuggestion | OwnMentionAccount;
}

/** The people in the @ menu: the source's suggestions, else the member's own personas that match the query. */
export function userMentionItems(
  source: MentionSource | undefined,
  own: readonly OwnMentionAccount[] | undefined,
  query: string
): MentionResultItem[] {
  if (source) {
    return source.items.map((suggestion) => ({
      type: "user",
      id: `${suggestion.kind}:${suggestion.name}`,
      name: `@${suggestion.name}`,
      description:
        suggestion.kind === "persona" ? `${suggestion.label} (persona)` : suggestion.label,
      icon: USER_MENTION_ICON,
      raw: suggestion,
    }));
  }
  const needle = query.toLowerCase().trim();
  return (own ?? [])
    .filter(
      (account) =>
        !needle ||
        account.username.toLowerCase().includes(needle) ||
        account.displayName?.toLowerCase().includes(needle)
    )
    .map((account) => ({
      type: "user",
      id: account.id,
      name: `@${account.username}`,
      description: account.displayName || account.username,
      icon: USER_MENTION_ICON,
      raw: account,
    }));
}
