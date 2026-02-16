"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  Package,
  Gift,
  Sparkles,
  ShoppingCart,
  Zap,
  Star,
  Info,
  Percent,
  Clock,
  Flame,
  Filter,
  ChevronDown,
  Heart,
  Gavel,
  Search,
  X,
  Store,
  Box,
  BadgeDollarSign,
  Timer,
  ArrowRight,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { TiltCard } from "~/components/vault/3DTiltCard";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { useSoundService } from "~/lib/sound-service";

const PackOpeningSequence = dynamic(
  () => import("~/components/cards/pack-opening/PackOpeningSequence").then(m => m.PackOpeningSequence),
  { ssr: false }
);

type SubTab = "packs" | "market";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Package }[] = [
  { id: "packs", label: "Card Packs", icon: Package },
  { id: "market", label: "Market", icon: ShoppingCart },
];

interface VaultAcquireSectionProps {
  initialTab?: string | null;
}

// ─── Pack config helper ──────────────────────────────────────────

const getPackConfig = (packType: string) => {
  const type = packType.toUpperCase();
  if (type.includes("BASIC") || type.includes("STARTER"))
    return { color: "text-blue-400", borderColor: "border-blue-400/50", glowColor: "shadow-blue-500/40", icon: Package, label: "Basic", tier: 1 };
  if (type.includes("ELITE") || type.includes("LEGENDARY"))
    return { color: "text-purple-400", borderColor: "border-purple-400/50", glowColor: "shadow-purple-500/40", icon: Star, label: "Elite", tier: 3 };
  if (type.includes("PREMIUM") || type.includes("GOLD"))
    return { color: "text-amber-400", borderColor: "border-amber-400/50", glowColor: "shadow-amber-500/40", icon: Sparkles, label: "Premium", tier: 2 };
  if (type.includes("EVENT") || type.includes("LIMITED"))
    return { color: "text-red-400", borderColor: "border-red-400/50", glowColor: "shadow-red-500/40", icon: Zap, label: "Event", tier: 4 };
  return { color: "text-cyan-400", borderColor: "border-cyan-400/50", glowColor: "shadow-cyan-500/40", icon: Gift, label: "Special", tier: 2 };
};

// ─── Packs Tab ───────────────────────────────────────────────────

function PacksTab() {
  const [openingPackId, setOpeningPackId] = useState<string | null>(null);
  const soundService = useSoundService();

  const { data: availablePacks, isLoading: packsLoading } = api.vault.getAvailablePacks.useQuery();
  const { data: myPacks, isLoading: myPacksLoading, refetch: refetchMyPacks } = api.vault.getMyPacks.useQuery();

  const purchasePack = api.vault.purchasePack.useMutation({
    onSuccess: (data) => {
      toast.success(`Pack purchased! Opening...`);
      void refetchMyPacks();
      soundService?.play("pack-open");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      {/* My Packs */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <Package className="h-5 w-5 text-blue-400" />
          My Packs
        </h3>
        {myPacksLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        ) : !myPacks || myPacks.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="font-bold text-foreground/80 mb-1">No Packs</p>
              <p className="text-sm text-muted-foreground">Purchase packs from the store below</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {myPacks.map((pack: any) => {
              const config = getPackConfig(pack.packType);
              const Icon = config.icon;
              return (
                <TiltCard key={pack.id} glowColor={config.color.includes("blue") ? "cyan" : config.color.includes("purple") ? "purple" : "gold"} className="cursor-pointer">
                  <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={cn("rounded-full bg-black/40 p-3 ring-2", config.borderColor)}>
                        <Icon className={cn("h-6 w-6", config.color)} />
                      </div>
                      <Badge variant="outline" className={config.color}>{config.label}</Badge>
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{pack.name || config.label + " Pack"}</h4>
                      <p className="text-sm text-white/60">{pack.cardsCount || 5} cards</p>
                    </div>
                    <Button
                      onClick={() => setOpeningPackId(pack.id)}
                      className="w-full glass-hierarchy-interactive"
                      size="sm"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Open Pack
                    </Button>
                  </div>
                </TiltCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Packs Store */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <Store className="h-5 w-5 text-amber-400" />
          Pack Store
        </h3>
        {packsLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        ) : !availablePacks || availablePacks.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Store className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="font-bold text-foreground/80 mb-1">No Packs Available</p>
              <p className="text-sm text-muted-foreground">Check back soon for new packs!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {availablePacks.map((pack: any) => {
              const config = getPackConfig(pack.packType);
              const Icon = config.icon;
              return (
                <TiltCard key={pack.id} glowColor="gold" className="cursor-pointer">
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={cn("rounded-full bg-black/40 p-3 ring-2", config.borderColor)}>
                        <Icon className={cn("h-6 w-6", config.color)} />
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-amber-400">{pack.price?.toLocaleString() ?? "?"} IxC</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">{pack.name}</h4>
                      <p className="text-sm text-white/60">{pack.description || `${pack.cardsPerPack || 5} cards per pack`}</p>
                    </div>
                    <Button
                      onClick={() => purchasePack.mutate({ packTypeId: pack.id })}
                      disabled={purchasePack.isPending}
                      className="w-full glass-hierarchy-interactive"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" /> Purchase
                    </Button>
                  </div>
                </TiltCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Pack opening overlay */}
      {openingPackId && (
        <PackOpeningSequence
          packId={openingPackId}
          onClose={() => {
            setOpeningPackId(null);
            void refetchMyPacks();
          }}
        />
      )}
    </div>
  );
}

// ─── Market Tab ──────────────────────────────────────────────────

function MarketTab() {
  return (
    <div className="space-y-6">
      <Card className="glass-hierarchy-child">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <ShoppingCart className="mb-4 h-16 w-16 text-muted-foreground/40" />
          <p className="text-xl font-bold text-foreground/80 mb-2">Marketplace</p>
          <p className="text-muted-foreground text-center max-w-md">
            Browse live auctions, buy singles, and list your cards for sale.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline">
              <Gavel className="mr-2 h-4 w-4" /> Live Auctions
            </Button>
            <Button variant="outline">
              <Store className="mr-2 h-4 w-4" /> Browse Cards
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────

function resolveInitialTab(initialTab: string | null | undefined): SubTab {
  if (initialTab === "market") return "market";
  return "packs";
}

export function VaultAcquireSection({ initialTab }: VaultAcquireSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>(() => resolveInitialTab(initialTab));

  return (
    <div className="space-y-6">
      {/* Tab strip */}
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
                  ? "bg-blue-500/20 text-blue-400 shadow-sm"
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
          {activeTab === "packs" && <PacksTab />}
          {activeTab === "market" && <MarketTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
