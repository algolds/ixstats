"use client";
/**
 * TradeNegotiation Component
 * Active trade negotiation view with accept/decline/counter options
 * Phase 3: P2P Trading System
 */

import React, { useMemo } from "react";
import Image from "next/image";
import {
  CheckCircle,
  XmarkCircle as XCircle,
  ChatBubble as MessageSquare,
  Clock,
  Coins,
  ArrowSeparate as ArrowRightLeft,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { formatDistanceToNow } from "date-fns";
import { CardHolographicCover } from "../display/CardHolographicCover";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";

/**
 * TradeNegotiation component props
 */
interface TradeNegotiationProps {
  /** Trade offer ID */
  tradeId: string;
  /** Is current user the recipient? */
  isRecipient: boolean;
  /** Refresh callback after action */
  onRefresh?: () => void;
}

/**
 * TradeNegotiation - Active trade view with actions
 *
 * Features:
 * - Split view: Your side | Their side
 * - Card displays for both sides
 * - Credits display
 * - Trade status and expiration
 * - Accept/Decline/Counter buttons
 * - Trade message display
 * - Glass styling
 *
 * @example
 * ```tsx
 * <TradeNegotiation
 *   tradeId="trade_123"
 *   isRecipient={true}
 *   onRefresh={() => refetch()}
 * />
 * ```
 */
/** One side of a trade: its cards, any credits, and the total value. */
function TradeSideCard({
  title,
  titleClassName,
  cards,
  credits,
  value,
}: {
  title: string;
  titleClassName: string;
  cards: any[];
  credits: number;
  value: number;
}) {
  return (
    <div className="bg-surface-secondary border-separator rounded-control border p-4">
      <h4 className={cn("text-headline mb-3", titleClassName)}>{title}</h4>

      {/* Cards */}
      <div className="mb-4 space-y-3">
        {cards.map((ownership: any) => (
          <div key={ownership.id} className="bg-fill-3 rounded-control flex items-center gap-3 p-2">
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
              <CardHolographicCover
                cardType={ownership.cards.cardType || "NATION"}
                rarity={ownership.cards.rarity || "COMMON"}
                title={ownership.cards.title}
              />
              <Image
                src={ownership.cards.artwork || CARD_ARTWORK_PLACEHOLDER}
                alt={ownership.cards.title}
                fill
                className="object-cover"
                unoptimized
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body text-label truncate font-medium">{ownership.cards.title}</p>
              <p className="text-footnote text-label-secondary">
                {ownership.cards.rarity} • {ownership.cards.marketValue?.toLocaleString()} credits
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Credits */}
      {credits > 0 && (
        <div className="bg-fill-3 rounded-control mb-3 flex items-center gap-2 p-3">
          <Coins className="text-yellow h-5 w-5" />
          <span className="text-label font-semibold">+{credits.toLocaleString()} IxCredits</span>
        </div>
      )}

      {/* Total value */}
      <div className="border-separator border-t pt-3">
        <p className="text-body text-label-secondary">Total value</p>
        <p className="text-title-2 text-label">{value.toLocaleString()} credits</p>
      </div>
    </div>
  );
}

export const TradeNegotiation = React.memo<TradeNegotiationProps>(
  ({ tradeId, isRecipient, onRefresh }) => {
    // Fetch trade details
    const { data: trade, isLoading } = api.trading.getTradeById.useQuery({ tradeId });

    // Respond to trade mutation
    const respondToTrade = api.trading.respondToTrade.useMutation({
      onSuccess: (data, variables) => {
        if (variables.action === "ACCEPT") {
          vaultNotify.tradeCompleted("Trade accepted. Cards exchanged.");
        } else if (variables.action === "REJECT") {
          vaultNotify.tradeCompleted("Trade declined.");
        } else {
          vaultNotify.tradeCompleted("Counter-offer sent");
        }
        onRefresh?.();
      },
      onError: (error) => {
        vaultNotify.error(error.message || "Failed to respond to trade");
      },
    });

    // Cancel trade mutation
    const cancelTrade = api.trading.cancelTrade.useMutation({
      onSuccess: () => {
        vaultNotify.tradeCompleted("Trade cancelled.");
        onRefresh?.();
      },
      onError: (error) => {
        vaultNotify.error(error.message || "Failed to cancel trade");
      },
    });

    // Calculate time remaining
    const timeRemaining = useMemo(() => {
      if (!trade) return "";
      const now = new Date();
      const expires = new Date(trade.expiresAt);
      if (expires < now) return "Expired";
      return formatDistanceToNow(expires, { addSuffix: true });
    }, [trade]);

    // Check if expired
    const isExpired = useMemo(() => {
      if (!trade) return false;
      return new Date() > new Date(trade.expiresAt);
    }, [trade]);

    if (isLoading) {
      return (
        <div className="bg-surface-secondary border-separator rounded-control border p-8">
          <div className="flex items-center justify-center">
            <div className="border-separator border-t-separator h-8 w-8 animate-spin rounded-full border-4" />
          </div>
        </div>
      );
    }

    if (!trade) {
      return (
        <div className="bg-surface-secondary border-separator rounded-control border p-8 text-center">
          <AlertCircle className="text-yellow mx-auto mb-3 h-12 w-12" />
          <p className="text-label">Trade not found</p>
        </div>
      );
    }

    const initiatorCards = trade.initiatorCardsData || [];
    const recipientCards = trade.recipientCardsData || [];

    const yourCards = isRecipient ? recipientCards : initiatorCards;
    const theirCards = isRecipient ? initiatorCards : recipientCards;
    const yourCredits = isRecipient ? trade.recipientCredits : trade.initiatorCredits;
    const theirCredits = isRecipient ? trade.initiatorCredits : trade.recipientCredits;

    const yourValue = isRecipient ? trade.recipientValue : trade.initiatorValue;
    const theirValue = isRecipient ? trade.initiatorValue : trade.recipientValue;

    const tradePartner = isRecipient ? trade.initiator : trade.recipient;

    return (
      <div className="space-y-4">
        <div className="bg-surface-secondary border-separator rounded-control border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-title-3 text-label flex items-center gap-2 font-semibold">
                <ArrowRightLeft className="text-blue h-5 w-5" />
                Trade with {tradePartner.country?.name || "Unknown"}
              </h3>
              {trade.message && (
                <div className="text-body text-label-secondary mt-2 flex items-start gap-2">
                  <MessageSquare className="mt-0.5 h-4 w-4" />
                  <p>{trade.message}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-label-secondary h-4 w-4" />
              <span className={cn("text-body font-medium", isExpired ? "text-red" : "text-label")}>
                {timeRemaining}
              </span>
            </div>
          </div>
        </div>

        {/* Trade display */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TradeSideCard
            title={`You ${isRecipient ? "Receive" : "Offer"}`}
            titleClassName="text-blue"
            cards={yourCards}
            credits={yourCredits}
            value={yourValue}
          />
          <TradeSideCard
            title={`They ${isRecipient ? "Offer" : "Receive"}`}
            titleClassName="text-green"
            cards={theirCards}
            credits={theirCredits}
            value={theirValue}
          />
        </div>

        {/* Actions */}
        {trade.status === "PENDING" && !isExpired && (
          <div className="bg-surface-secondary border-separator rounded-control border p-4">
            {isRecipient ? (
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  onClick={() =>
                    respondToTrade.mutate({
                      tradeId,
                      action: "REJECT",
                    })
                  }
                  disabled={respondToTrade.isPending}
                  variant="outline"
                  className="bg-surface-secondary border-separator hover:bg-red/20 border"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Decline
                </Button>
                <Button
                  onClick={() =>
                    respondToTrade.mutate({
                      tradeId,
                      action: "COUNTER",
                      // Could add counter-offer logic here
                    })
                  }
                  disabled={respondToTrade.isPending}
                  variant="outline"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Counter offer
                </Button>
                <Button
                  onClick={() =>
                    respondToTrade.mutate({
                      tradeId,
                      action: "ACCEPT",
                    })
                  }
                  disabled={respondToTrade.isPending}
                  className="bg-green/20 hover:bg-green/30"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {respondToTrade.isPending ? "Processing..." : "Accept Trade"}
                </Button>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  onClick={() => cancelTrade.mutate({ tradeId })}
                  disabled={cancelTrade.isPending}
                  variant="outline"
                  className="bg-surface-secondary border-separator hover:bg-red/20 border"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel trade
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Expired warning */}
        {isExpired && trade.status === "PENDING" && (
          <div className="bg-surface-secondary border-separator rounded-control border-yellow/30 border p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-yellow h-5 w-5" />
              <div>
                <p className="text-yellow font-medium">Trade expired</p>
                <p className="text-body text-label-secondary">
                  This trade offer has expired and can no longer be accepted
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

TradeNegotiation.displayName = "TradeNegotiation";
