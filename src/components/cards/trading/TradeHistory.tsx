"use client";
/**
 * TradeHistory Component
 * Display completed trade history with filtering
 * Phase 3: P2P Trading System
 */

import { Skeleton } from "~/components/ui/skeleton";
import React from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "motion/react";
import {
  CheckCircle,
  XmarkCircle as XCircle,
  Clock,
  ArrowSeparate as ArrowRightLeft,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { format } from "date-fns";

/**
 * TradeHistory component props
 */
export interface TradeHistoryProps {
  /** Optional filter by status */
  filterStatus?: "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED";
  /** Optional callback when trade is clicked */
  onTradeClick?: (tradeId: string) => void;
}

/**
 * TradeHistory - Display completed trades
 *
 * Features:
 * - List of completed/rejected/cancelled trades
 * - Trade status indicators
 * - Trade partner info
 * - Cards exchanged summary
 * - Credits exchanged display
 * - Pagination
 * - Glass styling
 *
 * @example
 * ```tsx
 * <TradeHistory
 *   filterStatus="ACCEPTED"
 *   onTradeClick={(id) => viewTradeDetails(id)}
 * />
 * ```
 */
export const TradeHistory = React.memo<TradeHistoryProps>(({ filterStatus, onTradeClick }) => {
  const { userId } = useAuth();
  const [page, setPage] = React.useState(0);
  const limit = 20;

  // Fetch trade history
  const { data, isLoading } = api.trading.getTradeHistory.useQuery({
    limit,
    offset: page * limit,
  });

  const trades = data?.trades || [];
  const hasMore = data?.hasMore || false;

  // Filter by status if provided
  const filteredTrades = filterStatus
    ? trades.filter((t: any) => t.status === filterStatus)
    : trades;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return {
          icon: CheckCircle,
          label: "Completed",
          color: "text-green",
          bgColor: "bg-green/20",
        };
      case "REJECTED":
        return {
          icon: XCircle,
          label: "Declined",
          color: "text-red",
          bgColor: "bg-red/20",
        };
      case "CANCELLED":
        return {
          icon: XCircle,
          label: "Cancelled",
          color: "text-yellow",
          bgColor: "bg-yellow/20",
        };
      case "EXPIRED":
        return {
          icon: Clock,
          label: "Expired",
          color: "text-label-tertiary",
          bgColor: "bg-fill-4",
        };
      default:
        return {
          icon: Clock,
          label: status,
          color: "text-label-secondary",
          bgColor: "bg-fill-3",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="rounded-row h-28 w-full" />
        ))}
      </div>
    );
  }

  if (filteredTrades.length === 0) {
    return (
      <div className="bg-surface-secondary border-separator rounded-control border p-8 text-center">
        <ArrowRightLeft className="text-label-tertiary mx-auto mb-3 h-12 w-12" />
        <p className="text-label-secondary">No trade history yet</p>
        {filterStatus && (
          <p className="text-body text-label-tertiary mt-1">Try removing filters to see more</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Trade cards */}
      {filteredTrades.map((trade: any) => {
        const statusConfig = getStatusConfig(trade.status);
        const StatusIcon = statusConfig.icon;

        // Determine if current user was initiator or recipient
        const isInitiator = trade.initiator?.clerkUserId === userId;
        const partner = isInitiator ? trade.recipient : trade.initiator;

        return (
          <motion.div
            key={trade.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "bg-surface-secondary border-separator rounded-control cursor-pointer border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
              onTradeClick && "hover:bg-fill-4"
            )}
            onClick={() => onTradeClick?.(trade.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Header */}
                <div className="mb-2 flex items-center gap-3">
                  <div className={cn("rounded-full p-2", statusConfig.bgColor)}>
                    <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-label truncate font-semibold">
                      Trade with {partner.country?.name || "Unknown"}
                    </h4>
                    <p className="text-footnote text-label-secondary">
                      {format(new Date(trade.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "text-footnote rounded-full px-2 py-1 font-medium",
                      statusConfig.bgColor,
                      statusConfig.color
                    )}
                  >
                    {statusConfig.label}
                  </div>
                </div>

                {/* Trade summary */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="bg-fill-3 rounded-control p-2">
                    <p className="text-footnote text-label-secondary mb-1">You offered</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-headline text-blue">
                        {isInitiator
                          ? trade.initiatorCardIds.length
                          : trade.recipientCardIds.length}
                      </span>
                      <span className="text-footnote text-label-tertiary">
                        card{trade.initiatorCardIds.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {((isInitiator && trade.initiatorCredits > 0) ||
                      (!isInitiator && trade.recipientCredits > 0)) && (
                      <p className="text-footnote text-yellow mt-1">
                        +
                        {isInitiator
                          ? trade.initiatorCredits.toLocaleString()
                          : trade.recipientCredits.toLocaleString()}{" "}
                        credits
                      </p>
                    )}
                  </div>

                  <div className="bg-fill-3 rounded-control p-2">
                    <p className="text-footnote text-label-secondary mb-1">You received</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-headline text-green">
                        {isInitiator
                          ? trade.recipientCardIds.length
                          : trade.initiatorCardIds.length}
                      </span>
                      <span className="text-footnote text-label-tertiary">
                        card{trade.recipientCardIds.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {((isInitiator && trade.recipientCredits > 0) ||
                      (!isInitiator && trade.initiatorCredits > 0)) && (
                      <p className="text-footnote text-yellow mt-1">
                        +
                        {isInitiator
                          ? trade.recipientCredits.toLocaleString()
                          : trade.initiatorCredits.toLocaleString()}{" "}
                        credits
                      </p>
                    )}
                  </div>
                </div>

                {/* Trade message preview */}
                {trade.message && (
                  <p className="text-footnote text-label-secondary mt-2 truncate italic">
                    "{trade.message}"
                  </p>
                )}
              </div>

              {/* Arrow indicator */}
              {onTradeClick && (
                <div className="shrink-0">
                  <ChevronRight className="text-label-tertiary h-5 w-5" />
                </div>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between pt-4">
          <Button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            variant="outline"
            className="bg-surface-secondary border-separator border"
          >
            Previous
          </Button>
          <span className="text-body text-label-secondary">Page {page + 1}</span>
          <Button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            variant="outline"
            className="bg-surface-secondary border-separator border"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
});

TradeHistory.displayName = "TradeHistory";
