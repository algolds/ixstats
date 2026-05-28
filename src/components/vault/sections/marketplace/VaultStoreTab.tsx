"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "motion/react";
import {
  Package,
  ShoppingCart,
  Sparkles,
  Star,
  Gift,
  Store,
  Info,
  X,
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
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { StoreItemCard, type StoreItem } from "./StoreItemCard";
import { useNotify } from "~/hooks/useNotify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

const PackOpeningSequence = dynamic(
  () =>
    import("~/components/cards/pack-opening/PackOpeningSequence").then(
      (m) => m.PackOpeningSequence
    ),
  { ssr: false }
);

export const ICON_MAP: Record<string, React.ComponentType<any>> = {
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
  Package,
  ShoppingCart,
  Star,
  Gift,
  Store,
};

// ─── Pack config helper ──────────────────────────────────────────
const getPackConfig = (packType: string) => {
  const type = packType.toUpperCase();
  if (type.includes("BASIC") || type.includes("STARTER"))
    return {
      color: "text-blue-600 dark:text-blue-400",
      borderColor: "border-blue-500/30",
      glowColor: "rgba(59,130,246,0.3)",
      icon: Package,
      label: "Basic",
    };
  if (type.includes("ELITE") || type.includes("LEGENDARY"))
    return {
      color: "text-purple-600 dark:text-purple-400",
      borderColor: "border-purple-500/30",
      glowColor: "rgba(168,85,247,0.3)",
      icon: Star,
      label: "Elite",
    };
  if (type.includes("PREMIUM") || type.includes("GOLD"))
    return {
      color: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-500/30",
      glowColor: "rgba(245,158,11,0.3)",
      icon: Sparkles,
      label: "Premium",
    };
  if (type.includes("EVENT") || type.includes("LIMITED"))
    return {
      color: "text-red-600 dark:text-red-400",
      borderColor: "border-red-500/30",
      glowColor: "rgba(239,68,68,0.3)",
      icon: Sparkles,
      label: "Event",
    };
  return {
    color: "text-cyan-600 dark:text-cyan-400",
    borderColor: "border-cyan-500/30",
    glowColor: "rgba(6,182,212,0.3)",
    icon: Gift,
    label: "Special",
  };
};

interface PackItem {
  id: string;
  name: string;
  description: string | null;
  artwork: string | null;
  packType: string;
  priceCredits: number;
  cardCount: number;
  guaranteedRarity: string | null;
  commonOdds: number;
  uncommonOdds: number;
  rareOdds: number;
  ultraRareOdds: number;
  epicOdds: number;
  legendaryOdds: number;
}

interface PackShelfItemProps {
  pack: PackItem;
  actionButton: React.ReactNode;
}

function PackShelfItem({ pack, actionButton }: PackShelfItemProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const config = getPackConfig(pack.packType);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-75, 75], [12, -12]), { stiffness: 120, damping: 15 });
  const rotateY = useSpring(useTransform(x, [-50, 50], [-12, 12]), { stiffness: 120, damping: 15 });
  const scale = useSpring(1, { stiffness: 120, damping: 15 });
  const translateY = useSpring(0, { stiffness: 120, damping: 15 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseEnter = () => {
    scale.set(1.04);
    translateY.set(-12);
  };

  const handleMouseLeave = () => {
    scale.set(1);
    translateY.set(0);
    x.set(0);
    y.set(0);
  };

  return (
    <div className="group relative flex flex-col items-center select-none">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="border-border/50 relative w-44 rounded-2xl border bg-black/5 p-2 shadow-2xl backdrop-blur-md transition-shadow hover:shadow-[0_15px_30px_var(--glow)] dark:border-white/10 dark:bg-black/40"
        style={
          {
            transformStyle: "preserve-3d" as any,
            rotateX,
            rotateY,
            scale,
            y: translateY,
            perspective: "1000px",
            "--glow": config.glowColor,
          } as any
        }
      >
        <Popover>
          <PopoverTrigger
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="absolute top-3 right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 transition-all hover:border-white/40 hover:bg-black/85 hover:text-white active:scale-95"
            title="View Rarity Drop Rates"
          >
            <Info className="h-3.5 w-3.5" />
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3">
            <div>
              <h4 className="mb-2 border-b border-cyan-500/20 pb-1 text-[10px] font-black tracking-wider text-cyan-600 uppercase dark:text-cyan-400">
                Drop Probabilities
              </h4>
              <div className="space-y-1.5 font-mono text-[9px]">
                <div className="text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Common
                  </span>
                  <span>{pack.commonOdds}%</span>
                </div>
                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Uncommon
                  </span>
                  <span>{pack.uncommonOdds}%</span>
                </div>
                <div className="text-purple-650 flex items-center justify-between dark:text-purple-400">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> Rare
                  </span>
                  <span>{pack.rareOdds}%</span>
                </div>
                <div className="flex items-center justify-between text-pink-600 dark:text-pink-400">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-pink-500" /> Ultra Rare
                  </span>
                  <span>{pack.ultraRareOdds}%</span>
                </div>
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-500">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Epic
                  </span>
                  <span>{pack.epicOdds}%</span>
                </div>
                <div className="flex items-center justify-between text-yellow-600 dark:text-yellow-500">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" /> Legendary
                  </span>
                  <span>{pack.legendaryOdds}%</span>
                </div>
              </div>
            </div>
            {pack.guaranteedRarity && (
              <div className="border-border/50 border-t mt-1.5 pt-1.5 text-center dark:border-white/10">
                <span className="text-amber-650 block text-[8px] font-bold tracking-widest uppercase dark:text-amber-400">
                  Guaranteed:
                </span>
                <span className="text-[9px] font-black text-foreground">
                  {pack.guaranteedRarity.replace("_", " ")}
                </span>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <div className="relative aspect-[3/4.2] w-full overflow-hidden rounded-xl bg-slate-950">
          {pack.artwork ? (
            <div className="relative h-full w-full">
              <img src={pack.artwork} alt={pack.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="absolute right-3 bottom-3 left-3">
                <p className="line-clamp-1 text-center text-xs font-black text-white/95 drop-shadow-md">
                  {pack.name}
                </p>
              </div>
            </div>
          ) : (
            <PackHolographicCover
              packType={pack.packType}
              guaranteedRarity={pack.guaranteedRarity}
              packName={pack.name}
              size="md"
              className="h-full w-full"
            />
          )}
        </div>

        <div className="mt-2.5 space-y-2 px-1">
          <div className="flex items-center justify-between">
            <span className="line-clamp-1 text-[11px] font-black text-slate-900 dark:text-white/90">
              {pack.name}
            </span>
            <Badge
              variant="outline"
              className={cn("px-1 py-0 text-[8px] font-bold uppercase", config.color)}
            >
              {config.label}
            </Badge>
          </div>
          <p className="text-muted-foreground line-clamp-2 text-[9px] leading-tight">
            {pack.description || `${pack.cardCount} premium cards included`}
          </p>
          <div className="pt-1">{actionButton}</div>
        </div>
      </motion.div>

      <div className="mt-2 h-1.5 w-32 rounded-full bg-black/20 blur-[4px] dark:bg-black/45" />
    </div>
  );
}

// ─── Particle definitions for drift celebration ──────────────────
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
  const [openingPack, setOpeningPack] = useState<{ id: string; packType: string } | null>(null);

  // storefront navigation sub-tabs
  const [storeTab, setStoreTab] = useState<"my-packs" | "boosters" | "cosmetics" | "upgrades">(
    "boosters"
  );
  const hasAutoSelected = useRef(false);

  // checkout modal states
  const [activeCheckoutItem, setActiveCheckoutItem] = useState<StoreItem | null>(null);
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  // tRPC Queries
  const { data: availableData, isLoading: packsLoading } =
    api.cardPacks.getAvailablePacks.useQuery();
  const {
    data: myPacksData,
    isLoading: myPacksLoading,
    refetch: refetchMyPacks,
  } = api.cardPacks.getMyPacks.useQuery({ isOpened: false });
  const { data: ownedData, refetch: refetchOwned } = api.vault.getPurchasedItems.useQuery();
  const { data: storeItems, isLoading: itemsLoading } = api.vault.listStoreItems.useQuery();
  const { refetch: refetchBalance } = api.vault.getBalance.useQuery({ userId: "" }); // clerk resolves user ID backend-side if empty

  const availablePacks = availableData?.packs;
  const myPacks = myPacksData?.packs;
  const ownedItemIds = ownedData?.purchasedItemIds || [];

  const hasUnopenedPacks = !!(myPacks && myPacks.length > 0);

  const storeTabs = STORE_TABS.filter((tab) => {
    if (tab.id === "my-packs") return hasUnopenedPacks;
    return true;
  });

  // Auto-switch to "My Packs" on initial load if user owns unopened packs
  useEffect(() => {
    if (hasUnopenedPacks && !hasAutoSelected.current) {
      setStoreTab("my-packs");
      hasAutoSelected.current = true;
    }
  }, [myPacks, hasUnopenedPacks]);

  // Safeguard: switch to boosters if no unopened packs and currently on my-packs
  useEffect(() => {
    if (!hasUnopenedPacks && storeTab === "my-packs") {
      setStoreTab("boosters");
    }
  }, [hasUnopenedPacks, storeTab]);

  // Mutations
  const purchasePackMutation = api.cardPacks.purchasePack.useMutation({
    onSuccess: (data) => {
      notify.success(
        "Pack Acquired!",
        `Successfully purchased ${data.userPack?.pack?.name || "booster pack"}.`
      );
      void refetchMyPacks();
      void refetchBalance();
      // Auto-open the pack
      if (data.success && data.userPack) {
        const packType = (data.userPack as any).pack?.packType ?? "BASIC";
        setOpeningPack({ id: data.userPack.id, packType });
      }
    },
    onError: (err) => notify.error("Purchase Failed", err.message),
  });

  const spendCreditsMutation = api.vault.spendCredits.useMutation({
    onSuccess: (_, variables) => {
      const item = activeCheckoutItem;
      setPurchasingItemId(null);
      setActiveCheckoutItem(null);

      if (item) {
        // Trigger particle drift animation
        const list = Array.from({ length: 30 }).map((_, i) => ({
          id: i,
          x: (Math.random() - 0.5) * 360,
          y: (Math.random() - 0.5) * 300 - 100,
          rotate: Math.random() * 360,
          scale: 0.6 + Math.random() * 0.7,
        }));
        setParticles(list);
        setShowCelebration(true);

        notify.success("Unlock Successful!", `Unlocked ${item.name} for ${item.price} IxC.`);
        void refetchOwned();
        void refetchBalance();

        setTimeout(() => {
          setShowCelebration(false);
          setParticles([]);
        }, 3200);
      }
    },
    onError: (err) => {
      setPurchasingItemId(null);
      setActiveCheckoutItem(null);
      notify.error("Purchase Failed", err.message);
    },
  });

  // Store items definitions mapped dynamically from database
  const cosmetics: StoreItem[] = (storeItems || [])
    .filter((item: any) => item.category === "cosmetics")
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      icon: ICON_MAP[item.icon] || Sparkles,
      glowColor: item.glowColor || "rgba(245,158,11,0.35)",
      quality: item.quality,
      badgeText: item.badgeText || "Custom",
    }));

  const upgrades: StoreItem[] = (storeItems || [])
    .filter((item: any) => item.category === "upgrades")
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      icon: ICON_MAP[item.icon] || Sparkles,
      glowColor: item.glowColor || "rgba(245,158,11,0.35)",
      quality: item.quality,
      badgeText: item.badgeText || "Custom",
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

  // Determine current active config and loading states
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

        {/* Category Sub-Tabs Selector (Nests subnav inside storefront main card content) */}
        <div className="mb-6 flex justify-center">
          <div className="glass-surface glass-refraction border-border/40 relative flex w-full gap-1 overflow-hidden rounded-xl border p-1 shadow-sm backdrop-blur-md sm:max-w-md bg-black/5 dark:bg-black/30">
            <motion.div
              className={cn(
                "absolute inset-y-1 rounded-lg border transition-all duration-300",
                activeColor.bg
              )}
              layout
              layoutId="store-sub-tab-indicator"
              style={{
                width: `${100 / storeTabs.length}%`,
                left: `${(storeTabs.findIndex((t) => t.id === storeTab) / storeTabs.length) * 100}%`,
              }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
            {storeTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = storeTab === tab.id;
              const configColor = tabColors[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => setStoreTab(tab.id)}
                  className={cn(
                    "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-transparent px-2 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors duration-205",
                    isActive
                      ? cn(configColor.text, "font-bold")
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors duration-205",
                      isActive ? configColor.icon : "text-muted-foreground"
                    )}
                  />
                  <span>{tab.label}</span>
                  {tab.id === "my-packs" && myPacks && myPacks.length > 0 && (
                    <span className="ml-1 animate-pulse rounded-full bg-blue-500 px-1.5 py-0.5 text-[8px] font-black text-white">
                      {myPacks.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

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
                          <PackShelfItem
                            pack={packData}
                            actionButton={
                              <Button
                                onClick={() =>
                                  setOpeningPack({
                                    id: userPack.id,
                                    packType: packData?.packType ?? "BASIC",
                                  })
                                }
                                className="h-8 w-full border-none bg-gradient-to-r from-blue-600 to-cyan-600 text-xs font-bold text-white shadow-[0_0_12px_rgba(59,130,246,0.3)] transition-all duration-200 hover:from-blue-500 hover:to-cyan-500 hover:shadow-[0_0_16px_rgba(59,130,246,0.55)]"
                                size="sm"
                              >
                                <Sparkles className="mr-1 h-3.5 w-3.5 animate-pulse" /> Open Pack
                              </Button>
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Package className="text-muted-foreground/30 mb-3 h-10 w-10" />
                    <p className="text-foreground/80 text-xs font-bold">No Packs in Inventory</p>
                    <p className="text-muted-foreground mt-1 max-w-[280px] text-[10px]">
                      Visit the{" "}
                      <span
                        className="cursor-pointer font-semibold text-amber-600 underline transition-colors hover:text-amber-500 dark:text-amber-400"
                        onClick={() => setStoreTab("boosters")}
                      >
                        Booster Packs
                      </span>{" "}
                      tab to buy your first pack!
                    </p>
                  </div>
                ))}

              {storeTab === "boosters" &&
                (availablePacks && availablePacks.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-8 py-6">
                    {availablePacks.map((pack: any) => (
                      <div key={pack.id} className="shrink-0">
                        <PackShelfItem
                          pack={pack}
                          actionButton={
                            <Button
                              onClick={() => purchasePackMutation.mutate({ packId: pack.id })}
                              disabled={purchasePackMutation.isPending}
                              className="h-8 w-full border-none bg-gradient-to-r from-amber-600 to-yellow-600 text-xs font-bold text-white shadow-[0_0_12px_rgba(245,158,11,0.25)] transition-all duration-200 hover:from-amber-500 hover:to-yellow-500 hover:shadow-[0_0_16px_rgba(245,158,11,0.45)]"
                              size="sm"
                            >
                              <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                              {purchasePackMutation.isPending ? (
                                "Acquiring..."
                              ) : (
                                <>
                                  Purchase{" "}
                                  <span className="ml-1 inline-flex items-center gap-0.5 align-middle font-mono text-[9px] opacity-90">
                                    <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                                    {pack.priceCredits?.toLocaleString()}
                                  </span>
                                </>
                              )}
                            </Button>
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Store className="text-muted-foreground/30 mb-3 h-10 w-10" />
                    <p className="text-foreground/80 text-xs font-bold">Emporium Closed</p>
                    <p className="text-muted-foreground mt-1 max-w-[280px] text-[10px]">
                      Check back soon! No booster packs are currently configured.
                    </p>
                  </div>
                ))}

              {storeTab === "cosmetics" && (
                <div className="flex flex-wrap justify-center gap-8 py-6">
                  {cosmetics.map((item) => (
                    <div key={item.id} className="shrink-0">
                      <StoreItemCard
                        item={item}
                        onPurchase={(i) => setActiveCheckoutItem(i)}
                        isPurchasing={purchasingItemId === item.id}
                        isOwned={ownedItemIds.includes(item.id)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {storeTab === "upgrades" && (
                <div className="flex flex-wrap justify-center gap-8 py-6">
                  {upgrades.map((item) => (
                    <div key={item.id} className="shrink-0">
                      <StoreItemCard
                        item={item}
                        onPurchase={(i) => setActiveCheckoutItem(i)}
                        isPurchasing={purchasingItemId === item.id}
                        isOwned={ownedItemIds.includes(item.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Checkout Confirmation Dialog */}
      <Dialog
        open={!!activeCheckoutItem}
        onOpenChange={(open) => !open && setActiveCheckoutItem(null)}
      >
        <DialogContent className="border-border/50 bg-popover/98 text-foreground max-w-sm backdrop-blur-md dark:bg-slate-900/98">
          <DialogHeader>
            <DialogTitle className="text-sm font-black tracking-wider text-amber-600 uppercase dark:text-amber-400">
              Confirm Purchase
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-2 text-xs">
              You are about to purchase the following item using your vault balance:
            </DialogDescription>
          </DialogHeader>

          {activeCheckoutItem && (
            <div className="border-border/50 my-2 flex items-center gap-3 rounded-xl border bg-black/5 p-4 dark:border-white/5 dark:bg-black/30">
              <div className="border-border/50 shrink-0 rounded-lg border bg-slate-100 p-2 dark:border-white/10 dark:bg-white/5">
                <activeCheckoutItem.icon className="h-6 w-6 text-amber-500" />
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                  {activeCheckoutItem.name}
                </h4>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[10px] leading-snug">
                  {activeCheckoutItem.description}
                </p>
              </div>
            </div>
          )}

          <div className="border-border/50 text-muted-foreground space-y-1.5 border-t pt-3 font-mono text-[10px] dark:border-white/5">
            <div className="flex justify-between">
              <span>Item Cost:</span>
              <span className="text-red-650 inline-flex items-center gap-0.5 font-bold dark:text-red-400">
                -<IxCreditsSymbol className="h-2.5 w-2.5" />
                {activeCheckoutItem?.price.toLocaleString()} IxC
              </span>
            </div>
          </div>

          <DialogFooter className="mt-4 flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setActiveCheckoutItem(null)}
              className="border-input hover:bg-accent text-foreground bg-transparent text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomPurchaseConfirm}
              disabled={spendCreditsMutation.isPending}
              className="border-none bg-gradient-to-r from-amber-600 to-yellow-600 text-xs font-bold text-white hover:from-amber-500 hover:to-yellow-500"
            >
              {spendCreditsMutation.isPending ? "Unlocking..." : "Confirm Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Celebration drift particle Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative">
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  className="absolute flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-gradient-to-br from-amber-400 to-yellow-500 p-1 text-amber-950 shadow-[0_0_8px_rgba(245,158,11,0.5)] select-none"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: p.x,
                    y: p.y,
                    scale: p.scale,
                    opacity: [1, 1, 0],
                    rotate: p.rotate,
                  }}
                  transition={{ duration: 2.5, ease: "easeOut" }}
                >
                  <IxCreditsSymbol className="h-full w-full" strokeWidth={3.5} />
                </motion.div>
              ))}

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [0.8, 1.05, 1], opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-popover/95 relative flex flex-col items-center rounded-2xl border border-amber-500/35 border-t-amber-400/50 px-10 py-7 text-center shadow-[0_0_40px_rgba(245,158,11,0.25)] dark:bg-slate-950/95"
              >
                <div className="mb-3 animate-bounce rounded-full border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-400">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-foreground text-lg font-black tracking-wider uppercase dark:text-white">
                  Item Unlocked!
                </h2>
                <p className="text-muted-foreground mt-2 max-w-[220px] text-xs">
                  Your purchase was successful. Check your account settings to apply your new
                  unlock!
                </p>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

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
