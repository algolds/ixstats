/**
 * TradeHistory Component
 * Display completed trade history with filtering
 * Phase 3: P2P Trading System
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  ArrowRightLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
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
export const TradeHistory = React.memo<TradeHistoryProps>(
  ({ filterStatus, onTradeClick }) => {
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
            color: "text-green-400",
            bgColor: "bg-green-500/20",
          };
        case "REJECTED":
          return {
            icon: XCircle,
            label: "Declined",
            color: "text-red-400",
            bgColor: "bg-red-500/20",
          };
        case "CANCELLED":
          return {
            icon: XCircle,
            label: "Cancelled",
            color: "text-amber-400",
            bgColor: "bg-amber-500/20",
          };
        case "EXPIRED":
          return {
            icon: Clock,
            label: "Expired",
            color: "text-white/40",
            bgColor: "bg-white/5",
          };
        default:
          return {
            icon: Clock,
            label: status,
            color: "text-white/60",
            bgColor: "bg-white/10",
          };
      }
    };

    if (isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="glass-hierarchy-child rounded-lg p-4 animate-pulse"
            >
              <div className="h-20 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      );
    }

    if (filteredTrades.length === 0) {
      return (
        <div className="glass-hierarchy-child rounded-lg p-8 text-center">
          <ArrowRightLeft className="mx-auto h-12 w-12 text-white/20 mb-3" />
          <p className="text-white/60">No trade history yet</p>
          {filterStatus && (
            <p className="text-sm text-white/40 mt-1">
              Try removing filters to see more
            </p>
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
          // Note: In real implementation, you'd compare with current user ID
          const isInitiator = true; // Placeholder
          const partner = isInitiator ? trade.recipient : trade.initiator;

          return (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "glass-hierarchy-child rounded-lg p-4 cursor-pointer transition-all hover:scale-[1.01]",
                onTradeClick && "hover:bg-white/5"
              )}
              onClick={() => onTradeClick?.(trade.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={cn(
                        "rounded-full p-1.5",
                        statusConfig.bgColor
                      )}
                    >
                      <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white truncate">
                        Trade with {partner.country?.name || "Unknown"}
                      </h4>
                      <p className="text-xs text-white/60">
                        {format(new Date(trade.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        statusConfig.bgColor,
                        statusConfig.color
                      )}
                    >
                      {statusConfig.label}
                    </div>
                  </div>

                  {/* Trade summary */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="glass-hierarchy-interactive rounded-lg p-2">
                      <p className="text-xs text-white/60 mb-1">You Offered</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-blue-400">
                          {isInitiator
                            ? trade.initiatorCardIds.length
                            : trade.recipientCardIds.length}
                        </span>
                        <span className="text-xs text-white/40">
                          card{trade.initiatorCardIds.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {((isInitiator && trade.initiatorCredits > 0) ||
                        (!isInitiator && trade.recipientCredits > 0)) && (
                        <p className="text-xs text-amber-400 mt-1">
                          +
                          {isInitiator
                            ? trade.initiatorCredits.toLocaleString()
                            : trade.recipientCredits.toLocaleString()}{" "}
                          credits
                        </p>
                      )}
                    </div>

                    <div className="glass-hierarchy-interactive rounded-lg p-2">
                      <p className="text-xs text-white/60 mb-1">You Received</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-green-400">
                          {isInitiator
                            ? trade.recipientCardIds.length
                            : trade.initiatorCardIds.length}
                        </span>
                        <span className="text-xs text-white/40">
                          card{trade.recipientCardIds.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {((isInitiator && trade.recipientCredits > 0) ||
                        (!isInitiator && trade.initiatorCredits > 0)) && (
                        <p className="text-xs text-amber-400 mt-1">
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
                    <p className="mt-2 text-xs text-white/50 italic truncate">
                      "{trade.message}"
                    </p>
                  )}
                </div>

                {/* Arrow indicator */}
                {onTradeClick && (
                  <div className="flex-shrink-0">
                    <ChevronRight className="h-5 w-5 text-white/40" />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Pagination */}
        {(page > 0 || hasMore) && (
          <div className="flex justify-between items-center pt-4">
            <Button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              variant="outline"
              className="glass-hierarchy-child"
            >
              Previous
            </Button>
            <span className="text-sm text-white/60">
              Page {page + 1}
            </span>
            <Button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              variant="outline"
              className="glass-hierarchy-child"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    );
  }
);

TradeHistory.displayName = "TradeHistory";
