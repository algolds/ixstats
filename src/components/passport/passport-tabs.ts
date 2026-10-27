import type { PassportPayload, PassportTabType } from "./types";

export const DEFAULT_PASSPORT_TAB: PassportTabType = "realms";

/** `?tab=` values, including removed and older names (`overview`, `passport`, `vault`, `lore`, `wiki`). */
const TAB_ALIASES = new Map<string, PassportTabType>([
  ["realms", "realms"],
  ["overview", "realms"],
  ["passport", "realms"],
  ["work", "work"],
  ["lore", "work"],
  ["wiki", "work"],
  ["collection", "collection"],
  ["vault", "collection"],
  ["history", "history"],
]);

/** Map a `?tab=` query value to a passport tab; null when absent or unknown. */
export function parsePassportTab(param: string | null | undefined): PassportTabType | null {
  return param ? (TAB_ALIASES.get(param.toLowerCase()) ?? null) : null;
}

/**
 * Ribbon badge counts known without loading a tab. Realms has none: the front face already states
 * realms and nations, and a bare number beside "Realms" would read as a realm count while the tab
 * lists nations.
 */
export function passportRibbonCounts(data: {
  vault: Pick<NonNullable<PassportPayload["vault"]>, "totalCards"> | null;
}): Partial<Record<PassportTabType, number>> {
  return data.vault ? { collection: data.vault.totalCards } : {};
}
