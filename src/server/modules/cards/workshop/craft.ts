/**
 * Crafting (cards refresh §2.2): any catalogue card of a realm up to Epic, for that realm's dust plus the rarity floor
 * in IxC, minted Standard. One transaction spends the credits (the my_vault row), then the dust (the dust row), then
 * takes capacity (7334) and mints (7331), the lock order the daily claim and a break-down keep; any refusal rolls the
 * whole craft back.
 */
import type { CardRarity, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { assertCapacityTx } from "~/lib/cards/capacity";
import { craftability, craftQuote, type CraftQuote, type Verdict } from "~/lib/cards/dust";
import { getEconomyConfig } from "~/lib/cards/economy-config";
import { CATALOGUE_WHERE } from "~/lib/cards/hub/catalogue";
import { mintCopy } from "~/lib/cards/mint";
import { getValuationConfig } from "~/lib/cards/valuation";
import { spendCreditsTx } from "~/lib/vault/vault-ledger";
import { spendDustTx } from "./dust-ledger";
import { workshopCall } from "./errors";

const CARD_SELECT = {
  id: true,
  title: true,
  rarity: true,
  cardType: true,
  isBound: true,
  isRetired: true,
  realmId: true,
} as const;

export interface CraftOffer {
  cardId: string;
  realmId: string;
  verdict: Verdict;
  quote: CraftQuote;
  /** The player's dust in the card's realm. */
  dust: number;
}

/** The card if anyone may browse it (approved, not hidden, in a published realm); craftability() refuses the rest. */
function craftableCard(db: PrismaClient, cardId: string) {
  return db.card.findFirst({ where: { id: cardId, ...CATALOGUE_WHERE }, select: CARD_SELECT });
}

async function quoteFor(db: PrismaClient, rarity: CardRarity): Promise<CraftQuote> {
  const [economy, valuation] = await Promise.all([getEconomyConfig(db), getValuationConfig(db)]);
  return craftQuote(rarity, economy, valuation);
}

export async function craftOfferFor(
  db: PrismaClient,
  userId: string,
  cardId: string
): Promise<CraftOffer | null> {
  const card = await craftableCard(db, cardId);
  if (!card) return null;
  const [quote, held] = await Promise.all([
    quoteFor(db, card.rarity),
    db.cardDustBalance.findUnique({
      where: { userId_realmId: { userId, realmId: card.realmId } },
      select: { balance: true },
    }),
  ]);
  return {
    cardId: card.id,
    realmId: card.realmId,
    verdict: craftability(card),
    quote,
    dust: held?.balance ?? 0,
  };
}

export async function craftCard(
  db: PrismaClient,
  input: { userId: string; cardId: string }
): Promise<{ ownershipId: string; dust: number; credits: number }> {
  const card = await craftableCard(db, input.cardId);
  if (!card) {
    throw new TRPCError({ code: "NOT_FOUND", message: "This card can't be crafted right now." });
  }
  const verdict = craftability(card);
  if (!verdict.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: verdict.reason });
  const quote = await quoteFor(db, card.rarity);

  return workshopCall(() =>
    db.$transaction(async (tx) => {
      // The ledger refuses a spend of nothing, so a floor of 0 charges no credits
      if (quote.credits > 0) {
        await spendCreditsTx(tx, {
          userId: input.userId,
          amount: quote.credits,
          type: "SPEND_CRAFT",
          source: "card_craft",
          metadata: { cardId: card.id, cardTitle: card.title, dust: quote.dust },
        });
      }
      await spendDustTx(tx, {
        userId: input.userId,
        realmId: card.realmId,
        amount: quote.dust,
        source: "CRAFT",
        cardId: card.id,
      });
      await assertCapacityTx(tx, input.userId, 1);
      const copy = await mintCopy(tx, {
        cardId: card.id,
        ownerId: input.userId,
        source: "CRAFT",
        finish: "STANDARD",
      });
      return { ownershipId: copy.id, dust: quote.dust, credits: quote.credits };
    })
  );
}
