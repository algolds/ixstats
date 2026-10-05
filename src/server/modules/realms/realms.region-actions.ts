/**
 * Realm region Manage actions: appearance and factbook, officers, embassies, the realm poll and board
 * restrictions — each gated by `requireRealmStaff` — plus a player leaving a realm with one of their nations.
 */
import type { PrismaClient } from "@prisma/client";
import {
  embassyPairKey,
  MAX_OFFICERS,
  MAX_REALM_TAGS,
  REALM_TAGS,
  STAFF_FOUNDER_ID,
  type BoardRestriction,
  type RealmPower,
} from "~/lib/realms/realm-region";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { sanitizeWikiContent } from "~/lib/utils/sanitize-html";
import { isRealmPublished, isSiteAdmin, type RealmActor } from "./realms.access";
import { releaseNation } from "./realms.ownership";
import { RealmRegionError, requireRealmStaff } from "./realms.region";
import { removeFromRealmBoard } from "~/server/shared/realm-board";

type ActionDb = Pick<
  PrismaClient,
  | "realmBoard"
  | "thinktankGroup"
  | "thinktankMember"
  | "conversationParticipant"
  | "realm"
  | "realmOfficer"
  | "realmEmbassy"
  | "realmBoardBan"
  | "poll"
  | "country"
  | "user"
  | "$transaction"
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

/** Save the factbook's wikitext and its rendered, sanitized HTML (what the front page shows). */
export async function updateRealmFactbook(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; wikitext: string }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "appearance");
  const wikitext = input.wikitext.trim();
  // The parser styles its output for small excerpts; the realm page styles the factbook itself.
  const html = wikitext
    ? sanitizeWikiContent(parseWikitextToHtml(wikitext).replace(/\sclass="[^"]*"/g, ""))
    : null;
  await db.realm.update({
    where: { id: realm.id },
    data: {
      factbookWikitext: wikitext || null,
      factbookHtml: html,
      factbookUpdatedAt: new Date(),
      factbookUpdatedBy: actor.clerkUserId,
    },
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

export async function appointRealmOfficer(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; userId: string; title: string; powers: RealmPower[] }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  if (realm.officers.some((o) => o.userId === input.userId))
    throw new RealmRegionError("CONFLICT", "That player is already an officer");
  if (realm.officers.length >= MAX_OFFICERS)
    throw new RealmRegionError("BAD_REQUEST", `A realm can have at most ${MAX_OFFICERS} officers`);
  if (input.userId === realm.ownerId)
    throw new RealmRegionError("BAD_REQUEST", "The founder already holds every power");
  await requireRealmNationOwner(db, realm.id, input.userId);
  await db.realmOfficer.create({
    data: {
      realmId: realm.id,
      userId: input.userId,
      title: input.title.trim(),
      powers: [...new Set(input.powers)],
      appointedBy: actor.clerkUserId,
    },
  });
  return { success: true };
}

export async function updateRealmOfficer(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; userId: string; title: string; powers: RealmPower[] }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "founder");
  const { count } = await db.realmOfficer.updateMany({
    where: { realmId: realm.id, userId: input.userId },
    data: { title: input.title.trim(), powers: [...new Set(input.powers)] },
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
 * Mute or ban a nation on the realm's board (replacing any restriction it has). The founder's and officers'
 * own nations can't be restricted.
 */
export async function restrictBoardNation(
  db: ActionDb,
  actor: RealmActor,
  input: {
    slug: string;
    countryId: string;
    kind: BoardRestriction;
    reason?: string;
    days?: number;
  }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "board");
  const nation = await db.country.findFirst({
    where: { id: input.countryId, realmId: realm.id },
    select: { id: true, owner: { select: { clerkUserId: true } } },
  });
  if (!nation) throw new RealmRegionError("NOT_FOUND", "That nation isn't in this realm");
  const ownerId = nation.owner?.clerkUserId;
  if (ownerId && (ownerId === realm.ownerId || realm.officers.some((o) => o.userId === ownerId)))
    throw new RealmRegionError(
      "FORBIDDEN",
      "The founder's and officers' nations can't be restricted"
    );
  const data = {
    kind: input.kind,
    reason: input.reason?.trim() || null,
    until: input.days ? new Date(Date.now() + input.days * 24 * 60 * 60 * 1000) : null,
    createdBy: actor.clerkUserId,
    createdAt: new Date(),
  };
  await db.realmBoardBan.upsert({
    where: { realmId_countryId: { realmId: realm.id, countryId: nation.id } },
    create: { realmId: realm.id, countryId: nation.id, ...data },
    update: data,
  });
  // A ban takes the owner off the board and its chat now, not at the next board open.
  if (input.kind === "ban" && ownerId) await removeFromRealmBoard(db, realm.id, ownerId);
  return { success: true };
}

export async function liftBoardRestriction(
  db: ActionDb,
  actor: RealmActor,
  input: { slug: string; countryId: string }
) {
  const realm = await requireRealmStaff(db, actor, input.slug, "board");
  await db.realmBoardBan.deleteMany({ where: { realmId: realm.id, countryId: input.countryId } });
  return { success: true };
}

/**
 * A player leaves a realm with one of their nations: it is released (unclaimed) and stops being their active
 * nation, and any board restriction on it is cleared. Officers who no longer own a nation in the realm lose
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
    await releaseNation(tx, nation.id);
    // A board restriction belongs to the player who held the nation, not to its next owner.
    await tx.realmBoardBan.deleteMany({ where: { countryId: nation.id } });
    const stillHolds = await tx.country.count({
      where: { realmId: nation.realmId, ownerUserId: actor.id },
    });
    if (stillHolds === 0) {
      await tx.realmOfficer.deleteMany({
        where: { realmId: nation.realmId, userId: actor.clerkUserId },
      });
    }
  });
  return { success: true, realmId: nation.realmId, name: nation.name };
}

/** Site admins: set a realm's founder (a Clerk user id), or hand it back to staff (`null`). */
export async function assignRealmFounder(
  db: ActionDb,
  actor: RealmActor,
  input: { realmId: string; clerkUserId: string | null }
) {
  if (!isSiteAdmin(actor))
    throw new RealmRegionError("FORBIDDEN", "Only site admins assign founders");
  if (input.clerkUserId) {
    const user = await db.user.findUnique({
      where: { clerkUserId: input.clerkUserId },
      select: { id: true },
    });
    if (!user) throw new RealmRegionError("NOT_FOUND", "No user with that id");
  }
  const ownerId = input.clerkUserId ?? STAFF_FOUNDER_ID;
  await db.$transaction(async (tx) => {
    await tx.realm.update({ where: { id: input.realmId }, data: { ownerId } });
    // The founder holds every power already; drop a now-redundant officer post.
    await tx.realmOfficer.deleteMany({ where: { realmId: input.realmId, userId: ownerId } });
  });
  return { success: true };
}
