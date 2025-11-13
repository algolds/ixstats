/**
 * TradeNegotiation Component
 * Active trade negotiation view with accept/decline/counter options
 * Phase 3: P2P Trading System
 */

"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  Coins,
  ArrowRightLeft,
  AlertCircle,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useSoundService } from "~/lib/sound-service";
import { formatDistanceToNow } from "date-fns";

/**
 * TradeNegotiation component props
 */
export interface TradeNegotiationProps {
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
export const TradeNegotiation = React.memo<TradeNegotiationProps>(
  ({ tradeId, isRecipient, onRefresh }) => {
    // Sound service
    const soundService = useSoundService();

    // Fetch trade details
    const { data: trade, isLoading } = api.trading.getTradeById.useQuery({ tradeId });

    // Respond to trade mutation
    const respondToTrade = api.trading.respondToTrade.useMutation({
      onSuccess: (data, variables) => {
        if (variables.action === "ACCEPT") {
          soundService?.play("trade-complete"); // Play trade complete sound
          toast.success("Trade accepted! Cards have been exchanged.");
        } else if (variables.action === "REJECT") {
          toast.success("Trade declined.");
        } else {
          toast.success("Counter-offer sent!");
        }
        onRefresh?.();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to respond to trade");
      },
    });

    // Cancel trade mutation
    const cancelTrade = api.trading.cancelTrade.useMutation({
      onSuccess: () => {
        toast.success("Trade cancelled.");
        onRefresh?.();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to cancel trade");
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
        <div className="glass-hierarchy-child rounded-lg p-8">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        </div>
      );
    }

    if (!trade) {
      return (
        <div className="glass-hierarchy-child rounded-lg p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-400 mb-3" />
          <p className="text-white/80">Trade not found</p>
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
        {/* Header */}
        <div className="glass-hierarchy-child rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-400" />
                Trade with {tradePartner.country?.name || "Unknown"}
              </h3>
              {trade.message && (
                <div className="mt-2 flex items-start gap-2 text-sm text-white/70">
                  <MessageSquare className="h-4 w-4 mt-0.5" />
                  <p>{trade.message}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/60" />
              <span
                className={cn(
                  "text-sm font-medium",
                  isExpired ? "text-red-400" : "text-white/80"
                )}
              >
                {timeRemaining}
              </span>
            </div>
          </div>
        </div>

        {/* Trade display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Your side */}
          <div className="glass-hierarchy-child rounded-lg p-4">
            <h4 className="mb-3 text-base font-semibold text-blue-400">
              You {isRecipient ? "Receive" : "Offer"}
            </h4>

            {/* Cards */}
            <div className="space-y-3 mb-4">
              {yourCards.map((ownership: any) => (
                <div
                  key={ownership.id}
                  className="flex items-center gap-3 glass-hierarchy-interactive rounded-lg p-2"
                >
                  <div className="relative h-16 w-12 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={ownership.cards.artwork || "/images/cards/placeholder-nation.png"}
                      alt={ownership.cards.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">
                      {ownership.cards.title}
                    </p>
                    <p className="text-xs text-white/60">
                      {ownership.cards.rarity} • {ownership.cards.marketValue?.toLocaleString()} credits
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Credits */}
            {yourCredits > 0 && (
              <div className="flex items-center gap-2 mb-3 glass-hierarchy-interactive rounded-lg p-3">
                <Coins className="h-5 w-5 text-amber-400" />
                <span className="font-semibold text-white">
                  +{yourCredits.toLocaleString()} IxCredits
                </span>
              </div>
            )}

            {/* Total value */}
            <div className="pt-3 border-t border-white/10">
              <p className="text-sm text-white/60">Total Value</p>
              <p className="text-xl font-bold text-white">
                {yourValue.toLocaleString()} credits
              </p>
            </div>
          </div>

          {/* Their side */}
          <div className="glass-hierarchy-child rounded-lg p-4">
            <h4 className="mb-3 text-base font-semibold text-green-400">
              They {isRecipient ? "Offer" : "Receive"}
            </h4>

            {/* Cards */}
            <div className="space-y-3 mb-4">
              {theirCards.map((ownership: any) => (
                <div
                  key={ownership.id}
                  className="flex items-center gap-3 glass-hierarchy-interactive rounded-lg p-2"
                >
                  <div className="relative h-16 w-12 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={ownership.cards.artwork || "/images/cards/placeholder-nation.png"}
                      alt={ownership.cards.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">
                      {ownership.cards.title}
                    </p>
                    <p className="text-xs text-white/60">
                      {ownership.cards.rarity} • {ownership.cards.marketValue?.toLocaleString()} credits
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Credits */}
            {theirCredits > 0 && (
              <div className="flex items-center gap-2 mb-3 glass-hierarchy-interactive rounded-lg p-3">
                <Coins className="h-5 w-5 text-amber-400" />
                <span className="font-semibold text-white">
                  +{theirCredits.toLocaleString()} IxCredits
                </span>
              </div>
            )}

            {/* Total value */}
            <div className="pt-3 border-t border-white/10">
              <p className="text-sm text-white/60">Total Value</p>
              <p className="text-xl font-bold text-white">
                {theirValue.toLocaleString()} credits
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {trade.status === "PENDING" && !isExpired && (
          <div className="glass-hierarchy-child rounded-lg p-4">
            {isRecipient ? (
              <div className="flex flex-wrap gap-3 justify-end">
                <Button
                  onClick={() =>
                    respondToTrade.mutate({
                      tradeId,
                      action: "REJECT",
                    })
                  }
                  disabled={respondToTrade.isPending}
                  variant="outline"
                  className="glass-hierarchy-child hover:bg-red-500/20"
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
                  className="glass-hierarchy-interactive"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Counter Offer
                </Button>
                <Button
                  onClick={() =>
                    respondToTrade.mutate({
                      tradeId,
                      action: "ACCEPT",
                    })
                  }
                  disabled={respondToTrade.isPending}
                  className="glass-hierarchy-interactive bg-green-500/20 hover:bg-green-500/30"
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
                  className="glass-hierarchy-child hover:bg-red-500/20"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Trade
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Expired warning */}
        {isExpired && trade.status === "PENDING" && (
          <div className="glass-hierarchy-child rounded-lg p-4 border border-amber-400/30">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              <div>
                <p className="font-medium text-amber-400">Trade Expired</p>
                <p className="text-sm text-white/60">
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
