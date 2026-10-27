/**
 * The `?tab=` ids the settings page renders. Labels, icons and grouping live in the Settings app
 * of `src/lib/navigation/app-sections.ts`, which is the sidebar's navigation; a test keeps the two
 * in step.
 */
export const SETTINGS_TAB_IDS = [
  "account",
  "country",
  "appearance",
  "wikios",
  "notifications",
  "social",
  "privacy",
  "vault",
  "cosmetics",
  "cards",
] as const;

export type SettingSectionId = (typeof SETTINGS_TAB_IDS)[number];
