/**
 * The trade builder's reads (spec §2.3 Trade builder): a partner found by passport handle, with their trade privacy
 * shown before building; each side's tradeable copies with wishlist highlights; and the partner's wishlist while
 * building. Card modules do not read identity, so the router injects how a handle resolves and how players are named
 * and whether they show their Vault cards (`PartnerRules`).
 */
import type { CardFinish, CardRarity, CardType, Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { loadCopyValues } from "~/lib/cards/copy-value";
import { CATALOGUE_WHERE } from "~/lib/cards/hub/catalogue";
import { copyFaces } from "~/lib/cards/hub/market-faces";
import { likeLiteral } from "~/lib/utils/like-literal";
import { WISHLIST_MAX, wishlistCardIds } from "~/server/modules/cards/market/wishlist";
import {
  hiddenLinkedNames,
  permissionAudiences,
  tradeOfferRefusers,
  type PermissionAudience,
} from "~/server/shared/privacy-permissions";
import type { TradeCopyView } from "./trade-queries";
import type { Party } from "./trade-service";

export interface PartnerName {
  handle: string;
  displayName: string | null;
}

export interface PartnerRules {
  /** The user a passport handle names (stored handle, wiki or forum name, Clerk id), or null: `resolveHandleUser`. */
  userOfHandle: (handle: string) => Promise<string | null>;
  /** Players' passport handles and display names, in one batch: `loadPlayerNames`. */
  namesOf: (userIds: readonly string[]) => Promise<ReadonlyMap<string, PartnerName>>;
  /** Which of these players show their Vault cards on their passport: `loadVaultCardsShown`. */
  cardsShown: (userIds: readonly string[]) => Promise<ReadonlySet<string>>;
}

export interface TradePrivacy {
  /** Who they take trade offers from; "nobody" to a viewer they block, so a block never shows as one. */
  audience: PermissionAudience;
  /** Whether that includes this viewer, who is not on their block list. */
  allowed: boolean;
  /** Their Vault cards switch: while it is off, their copies and their wishlist stay hidden. */
  cardsShown: boolean;
}

export interface TradePartner {
  id: string;
  /** Their passport handle, for a Passport link. */
  handle: string;
  /** Their name by the identity rule; null reads "a player". A trade is direct, so the Vault cards switch keeps it. */
  displayName: string | null;
  countryName: string | null;
  privacy: TradePrivacy;
}

type PartnerDb = PrismaClient;
interface PartnerUser {
  id: string;
  clerkUserId: string;
  country: { name: string } | null;
}

const REFUSED = "This player isn't taking trade offers from you.";
const PRIVATE = "This player keeps their cards private.";
const SEARCH_MIN = 2;
const SEARCH_SCAN = 15;
const SEARCH_MAX = 8;

const PARTNER_SELECT = {
  id: true,
  clerkUserId: true,
  isActive: true,
  country: { select: { name: true } },
} satisfies Prisma.UserSelect;

/** Each player's trade privacy toward the viewer, in the players' order. A block reads as "nobody" (messaging's rule). */
async function privacyOf(
  db: PartnerDb,
  rules: PartnerRules,
  viewer: Party,
  users: readonly PartnerUser[]
): Promise<TradePrivacy[]> {
  const clerkIds = users.map((u) => u.clerkUserId);
  const [audiences, refusals, shown] = await Promise.all([
    permissionAudiences(db, clerkIds, "tradeOffers"),
    tradeOfferRefusers(db, viewer.clerkUserId, clerkIds),
    rules.cardsShown(users.map((u) => u.id)),
  ]);
  return users.map((u): TradePrivacy => ({
    audience: refusals.blocking.has(u.clerkUserId)
      ? "nobody"
      : (audiences.get(u.clerkUserId) ?? "everyone"),
    allowed: !refusals.refused.has(u.clerkUserId),
    cardsShown: shown.has(u.id),
  }));
}

/** The players named by the identity rule, with their privacy; a player with no name (gone) is left out. */
async function asPartners(
  db: PartnerDb,
  rules: PartnerRules,
  viewer: Party,
  users: readonly PartnerUser[]
): Promise<TradePartner[]> {
  const names = await rules.namesOf(users.map((u) => u.id));
  const named = users.flatMap((user) => {
    const name = names.get(user.id);
    return name ? [{ user, name }] : [];
  });
  const privacy = await privacyOf(
    db,
    rules,
    viewer,
    named.map((n) => n.user)
  );
  return named.map(({ user, name }, i) => ({
    id: user.id,
    handle: name.handle,
    displayName: name.displayName,
    countryName: user.country?.name ?? null,
    privacy: privacy[i],
  }));
}

/** Another active player by id, or null. */
async function activePlayer(
  db: PartnerDb,
  viewer: Party,
  userId: string
): Promise<PartnerUser | null> {
  if (userId === viewer.id) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: PARTNER_SELECT });
  return user?.isActive ? user : null;
}

/** The player a passport handle names, typed with or without its @, and their trade privacy toward the viewer. */
export async function findTradePartner(
  db: PartnerDb,
  rules: PartnerRules,
  viewer: Party,
  rawHandle: string
): Promise<TradePartner | null> {
  const handle = rawHandle.trim().replace(/^@/, "").trim();
  if (!handle) return null;
  const userId = await rules.userOfHandle(handle);
  const user = userId ? await activePlayer(db, viewer, userId) : null;
  if (!user) return null;
  return (await asPartners(db, rules, viewer, [user]))[0] ?? null;
}

const SEARCH_SELECT = {
  id: true,
  clerkUserId: true,
  handle: true,
  forumUsername: true,
  discordUsername: true,
  country: { select: { name: true, leader: true } },
} satisfies Prisma.UserSelect;
type SearchRow = Prisma.UserGetPayload<{ select: typeof SEARCH_SELECT }>;

/** Each name a search matches, as typed: escaped, so a % or _ is a character and not a wildcard. */
function searchWhere(viewer: Party, text: string): Prisma.UserWhereInput {
  const literal = likeLiteral(text);
  const term = { contains: literal, mode: "insensitive" } as const;
  return {
    id: { not: viewer.id },
    isActive: true,
    OR: [
      { handle: { startsWith: literal, mode: "insensitive" } },
      { country: { OR: [{ name: term }, { leader: term }] } },
      { forumUsername: term },
      { discordUsername: term },
    ],
  };
}

/** Whether a row matched on a name its owner shows: a hidden Discord tag (SL-4) matches nothing. */
function matchesShown(row: SearchRow, needle: string, hidden: { discord: Set<string> }): boolean {
  const has = (value: string | null | undefined) => !!value?.toLowerCase().includes(needle);
  return (
    !!row.handle?.toLowerCase().startsWith(needle) ||
    has(row.country?.name) ||
    has(row.country?.leader) ||
    has(row.forumUsername) ||
    (!hidden.discord.has(row.clerkUserId) && has(row.discordUsername))
  );
}

/**
 * Players matching the typed text: a stored handle's start, a nation's name or leader, a forum name, or a Discord tag
 * their owner shows. At most eight, named by the identity rule.
 */
export async function searchTradePartners(
  db: PartnerDb,
  rules: PartnerRules,
  viewer: Party,
  query: string
): Promise<TradePartner[]> {
  const text = query.trim().replace(/^@/, "").trim();
  if (text.length < SEARCH_MIN) return [];
  const rows = await db.user.findMany({
    where: searchWhere(viewer, text),
    select: SEARCH_SELECT,
    orderBy: [{ handle: "asc" }, { id: "asc" }],
    take: SEARCH_SCAN,
  });
  const hidden = await hiddenLinkedNames(
    db,
    rows.map((r) => r.clerkUserId)
  );
  const needle = text.toLowerCase();
  const shown = rows.filter((row) => matchesShown(row, needle, hidden)).slice(0, SEARCH_MAX);
  return asPartners(db, rules, viewer, shown);
}

/** The partner, if the viewer may trade with them; whether they show their cards decides what the builder reads. */
async function openPartner(
  db: PartnerDb,
  rules: PartnerRules,
  viewer: Party,
  partnerId: string
): Promise<{ id: string; cardsShown: boolean }> {
  const partner = await activePlayer(db, viewer, partnerId);
  if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found." });
  const [privacy] = await privacyOf(db, rules, viewer, [partner]);
  if (!privacy.allowed) throw new TRPCError({ code: "FORBIDDEN", message: REFUSED });
  return { id: partner.id, cardsShown: privacy.cardsShown };
}

const hiddenCards = () => new TRPCError({ code: "FORBIDDEN", message: PRIVATE });

export interface TradeableFilters {
  realmId?: string;
  rarity?: CardRarity;
  finish?: CardFinish;
  cardType?: CardType;
  search?: string;
}

/** A copy either side may put on the table, as the trade view shows it. */
export interface TradeableCopy extends TradeCopyView {
  /** On the other party's wishlist (my side) or on mine (theirs). */
  highlighted: boolean;
}

/** What the builder reads of a copy: never who signed it (only the card sheet names a signer). */
const TRADEABLE_SELECT = {
  id: true,
  cardId: true,
  inscription: true,
} satisfies Prisma.CardOwnershipSelect;

/**
 * The copies an offer can carry, as the offer checks them: unlocked (not listed, at auction or given in a pending
 * trade) and unbound. A retired card's copies stay tradeable (spec §3), at 0 with the placeholder face.
 */
function tradeableWhere(ownerId: string, f: TradeableFilters): Prisma.CardOwnershipWhereInput {
  return {
    ownerId,
    isLocked: false,
    ...(f.finish ? { finish: f.finish } : {}),
    cards: {
      isBound: false,
      ...(f.realmId ? { realmId: f.realmId } : {}),
      ...(f.rarity ? { rarity: f.rarity } : {}),
      ...(f.cardType ? { cardType: f.cardType } : {}),
      ...(f.search
        ? { title: { contains: likeLiteral(f.search), mode: "insensitive" as const } }
        : {}),
    },
  };
}

/**
 * The partner's wishes a trade partner may see: catalogue cards only (so no hidden or unpublished card is named or
 * hinted at), newest first, as many as a wishlist holds. The wishlist shows them and my side's highlights use them.
 */
const partnerWishes = (userId: string) =>
  ({
    where: { userId, card: CATALOGUE_WHERE },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: WISHLIST_MAX,
  }) satisfies Prisma.CardWatchlistFindManyArgs;

/** The cards to highlight: the partner's wishes among my copies (only while they show their cards), mine among theirs. */
async function highlightedCards(
  db: PartnerDb,
  viewer: Party,
  partner: { id: string; cardsShown: boolean },
  mine: boolean
): Promise<ReadonlySet<string>> {
  if (!mine) return wishlistCardIds(db, viewer.id);
  if (!partner.cardsShown) return new Set();
  const wishes = await db.cardWatchlist.findMany({
    ...partnerWishes(partner.id),
    select: { cardId: true },
  });
  return new Set(wishes.map((w) => w.cardId));
}

export interface TradeablesInput {
  partnerId: string;
  side: "mine" | "theirs";
  filters: TradeableFilters;
  cursor?: string;
  limit: number;
}

/**
 * One page of a side's tradeable copies, by card title. Every face shows its art, marked by the viewer's own copies
 * (the partner's side too), values are the shared copy value, and a copy that is gone is left out.
 */
export async function getTradeables(
  db: PartnerDb,
  rules: PartnerRules,
  viewer: Party,
  input: TradeablesInput
): Promise<{ items: TradeableCopy[]; nextCursor: string | null }> {
  const partner = await openPartner(db, rules, viewer, input.partnerId);
  const mine = input.side === "mine";
  if (!mine && !partner.cardsShown) throw hiddenCards();
  const rows = await db.cardOwnership.findMany({
    where: tradeableWhere(mine ? viewer.id : partner.id, input.filters),
    select: TRADEABLE_SELECT,
    orderBy: [{ cards: { title: "asc" } }, { id: "asc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, input.limit);
  const ids = page.map((r) => r.id);
  const [wished, values, faces] = await Promise.all([
    highlightedCards(db, viewer, partner, mine),
    loadCopyValues(db, { ownershipIds: ids }),
    copyFaces(db, viewer.id, ids),
  ]);
  const valueOf = new Map(values.map((v) => [v.ownershipId, v.value]));
  const items = page.flatMap((r): TradeableCopy[] => {
    const face = faces.get(r.id);
    if (!face) return [];
    return [
      {
        ownershipId: r.id,
        face,
        inscription: r.inscription,
        value: valueOf.get(r.id) ?? 0,
        highlighted: wished.has(r.cardId),
      },
    ];
  });
  return { items, nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null };
}

export interface PartnerWish {
  cardId: string;
  title: string;
  rarity: CardRarity;
  realmId: string;
  /** The viewer's tradeable copies of it. */
  youOwn: number;
}

/**
 * The partner's wishlist, shown while building a trade with them (`partnerWishes`), with how many tradeable copies of
 * each the viewer holds.
 */
export async function getPartnerWishlist(
  db: PartnerDb,
  rules: PartnerRules,
  viewer: Party,
  partnerId: string
): Promise<PartnerWish[]> {
  const partner = await openPartner(db, rules, viewer, partnerId);
  if (!partner.cardsShown) throw hiddenCards();
  const rows = await db.cardWatchlist.findMany({
    ...partnerWishes(partner.id),
    select: { cardId: true, card: { select: { title: true, rarity: true, realmId: true } } },
  });
  if (rows.length === 0) return [];
  const owned = await db.cardOwnership.groupBy({
    by: ["cardId"],
    where: { ...tradeableWhere(viewer.id, {}), cardId: { in: rows.map((r) => r.cardId) } },
    _count: { _all: true },
  });
  const ownedBy = new Map(owned.map((o) => [o.cardId, o._count._all]));
  return rows.map((r) => ({
    cardId: r.cardId,
    title: r.card.title,
    rarity: r.card.rarity,
    realmId: r.card.realmId,
    youOwn: ownedBy.get(r.cardId) ?? 0,
  }));
}
