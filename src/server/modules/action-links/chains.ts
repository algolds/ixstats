/**
 * Story chains: a country's `Storyline` of kind "chain" whose entries are action-linked posts. open → submitted
 * (owner, after the wiki edit check) → approved / back to open (a site admin or a realm officer with the board power,
 * never one of the chain's own country). Approval queues an achievement check and the wiki append; a failed wiki
 * write leaves the approval standing (the story-chain-wiki-sync cron retries it).
 */
import type { PrismaClient } from "@prisma/client";
import type { PostSource } from "~/lib/action-links";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { assertCanEditArticle } from "~/lib/wiki-os/services/edit-service";
import { hasRealmPower, isSiteAdmin, type RealmActor } from "~/server/modules/realms";
import { ActionLinkError } from "./errors";

export type ChainsDb = Pick<PrismaClient, "storyline" | "postActionLink" | "user">;

export interface ChainActor extends RealmActor {
  countryId: string | null;
}

interface PostInChain {
  countryId: string;
  storylineId: string;
  postSource: PostSource;
  postRef: string;
}

const CHAIN = { kind: "chain" as const };

async function requireOpenChain(db: ChainsDb, countryId: string, storylineId: string) {
  const chain = await db.storyline.findFirst({ where: { id: storylineId, countryId, ...CHAIN } });
  if (!chain) throw new ActionLinkError("NOT_FOUND", "Story chain not found");
  if (chain.status !== "open") throw new ActionLinkError("CONFLICT", "This chain is not open for changes");
  return chain;
}

export function createChain(db: ChainsDb, countryId: string, title: string) {
  return db.storyline.create({ data: { countryId, title, ...CHAIN }, select: { id: true } });
}

export function myChains(db: ChainsDb, countryId: string) {
  return db.storyline.findMany({
    where: { countryId, ...CHAIN },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      reviewNote: true,
      wikiPageTitle: true,
      wikiSyncedAt: true,
      _count: { select: { actionLinks: true } },
    },
  });
}

export async function addPostToChain(db: ChainsDb, input: PostInChain): Promise<void> {
  const { countryId, storylineId, postSource, postRef } = input;
  await requireOpenChain(db, countryId, storylineId);
  const post = { postSource, postRef, countryId };
  // Only unchained links or this chain's own may move; a link in another chain stays put (that chain may be locked).
  const movable = { ...post, OR: [{ storylineId: null }, { storylineId }] };
  if ((await db.postActionLink.count({ where: movable })) === 0) {
    if ((await db.postActionLink.count({ where: post })) > 0) {
      throw new ActionLinkError("CONFLICT", "That post is already in another story chain");
    }
    throw new ActionLinkError("NOT_FOUND", "That post links none of your nation's actions");
  }
  const last = await db.postActionLink.aggregate({ where: { storylineId }, _max: { chainOrder: true } });
  await db.postActionLink.updateMany({
    where: movable,
    data: { storylineId, chainOrder: (last._max.chainOrder ?? 0) + 1 },
  });
}

export async function removePostFromChain(db: ChainsDb, input: PostInChain): Promise<void> {
  const { countryId, storylineId, postSource, postRef } = input;
  await requireOpenChain(db, countryId, storylineId);
  await db.postActionLink.updateMany({
    where: { postSource, postRef, countryId, storylineId },
    data: { storylineId: null, chainOrder: null },
  });
}

/** The owner names the wiki page; their edit right is checked now, so approval never writes where they couldn't. */
export async function submitChain(
  db: ChainsDb,
  ctx: WikiAuthContext,
  input: { countryId: string; storylineId: string; wikiPageTitle: string }
): Promise<void> {
  const { countryId, storylineId } = input;
  await requireOpenChain(db, countryId, storylineId);
  if ((await db.postActionLink.count({ where: { storylineId } })) === 0) {
    throw new ActionLinkError("BAD_REQUEST", "Add at least one post before submitting");
  }
  const canonical = canonicalizeTitle(input.wikiPageTitle);
  if (!canonical) throw new ActionLinkError("BAD_REQUEST", "Not a valid wiki title");
  const wikiPageTitle = canonical.title;
  await assertCanEditArticle(ctx, wikiPageTitle);
  await db.storyline.updateMany({
    where: { id: storylineId, countryId, ...CHAIN, status: "open" },
    data: { status: "submitted", wikiPageTitle },
  });
}

const REVIEW_INCLUDE = {
  country: {
    select: {
      realmId: true,
      ownerUserId: true,
      owner: { select: { clerkUserId: true } },
      realm: { select: { ownerId: true, officers: true } },
    },
  },
} as const;

interface ReviewedChain {
  countryId: string;
  country: {
    ownerUserId: string | null;
    realm: { ownerId: string; officers: { userId: string; powers: string[] }[] } | null;
  };
}

/** Never one of the chain's own country: neither its active player nor its owner (who may have another nation active). */
function canReview(actor: ChainActor, chain: ReviewedChain): boolean {
  if (actor.countryId === chain.countryId || chain.country.ownerUserId === actor.id) return false;
  if (isSiteAdmin(actor)) return true;
  const realm = chain.country.realm;
  return realm !== null && hasRealmPower(actor, realm, realm.officers, "board");
}

/** Achievements are keyed by Clerk id: the country's owner, else whoever has it active. */
async function achievementRecipient(
  db: ChainsDb,
  chain: { countryId: string; country: { owner: { clerkUserId: string } | null } }
): Promise<string | undefined> {
  if (chain.country.owner) return chain.country.owner.clerkUserId;
  const player = await db.user.findFirst({ where: { countryId: chain.countryId }, select: { clerkUserId: true } });
  return player?.clerkUserId;
}

export async function reviewChain(
  db: ChainsDb,
  actor: ChainActor,
  input: { storylineId: string; approve: boolean; note?: string },
  onApproved: (storylineId: string) => Promise<void>
): Promise<void> {
  const chain = await db.storyline.findFirst({
    where: { id: input.storylineId, ...CHAIN, status: "submitted" },
    include: REVIEW_INCLUDE,
  });
  if (!chain) throw new ActionLinkError("NOT_FOUND", "No submitted chain with that id");
  if (!canReview(actor, chain)) throw new ActionLinkError("FORBIDDEN", "You cannot review this chain");

  const won = await db.storyline.updateMany({
    where: { id: chain.id, status: "submitted" },
    data: {
      status: input.approve ? "approved" : "open",
      reviewedBy: actor.id,
      reviewedAt: new Date(),
      reviewNote: input.note ?? null,
    },
  });
  if (won.count === 0) throw new ActionLinkError("CONFLICT", "This chain was already reviewed");
  if (!input.approve) return;

  // The approval is committed: nothing below may turn it into a failed mutation.
  try {
    queueAchievementCheck(await achievementRecipient(db, chain), chain.countryId);
  } catch (error) {
    console.warn(`[action-links] achievement check for chain ${chain.id} not queued:`, error);
  }
  await onApproved(chain.id).catch((error) => {
    console.warn(`[action-links] wiki append for chain ${chain.id} failed; the cron will retry:`, error);
  });
}

/** Submitted chains this actor may review: all for site admins, else those in realms where they hold "board". */
export async function reviewQueue(db: ChainsDb, actor: ChainActor) {
  const chains = await db.storyline.findMany({
    where: { ...CHAIN, status: "submitted" },
    include: { ...REVIEW_INCLUDE, _count: { select: { actionLinks: true } } },
    orderBy: { updatedAt: "asc" },
    take: 200,
  });
  return chains
    .filter((c) => canReview(actor, c))
    .map((c) => ({ id: c.id, title: c.title, countryId: c.countryId, linkCount: c._count.actionLinks }));
}
