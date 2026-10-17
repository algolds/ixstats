"use client";
/**
 * TradeNegotiation Component
 * Active trade negotiation view with accept/decline/counter options
 * Phase 3: P2P Trading System
 */

import React, { useMemo } from "react";
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
import { CardFace } from "~/components/cards/face/CardFace";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";

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
  /** Opens a card's sheet, with the place that shows its art. */
  onOpenCard?: (cardId: string, from?: SheetFrom | null) => void;
}

interface SideFacts {
  faces: readonly CardFaceData[];
  credits: number;
  value: number;
}

interface TradeTotals {
  initiatorFaces: readonly CardFaceData[];
  recipientFaces: readonly CardFaceData[];
  initiatorCredits: number;
  recipientCredits: number;
  initiatorValue: number;
  recipientValue: number;
}

/** The trade from the player's side: what they give and what they get. */
function sidesOf(trade: TradeTotals, isRecipient: boolean): { give: SideFacts; get: SideFacts } {
  const initiator = {
    faces: trade.initiatorFaces,
    credits: trade.initiatorCredits,
    value: trade.initiatorValue,
  };
  const recipient = {
    faces: trade.recipientFaces,
    credits: trade.recipientCredits,
    value: trade.recipientValue,
  };
  return isRecipient ? { give: recipient, get: initiator } : { give: initiator, get: recipient };
}

/**
 * Where each side's cards open their sheet. A live offer shows all its art to its recipient (the offer context);
 * otherwise the partner's copies open as theirs (the holder context, by their passport handle), and the player's
 * own need no context.
 */
function sheetContexts(
  tradeId: string,
  liveOfferToViewer: boolean,
  partnerHandle: string
): { give: SheetFrom | null; get: SheetFrom | null } {
  if (liveOfferToViewer) {
    const offer: SheetFrom = { kind: "offer", id: tradeId };
    return { give: offer, get: offer };
  }
  return { give: null, get: { kind: "holder", handle: partnerHandle } };
}

/** One side of a trade: its cards, any credits, and the total value. */
function TradeSide({
  title,
  faces,
  credits,
  value,
  onOpen,
}: SideFacts & { title: string; onOpen: (face: CardFaceData) => void }) {
  const headingId = React.useId();
  return (
    <section
      aria-labelledby={headingId}
      className="bg-surface-secondary border-separator rounded-control border p-4"
    >
      <h4 id={headingId} className="text-headline mb-3">
        {title}
      </h4>

      {faces.length > 0 && (
        <ul className="mb-4 grid grid-cols-3 gap-2">
          {faces.map((face) => (
            <li key={face.copy?.ownershipId ?? face.cardId}>
              <CardFace face={face} size="S" className="w-full" onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}

      {/* Credits */}
      {credits > 0 && (
        <div className="bg-fill-3 rounded-control mb-3 flex items-center gap-2 p-3">
          <Coins aria-hidden className="text-yellow h-5 w-5" />
          <span className="text-label font-semibold tabular-nums">
            +{credits.toLocaleString()} IxC
          </span>
        </div>
      )}

      {/* Total value */}
      <div className="border-separator border-t pt-3">
        <p className="text-body text-label-secondary">Total value</p>
        <p className="text-title-2 text-label tabular-nums">{value.toLocaleString()} IxC</p>
      </div>
    </section>
  );
}

/**
 * TradeNegotiation - Active trade view with actions
 *
 * Features:
 * - Split view: what you give | what you get
 * - Card faces for both sides, each opening its sheet
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
 *   onOpenCard={sheet.open}
 * />
 * ```
 */
export const TradeNegotiation = React.memo<TradeNegotiationProps>(
  ({ tradeId, isRecipient, onRefresh, onOpenCard }) => {
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

    const partner = isRecipient ? trade.initiator : trade.recipient;
    const live = trade.status === "PENDING" && !isExpired;
    const sides = sidesOf(trade, isRecipient);
    // A partner with no stored handle is named by their Clerk id, the passport handle the holder context resolves.
    const contexts = sheetContexts(
      tradeId,
      isRecipient && live,
      partner.handle ?? partner.clerkUserId
    );
    const open = (from: SheetFrom | null) => (face: CardFaceData) =>
      onOpenCard?.(face.cardId, from);

    return (
      <div className="space-y-4">
        <div className="bg-surface-secondary border-separator rounded-control border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-title-3 text-label flex items-center gap-2 font-semibold">
                <ArrowRightLeft aria-hidden className="text-blue h-5 w-5" />
                Trade with {partner.handle ? `@${partner.handle}` : "a player"}
              </h3>
              {trade.message && (
                <div className="text-body text-label-secondary mt-2 flex items-start gap-2">
                  <MessageSquare aria-hidden className="mt-0.5 h-4 w-4" />
                  <p>{trade.message}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock aria-hidden className="text-label-secondary h-4 w-4" />
              <span className={cn("text-body font-medium", isExpired ? "text-red" : "text-label")}>
                {timeRemaining}
              </span>
            </div>
          </div>
        </div>

        {/* Trade display */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TradeSide title="You give" {...sides.give} onOpen={open(contexts.give)} />
          <TradeSide title="You get" {...sides.get} onOpen={open(contexts.get)} />
        </div>

        {/* Actions */}
        {live && (
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
                  {respondToTrade.isPending ? "Processing..." : "Accept trade"}
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
