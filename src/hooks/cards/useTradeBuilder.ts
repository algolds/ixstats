"use client";

import { api, type RouterOutputs } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { useDebounce } from "~/hooks/useDebounce";
import type { TradeCopyLike } from "~/lib/cards/trade/builder-state";
import { vaultNotify } from "~/lib/vault/vault-notifications";

export type TradePartnerView = NonNullable<RouterOutputs["trading"]["findPartner"]>;
export type TradeableView = RouterOutputs["trading"]["getTradeables"]["items"][number];
export type TradeDetailsView = RouterOutputs["trading"]["getTradeById"];

/** How long typing settles before a search reads. */
const TYPING_MS = 250;
/** The largest page the tradeables read gives. */
const TRADEABLES_PAGE = 60;

/** Players matching what is typed, once two characters follow any @ (the server's own minimum). */
export function usePartnerSearch(query: string) {
  const typed = useDebounce(query.trim(), TYPING_MS);
  return api.trading.searchPartners.useQuery(
    { query: typed },
    { enabled: typed.replace(/^@/, "").trim().length >= 2 }
  );
}

/** The player a passport handle names, with their trade privacy toward the viewer. */
export function useFindPartner(handle: string | null) {
  return api.trading.findPartner.useQuery({ handle: handle ?? "" }, { enabled: !!handle });
}

/** One side's tradeable copies by title, searched as typed; the last page stays up while a new search loads. */
export function useTradeables(partnerId: string | null, side: "mine" | "theirs", search: string) {
  const typed = useDebounce(search.trim(), TYPING_MS);
  return api.trading.getTradeables.useQuery(
    {
      partnerId: partnerId ?? "",
      side,
      filters: typed ? { search: typed } : {},
      limit: TRADEABLES_PAGE,
    },
    { enabled: !!partnerId, placeholderData: (previous) => previous }
  );
}

export function usePartnerWishlist(partnerId: string | null) {
  return api.trading.getPartnerWishlist.useQuery(
    { partnerId: partnerId ?? "" },
    { enabled: !!partnerId }
  );
}

export function useTradeDetails(tradeId: string | null) {
  return api.trading.getTradeById.useQuery({ tradeId: tradeId ?? "" }, { enabled: !!tradeId });
}

/**
 * The copy a link put on your side ("Offer in a trade" in the card sheet), found in Mine wherever it falls in the
 * tradeables' pages. Undefined until it is read; null when it is not an unlocked, unbound copy of yours.
 */
export function useSeedCopy(ownershipId: string | null): TradeCopyLike | null | undefined {
  const { data } = api.cards.listMine.useQuery(
    { copyId: ownershipId ?? undefined, limit: 1 },
    { enabled: !!ownershipId }
  );
  if (!ownershipId || !data) return undefined;
  const row = data.rows.find((r) => r.face.copy?.ownershipId === ownershipId);
  if (!row || row.isLocked || row.isBound) return null;
  return { ownershipId, face: row.face, inscription: null, value: row.value };
}

/** A failed trade mutation, as the client receives it. */
interface TradeFailure {
  data?: { code: string } | null;
}

/**
 * Send, counter, answer and withdraw. Each reads the card screens again through the one refresh. A failure's message
 * is the sheet's to show; a conflict means the table changed under the player (a copy moved, was burned or signed, or
 * the vaults were busy), so the trade is read again too.
 */
export function useTradeMutations() {
  const refreshCards = useCardsRefresh();
  const onError = (error: TradeFailure) => {
    if (error.data?.code === "CONFLICT") refreshCards();
  };
  const settled = (message: string, title: string) => {
    vaultNotify.success(message, title);
    refreshCards();
  };
  const done = (message: string, title: string) => () => settled(message, title);
  const answered = (trade: { status: string }) =>
    trade.status === "ACCEPTED"
      ? settled("The cards and credits have changed hands.", "Trade accepted")
      : settled("The offer is closed.", "Offer declined");
  return {
    create: api.trading.createtradeOffer.useMutation({
      onSuccess: done("They have 24 hours to answer.", "Offer sent"),
      onError,
    }),
    counter: api.trading.counterTrade.useMutation({
      onSuccess: done("It is their turn to answer.", "Counter-offer sent"),
      onError,
    }),
    respond: api.trading.respondToTrade.useMutation({ onSuccess: answered, onError }),
    cancel: api.trading.cancelTrade.useMutation({
      onSuccess: done("Your cards are free again.", "Offer withdrawn"),
      onError,
    }),
  };
}
