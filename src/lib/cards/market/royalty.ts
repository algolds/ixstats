/**
 * The nation card royalty: a share of a sale or a trade credit leg, paid to the owner of the nation a NATION card
 * shows. It is carved out of the market fee, so it adds no credits, and it is paid only when that owner is not a
 * party to the deal. There is no fallback recipient.
 */
import type { CardType, Prisma } from "@prisma/client";
import { earnCreditsTx, LedgerError } from "~/lib/vault/vault-ledger";
import type { CardNotice } from "../card-notify";
import { getEconomyConfig } from "../economy-config";
import { royaltyFromFee } from "./fees";

export interface RoyaltyCard {
  cardId: string;
  cardType: CardType;
  countryId: string | null;
}

export interface RoyaltyPayout {
  recipientId: string;
  amount: number;
  cardId: string;
}

type NationCard = RoyaltyCard & { countryId: string };

type Owner = Omit<RoyaltyPayout, "amount">;

const showsNation = (card: RoyaltyCard): card is NationCard =>
  card.cardType === "NATION" && card.countryId !== null;

/** Each distinct nation owner among the cards who is not a party (a `User.id`), with one card of theirs. */
async function eligibleOwners(
  tx: Prisma.TransactionClient,
  cards: NationCard[],
  partyIds: readonly string[]
): Promise<Owner[]> {
  const countries = await tx.country.findMany({
    where: { id: { in: [...new Set(cards.map((c) => c.countryId))] } },
    select: { id: true, ownerUserId: true },
  });
  const ownerOf = new Map(countries.map((c) => [c.id, c.ownerUserId]));
  // Each owner with the first of their cards
  const owners = new Map<string, string>();
  for (const card of cards) {
    const ownerId = ownerOf.get(card.countryId);
    if (ownerId && !partyIds.includes(ownerId) && !owners.has(ownerId)) {
      owners.set(ownerId, card.cardId);
    }
  }
  return [...owners].map(([recipientId, cardId]) => ({ recipientId, cardId }));
}

/**
 * Pays the royalty on `amount` out of its `fee`, split evenly between the eligible nation owners in whole cents,
 * rounded down. A ledger refusal on one payout happens before any write, so that share stays with the house and the
 * deal goes on. Earning switched off is not that case on a sale: the seller's EARN_CARDS payment comes first and
 * fails the whole sale.
 */
export async function payNationRoyaltiesTx(
  tx: Prisma.TransactionClient,
  args: {
    cards: RoyaltyCard[];
    partyIds: readonly string[];
    amount: number;
    fee: number;
    context: Record<string, string>;
  }
): Promise<RoyaltyPayout[]> {
  const nationCards = args.cards.filter(showsNation);
  // No nation card, or no fee to carve the royalty from: nothing to look up
  if (nationCards.length === 0 || args.fee <= 0) return [];
  const owners = await eligibleOwners(tx, nationCards, args.partyIds);
  if (owners.length === 0) return [];
  const { royaltyPct } = await getEconomyConfig(tx);
  // The royalty is whole cents of a whole-IxC fee, so the split is integer arithmetic (a float floor of 0.58 × 100,
  // which is 57.99..., would pay 0.57)
  const royaltyCents = Math.round(royaltyFromFee(args.amount, args.fee, royaltyPct) * 100);
  const share = Math.floor(royaltyCents / owners.length) / 100;
  if (share <= 0) return [];

  const paid: RoyaltyPayout[] = [];
  for (const owner of owners) {
    try {
      await earnCreditsTx(tx, {
        userId: owner.recipientId,
        amount: share,
        type: "EARN_CARDS",
        source: "nation_card_royalty",
        metadata: { ...args.context, cardId: owner.cardId, amount: args.amount, royaltyPct },
      });
      paid.push({ ...owner, amount: share });
    } catch (error) {
      if (!(error instanceof LedgerError)) throw error;
    }
  }
  return paid;
}

/** "Royalty paid" notices, one per payout. */
export function royaltyNotices(
  payouts: RoyaltyPayout[],
  titles: ReadonlyMap<string, string>
): CardNotice[] {
  return payouts.map((p) => {
    const title = titles.get(p.cardId);
    return {
      userId: p.recipientId,
      cardId: p.cardId,
      title: "Royalty paid",
      message: `A copy of your nation's card${title ? `, ${title},` : ""} changed hands. You received ${p.amount} IxC.`,
      type: "success",
      priority: "low",
    };
  });
}
