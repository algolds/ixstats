/**
 * src/lib/wiki-os/services/inbound-quarantined-parents.ts — a revision built on a quarantined one (A5)
 *
 * When the sync quarantines classic revision R1 and moves past it, R2 (whose parent is R1) runs against WikiOS's head
 * R0. By ids alone that is a collision, and the conflict rule would record that R2 overwrote R0 and tell R0's author:
 * false, since classic simply went R0, R1, R2. So a collision whose parent is a quarantined revision follows the
 * parents back through quarantined revisions: when the chain reaches WikiOS's head, the revision is a fast-forward.
 * R1 itself, retried later, is older than the head and filed as history. A dismissed R1 counts too: R2 holds its text.
 */

import { db } from "~/server/db";
import type { InboundHead } from "./inbound-decision";
import { fetchRevisionHash, type RevisionHash } from "./inbound-mediawiki";

/** How many quarantined revisions in a row are followed back. */
const MAX_HOPS = 10;

/** Whether the sync quarantined classic revision `revid` (still open, or resolved since). */
async function quarantinedRevision(revid: number): Promise<boolean> {
  const row = await db.wikiSyncDeadLetter.findFirst({
    where: { stepKey: `rc:${revid}`, quarantinedAt: { not: null } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Whether a revision whose parent is `parentid` (read as `parent`) builds on WikiOS's head through quarantined
 * revisions only: every revision between the head and it was quarantined.
 */
export async function buildsOnHeadPastQuarantine(
  parentid: number,
  parent: RevisionHash,
  head: InboundHead | null
): Promise<boolean> {
  const target = head?.mwRevId ?? null;
  if (target === null) return false;
  let revid = parentid;
  let grandparent = parent.parentid;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (grandparent === null || !(await quarantinedRevision(revid))) return false;
    if (grandparent === target) return true;
    if (grandparent <= 0) return false;
    revid = grandparent;
    grandparent = (await fetchRevisionHash(revid)).parentid;
  }
  return false;
}
