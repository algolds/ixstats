/** The conversations a person muted and archived, as the server keeps them. */
export interface ConversationPreferences {
  muted: string[];
  archived: string[];
}

export type PreferenceField = keyof ConversationPreferences;

export const NO_PREFERENCES: ConversationPreferences = { muted: [], archived: [] };

/** The preferences with one conversation switched on or off for one field; the lists never hold an id twice. */
export function withPreference(
  prefs: ConversationPreferences,
  field: PreferenceField,
  conversationId: string,
  on: boolean
): ConversationPreferences {
  const rest = prefs[field].filter((id) => id !== conversationId);
  return { ...prefs, [field]: on ? [...rest, conversationId] : rest };
}
