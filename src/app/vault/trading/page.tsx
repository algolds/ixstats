/**
 * Trading Hub Page
 * P2P card trading interface
 * Phase 3: Trading System
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  Plus,
  Inbox,
  Send,
  History,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  TradeOfferModal,
  TradeNegotiation,
  TradeHistory,
} from "~/components/cards/trading";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";

/**
 * TradingPage - P2P Trading Hub
 *
 * Features:
 * - Active Offers tab: View all pending trades
 * - Incoming tab: Trades you need to respond to
 * - Outgoing tab: Trades you've initiated
 * - History tab: Completed/cancelled trades
 * - New Trade button
 * - Trading statistics
 */
export default function TradingPage() {
  const [createTradeOpen, setCreateTradeOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("active");
  const { userId } = useAuth();

  // Fetch active trades
  const {
    data: activeTrades,
    isLoading: activeLoading,
    refetch: refetchActive,
  } = api.trading.getActiveTrades.useQuery();

  // Fetch trade history
  const { data: history } = api.trading.getTradeHistory.useQuery({ limit: 10 });

  // Split active trades into incoming/outgoing
  const incomingTrades =
    activeTrades?.filter((t: any) => t.recipientId === userId) || [];
  const outgoingTrades =
    activeTrades?.filter((t: any) => t.initiatorId === userId) || [];

  // Calculate statistics
  const totalTrades = (history?.total || 0) + (activeTrades?.length || 0);
  const completedTrades =
    history?.trades.filter((t: any) => t.status === "ACCEPTED").length || 0;
  const successRate =
    totalTrades > 0 ? ((completedTrades / totalTrades) * 100).toFixed(0) : "0";

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
              <ArrowRightLeft className="h-8 w-8 text-blue-400" />
              Trading Hub
            </h1>
            <p className="mt-2 text-white/60">
              Trade cards directly with other players
            </p>
          </div>
          <Button
            onClick={() => setCreateTradeOpen(true)}
            className="glass-hierarchy-interactive"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Trade
          </Button>
        </motion.div>

        {/* Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div className="glass-hierarchy-child rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-500/20 p-3">
                <ArrowRightLeft className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Active Trades</p>
                <p className="text-2xl font-bold text-white">
                  {activeTrades?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-hierarchy-child rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/20 p-3">
                <History className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Completed</p>
                <p className="text-2xl font-bold text-white">{completedTrades}</p>
              </div>
            </div>
          </div>

          <div className="glass-hierarchy-child rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500/20 p-3">
                <TrendingUp className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Success Rate</p>
                <p className="text-2xl font-bold text-white">{successRate}%</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-hierarchy-parent rounded-xl p-6"
      >
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="glass-hierarchy-child mb-6">
            <TabsTrigger
              value="active"
              className={cn(
                "relative px-6 py-3",
                selectedTab === "active" && "glass-hierarchy-interactive"
              )}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Active
              {activeTrades && activeTrades.length > 0 && (
                <span className="ml-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {activeTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="incoming"
              className={cn(
                "relative px-6 py-3",
                selectedTab === "incoming" && "glass-hierarchy-interactive"
              )}
            >
              <Inbox className="mr-2 h-4 w-4" />
              Incoming
              {incomingTrades.length > 0 && (
                <span className="ml-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {incomingTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="outgoing"
              className={cn(
                "relative px-6 py-3",
                selectedTab === "outgoing" && "glass-hierarchy-interactive"
              )}
            >
              <Send className="mr-2 h-4 w-4" />
              Outgoing
              {outgoingTrades.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {outgoingTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className={cn(
                "relative px-6 py-3",
                selectedTab === "history" && "glass-hierarchy-interactive"
              )}
            >
              <History className="mr-2 h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Active trades */}
          <TabsContent value="active" className="space-y-4">
            {activeLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
              </div>
            ) : activeTrades && activeTrades.length > 0 ? (
              activeTrades.map((trade: any) => (
                <TradeNegotiation
                  key={trade.id}
                  tradeId={trade.id}
                  isRecipient={trade.recipientId === userId}
                  onRefresh={refetchActive}
                />
              ))
            ) : (
              <div className="glass-hierarchy-child rounded-lg p-12 text-center">
                <ArrowRightLeft className="mx-auto h-16 w-16 text-white/20 mb-4" />
                <h3 className="text-xl font-semibold text-white/80 mb-2">
                  No Active Trades
                </h3>
                <p className="text-white/60 mb-6">
                  Start trading by creating a new offer
                </p>
                <Button
                  onClick={() => setCreateTradeOpen(true)}
                  className="glass-hierarchy-interactive"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Trade Offer
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Incoming trades */}
          <TabsContent value="incoming" className="space-y-4">
            {incomingTrades.length > 0 ? (
              incomingTrades.map((trade: any) => (
                <TradeNegotiation
                  key={trade.id}
                  tradeId={trade.id}
                  isRecipient={true}
                  onRefresh={refetchActive}
                />
              ))
            ) : (
              <div className="glass-hierarchy-child rounded-lg p-12 text-center">
                <Inbox className="mx-auto h-16 w-16 text-white/20 mb-4" />
                <h3 className="text-xl font-semibold text-white/80 mb-2">
                  No Incoming Trades
                </h3>
                <p className="text-white/60">
                  You don't have any trade offers to review
                </p>
              </div>
            )}
          </TabsContent>

          {/* Outgoing trades */}
          <TabsContent value="outgoing" className="space-y-4">
            {outgoingTrades.length > 0 ? (
              outgoingTrades.map((trade: any) => (
                <TradeNegotiation
                  key={trade.id}
                  tradeId={trade.id}
                  isRecipient={false}
                  onRefresh={refetchActive}
                />
              ))
            ) : (
              <div className="glass-hierarchy-child rounded-lg p-12 text-center">
                <Send className="mx-auto h-16 w-16 text-white/20 mb-4" />
                <h3 className="text-xl font-semibold text-white/80 mb-2">
                  No Outgoing Trades
                </h3>
                <p className="text-white/60 mb-6">
                  You haven't sent any trade offers yet
                </p>
                <Button
                  onClick={() => setCreateTradeOpen(true)}
                  className="glass-hierarchy-interactive"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Trade Offer
                </Button>
              </div>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <TradeHistory />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Trading tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 glass-hierarchy-child rounded-lg p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm text-white/70">
            <p className="font-semibold text-white">Trading Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Trade offers expire after 24 hours</li>
              <li>You can add IxCredits to sweeten the deal</li>
              <li>Fair trades (within 20% value) are more likely to be accepted</li>
              <li>Counter-offers create a new trade with reversed roles</li>
              <li>All trades are atomic - both sides succeed or fail together</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Create Trade Modal */}
      <TradeOfferModal
        open={createTradeOpen}
        onClose={() => {
          setCreateTradeOpen(false);
          refetchActive();
        }}
      />
    </div>
  );
}
