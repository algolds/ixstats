"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "~/lib/utils";
import { ArrowRightLeft, Plus, History, TrendingUp, Inbox, Send } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";

const TradeOfferModal = dynamic(
  () => import("~/components/cards/trading/TradeOfferModal").then((m) => m.TradeOfferModal),
  { ssr: false }
);
const TradeNegotiation = dynamic(
  () => import("~/components/cards/trading/TradeNegotiation").then((m) => m.TradeNegotiation),
  { ssr: false }
);
const TradeHistory = dynamic(
  () => import("~/components/cards/trading/TradeHistory").then((m) => m.TradeHistory),
  { ssr: false }
);

export function VaultTradingTab() {
  const [createTradeOpen, setCreateTradeOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("active");
  const { userId } = useAuth();

  const {
    data: activeTrades,
    isLoading: activeLoading,
    refetch: refetchActive,
  } = api.trading.getActiveTrades.useQuery();
  const { data: history } = api.trading.getTradeHistory.useQuery({ limit: 10 });

  type ActiveTradeItem = NonNullable<typeof activeTrades>[number];

  const incomingTrades =
    activeTrades?.filter((t: ActiveTradeItem) => t.recipient?.clerkUserId === userId) || [];
  const outgoingTrades =
    activeTrades?.filter((t: ActiveTradeItem) => t.initiator?.clerkUserId === userId) || [];

  const completedTrades = history?.trades.filter((t) => t.status === "ACCEPTED").length || 0;
  const totalTrades = (history?.total || 0) + (activeTrades?.length || 0);
  const successRate = totalTrades > 0 ? ((completedTrades / totalTrades) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4.5 w-4.5 text-blue-500 dark:text-blue-400" />
          <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            P2P Trading Hub
          </h3>
        </div>
        <Button
          onClick={() => setCreateTradeOpen(true)}
          className="border-none bg-gradient-to-r from-blue-600 to-cyan-600 text-xs font-bold text-white hover:from-blue-500 hover:to-cyan-500"
          size="sm"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New Trade
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Active Trades",
            value: activeTrades?.length || 0,
            color: "text-blue-600 dark:text-blue-400",
            icon: ArrowRightLeft,
          },
          {
            label: "Completed",
            value: completedTrades,
            color: "text-green-600 dark:text-green-400",
            icon: History,
          },
          {
            label: "Success Rate",
            value: `${successRate}%`,
            color: "text-amber-600 dark:text-amber-400",
            icon: TrendingUp,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-surface glass-refraction border-border/40 relative flex items-center gap-2.5 overflow-hidden rounded-xl border bg-black/5 p-2.5 shadow-lg backdrop-blur-md dark:bg-black/40"
          >
            <TextureOverlay texture="dots" opacity={0.03} />
            <stat.icon className={cn("relative z-10 h-4 w-4 shrink-0", stat.color)} />
            <div className="relative z-10 min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[8px] font-semibold tracking-wider uppercase">
                {stat.label}
              </p>
              <p
                className={cn(
                  "mt-1 font-mono text-base leading-none font-bold tabular-nums",
                  stat.color
                )}
              >
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Card className="glass-surface border-border/40 bg-black/5 p-4 dark:bg-black/25">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="border-border/50 mb-4 rounded-xl border bg-black/5 p-1 dark:border-white/5 dark:bg-black/40">
            <TabsTrigger
              value="active"
              className="text-muted-foreground data-[state=active]:text-foreground relative px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Active Offer List
              {activeTrades && activeTrades.length > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-500 px-1.5 py-0 text-[8px] leading-none font-bold text-white">
                  {activeTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="incoming"
              className="text-muted-foreground data-[state=active]:text-foreground relative px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              <Inbox className="mr-1.5 h-3.5 w-3.5" /> Incoming Offers
              {incomingTrades.length > 0 && (
                <span className="ml-1.5 rounded-full bg-green-500 px-1.5 py-0 text-[8px] leading-none font-bold text-white">
                  {incomingTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="outgoing"
              className="text-muted-foreground data-[state=active]:text-foreground relative px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> Sent Offers
              {outgoingTrades.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0 text-[8px] leading-none font-bold text-white">
                  {outgoingTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-muted-foreground data-[state=active]:text-foreground relative px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              <History className="mr-1.5 h-3.5 w-3.5" /> Trade History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 outline-none">
            {activeLoading ? (
              <div className="flex items-center justify-center py-10">
                <Skeleton className="h-20 w-full animate-pulse rounded-lg bg-white/5" />
              </div>
            ) : activeTrades && activeTrades.length > 0 ? (
              activeTrades.map((trade: ActiveTradeItem) => (
                <TradeNegotiation
                  key={trade.id}
                  tradeId={trade.id}
                  isRecipient={trade.recipient?.clerkUserId === userId}
                  onRefresh={refetchActive}
                />
              ))
            ) : (
              <div className="border-border/50 flex flex-col items-center justify-center rounded-lg border border-dashed py-10">
                <ArrowRightLeft className="text-muted-foreground/30 mb-3 h-10 w-10" />
                <p className="text-foreground/80 text-xs font-bold">No Active Trades</p>
                <p className="text-muted-foreground mt-0.5 mb-3 text-[10px]">
                  Start trading by creating a new offer
                </p>
                <Button
                  onClick={() => setCreateTradeOpen(true)}
                  size="sm"
                  className="border-none bg-gradient-to-r from-blue-600 to-cyan-600 text-xs font-bold text-white hover:from-blue-500 hover:to-cyan-500"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Trade Offer
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="incoming" className="space-y-3 outline-none">
            {incomingTrades.length > 0 ? (
              incomingTrades.map((trade: ActiveTradeItem) => (
                <TradeNegotiation
                  key={trade.id}
                  tradeId={trade.id}
                  isRecipient={true}
                  onRefresh={refetchActive}
                />
              ))
            ) : (
              <div className="border-border/50 flex flex-col items-center justify-center rounded-lg border border-dashed py-10">
                <Inbox className="text-muted-foreground/30 mb-3 h-10 w-10" />
                <p className="text-foreground/80 text-xs font-bold">No Incoming Trades</p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  You don't have any trade offers to review
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="outgoing" className="space-y-3 outline-none">
            {outgoingTrades.length > 0 ? (
              outgoingTrades.map((trade: ActiveTradeItem) => (
                <TradeNegotiation
                  key={trade.id}
                  tradeId={trade.id}
                  isRecipient={false}
                  onRefresh={refetchActive}
                />
              ))
            ) : (
              <div className="border-border/50 flex flex-col items-center justify-center rounded-lg border border-dashed py-10">
                <Send className="text-muted-foreground/30 mb-3 h-10 w-10" />
                <p className="text-foreground/80 text-xs font-bold">No Outgoing Trades</p>
                <p className="text-muted-foreground mt-0.5 mb-3 text-[10px]">
                  You haven't sent any trade offers yet
                </p>
                <Button
                  onClick={() => setCreateTradeOpen(true)}
                  size="sm"
                  className="border-none bg-gradient-to-r from-blue-600 to-cyan-600 text-xs font-bold text-white hover:from-blue-500 hover:to-cyan-500"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Trade Offer
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="outline-none">
            <TradeHistory />
          </TabsContent>
        </Tabs>
      </Card>

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
