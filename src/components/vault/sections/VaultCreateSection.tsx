"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  Hammer,
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
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { CometCard } from "~/components/ui/comet-card";
import type { CardInstance } from "~/types/cards-display";

const CraftingWorkbench = dynamic(
  () => import("~/components/cards/crafting/CraftingWorkbench").then(m => m.CraftingWorkbench),
  { ssr: false }
);
const RecipeBrowser = dynamic(
  () => import("~/components/cards/crafting/RecipeBrowser").then(m => m.RecipeBrowser),
  { ssr: false }
);
const TradeOfferModal = dynamic(
  () => import("~/components/cards/trading/TradeOfferModal").then(m => m.TradeOfferModal),
  { ssr: false }
);
const TradeNegotiation = dynamic(
  () => import("~/components/cards/trading/TradeNegotiation").then(m => m.TradeNegotiation),
  { ssr: false }
);
const TradeHistory = dynamic(
  () => import("~/components/cards/trading/TradeHistory").then(m => m.TradeHistory),
  { ssr: false }
);

type SubTab = "crafting" | "trading";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Hammer }[] = [
  { id: "crafting", label: "Crafting", icon: Hammer },
  { id: "trading", label: "Trading", icon: ArrowRightLeft },
];

interface VaultCreateSectionProps {
  initialTab?: string | null;
}

// ─── Crafting Tab ────────────────────────────────────────────────

function CraftingTab() {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const { data: inventoryData, refetch: refetchInventory } = api.cards.getMyCards.useQuery({ sortBy: "acquired" });
  const { data: craftingStats } = api.crafting.getCraftingStats.useQuery();
  const { data: historyData } = api.crafting.getCraftingHistory.useQuery({ limit: 10 });

  const availableCards: CardInstance[] = useMemo(
    () =>
      inventoryData?.map((ownership: any) => ({
        id: ownership.id,
        title: ownership.cards.title,
        description: ownership.cards.description || "",
        artwork: ownership.cards.artwork || "/images/cards/placeholder-nation.png",
        artworkVariants: ownership.cards.artworkVariants || null,
        cardType: ownership.cards.cardType,
        rarity: ownership.cards.rarity,
        season: ownership.cards.season,
        nsCardId: ownership.cards.nsCardId || null,
        nsSeason: ownership.cards.nsSeason || null,
        nsData: ownership.cards.nsData || null,
        wikiSource: ownership.cards.wikiSource || null,
        wikiArticleTitle: ownership.cards.wikiArticleTitle || null,
        wikiUrl: ownership.cards.wikiUrl || null,
        countryId: ownership.cards.countryId,
        stats: ownership.cards.stats || {},
        marketValue: ownership.cards.marketValue || 0,
        totalSupply: ownership.cards.totalSupply || 0,
        level: ownership.level || 1,
        evolutionStage: ownership.cards.evolutionStage || 0,
        enhancements: ownership.cards.enhancements || null,
        createdAt: ownership.cards.createdAt,
        updatedAt: ownership.cards.updatedAt,
        lastTrade: ownership.cards.lastTrade || null,
        country: ownership.cards.country,
        owners: [],
      })) || [],
    [inventoryData]
  );

  const history = historyData?.history ?? [];

  const handleCraftComplete = async (result: any) => {
    await refetchInventory();
  };

  return (
    <div className="space-y-8">
      {/* Stats overview */}
      {craftingStats && (
        <CometCard className="p-6" glassDepth="parent">
          <h2 className="text-xl font-black text-foreground mb-4">Crafting Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-black text-purple-400">{craftingStats.totalCrafts}</div>
              <div className="text-muted-foreground text-sm">Total Crafts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-green-400">{craftingStats.successfulCrafts}</div>
              <div className="text-muted-foreground text-sm">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-yellow-400">{craftingStats.successRate.toFixed(1)}%</div>
              <div className="text-muted-foreground text-sm">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-blue-400">{craftingStats.uniqueRecipesCrafted}</div>
              <div className="text-muted-foreground text-sm">Unique Recipes</div>
            </div>
          </div>
        </CometCard>
      )}

      {/* Main crafting interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <RecipeBrowser selectedRecipeId={selectedRecipeId} onRecipeSelect={setSelectedRecipeId} />
        </div>
        <div className="lg:col-span-2">
          <CraftingWorkbench recipeId={selectedRecipeId} availableCards={availableCards} onCraftComplete={handleCraftComplete} />
        </div>
      </div>

      {/* History */}
      <CometCard className="p-6" glassDepth="parent">
        <h2 className="text-xl font-black text-foreground mb-4">Recent Crafting History</h2>
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No crafting history yet. Start crafting to see your results here!
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry: any) => (
              <CometCard key={entry.id} className="p-4" glassDepth="child">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-foreground">{entry.recipe.name}</span>
                      {entry.success ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs font-semibold">Success</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold">Failed</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(entry.craftedAt).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      <span className="text-yellow-400 font-semibold">-{entry.ixCreditsSpent.toLocaleString()}</span> IxCredits
                    </div>
                    {entry.collectorXPGain > 0 && (
                      <div className="text-sm text-muted-foreground">
                        <span className="text-blue-400 font-semibold">+{entry.collectorXPGain}</span> XP
                      </div>
                    )}
                  </div>
                </div>
              </CometCard>
            ))}
          </div>
        )}
      </CometCard>
    </div>
  );
}

// ─── Trading Tab ─────────────────────────────────────────────────

function TradingTab() {
  const [createTradeOpen, setCreateTradeOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("active");
  const { userId } = useAuth();

  const { data: activeTrades, isLoading: activeLoading, refetch: refetchActive } = api.trading.getActiveTrades.useQuery();
  const { data: history } = api.trading.getTradeHistory.useQuery({ limit: 10 });

  const incomingTrades = activeTrades?.filter((t: any) => t.recipientId === userId) || [];
  const outgoingTrades = activeTrades?.filter((t: any) => t.initiatorId === userId) || [];

  const completedTrades = history?.trades.filter((t: any) => t.status === "ACCEPTED").length || 0;
  const totalTrades = (history?.total || 0) + (activeTrades?.length || 0);
  const successRate = totalTrades > 0 ? ((completedTrades / totalTrades) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-foreground flex items-center gap-3">
            <ArrowRightLeft className="h-5 w-5 text-blue-400" />
            Trading Hub
          </h3>
          <p className="text-sm text-muted-foreground">Trade cards directly with other players</p>
        </div>
        <Button onClick={() => setCreateTradeOpen(true)} className="glass-hierarchy-interactive" size="sm">
          <Plus className="mr-2 h-4 w-4" /> New Trade
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-hierarchy-child rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-500/20 p-3"><ArrowRightLeft className="h-5 w-5 text-blue-400" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Active Trades</p>
              <p className="text-2xl font-bold text-foreground">{activeTrades?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="glass-hierarchy-child rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-500/20 p-3"><History className="h-5 w-5 text-green-400" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-foreground">{completedTrades}</p>
            </div>
          </div>
        </div>
        <div className="glass-hierarchy-child rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/20 p-3"><TrendingUp className="h-5 w-5 text-amber-400" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold text-foreground">{successRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-hierarchy-parent rounded-xl p-6">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="glass-hierarchy-child mb-6">
            <TabsTrigger value="active" className="relative px-6 py-3">
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Active
              {activeTrades && activeTrades.length > 0 && (
                <span className="ml-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">{activeTrades.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="incoming" className="relative px-6 py-3">
              <Inbox className="mr-2 h-4 w-4" /> Incoming
              {incomingTrades.length > 0 && <span className="ml-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">{incomingTrades.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="relative px-6 py-3">
              <Send className="mr-2 h-4 w-4" /> Outgoing
              {outgoingTrades.length > 0 && <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">{outgoingTrades.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="history" className="relative px-6 py-3">
              <History className="mr-2 h-4 w-4" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
              </div>
            ) : activeTrades && activeTrades.length > 0 ? (
              activeTrades.map((trade: any) => (
                <TradeNegotiation key={trade.id} tradeId={trade.id} isRecipient={trade.recipientId === userId} onRefresh={refetchActive} />
              ))
            ) : (
              <div className="glass-hierarchy-child rounded-lg p-12 text-center">
                <ArrowRightLeft className="mx-auto h-16 w-16 text-muted-foreground/20 mb-4" />
                <h3 className="text-xl font-semibold text-foreground/80 mb-2">No Active Trades</h3>
                <p className="text-muted-foreground mb-6">Start trading by creating a new offer</p>
                <Button onClick={() => setCreateTradeOpen(true)} className="glass-hierarchy-interactive">
                  <Plus className="mr-2 h-4 w-4" /> Create Trade Offer
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="incoming" className="space-y-4">
            {incomingTrades.length > 0 ? (
              incomingTrades.map((trade: any) => (
                <TradeNegotiation key={trade.id} tradeId={trade.id} isRecipient={true} onRefresh={refetchActive} />
              ))
            ) : (
              <div className="glass-hierarchy-child rounded-lg p-12 text-center">
                <Inbox className="mx-auto h-16 w-16 text-muted-foreground/20 mb-4" />
                <h3 className="text-xl font-semibold text-foreground/80 mb-2">No Incoming Trades</h3>
                <p className="text-muted-foreground">You don't have any trade offers to review</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="outgoing" className="space-y-4">
            {outgoingTrades.length > 0 ? (
              outgoingTrades.map((trade: any) => (
                <TradeNegotiation key={trade.id} tradeId={trade.id} isRecipient={false} onRefresh={refetchActive} />
              ))
            ) : (
              <div className="glass-hierarchy-child rounded-lg p-12 text-center">
                <Send className="mx-auto h-16 w-16 text-muted-foreground/20 mb-4" />
                <h3 className="text-xl font-semibold text-foreground/80 mb-2">No Outgoing Trades</h3>
                <p className="text-muted-foreground mb-6">You haven't sent any trade offers yet</p>
                <Button onClick={() => setCreateTradeOpen(true)} className="glass-hierarchy-interactive">
                  <Plus className="mr-2 h-4 w-4" /> Create Trade Offer
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <TradeHistory />
          </TabsContent>
        </Tabs>
      </div>

      <TradeOfferModal open={createTradeOpen} onClose={() => { setCreateTradeOpen(false); refetchActive(); }} />
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────

function resolveInitialTab(initialTab: string | null | undefined): SubTab {
  if (initialTab === "trading") return "trading";
  return "crafting";
}

export function VaultCreateSection({ initialTab }: VaultCreateSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>(() => resolveInitialTab(initialTab));

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-black/20 p-1 backdrop-blur-sm">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-all",
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "crafting" && <CraftingTab />}
          {activeTab === "trading" && <TradingTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
