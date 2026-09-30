/**
 * Gameplay feature flags.
 *
 * Default posture is "narrative mode": the browser-game-style loops are OFF.
 * Issues are optional prompts (surfaced by community DMs via plan 034), not an
 * auto-spawning chore queue with deadlines and reward farming. An operator can
 * opt back into the classic NationStates-style loop by setting the env vars.
 *
 * ponytail: global flags read from env at module load — simplest reversible
 * switch, no DB migration. Upgrade path: if per-world or per-country control is
 * ever needed, replace these reads with a settings lookup keyed by world/country.
 */
function envBool(name: string, dflt: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return dflt;
  return v === "1" || v.toLowerCase() === "true";
}

export function getGameplayFlags() {
  return {
    /**
     * Auto-generate national issues from country state (on inbox open + via the
     * background generation cron). Default ON — issues are the core Executive loop.
     * Set ISSUES_AUTO_GENERATE=0 to return to pure narrative mode.
     */
    issuesAutoGenerate: envBool("ISSUES_AUTO_GENERATE", true),
    /** Enforce issue deadlines: block dismiss of deadline issues + auto-resolve on expiry. */
    issuesEnforceDeadlines: envBool("ISSUES_ENFORCE_DEADLINES", false),
    /** Award IxCredits for resolving issues (engagement reward). */
    issuesAwardCredits: envBool("ISSUES_AWARD_CREDITS", false),
    /**
     * Statecraft spine: the Meeting/recon → Capacity loop on issues (Stage 1 of
     * plans/statecraft-stage1.md). Default OFF — ships dark until the loop is complete.
     * Set STATECRAFT_SPINE=1 to enable recon Meetings + Capacity spend.
     */
    statecraftSpine: envBool("STATECRAFT_SPINE", false),
  };
}

export const GAMEPLAY_FLAGS = getGameplayFlags();
