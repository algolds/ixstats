/**
 * P0 of the IxnayID identity work (design 2026-10-23: order, step 1): the legacy IxWiki identity counts the owner reads
 * before anything is built, and again after the deploy. Prints JSON `{ counts, extra }`.
 * Reads only; safe on production.
 *   bun scripts/identity/count-legacy-identity.ts
 */
import { PrismaClient } from "@prisma/client";
import { countLegacyIdentity, heldLegacyNames } from "~/lib/identity/legacy-identity";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { loadLegacySnapshot } from "./legacy-snapshot";

/** Distinct normalised Lorewards winner and runner-up names. */
async function loadLorewardNames(db: PrismaClient): Promise<Set<string>> {
  const entries = await db.lorewardEntry.findMany({
    where: { OR: [{ winnerUser: { not: null } }, { runnerUpUser: { not: null } }] },
    select: { winnerUser: true, runnerUpUser: true },
  });
  const raw = entries.flatMap((e) => [e.winnerUser, e.runnerUpUser]);
  return new Set(raw.flatMap((name) => (name?.trim() ? [normalizeWikiUsername(name)] : [])));
}

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const snapshot = await loadLegacySnapshot(db);
    const held = heldLegacyNames(snapshot);
    const [
      sisterLinks,
      groupsByName,
      blocksByName,
      revisions,
      revisionsWithAuthorId,
      lorewardNames,
    ] = await Promise.all([
      db.wikiAccountLink.groupBy({
        by: ["source"],
        where: { source: { not: "ixwiki" } },
        _count: true,
      }),
      db.wikiUserGroup.count({ where: { wikiUsername: { not: null } } }),
      db.wikiBlock.count({ where: { wikiUsername: { not: null } } }),
      db.wikiRevision.count(),
      db.wikiRevision.count({ where: { authorId: { not: null } } }),
      loadLorewardNames(db),
    ]);
    const extra = {
      sisterLinks: sisterLinks.map((row) => ({ source: row.source, links: row._count })),
      groupsByName,
      blocksByName,
      revisions,
      revisionsWithAuthorId,
      lorewardNames: lorewardNames.size,
      lorewardNamesHeldByLegacy: [...lorewardNames].filter((name) => held.has(name)).length,
    };
    console.log(JSON.stringify({ counts: countLegacyIdentity(snapshot), extra }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error(`[count-legacy-identity] failed: ${error.message}`);
    process.exitCode = 1;
  });
}
