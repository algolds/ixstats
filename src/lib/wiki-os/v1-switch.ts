/**
 * The WikiOS v1 switch (`WIKIOS_V1_ENABLED`): whether WikiOS is the wiki of record.
 *
 * Off (the default: unset, empty, or anything but `1`, `true`, `on`, `yes`), classic MediaWiki is still the
 * wiki everyone edits, as before WikiOS v1 was merged, and an ordinary IxStates deploy needs none of the
 * cutover's operator steps (the manual SQL, the mirror account, the render engine, nginx). WikiOS writes (page
 * edits, reverts, moves, deletions, protections, blocks, rights changes, uploads, XML imports, bot passwords,
 * `/w/api.php`) and the outbound mirror (`wiki-mirror`) then follow the admin editing switch (editing-switch.ts):
 * refused with MediaWiki's `readonly` error and idle (after draining its queue) while that is off. The rest:
 *   - the background renders (`wiki-render-stale`) do nothing;
 *   - the lore-card generator reads IxWiki pages from MediaWiki, not from the tables renders fill.
 * On, WikiOS v1 runs as built: step 6b of docs/operations/wikios-v1-cutover.md turns it on.
 *
 * The inbound sync does not depend on it: a MediaWiki edit that collides with a WikiOS edit goes through the same
 * conflict rule (services/conflict-rule.ts) in every mode, so a WikiOS edit is never silently overwritten.
 *
 * Read at call time, server-side only.
 */

const ON = /^(?:1|true|on|yes)$/i;

export function isWikiosV1Enabled(): boolean {
  return ON.test(process.env.WIKIOS_V1_ENABLED?.trim() ?? "");
}

/** Why a WikiOS write is refused whenever editing is off (MediaWiki's `readonly` error carries it). */
export const WIKIOS_READONLY_REASON =
  "WikiOS editing is turned off. Classic MediaWiki is still the wiki you edit.";

/**
 * The SystemConfig row the rights import (scripts/wikios-import-rights.ts) writes once the protections exist in WikiOS:
 * step 1's default-protections backfill checked, then step 1b's import applied. Value: JSON `{ at, restrictions }`.
 * Until it exists WikiOS takes no write in either mode (editing-switch.ts).
 */
export const WIKIOS_PROTECTIONS_MARKER_KEY = "wikios_protections_imported_at";

/** Why a WikiOS write is refused when editing is on but the protections import has not run. */
export const WIKIOS_PROTECTIONS_REASON =
  "WikiOS editing waits for the protections import (runbook steps 1 and 1b).";
