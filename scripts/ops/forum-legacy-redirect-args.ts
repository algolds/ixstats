/**
 * Arguments of the legacy forum switch (scripts/ops/forum-legacy-redirect.ts). Pure.
 *   on|off|status [--production], the flag before or after the verb.
 */
export const LEGACY_REDIRECT_COMMANDS = ["on", "off", "status"] as const;
export type LegacyRedirectCommand = (typeof LEGACY_REDIRECT_COMMANDS)[number];

export const LEGACY_REDIRECT_USAGE =
  "Usage: bun run forum:legacy-redirect -- [--production] on|off|status";

/** The verb and the production flag, or the usage line when the arguments are anything else. */
export function parseLegacyRedirectArgs(
  argv: readonly string[]
): { command: LegacyRedirectCommand; production: boolean } | { error: string } {
  const args = argv.filter((arg) => arg !== "--");
  const words = args.filter((arg) => !arg.startsWith("--"));
  const flags = args.filter((arg) => arg.startsWith("--"));
  const command = LEGACY_REDIRECT_COMMANDS.find((name) => name === words[0]);
  if (words.length !== 1 || !command || flags.some((flag) => flag !== "--production")) {
    return { error: LEGACY_REDIRECT_USAGE };
  }
  return { command, production: flags.includes("--production") };
}
