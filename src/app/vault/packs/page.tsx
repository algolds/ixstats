/**
 * Card Packs Page - PREMIUM EDITION V2
 * Phase 1 Enhancement: 3D rotating pack, TiltCard integration, premium animations
 * Features: Hero 3D pack, carousel with TiltCard, pack stacks, holographic effects
 */

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Gift,
  Sparkles,
  ShoppingCart,
  Zap,
  Star,
  Info,
  Percent,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { PackOpeningSequence } from "~/components/cards/pack-opening/PackOpeningSequence";
import { useSoundService } from "~/lib/sound-service";
import { Badge } from "~/components/ui/badge";
import { TiltCard } from "~/components/vault/3DTiltCard";
import { NumberFlowDisplay } from "~/components/ui/number-flow";

/**
 * Pack rarity configuration
 */
const getPackConfig = (packType: string) => {
  const type = packType.toUpperCase();

  if (type.includes("BASIC") || type.includes("STARTER")) {
    return {
      color: "text-blue-400",
      borderColor: "border-blue-400/50",
      glowColor: "shadow-blue-500/40",
      icon: Package,
      label: "Basic",
      tier: 1,
    };
  } else if (type.includes("ELITE") || type.includes("LEGENDARY")) {
    return {
      color: "text-purple-400",
      borderColor: "border-purple-400/50",
      glowColor: "shadow-purple-500/40",
      icon: Star,
      label: "Elite",
      tier: 3,
    };
  } else if (type.includes("PREMIUM") || type.includes("GOLD")) {
    return {
      color: "text-gold-400",
      borderColor: "border-gold-400/50",
      glowColor: "shadow-gold-500/40",
      icon: Sparkles,
      label: "Premium",
      tier: 2,
    };
  } else if (type.includes("EVENT") || type.includes("LIMITED")) {
    return {
      color: "text-red-400",
      borderColor: "border-red-400/50",
      glowColor: "shadow-red-500/40",
      icon: Zap,
      label: "Event",
      tier: 4,
    };
  } else {
    return {
      color: "text-cyan-400",
      borderColor: "border-cyan-400/50",
      glowColor: "shadow-cyan-500/40",
      icon: Gift,
      label: "Special",
      tier: 2,
    };
  }
};

/**
 * Hero Pack Card Component - 3D Rotating Version
 */
function HeroPackCard({ pack, onPurchase, onShowOdds }: { pack: any; onPurchase: () => void; onShowOdds: () => void }) {
  const config = getPackConfig(pack.packType);
  const Icon = config.icon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
      {/* Left: 3D Rotating Pack */}
      <motion.div
        className="flex justify-center"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="relative"
          style={{ perspective: "1200px" }}
        >
          {/* Holographic glow backdrop */}
          <motion.div
            className="absolute inset-0 rounded-3xl blur-3xl vault-glow-holographic"
            animate={{
              opacity: [0.4, 0.7, 0.4],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* 3D Rotating Pack */}
          <motion.div
            className={cn(
              "relative w-[300px] h-[400px] rounded-2xl border-2",
              "backdrop-blur-xl bg-gradient-to-br from-black/40 to-black/20",
              config.borderColor,
              "shadow-2xl overflow-hidden"
            )}
            animate={{
              rotateY: [0, 360],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Pack content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-4">
              {/* Tier badge */}
              <Badge className={cn("absolute top-4 left-4", config.color, "font-black")}>
                {config.label}
              </Badge>

              {/* Main icon */}
              <motion.div
                className={cn(
                  "rounded-full p-8 border-2",
                  "backdrop-blur-sm bg-black/30",
                  config.borderColor
                )}
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Icon className={cn("h-24 w-24", config.color)} />
              </motion.div>

              {/* Pack name */}
              <h3 className="text-2xl font-black text-white text-center">
                {pack.name}
              </h3>

              {/* Quick stats */}
              <div className="flex gap-4 text-center">
                <div className="rounded-lg bg-black/40 px-4 py-2">
                  <div className={cn("text-xl font-black", config.color)}>
                    <NumberFlowDisplay value={pack.cardCount} format="default" />
                  </div>
                  <div className="text-[10px] text-white/60">CARDS</div>
                </div>
                <div className="rounded-lg bg-black/40 px-4 py-2">
                  <div className="text-xl font-black text-gold-400">
                    <NumberFlowDisplay value={pack.priceCredits} format="default" />
                  </div>
                  <div className="text-[10px] text-white/60">IxC</div>
                </div>
              </div>

              {/* Animated sparkles */}
              <motion.div
                className="absolute bottom-6 left-1/2 -translate-x-1/2"
                animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className={cn("h-8 w-8", config.color)} />
              </motion.div>
            </div>

            {/* Holographic overlay */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "var(--vault-gradient-holographic)",
                mixBlendMode: "overlay",
                opacity: 0.3,
              }}
              animate={{
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Right: Details Panel */}
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Featured badge */}
        <Badge className={cn("inline-flex items-center gap-1", config.color, "text-lg px-4 py-2")}>
          <Star className="h-4 w-4" />
          Featured This Week
        </Badge>

        {/* Title */}
        <div>
          <h2 className="text-4xl font-black text-white mb-2">{pack.name}</h2>
          <p className="text-white/70 text-lg leading-relaxed">{pack.description}</p>
        </div>

        {/* Stats breakdown */}
        <div className="glass-hierarchy-child rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white/80 uppercase tracking-wide">Pack Details</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-white/60">Total Cards</div>
              <div className={cn("text-3xl font-black", config.color)}>
                <NumberFlowDisplay value={pack.cardCount} format="default" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-white/60">Price</div>
              <div className="text-3xl font-black text-gold-400">
                <NumberFlowDisplay value={pack.priceCredits} format="default" />
                <span className="text-sm ml-1">IxC</span>
              </div>
            </div>
          </div>

          {/* Guaranteed rarity indicator */}
          <div className="rounded-lg bg-black/30 p-3 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Guaranteed Rarity</span>
              <Badge className={cn(config.color, "font-bold")}>
                {config.label}+
              </Badge>
            </div>
          </div>
        </div>

        {/* Odds visualization (placeholder) */}
        <div className="glass-hierarchy-child rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-white/80">Rarity Odds</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowOdds}
              className="text-cyan-400 hover:text-cyan-300"
            >
              <Info className="h-4 w-4 mr-1" />
              Details
            </Button>
          </div>

          {/* Simple bar chart visualization */}
          <div className="space-y-2">
            {[
              { label: "Common", percent: 50, color: "bg-gray-400" },
              { label: "Uncommon", percent: 30, color: "bg-green-400" },
              { label: "Rare", percent: 15, color: "bg-blue-400" },
              { label: config.label, percent: 5, color: config.color.replace("text-", "bg-") },
            ].map((rarity) => (
              <div key={rarity.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70">{rarity.label}</span>
                  <span className="text-white/50">
                    <NumberFlowDisplay value={rarity.percent} format="default" />%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", rarity.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${rarity.percent}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button with shimmer effect */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            onClick={onPurchase}
            size="lg"
            className={cn(
              "w-full font-black text-black text-lg py-6 relative overflow-hidden",
              "bg-gradient-to-r from-orange-500 to-orange-600",
              "hover:from-orange-400 hover:to-orange-500",
              "shadow-xl shadow-orange-500/30"
            )}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{
                x: ["-100%", "200%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            />
            <ShoppingCart className="mr-2 h-6 w-6" />
            Purchase Now
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * Pack Card Component (for carousel) - Enhanced with TiltCard
 */
function PackCard({ pack, onPurchase, onShowOdds }: { pack: any; onPurchase: () => void; onShowOdds: () => void }) {
  const config = getPackConfig(pack.packType);
  const Icon = config.icon;
  const soundService = useSoundService();

  // Map config colors to TiltCard glowColor prop
  const tiltGlowColor = config.label === "Elite" ? "purple" :
                        config.label === "Premium" ? "gold" :
                        config.label === "Event" ? "orange" :
                        config.label === "Basic" ? "blue" : "cyan";

  return (
    <TiltCard
      glowColor={tiltGlowColor}
      showSparkles={config.tier >= 3}
      className="h-full"
      onClick={() => soundService?.play("card-hover", 0.2)}
    >
      <div className="relative p-6 flex flex-col h-full space-y-4">
        {/* Tier badge */}
        <Badge className={cn("absolute top-2 right-2 z-10", config.color, "font-bold text-xs")}>
          {config.label}
        </Badge>

        {/* Icon */}
        <div className="flex justify-center pt-4">
          <motion.div
            className={cn(
              "rounded-full p-6 border-2",
              "backdrop-blur-sm bg-black/30",
              config.borderColor
            )}
            whileHover={{ rotate: 360, scale: 1.1 }}
            transition={{ duration: 0.6, type: "spring" }}
          >
            <Icon className={cn("h-12 w-12", config.color)} />
          </motion.div>
        </div>

        {/* Name */}
        <h4 className="text-xl font-bold text-center text-white">{pack.name}</h4>

        {/* Description */}
        <p className="text-sm text-white/60 text-center line-clamp-2 flex-1">{pack.description}</p>

        {/* Stats */}
        <div className="space-y-2 rounded-lg bg-black/30 p-3 border border-white/10">
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Cards</span>
            <span className={cn("font-bold", config.color)}>
              <NumberFlowDisplay value={pack.cardCount} format="default" />
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Price</span>
            <span className="font-bold text-gold-400">
              <NumberFlowDisplay value={pack.priceCredits} format="default" /> IxC
            </span>
          </div>
        </div>

        {/* Odds button */}
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onShowOdds();
            soundService?.play("card-select", 0.3);
          }}
          className="w-full border-white/20 hover:bg-white/10"
        >
          <Percent className="mr-1 h-3 w-3" />
          View Odds
        </Button>

        {/* Purchase button */}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onPurchase();
              soundService?.play("card-select");
            }}
            className={cn(
              "w-full font-black bg-gradient-to-r from-orange-500 to-orange-600 text-black",
              "hover:from-orange-400 hover:to-orange-500 shadow-lg"
            )}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Buy Now
          </Button>
        </motion.div>
      </div>
    </TiltCard>
  );
}

/**
 * Unopened Pack Stack Component - Enhanced with floating badge
 */
function UnopenedPackStack({ pack, count, onOpen, onOpenAll }: { pack: any; count: number; onOpen: () => void; onOpenAll?: () => void }) {
  const config = getPackConfig(pack.pack?.packType || "");
  const Icon = config.icon;
  const soundService = useSoundService();

  return (
    <motion.div
      className={cn(
        "group relative rounded-xl border-2 p-4 cursor-pointer",
        "backdrop-blur-xl bg-black/30",
        config.borderColor,
        "transition-all duration-300"
      )}
      whileHover={{ y: -8, scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      onHoverStart={() => soundService?.play("card-hover", 0.2)}
    >
      {/* Glow effect on hover */}
      <motion.div
        className={cn("absolute inset-0 rounded-xl blur-lg opacity-0 group-hover:opacity-60", config.glowColor)}
        transition={{ duration: 0.3 }}
      />

      {/* Animated quantity badge */}
      {count > 1 && (
        <motion.div
          className="absolute -top-2 -right-2 z-20"
          animate={{
            y: [0, -4, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Badge
            className={cn(
              "bg-gradient-to-r from-orange-500 to-orange-600 text-white font-black px-3 py-1",
              "border-2 border-orange-400 shadow-xl shadow-orange-500/50",
              "text-base"
            )}
          >
            <NumberFlowDisplay value={count} format="default" className="font-black" />
          </Badge>
        </motion.div>
      )}

      <div className="relative z-10">
        {/* Pack icon with rarity border */}
        <div className="relative mb-3 flex justify-center">
          <motion.div
            className={cn(
              "rounded-xl p-6 border-2",
              "backdrop-blur-sm bg-black/30",
              config.borderColor
            )}
            whileHover={{ rotate: [0, -5, 5, 0], scale: 1.1 }}
            transition={{ duration: 0.5 }}
          >
            <Icon className={cn("h-16 w-16", config.color)} />
          </motion.div>

          {/* Sparkle effect for high-tier packs */}
          {config.tier >= 3 && (
            <motion.div
              className="absolute top-0 right-0"
              animate={{
                opacity: [0, 1, 0],
                rotate: [0, 180, 360],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className={cn("h-5 w-5", config.color)} />
            </motion.div>
          )}
        </div>

        {/* Pack name */}
        <h4 className="text-center font-bold text-white mb-1 line-clamp-1">
          {pack.pack?.name}
        </h4>

        {/* Tier badge */}
        <div className="text-center mb-3">
          <Badge className={cn("text-xs", config.color)}>
            {config.label}
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <Button
            size="sm"
            className={cn(
              "w-full font-bold",
              "bg-gradient-to-r from-purple-600 to-purple-700 text-white",
              "hover:from-purple-500 hover:to-purple-600",
              "shadow-lg shadow-purple-500/30"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Open Pack
          </Button>

          {/* Open All button (only show if multiple packs) */}
          {count > 1 && onOpenAll && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs border-purple-400/30 hover:bg-purple-400/10"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAll();
              }}
            >
              <Zap className="mr-1 h-3 w-3" />
              Open All ({count})
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Odds Detail Modal Component
 */
function OddsDetailModal({ pack, isOpen, onClose }: { pack: any; isOpen: boolean; onClose: () => void }) {
  if (!pack) return null;

  const config = getPackConfig(pack.packType);

  const rarityOdds = [
    { rarity: "Common", percent: 50, color: "text-gray-400", bgColor: "bg-gray-400" },
    { rarity: "Uncommon", percent: 30, color: "text-green-400", bgColor: "bg-green-400" },
    { rarity: "Rare", percent: 15, color: "text-blue-400", bgColor: "bg-blue-400" },
    { rarity: config.label, percent: 5, color: config.color, bgColor: config.color.replace("text-", "bg-") },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-hierarchy-modal max-w-lg w-full p-6 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-white">Pack Odds</h3>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <span className="text-white/60">✕</span>
              </Button>
            </div>

            <p className="text-white/70 mb-6">
              Detailed probability breakdown for <span className="font-bold text-white">{pack.name}</span>
            </p>

            <div className="space-y-4">
              {rarityOdds.map((odds) => (
                <div key={odds.rarity} className="glass-hierarchy-child rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("font-bold text-lg", odds.color)}>{odds.rarity}</span>
                    <span className="text-2xl font-black text-white">
                      <NumberFlowDisplay value={odds.percent} format="default" />%
                    </span>
                  </div>

                  {/* Visual bar */}
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", odds.bgColor)}
                      initial={{ width: 0 }}
                      animate={{ width: `${odds.percent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>

                  {/* Additional info */}
                  <p className="text-xs text-white/50 mt-2">
                    Approximately {Math.round((pack.cardCount * odds.percent) / 100)} {odds.rarity.toLowerCase()} card
                    {Math.round((pack.cardCount * odds.percent) / 100) !== 1 ? "s" : ""} per pack
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-4">
              <p className="text-xs text-cyan-200">
                <Info className="inline h-3 w-3 mr-1" />
                These odds are based on statistical averages. Actual results may vary per pack opening.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Main Packs Page Component
 */
export default function PacksPage() {
  const [selectedPack, setSelectedPack] = useState<any>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [oddsModalOpen, setOddsModalOpen] = useState(false);
  const [oddsModalPack, setOddsModalPack] = useState<any>(null);
  const [openingPack, setOpeningPack] = useState<any>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const soundService = useSoundService();

  const utils = api.useUtils();

  // Fetch data
  const { data: packsData, isLoading: packsLoading } = api.cardPacks.getAvailablePacks.useQuery();
  const { data: myPacksData, isLoading: myPacksLoading } = api.cardPacks.getMyPacks.useQuery({ isOpened: false });

  const availablePacks = packsData?.packs || [];
  const unopenedPacks = myPacksData?.packs || [];

  // Group unopened packs by type
  const groupedPacks = unopenedPacks.reduce((acc: any, pack: any) => {
    const packId = pack.packId;
    if (!acc[packId]) {
      acc[packId] = { pack, packs: [] };
    }
    acc[packId].packs.push(pack);
    return acc;
  }, {});

  // Featured pack (highest tier available)
  const featuredPack = availablePacks.sort((a: any, b: any) => {
    const tierA = getPackConfig(a.packType).tier;
    const tierB = getPackConfig(b.packType).tier;
    return tierB - tierA;
  })[0];

  // Purchase mutation
  const purchaseMutation = api.cardPacks.purchasePack.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      soundService?.play("craft-success");
      setPurchaseModalOpen(false);
      setSelectedPack(null);
      utils.cardPacks.getMyPacks.invalidate();
      utils.vault.getBalance.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
      soundService?.play("craft-fail");
    },
  });

  const handlePurchase = useCallback(
    (pack: any) => {
      setSelectedPack(pack);
      setPurchaseModalOpen(true);
      soundService?.play("card-select");
    },
    [soundService]
  );

  const handleShowOdds = useCallback(
    (pack: any) => {
      setOddsModalPack(pack);
      setOddsModalOpen(true);
      soundService?.play("card-select", 0.3);
    },
    [soundService]
  );

  const confirmPurchase = useCallback(() => {
    if (!selectedPack) return;
    purchaseMutation.mutate({ packId: selectedPack.id });
  }, [selectedPack, purchaseMutation]);

  const handleOpenPack = useCallback(
    (pack: any) => {
      setOpeningPack(pack);
      soundService?.play("pack-open");
    },
    [soundService]
  );

  const handlePackOpenComplete = useCallback(() => {
    setOpeningPack(null);
    utils.cardPacks.getMyPacks.invalidate();
    utils.cards.getMyCards.invalidate();
    toast.success("Pack opened successfully! Check your inventory.");
  }, [utils]);

  const loading = packsLoading || myPacksLoading;

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Section */}
      {featuredPack && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-black text-white">
                Featured Pack
              </h2>
              <p className="text-sm text-white/60">Premium selection for this week</p>
            </div>
            <a
              href="/vault/market"
              className="rounded-lg border border-purple-400/30 px-4 py-2 text-sm font-bold text-purple-200 hover:bg-purple-400/10 transition-colors"
            >
              Visit Storefront
            </a>
          </div>
          <HeroPackCard
            pack={featuredPack}
            onPurchase={() => handlePurchase(featuredPack)}
            onShowOdds={() => handleShowOdds(featuredPack)}
          />
        </motion.div>
      )}

      {/* Your Unopened Packs */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gold-400">Your Unopened Packs</h2>
            <p className="text-sm text-white/60">
              {unopenedPacks.length} {unopenedPacks.length === 1 ? "pack" : "packs"} ready to open
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : unopenedPacks.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="mb-4 h-16 w-16 text-white/40" />
              <p className="text-white/60 text-center">No unopened packs. Purchase some below!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Object.values(groupedPacks).map((group: any) => (
              <UnopenedPackStack
                key={group.pack.id}
                pack={group.pack}
                count={group.packs.length}
                onOpen={() => handleOpenPack(group.packs[0])}
              />
            ))}
          </div>
        )}
      </div>

      {/* Available Packs Shop */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-purple-400">Available Packs</h2>
            <p className="text-sm text-white/60">Browse and purchase card packs with TiltCard 3D effects</p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[500px] rounded-2xl" />
            ))}
          </div>
        ) : availablePacks.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="mb-4 h-16 w-16 text-white/40" />
              <p className="text-white/60">No packs available at the moment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {availablePacks
              .filter((p: any) => p.id !== featuredPack?.id)
              .map((pack: any) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  onPurchase={() => handlePurchase(pack)}
                  onShowOdds={() => handleShowOdds(pack)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Purchase Confirmation Modal */}
      <AnimatePresence>
        {purchaseModalOpen && selectedPack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setPurchaseModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-hierarchy-modal max-w-md w-full p-6 rounded-2xl"
            >
              <h3 className="text-2xl font-black text-gold-400 mb-4">Confirm Purchase</h3>
              <p className="text-white/70 mb-6">{selectedPack.description}</p>

              <div className="space-y-3 rounded-lg bg-white/5 border border-white/10 p-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-white/70">Pack</span>
                  <span className="font-bold text-white">{selectedPack.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Cards</span>
                  <span className="font-bold text-purple-400">
                    <NumberFlowDisplay value={selectedPack.cardCount} format="default" />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Price</span>
                  <span className="font-bold text-gold-400">
                    <NumberFlowDisplay value={selectedPack.priceCredits} format="default" /> IxC
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPurchaseModalOpen(false)}
                  disabled={purchaseMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-black font-black hover:brightness-105 shadow-lg"
                  onClick={confirmPurchase}
                  disabled={purchaseMutation.isPending}
                >
                  {purchaseMutation.isPending ? "Purchasing..." : "Confirm"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Odds Detail Modal */}
      <OddsDetailModal
        pack={oddsModalPack}
        isOpen={oddsModalOpen}
        onClose={() => setOddsModalOpen(false)}
      />

      {/* Pack Opening Sequence */}
      {openingPack && (
        <div className="fixed inset-0 z-50">
          <PackOpeningSequence
            userPackId={openingPack.id}
            packType={openingPack.pack?.packType}
            packArtwork={openingPack.pack?.artwork}
            onComplete={handlePackOpenComplete}
            onCancel={() => setOpeningPack(null)}
          />
        </div>
      )}
    </div>
  );
}
