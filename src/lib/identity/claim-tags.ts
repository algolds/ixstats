/**
 * Reversible revision tags (IxnayID design decisions 6 and 7). An approved claim puts its account on the name's
 * revisions that have no author yet (`authorId = null`), and logs each one in `wiki_revision_claim_tags`, so a revoke
 * takes back exactly those and never a native WikiOS edit or a system save. Every tag or untag of a name runs under that
 * name's advisory lock (41103), taken alone: no card or vault lock is ever taken with it.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { checkClaimName, claimName, claimSpellings, type WikiNameSource } from "./wiki-names";

export const WIKI_NAME_LOCK_NAMESPACE = 41103;
export const TAG_BATCH = 1000;
export const TAG_TX_OPTIONS = { timeout: 120_000 } as const;

export interface TaggableClaim {
  id: string;
  userId: string;
  source: WikiNameSource;
  name: string;
}

type TagTx = Pick<Prisma.TransactionClient, "wikiRevision" | "wikiRevisionClaimTag">;

/** Holds the name's lock to the end of the caller's transaction (both spellings of a name share one key). */
export async function lockWikiNameTx(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  source: WikiNameSource,
  name: string
): Promise<void> {
  // $executeRaw, not $queryRaw: Prisma cannot deserialize the void pg_advisory_xact_lock returns
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${WIKI_NAME_LOCK_NAMESPACE}::int, hashtext(${`${source}:${claimName(name)}`}))`;
}

/** Puts the claim's account on the name's unauthored revisions, in batches; returns how many it set. */
export async function tagClaimRevisionsTx(tx: TagTx, claim: TaggableClaim): Promise<number> {
  const author = { in: claimSpellings(claim.name) };
  let tagged = 0;
  for (;;) {
    const batch = await tx.wikiRevision.findMany({
      where: { source: claim.source, author, authorId: null },
      select: { id: true },
      take: TAG_BATCH,
    });
    if (batch.length === 0) return tagged;
    const ids = batch.map((r) => r.id);
    await tx.wikiRevisionClaimTag.createMany({
      data: ids.map((revisionId) => ({ claimId: claim.id, revisionId })),
    });
    const { count } = await tx.wikiRevision.updateMany({
      where: { id: { in: ids }, authorId: null },
      data: { authorId: claim.userId },
    });
    tagged += count;
  }
}

/** Takes back every tag the claim still holds: only revisions still carrying its account lose their author. */
export async function untagClaimRevisionsTx(
  tx: TagTx,
  claim: Pick<TaggableClaim, "id" | "userId">,
  now: Date
): Promise<number> {
  let untagged = 0;
  for (;;) {
    const tags = await tx.wikiRevisionClaimTag.findMany({
      where: { claimId: claim.id, undoneAt: null },
      select: { id: true, revisionId: true },
      take: TAG_BATCH,
    });
    if (tags.length === 0) return untagged;
    const { count } = await tx.wikiRevision.updateMany({
      where: { id: { in: tags.map((t) => t.revisionId) }, authorId: claim.userId },
      data: { authorId: null },
    });
    await tx.wikiRevisionClaimTag.updateMany({
      where: { id: { in: tags.map((t) => t.id) } },
      data: { undoneAt: now },
    });
    untagged += count;
  }
}

/**
 * For inbound writers: tags the new revisions of `author` for the account holding its approved claim (any visibility).
 * A blank, impossible or `wikios>` name, or a name nobody holds, tags nothing.
 */
export async function tagRevisionsOfName(
  db: Pick<PrismaClient, "$transaction">,
  source: WikiNameSource,
  author: string | null
): Promise<number> {
  const check = checkClaimName(author ?? "");
  if (!check.ok) return 0;
  const { name } = check;
  return db.$transaction(async (tx) => {
    await lockWikiNameTx(tx, source, name);
    const claim = await tx.wikiNameClaim.findFirst({
      where: { source, name, status: "APPROVED" },
      select: { id: true, userId: true },
    });
    return claim ? tagClaimRevisionsTx(tx, { ...claim, source, name }) : 0;
  }, TAG_TX_OPTIONS);
}
