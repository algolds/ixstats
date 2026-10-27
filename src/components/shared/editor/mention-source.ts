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
  /** The menu's first line when it is not `name` (a persona's display name). */
  title?: string;
  /** Set for a source's rows: the menu shows this avatar, with its initial as the fallback, and no icon. */
  avatar?: { url: string | null };
  raw: MentionSuggestion | OwnMentionAccount;
}

/** A source row's two lines: a persona leads with its display name over its `@username`; a user with nothing to add shows the name alone. */
function suggestionLines(
  suggestion: MentionSuggestion
): Pick<MentionResultItem, "title" | "description"> {
  const handle = `@${suggestion.name}`;
  if (suggestion.kind === "persona") {
    return suggestion.label === suggestion.name
      ? { description: "" }
      : { title: suggestion.label, description: handle };
  }
  return { description: suggestion.label === suggestion.name ? "" : suggestion.label };
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
      ...suggestionLines(suggestion),
      icon: "",
      avatar: { url: suggestion.avatarUrl },
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
