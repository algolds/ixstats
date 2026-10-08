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
 *   - the inbound sync never parks a MediaWiki edit: MediaWiki's revision becomes WikiOS's head (the rule
 *     before v1), and no WikiOS text is ever pushed back to MediaWiki;
 *   - the lore-card generator reads IxWiki pages from MediaWiki, not from the tables renders fill.
 * On, WikiOS v1 runs as built: step 7a of docs/operations/wikios-v1-cutover.md turns it on.
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
