/**
 * A trade for one of its two parties: both sides' copies (faces, inscriptions, values) and the market fee each credit
 * leg would pay if accepted now. The router names the parties (`withPartyName`).
 */
import type { PrismaClient, TradeOffer } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { loadCopyValues } from "~/lib/cards/copy-value";
import type { CardFaceData } from "~/lib/cards/face/types";
import { marketplaceFee } from "~/lib/cards/general-settings";
import { copyIdsOf } from "~/lib/cards/hub/art-visibility";
import { copyFaces } from "~/lib/cards/hub/market-faces";
import type { TradeRole } from "~/lib/cards/trade/trade-table";

export interface TradeCopyView {
  ownershipId: string;
  face: CardFaceData;
  /** The text travels with the copy; who signed it is the card sheet's to show. */
  inscription: string | null;
  value: number;
}

interface TradeParty {
  id: string;
  clerkUserId: string;
}

export interface TradeDetails extends TradeOffer {
  initiator: TradeParty;
  recipient: TradeParty;
  /** The stored card ids, parsed (the builder edits these). */
  initiatorCardIdList: string[];
  recipientCardIdList: string[];
  initiatorCopies: TradeCopyView[];
  recipientCopies: TradeCopyView[];
  /** Each side's copies at the shared copy value (a retired copy is 0), plus its credits. */
  initiatorValue: number;
  recipientValue: number;
  viewerRole: TradeRole;
  /** The table waits on the viewer: pending, unexpired, and written by the other party. */
  myTurn: boolean;
  /** The market fee each side's credits would pay if accepted now. */
  feePreview: { initiator: number; recipient: number };
}

const PARTY = { select: { id: true, clerkUserId: true } } as const;

export async function getTradeDetails(
  db: PrismaClient,
  viewerId: string,
  tradeId: string
): Promise<TradeDetails> {
  const trade = await db.tradeOffer.findUnique({
    where: { id: tradeId },
    include: { initiator: PARTY, recipient: PARTY },
  });
  if (!trade || (trade.initiatorId !== viewerId && trade.recipientId !== viewerId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found." });
  }
  const now = new Date();
  const initiatorIds = copyIdsOf(trade.initiatorCardIds);
  const recipientIds = copyIdsOf(trade.recipientCardIds);
  const ids = [...initiatorIds, ...recipientIds];
  const [faces, signed, values, initiatorFee, recipientFee] = await Promise.all([
    // Both sides show their art, each face marked by the viewer's own copies
    copyFaces(db, viewerId, ids),
    db.cardOwnership.findMany({
      where: { id: { in: ids } },
      select: { id: true, inscription: true },
    }),
    loadCopyValues(db, { ownershipIds: ids }),
    marketplaceFee(db, trade.initiatorCredits),
    marketplaceFee(db, trade.recipientCredits),
  ]);
  const valueOf = new Map(values.map((v) => [v.ownershipId, v.value]));
  const inscriptionOf = new Map(signed.map((row) => [row.id, row.inscription]));
  // A copy that is gone (broken down, fused) has no face and is left out
  const view = (id: string): TradeCopyView[] => {
    const face = faces.get(id);
    if (!face) return [];
    return [
      {
        ownershipId: id,
        face,
        inscription: inscriptionOf.get(id) ?? null,
        value: valueOf.get(id) ?? 0,
      },
    ];
  };
  const initiatorCopies = initiatorIds.flatMap(view);
  const recipientCopies = recipientIds.flatMap(view);
  const worth = (copies: TradeCopyView[], credits: number) =>
    copies.reduce((sum, c) => sum + c.value, 0) + credits;
  return {
    ...trade,
    initiatorCardIdList: initiatorIds,
    recipientCardIdList: recipientIds,
    initiatorCopies,
    recipientCopies,
    initiatorValue: worth(initiatorCopies, trade.initiatorCredits),
    recipientValue: worth(recipientCopies, trade.recipientCredits),
    viewerRole: trade.initiatorId === viewerId ? "initiator" : "recipient",
    myTurn: trade.status === "PENDING" && trade.expiresAt > now && trade.proposerId !== viewerId,
    feePreview: { initiator: initiatorFee, recipient: recipientFee },
  };
}
