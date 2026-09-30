import type { PassportTabType } from "./types";

export const DEFAULT_PASSPORT_TAB: PassportTabType = "overview";

/** `?tab=` values, including the pre-plan-188 names (`lore`, `wiki`) and the plan's `passport`. */
const TAB_ALIASES = new Map<string, PassportTabType>([
  ["overview", "overview"],
  ["passport", "overview"],
  ["realms", "realms"],
  ["work", "work"],
  ["lore", "work"],
  ["wiki", "work"],
  ["vault", "vault"],
  ["history", "history"],
]);

/** Map a `?tab=` query value to a passport tab; null when absent or unknown. */
export function parsePassportTab(param: string | null | undefined): PassportTabType | null {
  return param ? (TAB_ALIASES.get(param.toLowerCase()) ?? null) : null;
}
