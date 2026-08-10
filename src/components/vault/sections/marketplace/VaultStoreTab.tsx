"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  Package,
  Sparkles,
  Star,
  Gift,
  Store,
  Crown,
  Cpu,
  BookOpen,
  Database,
  TrendingUp,
  Award,
  Flame,
  Shield,
  Zap,
  Coins,
  Heart,
  Palette,
  Wrench,
  Gauge,
  Lock,
  Compass,
  Trophy,
  Gem,
  Sword,
  Target,
  Flag,
  Ghost,
  Skull,
  Key,
  Lightbulb,
  Terminal,
  Music,
  Ticket,
  Gamepad2,
  Anchor,
  Sun,
  Moon,
  Hammer,
  Eye,
  User,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { StoreItemCard, type StoreItem } from "./StoreItemCard";
import { useNotify } from "~/hooks/useNotify";
import { PackHolographicCard, type PackItem } from "./store/PackHolographicCard";
import { StoreCategoryHeader } from "./store/StoreCategoryHeader";
import { StorePurchaseDialog } from "./store/StorePurchaseDialog";
import { VaultParticleExplosionModal } from "~/components/vault/VaultParticleExplosionModal";

const PackOpeningSequence = dynamic(
  () =>
    import("~/components/cards/pack-opening/PackOpeningSequence").then(
      (m) => m.PackOpeningSequence
    ),
  { ssr: false }
);

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Cpu,
  Crown,
  BookOpen,
  Database,
  TrendingUp,
  Award,
  Flame,
  Shield,
  Zap,
  Coins,
  Heart,
  Palette,
  Wrench,
  Gauge,
  Lock,
  Compass,
  Trophy,
  Gem,
  Sword,
  Target,
  Flag,
  Ghost,
  Skull,
  Key,
  Lightbulb,
  Terminal,
  Music,
  Ticket,
  Gamepad2,
  Anchor,
  Sun,
  Moon,
  Hammer,
  Eye,
  User,
};

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

const STORE_TABS = [
  { id: "my-packs" as const, label: "My Packs", icon: Package },
  { id: "boosters" as const, label: "Marketplace", icon: Store },
  { id: "cosmetics" as const, label: "Cosmetics", icon: Sparkles },
  { id: "upgrades" as const, label: "Account Upgrades", icon: TrendingUp },
];

export function VaultStoreTab() {
  const notify = useNotify();

  const [storeTab, setStoreTab] = useState<"my-packs" | "boosters" | "cosmetics" | "upgrades">(
    "boosters"
  );
  const [openingPack, setOpeningPack] = useState<{ id: string; packType: string } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activeCheckoutItem, setActiveCheckoutItem] = useState<StoreItem | null>(null);
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data: myPacksData, isLoading: myPacksLoading, refetch: refetchMyPacks } =
    api.cardPacks.getMyPacks.useQuery();
  const { data: packsData, isLoading: packsLoading } = api.cardPacks.getAvailablePacks.useQuery();
  const { data: storeItemsData, isLoading: itemsLoading } = api.vault.listStoreItems.useQuery();
  const { data: ownedData } = api.vault.getPurchasedItems.useQuery();

  const purchasePackMutation = api.cardPacks.purchasePack.useMutation({
    onSuccess: (data: any) => {
      notify.success("Card pack purchased successfully!");
      void utils.vault.getBalance.invalidate();
      void utils.cardPacks.getMyPacks.invalidate();
      const userPackId = data.userPack?.id || data.userPackId;
      const packType = data.userPack?.pack?.packType || data.userPack?.packType || data.packType;
      if (userPackId && packType) {
        setOpeningPack({
          id: userPackId,
          packType,
        });
      }
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to purchase card pack.");
    },
  });

  const spendCreditsMutation = api.vault.spendCredits.useMutation({
    onSuccess: () => {
      notify.success("Item unlocked successfully!");
      void utils.vault.getBalance.invalidate();
      void utils.vault.getPurchasedItems.invalidate();
      setActiveCheckoutItem(null);
      setPurchasingItemId(null);
      setShowCelebration(true);

      setTimeout(() => {
        setShowCelebration(false);
      }, 3500);
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to complete transaction.");
      setPurchasingItemId(null);
    },
  });

  const packs: any[] = (packsData as any)?.packs || (Array.isArray(packsData) ? packsData : []);
  const myPacks: any[] = (myPacksData as any)?.packs || (Array.isArray(myPacksData) ? myPacksData : []);

  const cosmeticItems: StoreItem[] = ((storeItemsData || []) as any[])
    .filter((item) => item.category === "cosmetics")
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      icon: ICON_MAP[item.icon] || Sparkles,
      glowColor: item.glowColor || "rgba(168,85,247,0.35)",
      quality: item.quality || "standard",
      badgeText: item.badgeText || "Cosmetic",
      category: item.category,
    }));

  const upgradeItems: StoreItem[] = ((storeItemsData || []) as any[])
    .filter((item) => item.category === "upgrades")
    .filter((item) => {
      if (item.id === "upgrade_card_capacity_mega") {
        const purchaseCounts = (ownedData as { purchaseCounts?: Record<string, number> } | undefined)?.purchaseCounts;
        const standardCount = purchaseCounts?.["upgrade_card_capacity"] || 0;
        return standardCount >= 5;
      }
      return true;
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      icon: ICON_MAP[item.icon] || Sparkles,
      glowColor: item.glowColor || "rgba(245,158,11,0.35)",
      quality: item.quality || "standard",
      badgeText: item.badgeText || "Custom",
      category: item.category,
    }));

  const handleCustomPurchaseConfirm = () => {
    if (!activeCheckoutItem) return;
    setPurchasingItemId(activeCheckoutItem.id);
    spendCreditsMutation.mutate({
      amount: activeCheckoutItem.price,
      type: "SPEND_COSMETIC",
      source: `Purchase item: ${activeCheckoutItem.name}`,
      metadata: { itemId: activeCheckoutItem.id },
    });
  };

  const isLoading =
    storeTab === "my-packs"
      ? myPacksLoading
      : storeTab === "boosters"
        ? packsLoading
        : itemsLoading;

  const activeConfig = {
    "my-packs": {
      title: "My Unopened Packs",
      icon: <Package className="h-4 w-4 text-blue-500" />,
      description: "Packs you own that are ready to rip open. Reveal rare and legendary cards!",
      badgeStyle: "border-blue-500/20 text-blue-500 dark:text-blue-400 bg-blue-500/5",
      statusText: "Inventory",
    },
    boosters: {
      title: "Booster Packs",
      icon: <Store className="h-4 w-4 text-amber-500" />,
      description: "Purchase new card packs to expand your collection.",
      badgeStyle: "border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/5",
      statusText: "Marketplace",
    },
    cosmetics: {
      title: "Profile Customizations",
      icon: <Sparkles className="h-4 w-4 text-purple-500" />,
      description:
        "Exclusive decorations, neon frames, and elite name tags to customize your profile presence.",
      badgeStyle: "border-purple-500/20 text-purple-600 dark:text-purple-400 bg-purple-500/5",
      statusText: "Cosmetics",
    },
    upgrades: {
      title: "Vault System Upgrades",
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
      description:
        "Permanent collection expansion, passive credit yield buffs, and wiki lore submission tokens.",
      badgeStyle: "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5",
      statusText: "Account Upgrades",
    },
  }[storeTab];

  const tabColors = {
    "my-packs": {
      text: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20",
      icon: "text-blue-500",
    },
    boosters: {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20",
      icon: "text-amber-500",
    },
    cosmetics: {
      text: "text-purple-650 dark:text-purple-400",
      bg: "bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/20",
      icon: "text-purple-500",
    },
    upgrades: {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20",
      icon: "text-emerald-500",
    },
  };

  const activeColor = tabColors[storeTab];

  return (
    <div className="pb-10">
      {/* Large Storefront Showcase Window */}
      <div className="glass-surface glass-refraction border-border/40 relative min-h-[380px] w-full overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.01] to-black/5 p-6 shadow-xl backdrop-blur-md dark:to-black/40">
        <TextureOverlay texture="dots" opacity={0.03} />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />

        {/* Category Sub-Tabs Selector */}
        <StoreCategoryHeader
          tabs={STORE_TABS}
          activeTab={storeTab}
          onTabChange={setStoreTab}
          activeColor={activeColor}
          tabColors={tabColors}
          myPacksCount={myPacks?.length}
        />

        {/* Storefront Window Header */}
        <div className="border-border/50 mb-4 flex flex-col items-start justify-between gap-2 border-b pb-4 sm:flex-row sm:items-center dark:border-white/5">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-900 uppercase dark:text-white">
              {activeConfig.icon}
              {activeConfig.title}
            </h3>
            <p className="text-muted-foreground mt-1 text-[10px]">{activeConfig.description}</p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[9px] font-black tracking-widest uppercase",
              activeConfig.badgeStyle
            )}
          >
            {activeConfig.statusText}
          </span>
        </div>

        {/* Showcase Display Area */}
        {isLoading ? (
          <div className="flex flex-wrap justify-center gap-8 py-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[280px] w-44 shrink-0 rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={storeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              {storeTab === "my-packs" &&
                (myPacks && myPacks.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-8 py-6">
                    {myPacks.map((userPack: any) => {
                      const packData = userPack.pack as PackItem;
                      return (
                        <div key={userPack.id} className="shrink-0">
                          <PackHolographicCard
                            pack={packData}
                            actionButton={
                              <Button
                                size="sm"
                                onClick={() =>
                                  setOpeningPack({
                                    id: userPack.id,
                                    packType: packData.packType,
                                  })
                                }
                                className="h-7 w-full border-none bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-md hover:from-blue-500 hover:to-indigo-500"
                              >
                                Rip Open Pack
                              </Button>
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="text-muted-foreground/20 mb-3 h-12 w-12" />
                    <h4 className="text-foreground text-sm font-bold">No Unopened Packs</h4>
                    <p className="text-muted-foreground mt-1 mb-4 max-w-xs text-xs">
                      You don't have any packs in your inventory right now. Head over to the
                      marketplace to get some!
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setStoreTab("boosters")}
                      className="border-none bg-gradient-to-r from-amber-600 to-yellow-600 text-xs font-bold text-white shadow-md"
                    >
                      <Store className="mr-1.5 h-3.5 w-3.5" /> Browse Marketplace
                    </Button>
                  </div>
                ))}

              {storeTab === "boosters" &&
                (packs && packs.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-8 py-6">
                    {packs.map((pack: any) => {
                      const isPending =
                        purchasePackMutation.isPending &&
                        purchasePackMutation.variables?.packId === pack.id;
                      return (
                        <div key={pack.id} className="shrink-0">
                          <PackHolographicCard
                            pack={pack as PackItem}
                            actionButton={
                              <Button
                                size="sm"
                                onClick={() =>
                                  purchasePackMutation.mutate({
                                    packId: pack.id,
                                  })
                                }
                                disabled={isPending}
                                className="h-7 w-full border-none bg-gradient-to-r from-amber-600 to-yellow-600 text-xs font-bold text-white shadow-md hover:from-amber-500 hover:to-yellow-500"
                              >
                                {isPending ? (
                                  "Buying..."
                                ) : (
                                  <span className="flex items-center gap-1 font-mono">
                                    <IxCreditsSymbol className="h-3 w-3 shrink-0 text-white" />
                                    Buy ({pack.priceCredits})
                                  </span>
                                )}
                              </Button>
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Store className="text-muted-foreground/20 mb-3 h-12 w-12" />
                    <h4 className="text-foreground text-sm font-bold">No Packs Available</h4>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Check back later for new pack drops and special seasonal releases.
                    </p>
                  </div>
                ))}

              {storeTab === "cosmetics" &&
                (cosmeticItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cosmeticItems.map((item: StoreItem) => (
                      <StoreItemCard
                        key={item.id}
                        item={item}
                        onPurchase={(itm: StoreItem) => setActiveCheckoutItem(itm)}
                        isPurchasing={purchasingItemId === item.id}
                        isOwned={!!(ownedData as { purchasedIds?: string[] } | undefined)?.purchasedIds?.includes(item.id)}
                        purchaseCount={(ownedData as { purchaseCounts?: Record<string, number> } | undefined)?.purchaseCounts?.[item.id] ?? 0}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Sparkles className="text-muted-foreground/20 mb-3 h-12 w-12" />
                    <h4 className="text-foreground text-sm font-bold">No Cosmetics Listed</h4>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Profile customization cosmetics will appear here soon.
                    </p>
                  </div>
                ))}

              {storeTab === "upgrades" &&
                (upgradeItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {upgradeItems.map((item: StoreItem) => (
                      <StoreItemCard
                        key={item.id}
                        item={item}
                        onPurchase={(itm: StoreItem) => setActiveCheckoutItem(itm)}
                        isPurchasing={purchasingItemId === item.id}
                        isOwned={!!(ownedData as { purchasedIds?: string[] } | undefined)?.purchasedIds?.includes(item.id)}
                        purchaseCount={(ownedData as { purchaseCounts?: Record<string, number> } | undefined)?.purchaseCounts?.[item.id] ?? 0}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <TrendingUp className="text-muted-foreground/20 mb-3 h-12 w-12" />
                    <h4 className="text-foreground text-sm font-bold">No Upgrades Listed</h4>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Account system upgrades will appear here soon.
                    </p>
                  </div>
                ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <StorePurchaseDialog
        item={activeCheckoutItem}
        onClose={() => setActiveCheckoutItem(null)}
        onConfirm={handleCustomPurchaseConfirm}
        isPurchasing={purchasingItemId === activeCheckoutItem?.id && spendCreditsMutation.isPending}
      />

      <VaultParticleExplosionModal
        open={showCelebration}
        title="Item Unlocked!"
        subtitle="Your purchase was successful. Check your account settings to apply your new unlock!"
      />

      {/* Booster pack opening overlay */}
      {openingPack && (
        <div className="fixed inset-0 z-50">
          <PackOpeningSequence
            userPackId={openingPack.id}
            packType={openingPack.packType as any}
            onComplete={() => {
              setOpeningPack(null);
              purchasePackMutation.reset();
              void refetchMyPacks();
            }}
            onCancel={() => {
              setOpeningPack(null);
              purchasePackMutation.reset();
            }}
          />
        </div>
      )}
    </div>
  );
}
