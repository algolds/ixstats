/**
 * The economy half of the card sheet, for one card and one viewer: what each of their copies is worth, the dust it
 * breaks down for and what they can do with it, the fusion groups ready now, the craft offer, the wishlist state and
 * the name a signature would freeze. The card, its copies' facts and the market (listings, sales, wanted count) come
 * from Phase 3's `cards.getSheet`.
 */
import type { CardFinish, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { loadCopyValues } from "~/lib/cards/copy-value";
import { copyBlocker, dustYield } from "~/lib/cards/dust";
import { getEconomyConfig } from "~/lib/cards/economy-config";
import { nextFinish } from "~/lib/cards/finish";
import { offeredCopyIds } from "~/lib/cards/trade/offered-copies";
import { craftOfferFor, type CraftOffer } from "./workshop/craft";

export interface CopyEconomy {
  ownershipId: string;
  finish: CardFinish;
  value: number;
  dust: number;
  breakdownBlocker: string | null;
  canSign: boolean;
  listingId: string | null;
  auctionId: string | null;
}

export interface FusionGroup {
  finish: CardFinish;
  next: CardFinish;
  ownershipIds: string[];
}

export interface SheetEconomy {
  cardId: string;
  isBound: boolean;
  wishlisted: boolean;
  /** The name other players read for the viewer, the one `cards.inscribe` freezes; null when they cannot sign. */
  signerName: string | null;
  copies: CopyEconomy[];
  fusionGroups: FusionGroup[];
  craft: CraftOffer | null;
}

/** A copy as fusion sees it; callers pass copies in serial order, lowest first. */
export interface FusibleCopy {
  ownershipId: string;
  finish: CardFinish;
  isLocked: boolean;
  signed: boolean;
}

/** The viewer's display name by the identity rule, which the router injects (card modules may not read identity). */
export type SignerNameOf = (userId: string) => Promise<string | null>;

/** Per fusible finish, the lowest-serial ready copies (unlocked, unsigned), when there are enough to fuse. */
export function fusionGroups(
  copies: readonly FusibleCopy[],
  isBound: boolean,
  size: number
): FusionGroup[] {
  if (isBound) return [];
  const byFinish = new Map<CardFinish, string[]>();
  for (const copy of copies) {
    if (copy.isLocked || copy.signed) continue;
    byFinish.set(copy.finish, [...(byFinish.get(copy.finish) ?? []), copy.ownershipId]);
  }
  // Holo and Serialised have no next finish, so they never fuse.
  return [...byFinish].flatMap(([finish, ids]) => {
    const next = nextFinish(finish);
    return next && ids.length >= size ? [{ finish, next, ownershipIds: ids.slice(0, size) }] : [];
  });
}

/** No inscription fields beyond the two the rules read: who signed is never sent (`INSCRIPTION_OMIT`). */
const COPY_SELECT = {
  id: true,
  finish: true,
  isLocked: true,
  inscription: true,
  inscribedAt: true,
  importDiscounted: true,
  listings: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
  CardAuction: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
} as const;

/**
 * Values come from the one loader with its default, so a retired card's copies are worth 0 (Phase 3 Q5). A copy may be
 * signed once: never after a signature, even one staff cleared (`inscribedAt` stays), and never while it is locked. A
 * copy a pending trade offer names counts as locked for breaking down and fusing, as the workshop judges it
 * (`judgedCopiesTx`); signing it is not blocked (an accept refuses a copy signed since the offer).
 */
export async function getSheetEconomy(
  db: PrismaClient,
  viewerId: string,
  cardId: string,
  signerNameOf: SignerNameOf
): Promise<SheetEconomy> {
  const card = await db.card.findUnique({
    where: { id: cardId },
    select: { id: true, rarity: true, isBound: true },
  });
  if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });

  const [rows, cfg, wish, craft, signerName] = await Promise.all([
    db.cardOwnership.findMany({
      where: { ownerId: viewerId, cardId },
      orderBy: { serialNumber: "asc" },
      select: COPY_SELECT,
    }),
    getEconomyConfig(db),
    db.cardWatchlist.findUnique({
      where: { userId_cardId: { userId: viewerId, cardId } },
      select: { id: true },
    }),
    craftOfferFor(db, viewerId, cardId),
    signerNameOf(viewerId),
  ]);
  const ids = rows.map((r) => r.id);
  const [values, offered] = await Promise.all([
    loadCopyValues(db, { ownershipIds: ids }),
    offeredCopyIds(db, ids),
  ]);
  const valueOf = new Map(values.map((v) => [v.ownershipId, v.value]));
  const workshopLocked = (r: (typeof rows)[number]) => r.isLocked || offered.has(r.id);

  const copies = rows.map((r): CopyEconomy => {
    const workshop = {
      cardId,
      rarity: card.rarity,
      finish: r.finish,
      importDiscounted: r.importDiscounted,
      inscription: r.inscription,
      isLocked: workshopLocked(r),
      isBound: card.isBound,
    };
    return {
      ownershipId: r.id,
      finish: r.finish,
      value: valueOf.get(r.id) ?? 0,
      dust: dustYield(workshop, cfg),
      breakdownBlocker: copyBlocker(workshop, "break down"),
      canSign: r.inscribedAt === null && !r.isLocked,
      listingId: r.listings[0]?.id ?? null,
      auctionId: r.CardAuction[0]?.id ?? null,
    };
  });
  const fusible = rows.map((r) => ({
    ownershipId: r.id,
    finish: r.finish,
    isLocked: workshopLocked(r),
    signed: r.inscription !== null,
  }));

  return {
    cardId,
    isBound: card.isBound,
    wishlisted: wish !== null,
    signerName,
    copies,
    fusionGroups: fusionGroups(fusible, card.isBound, cfg.fusionCopies),
    craft,
  };
}
