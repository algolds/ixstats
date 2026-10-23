/**
 * The reversible claimed-revision backfill (design decision 6): every APPROVED name claim puts its account on the name's
 * past revisions that have no author yet (`authorId = null`), each tag logged in `wiki_revision_claim_tags`. Run it after
 * the conversion; it is reversible with --undo, which takes back every live tag and never a native WikiOS edit or a
 * system save. Each claim runs in its own transaction under its name's lock (41103, taken alone). It runs no claim hooks.
 *   bun scripts/identity/tag-claimed-revisions.ts           # dry run: prints each claim's count, writes nothing
 *   bun scripts/identity/tag-claimed-revisions.ts --apply   # tags; a second --apply tags 0
 *   bun scripts/identity/tag-claimed-revisions.ts --undo    # takes back every live tag
 */
import { PrismaClient } from "@prisma/client";
import {
  lockWikiNameTx,
  tagClaimRevisionsTx,
  TAG_TX_OPTIONS,
  untagClaimRevisionsTx,
} from "~/lib/identity/claim-tags";
import { claimSpellings, IXWIKI } from "~/lib/identity/wiki-names";

export type TagMode = "dry-run" | "apply" | "undo";

export interface TagPlanRow {
  claimId: string;
  name: string;
  userId: string;
  untagged: number;
}

export function parseTagArgs(argv: string[]): { mode: TagMode } {
  const apply = argv.includes("--apply");
  const undo = argv.includes("--undo");
  if (apply && undo) throw new Error("Pass --apply or --undo, not both");
  return { mode: apply ? "apply" : undo ? "undo" : "dry-run" };
}

function approvedClaims(db: PrismaClient) {
  return db.wikiNameClaim.findMany({
    where: { source: IXWIKI, status: "APPROVED" },
    select: { id: true, userId: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Every approved claim and how many unauthored revisions its spellings would tag now. */
export async function planTagRun(db: PrismaClient): Promise<TagPlanRow[]> {
  const rows: TagPlanRow[] = [];
  for (const c of await approvedClaims(db)) {
    const untagged = await db.wikiRevision.count({
      where: { source: IXWIKI, author: { in: claimSpellings(c.name) }, authorId: null },
    });
    rows.push({ claimId: c.id, name: c.name, userId: c.userId, untagged });
  }
  return rows;
}

/** Tags each approved claim's revisions; the claim is re-read under its lock, so one revoked since the list tags 0. */
export async function applyTags(db: PrismaClient): Promise<number> {
  let tagged = 0;
  for (const c of await approvedClaims(db)) {
    tagged += await db.$transaction(async (tx) => {
      await lockWikiNameTx(tx, IXWIKI, c.name);
      const live = await tx.wikiNameClaim.findFirst({
        where: { id: c.id, status: "APPROVED" },
        select: { userId: true },
      });
      return live ? tagClaimRevisionsTx(tx, { ...c, userId: live.userId, source: IXWIKI }) : 0;
    }, TAG_TX_OPTIONS);
  }
  return tagged;
}

/** Takes back every live tag, claim by claim under each name's lock; returns how many revisions lost their author. */
export async function undoTags(db: PrismaClient): Promise<number> {
  const claims = await db.wikiNameClaim.findMany({
    where: { source: IXWIKI, tags: { some: { undoneAt: null } } },
    select: { id: true, userId: true, name: true },
    orderBy: { name: "asc" },
  });
  const now = new Date();
  let untagged = 0;
  for (const c of claims) {
    untagged += await db.$transaction(async (tx) => {
      await lockWikiNameTx(tx, IXWIKI, c.name);
      return untagClaimRevisionsTx(tx, c, now);
    }, TAG_TX_OPTIONS);
  }
  return untagged;
}

async function run(db: PrismaClient, mode: TagMode): Promise<void> {
  if (mode === "undo") {
    console.log(`[tag-claimed-revisions] untagged ${await undoTags(db)} revisions`);
    return;
  }
  const rows = await planTagRun(db);
  for (const r of rows) console.log(`${r.untagged}\t${r.name}\t${r.userId}\t${r.claimId}`);
  const total = rows.reduce((sum, r) => sum + r.untagged, 0);
  console.log(`[tag-claimed-revisions] ${rows.length} approved claims, ${total} revisions to tag`);
  if (mode === "dry-run") {
    console.log("[tag-claimed-revisions] dry run: nothing written (pass --apply to tag)");
    return;
  }
  console.log(`[tag-claimed-revisions] tagged ${await applyTags(db)} revisions`);
}

async function main(): Promise<void> {
  const { mode } = parseTagArgs(process.argv.slice(2));
  const db = new PrismaClient();
  try {
    await run(db, mode);
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error(`[tag-claimed-revisions] failed: ${error.message}`);
    process.exitCode = 1;
  });
}
