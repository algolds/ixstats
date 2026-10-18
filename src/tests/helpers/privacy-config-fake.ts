/**
 * Stored privacy configs for specs whose code reads a privacy switch (`usersWithSwitchOff`): the `privacy_config`
 * UserConnection row Settings → Privacy & Security writes for a user, and a `userConnection` delegate over such rows.
 */
export type PrivacyConfigRow = {
  userId: string;
  targetUserId: string;
  connectionType: string;
  status: string;
};

/** The stored config row of the Clerk user `clerkUserId`. */
export function privacyConfigRow(
  clerkUserId: string,
  config: Record<string, boolean | string>
): PrivacyConfigRow {
  return {
    userId: clerkUserId,
    targetUserId: "global_privacy",
    connectionType: "privacy_config",
    status: JSON.stringify(config),
  };
}

/** Rows turning wiki attribution (`showWikiAttribution`) off for each of `clerkUserIds`. */
export const wikiAttributionOff = (...clerkUserIds: string[]): PrivacyConfigRow[] =>
  clerkUserIds.map((id) => privacyConfigRow(id, { showWikiAttribution: false }));

/** A `userConnection` delegate holding `rows` (none: every switch keeps its default, on). */
export function privacyConnections(rows: PrivacyConfigRow[] = []) {
  return { findMany: jest.fn(async (_args?: object): Promise<PrivacyConfigRow[]> => rows) };
}
