"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "~/lib/utils";
import {
  ArrowSeparate as ArrowRightLeft,
  Plus,
  ClockRotateRight as History,
  StatUp as TrendingUp,
  MailIn as Inbox,
  Send,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { Card } from "~/components/ui/card";

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="text-blue h-4.5 w-4.5" />
          <h3 className="text-label-secondary text-eyebrow">P2P Trading Hub</h3>
        </div>
        <Button onClick={() => setCreateTradeOpen(true)} size="sm">
          <Plus className="mr-2 h-3.5 w-3.5" /> New Trade
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Active trades",
            value: activeTrades?.length || 0,
            color: "text-blue",
            icon: ArrowRightLeft,
          },
          {
            label: "Completed",
            value: completedTrades,
            color: "text-green",
            icon: History,
          },
          {
            label: "Success rate",
            value: `${successRate}%`,
            color: "text-yellow",
            icon: TrendingUp,
          },
        ].map((stat) => (
          <Card key={stat.label} padding="sm" className="flex items-center gap-3">
            <stat.icon className={cn("size-4 shrink-0", stat.color)} aria-hidden />
            <Stat size="sm" label={stat.label} value={stat.value} className="min-w-0 flex-1" />
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Card padding="md">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="active" className="relative">
              <ArrowRightLeft className="mr-2 h-3.5 w-3.5" /> Active Offer List
              {activeTrades && activeTrades.length > 0 && (
                <span className="bg-blue text-footnote text-on-blue ml-2 rounded-full px-2 py-0 leading-none font-semibold">
                  {activeTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="incoming" className="relative">
              <Inbox className="mr-2 h-3.5 w-3.5" /> Incoming Offers
              {incomingTrades.length > 0 && (
                <span className="bg-green text-footnote text-on-green ml-2 rounded-full px-2 py-0 leading-none font-semibold">
                  {incomingTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="relative">
              <Send className="mr-2 h-3.5 w-3.5" /> Sent Offers
              {outgoingTrades.length > 0 && (
                <span className="bg-tint text-caption text-on-tint ml-2 rounded-full px-2 leading-4 tabular-nums">
                  {outgoingTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="relative">
              <History className="mr-2 h-3.5 w-3.5" /> Trade History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 outline-none">
            {activeLoading ? (
              <div className="flex items-center justify-center py-10">
                <Skeleton className="rounded-control bg-fill-4 h-20 w-full" />
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
              <div className="border-separator rounded-control flex flex-col items-center justify-center border border-dashed py-10">
                <ArrowRightLeft className="text-label-tertiary mb-3 h-10 w-10" />
                <p className="text-label text-footnote font-semibold">No active trades</p>
                <p className="text-label-secondary text-footnote mt-0.5 mb-3">
                  Start trading by creating a new offer
                </p>
                <Button onClick={() => setCreateTradeOpen(true)} size="sm">
                  <Plus className="mr-2 h-3.5 w-3.5" /> Create Trade Offer
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
              <div className="border-separator rounded-control flex flex-col items-center justify-center border border-dashed py-10">
                <Inbox className="text-label-tertiary mb-3 h-10 w-10" />
                <p className="text-label text-footnote font-semibold">No incoming trades</p>
                <p className="text-label-secondary text-footnote mt-0.5">
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
              <div className="border-separator rounded-control flex flex-col items-center justify-center border border-dashed py-10">
                <Send className="text-label-tertiary mb-3 h-10 w-10" />
                <p className="text-label text-footnote font-semibold">No outgoing trades</p>
                <p className="text-label-secondary text-footnote mt-0.5 mb-3">
                  You haven't sent any trade offers yet
                </p>
                <Button onClick={() => setCreateTradeOpen(true)} size="sm">
                  <Plus className="mr-2 h-3.5 w-3.5" /> Create Trade Offer
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
