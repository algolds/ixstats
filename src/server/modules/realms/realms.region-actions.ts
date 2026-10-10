/**
 * Realm region Manage actions: appearance, factbook, rules, community links and the in-world date, officers,
 * embassies and the realm poll — each gated by `requireRealmStaff` — plus a player leaving a
 * realm with one of their nations.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  embassyPairKey,
  MAX_OFFICERS,
  MAX_REALM_TAGS,
  REALM_TAGS,
  type RealmPower,
} from "~/lib/realms/realm-region";
import type { InWorldDate, RealmLink } from "~/lib/realms/realm-community";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { sanitizeRealmContent } from "~/lib/utils/sanitize-html";
import { isRealmPublished, type RealmActor } from "./realms.access";
import { dropOfficerPostWithoutNation, releaseNation } from "./realms.ownership";
import { RealmRegionError, requireRealmStaff } from "./realms.region";
import { withInWorldDate } from "./realms.settings";

type ActionDb = Pick<
  PrismaClient,
  "realm" | "realmOfficer" | "realmEmbassy" | "poll" | "country" | "user" | "$transaction"
>;

export async function updateRealmAppearance(
  db: ActionDb,
  actor: RealmActor,
  input: {
    slug: string;
    bannerUrl?: string | null;
    thumbnail?: string | null;
    description?: string | null;
    tags?: string[];
  }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "appearance");
  const tags = input.tags
    ? [...new Set(input.tags)].filter((t) => (REALM_TAGS as readonly string[]).includes(t))
    : undefined;
  if (tags && tags.length > MAX_REALM_TAGS)
    throw new RealmRegionError("BAD_REQUEST", `Choose at most ${MAX_REALM_TAGS} tags`);
  await db.realm.update({
    where: { id: realm.id },
    data: {
      ...(input.bannerUrl !== undefined && { bannerUrl: input.bannerUrl || null }),
      ...(input.thumbnail !== undefined && { thumbnail: input.thumbnail || null }),
      ...(input.description !== undefined && { description: input.description || null }),
      ...(tags && { tags }),
    },
  });
  return { success: true };
}

/** Trimmed wikitext and its rendered, sanitized HTML; both null when the text is empty. */
function renderRealmWikitext(source: string) {
  const wikitext = source.trim();
  // The parser styles its output for small excerpts; the realm page styles the factbook and rules itself.
  const html = wikitext ? sanitizeRealmContent(parseWikitextToHtml(wikitext)) : null;
  return { wikitext: wikitext || null, html };
}

/** Save the factbook's wikitext and its rendered, sanitized HTML (what the front page shows). */
export async function updateRealmFactbook(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; wikitext: string }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "appearance");
  const { wikitext, html } = renderRealmWikitext(input.wikitext);
  await db.realm.update({
    where: { id: realm.id },
    data: {
      factbookWikitext: wikitext,
      factbookHtml: html,
      factbookUpdatedAt: new Date(),
      factbookUpdatedBy: actor.clerkUserId,
    },
  });
  return { success: true };
}

/**
 * Save the realm's rules like the factbook (wikitext plus rendered, sanitized HTML). While rules exist, a claim
 * needs the player to confirm reading them; empty text removes them.
 */
export async function updateRealmRules(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; wikitext: string }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "appearance");
  const { wikitext, html } = renderRealmWikitext(input.wikitext);
  await db.realm.update({
    where: { id: realm.id },
    data: {
      rulesWikitext: wikitext,
      rulesHtml: html,
      rulesUpdatedAt: new Date(),
      rulesUpdatedBy: actor.clerkUserId,
    },
  });
  return { success: true };
}

/** Replace the realm's community links (validated by `RealmLinksSchema` in the router), in the order given. */
export async function updateRealmLinks(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; links: RealmLink[] }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "appearance");
  await db.realm.update({
    where: { id: realm.id },
    data: { communityLinks: input.links.map(({ label, url, kind }) => ({ label, url, kind })) },
  });
  return { success: true };
}

/** Set the realm's in-world date (`settings.inWorldDate`), or clear it with `null`; other settings are kept. */
export async function updateRealmInWorldDate(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; inWorldDate: InWorldDate | null }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "appearance");
  const stored = await db.realm.findUnique({ where: { id: realm.id }, select: { settings: true } });
  await db.realm.update({
    where: { id: realm.id },
    data: { settings: withInWorldDate(stored?.settings, input.inWorldDate) },
  });
  return { success: true };
}

/** Players the founder may appoint: owners of a nation in the realm, matched by nation or name. */
export async function listOfficerCandidates(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; query: string }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  const nations = await db.country.findMany({
    where: {
      realmId: realm.id,
      ownerUserId: { not: null },
      ...(input.query.trim() && { name: { contains: input.query.trim(), mode: "insensitive" } }),
    },
    orderBy: { name: "asc" },
    take: 20,
    select: { name: true, owner: { select: { clerkUserId: true } } },
  });
  const officers = new Set(realm.officers.map((o) => o.userId));
  return nations
    .filter((n) => n.owner && !officers.has(n.owner.clerkUserId))
    .map((n) => ({ userId: n.owner!.clerkUserId, nation: n.name }));
}

async function requireRealmNationOwner(db: ActionDb, realmId: string, clerkUserId: string) {
  const nation = await db.country.findFirst({
    where: { realmId, owner: { clerkUserId } },
    select: { id: true },
  });
  if (!nation) throw new RealmRegionError("BAD_REQUEST", "Officers must own a nation in the realm");
}

/**
 * Refuses giving a player (Clerk id) a realm's `board` power, i.e. forum moderation there. The router supplies the
 * forum's check (M9: no active forum ban in the realm or sitewide), which this module cannot import. It runs inside
 * the grant's transaction, under the member's lock.
 */
export type BoardGrantGuard = (
  tx: Prisma.TransactionClient,
  realmId: string,
  clerkUserId: string
) => Promise<void>;

export async function appointRealmOfficer(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; userId: string; title: string; powers: RealmPower[] },
  guardBoard: BoardGrantGuard
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  if (realm.officers.some((o) => o.userId === input.userId))
    throw new RealmRegionError("CONFLICT", "That player is already an officer");
  if (realm.officers.length >= MAX_OFFICERS)
    throw new RealmRegionError("BAD_REQUEST", `A realm can have at most ${MAX_OFFICERS} officers`);
  if (input.userId === realm.ownerId)
    throw new RealmRegionError("BAD_REQUEST", "The founder already holds every power");
  await requireRealmNationOwner(db, realm.id, input.userId);
  await db.$transaction(async (tx) => {
    if (input.powers.includes("board")) await guardBoard(tx, realm.id, input.userId);
    await tx.realmOfficer.create({
      data: {
        realmId: realm.id,
        userId: input.userId,
        title: input.title.trim(),
        powers: [...new Set(input.powers)],
        appointedBy: actor.clerkUserId,
      },
    });
  });
  return { success: true };
}

/** Changes an officer's title and powers; adding `board` goes through the router's guard (M9). */
export async function updateRealmOfficer(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; userId: string; title: string; powers: RealmPower[] },
  guardBoard: BoardGrantGuard
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  const current = realm.officers.find((o) => o.userId === input.userId);
  const addsBoard =
    current !== undefined && !current.powers.includes("board") && input.powers.includes("board");
  const { count } = await db.$transaction(async (tx) => {
    if (addsBoard) await guardBoard(tx, realm.id, input.userId);
    return tx.realmOfficer.updateMany({
      where: { realmId: realm.id, userId: input.userId },
      data: { title: input.title.trim(), powers: [...new Set(input.powers)] },
    });
  });
  if (count === 0) throw new RealmRegionError("NOT_FOUND", "Officer not found");
  return { success: true };
}

/** The founder dismisses an officer, or an officer resigns. */
export async function removeRealmOfficer(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; userId: string }
) {
  const resigning = input.userId === actor.clerkUserId;
  const realm = resigning
    ? await db.realm.findUnique({ where: { slug: input.slug }, select: { id: true } })
    : await requireRealmStaff(db, actor, input.slug, "founder");
  if (!realm) throw new RealmRegionError("NOT_FOUND", "Realm not found");
  const { count } = await db.realmOfficer.deleteMany({
    where: { realmId: realm.id, userId: input.userId },
  });
  if (count === 0) throw new RealmRegionError("NOT_FOUND", "Officer not found");
  return { success: true };
}

/**
 * Propose an embassy to another published realm. A pending proposal from that realm is accepted instead; a
 * closed embassy between the pair is proposed afresh.
 */
export async function proposeRealmEmbassy(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; targetSlug: string }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "diplomacy");
  const target = await db.realm.findUnique({
    where: { slug: input.targetSlug },
    select: { id: true, status: true },
  });
  if (!target || !isRealmPublished(target.id, target.status) || target.status === "archived")
    throw new RealmRegionError("NOT_FOUND", "That realm can't receive embassies");
  if (target.id === realm.id)
    throw new RealmRegionError("BAD_REQUEST", "A realm can't open an embassy with itself");

  const pairKey = embassyPairKey(realm.id, target.id);
  const existing = await db.realmEmbassy.findUnique({ where: { pairKey } });
  if (existing?.status === "active")
    throw new RealmRegionError("CONFLICT", "These realms already have an embassy");
  if (existing?.status === "proposed") {
    if (existing.fromRealmId === realm.id)
      throw new RealmRegionError("CONFLICT", "Your proposal is already waiting for an answer");
    await db.realmEmbassy.update({
      where: { id: existing.id },
      data: {
        status: "active",
        respondedBy: actor.clerkUserId,
        openedAt: new Date(),
        closedAt: null,
      },
    });
    return { status: "active" as const };
  }
  const data = {
    fromRealmId: realm.id,
    toRealmId: target.id,
    status: "proposed",
    proposedBy: actor.clerkUserId,
    respondedBy: null,
    openedAt: null,
    closedAt: null,
  };
  await db.realmEmbassy.upsert({ where: { pairKey }, create: { ...data, pairKey }, update: data });
  return { status: "proposed" as const };
}

/** The receiving realm accepts or declines a proposal. */
export async function respondRealmEmbassy(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; embassyId: string; accept: boolean }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "diplomacy");
  const { count } = await db.realmEmbassy.updateMany({
    where: { id: input.embassyId, toRealmId: realm.id, status: "proposed" },
    data: input.accept
      ? { status: "active", respondedBy: actor.clerkUserId, openedAt: new Date() }
      : { status: "closed", respondedBy: actor.clerkUserId, closedAt: new Date() },
  });
  if (count === 0) throw new RealmRegionError("NOT_FOUND", "No pending proposal to answer");
  return { success: true };
}

/** Either realm closes an embassy, or the proposer withdraws its proposal. */
export async function closeRealmEmbassy(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; embassyId: string }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "diplomacy");
  const { count } = await db.realmEmbassy.updateMany({
    where: {
      id: input.embassyId,
      OR: [
        { status: "active", fromRealmId: realm.id },
        { status: "active", toRealmId: realm.id },
        { status: "proposed", fromRealmId: realm.id },
      ],
    },
    data: { status: "closed", respondedBy: actor.clerkUserId, closedAt: new Date() },
  });
  if (count === 0) throw new RealmRegionError("NOT_FOUND", "Embassy not found");
  return { success: true };
}

/** Open the realm poll. One runs at a time: close the current one first. */
export async function createRealmPoll(
  db: ActionDb,
  actor: RealmActor,
  input: {
    slug: string;
    question: string;
    description?: string;
    options: string[];
    multiple: boolean;
    endDate?: Date;
  }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "diplomacy");
  const options = [...new Set(input.options.map((o) => o.trim()).filter(Boolean))];
  if (options.length < 2)
    throw new RealmRegionError("BAD_REQUEST", "A poll needs at least two different options");
  if (input.endDate && input.endDate <= new Date())
    throw new RealmRegionError("BAD_REQUEST", "The end date must be in the future");
  const open = await db.poll.findFirst({
    where: { realmId: realm.id, isActive: true },
    select: { id: true },
  });
  if (open) throw new RealmRegionError("CONFLICT", "Close the current poll before opening another");
  const poll = await db.poll.create({
    data: {
      realmId: realm.id,
      question: input.question.trim(),
      description: input.description?.trim() || null,
      pollType: "choice",
      multiple: input.multiple,
      endDate: input.endDate ?? null,
      options: { create: options.map((label) => ({ label })) },
    },
    select: { id: true },
  });
  return { pollId: poll.id };
}

export async function closeRealmPoll(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; pollId: string }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "diplomacy");
  const { count } = await db.poll.updateMany({
    where: { id: input.pollId, realmId: realm.id, isActive: true },
    data: { isActive: false },
  });
  if (count === 0) throw new RealmRegionError("NOT_FOUND", "Open poll not found");
  return { success: true };
}

/**
 * A player leaves a realm with one of their nations: it is released (unclaimed) and stops being their active
 * nation; a board restriction on it still binds them. Officers who no longer own a nation in the realm lose
 * their post.
 */
export async function abandonNation(
  db: ActionDb,
  actor: RealmActor,
  input: { countryId: string; confirmName: string }
) {
  const nation = await db.country.findUnique({
    where: { id: input.countryId },
    select: { id: true, name: true, realmId: true, ownerUserId: true },
  });
  if (!nation || nation.ownerUserId !== actor.id)
    throw new RealmRegionError("NOT_FOUND", "You don't own that nation");
  if (input.confirmName.trim().toLowerCase() !== nation.name.trim().toLowerCase())
    throw new RealmRegionError("BAD_REQUEST", "Type the nation's name to confirm");

  await db.$transaction(async (tx) => {
    // A board restriction on the nation stays: it keeps binding this player, never its next claimant
    // (restrictionHolders in realm-board.ts).
    await releaseNation(tx, nation.id);
    await dropOfficerPostWithoutNation(tx, nation.realmId, actor);
  });
  return { success: true, realmId: nation.realmId, name: nation.name };
}
