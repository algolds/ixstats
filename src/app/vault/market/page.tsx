"use client";

/**
 * Premium Market Page - IxCards Marketplace
 * Phase 1 Redesign: New 5-Tab System with Enhanced UI/UX
 *
 * Tabs:
 * 1. Store - Hero banner, Shop Singles, Pack Bundles, Limited Time offers
 * 2. Auctions - Live auctions with filters, sort, countdown timers
 * 3. Card Search - Integrated MarketBrowser with advanced filters
 * 4. My Bids - User's active/past bids with status tracking
 * 5. My Listings - User's active listings with quick actions
 *
 * Design System:
 * - TiltCard components with 3D effects
 * - Vault color classes (vault-glow-gold, vault-glow-purple, vault-glow-cyan)
 * - Glass hierarchy depth system
 * - Framer-motion spring physics (stiffness 300-500, damping 20-30)
 * - NumberFlow for animated price displays
 */

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  TrendingUp,
  Clock,
  Flame,
  Star,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  Heart,
  Gavel,
  Sparkles,
  Search,
  X,
  Store,
  Box,
  BadgeDollarSign,
  Package,
  Timer,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { MarketBrowser } from "~/components/cards/marketplace/MarketBrowser";
import { TiltCard } from "~/components/vault/3DTiltCard";
import NumberFlowDisplay from "~/components/ui/number-flow";

/**
 * Auction Status Badge Component
 */
function AuctionStatusBadge({ status, timeRemaining }: { status: string; timeRemaining: number }) {
  const isEndingSoon = timeRemaining < 300000; // 5 minutes
  const isActive = status === "ACTIVE";

  if (!isActive) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-gray-500/20 px-3 py-1 text-xs font-bold text-gray-400">
        <div className="h-2 w-2 rounded-full bg-gray-400" />
        ENDED
      </div>
    );
  }

  if (isEndingSoon) {
    return (
      <motion.div
        className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <Flame className="h-3 w-3" />
        ENDING SOON
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400">
      <motion.div
        className="h-2 w-2 rounded-full bg-green-400"
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      LIVE
    </div>
  );
}

/**
 * Countdown Timer Component
 */
function CountdownTimer({ endTime }: { endTime: Date }) {
  const [timeRemaining, setTimeRemaining] = useState(
    new Date(endTime).getTime() - Date.now()
  );

  React.useEffect(() => {
    const interval = setInterval(() => {
      const remaining = new Date(endTime).getTime() - Date.now();
      setTimeRemaining(remaining > 0 ? remaining : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  if (timeRemaining <= 0) {
    return <span className="text-gray-400">Ended</span>;
  }

  const hours = Math.floor(timeRemaining / 3600000);
  const minutes = Math.floor((timeRemaining % 3600000) / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  const isUrgent = timeRemaining < 300000; // 5 minutes

  return (
    <motion.span
      className={cn(
        "font-mono font-bold",
        isUrgent ? "text-red-400" : "text-blue-400"
      )}
      animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
    >
      {hours > 0 && `${hours}h `}
      {minutes}m {seconds}s
    </motion.span>
  );
}

/**
 * Featured Auction Card Component
 */
function FeaturedAuctionCard({ auction, onBid }: any) {
  return (
    <TiltCard
      glowColor="gold"
      showSparkles
      className="relative h-[500px] w-full rounded-2xl overflow-hidden"
    >
      {/* Background surface */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Featured badge */}
      <motion.div
        className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-lg bg-gold-500/90 px-4 py-2 backdrop-blur-md"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Star className="h-4 w-4 fill-black text-black" />
        <span className="text-sm font-black text-black">FEATURED</span>
      </motion.div>

      {/* Status badge */}
      <div className="absolute top-4 right-4 z-10">
        <AuctionStatusBadge
          status="ACTIVE"
          timeRemaining={new Date(auction?.endTime || Date.now()).getTime() - Date.now()}
        />
      </div>

      {/* Card preview */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="w-80">
          {auction?.card && (
            <CardDisplay
              card={auction.card}
              size="large"
              enableHolographic={true}
              enable3D={true}
            />
          )}
        </div>
      </div>

      {/* Auction details footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-md p-6 pt-20 border-t border-gold-400/20">
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Current Bid</p>
              <div className="text-3xl font-black text-gold-400">
                <NumberFlowDisplay value={auction?.currentBid || 0} /> <span className="text-2xl">IxC</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Ends In</p>
              <CountdownTimer endTime={auction?.endTime || new Date()} />
            </div>
          </div>

          <motion.button
            onClick={() => onBid(auction?.id)}
            className="w-full rounded-lg bg-orange-500 px-6 py-3 font-black text-black transition-all flex items-center justify-center gap-2 vault-glow-orange"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Gavel className="h-5 w-5" />
            PLACE BID
          </motion.button>
        </div>
      </div>
    </TiltCard>
  );
}

/**
 * Auction Grid Item Component
 */
function AuctionGridItem({ auction, onBid, onWatch, isWatched }: any) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      className="group relative rounded-xl overflow-hidden glass-hierarchy-child"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -5 }}
    >
      {/* Watch button */}
      <button
        onClick={() => onWatch(auction.id)}
        className="absolute top-3 right-3 z-10 rounded-lg bg-black/60 p-2 backdrop-blur-md transition-all hover:scale-110"
      >
        <Heart
          className={cn("h-4 w-4", isWatched ? "fill-red-500 text-red-500" : "text-white")}
        />
      </button>

      {/* Status badge */}
      <div className="absolute top-3 left-3 z-10">
        <AuctionStatusBadge
          status={auction.status}
          timeRemaining={new Date(auction.endTime).getTime() - Date.now()}
        />
      </div>

      {/* Card display */}
      <div className="p-4">
        {auction.card && (
          <CardDisplay
            card={auction.card}
            size="medium"
            enableHolographic={true}
            showStatsOnHover={true}
          />
        )}
      </div>

      {/* Auction info */}
      <div className="border-t border-white/10 bg-black/40 backdrop-blur-md p-4 space-y-3">
        {/* Price row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Current Bid</p>
            <div className="text-lg font-black text-gold-400">
              <NumberFlowDisplay value={auction.currentBid} /> <span className="text-sm">IxC</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Bids</p>
            <div className="text-lg font-bold text-blue-400">
              <NumberFlowDisplay value={auction.bidCount || 0} />
            </div>
          </div>
        </div>

        {/* Timer row */}
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-400">Ends in:</span>
          <CountdownTimer endTime={auction.endTime} />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <motion.button
            onClick={() => onBid(auction.id)}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white transition-all vault-glow-purple"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Bid
          </motion.button>
          {auction.buyoutPrice && (
            <motion.button
              onClick={() => onBid(auction.id, true)}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-black transition-all vault-glow-orange flex items-center justify-center gap-1"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-xs">Buy</span>
              <NumberFlowDisplay value={auction.buyoutPrice} className="text-sm" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Hover overlay for details */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              onClick={() => setShowDetails(false)}
              className="absolute top-3 right-3 rounded-lg bg-white/10 p-2"
            >
              <X className="h-4 w-4" />
            </button>
            {/* Bid history would go here */}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Main Market Page Component
 */
export default function MarketPage() {
  const { userId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 });
  const [sortBy, setSortBy] = useState<"endingSoon" | "price" | "bids">("endingSoon");
  const [showFilters, setShowFilters] = useState(false);
  const [watchedAuctions, setWatchedAuctions] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"store" | "auctions" | "search" | "bids" | "listings">("store");

  // Fetch vault balance
  const { data: vaultBalance } = api.vault.getBalance.useQuery(
    { userId: userId || "" },
    { enabled: !!userId }
  );

  // Fetch featured auctions (admin-only)
  const { data: featuredData } = api.cardMarket.getFeaturedAuctions.useQuery(
    { limit: 5 },
    { enabled: !!userId }
  );

  // Fetch active auctions (admin-only)
  const { data: auctionsData } = api.cardMarket.getActiveAuctions.useQuery(
    { limit: 50 },
    { enabled: !!userId }
  );

  const handleBid = useCallback((auctionId: string, isBuyout = false) => {
    toast.info(`${isBuyout ? "Buyout" : "Bid"} functionality coming soon!`);
  }, []);

  const handleWatch = useCallback((auctionId: string) => {
    setWatchedAuctions((prev) => {
      const next = new Set(prev);
      if (next.has(auctionId)) {
        next.delete(auctionId);
        toast.success("Removed from watch list");
      } else {
        next.add(auctionId);
        toast.success("Added to watch list");
      }
      return next;
    });
  }, []);

  const featuredAuctions = featuredData?.auctions || [];
  const allAuctions = auctionsData?.auctions || [];

  return (
    <div className="min-h-screen space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-gold-400 sm:text-4xl">
              Marketplace
            </h1>
            <p className="text-sm text-gray-400 sm:text-base">
              Storefront • Live Auctions • Card Browser
            </p>
          </div>

          {vaultBalance && (
            <TiltCard glowColor="gold" className="rounded-xl px-6 py-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Your Balance</p>
              <div className="text-2xl font-black text-gold-400 flex items-baseline gap-2">
                <NumberFlowDisplay value={vaultBalance.credits} />
                <span className="text-base">IxC</span>
              </div>
            </TiltCard>
          )}
        </div>
      </div>

      {/* Tabs - Sticky Navigation with Glass Effect */}
      <div className="sticky top-0 z-40 mb-6 -mx-4 sm:mx-0">
        <div className="glass-hierarchy-interactive rounded-none sm:rounded-xl border-x-0 sm:border-x border-white/10 bg-black/60 backdrop-blur-xl p-2">
          <div className="grid grid-cols-5 gap-1 sm:gap-2">
            {[
              { value: "store", icon: Store, label: "Store" },
              { value: "auctions", icon: Flame, label: "Auctions" },
              { value: "search", icon: Search, label: "Search" },
              { value: "bids", icon: Gavel, label: "My Bids" },
              { value: "listings", icon: BadgeDollarSign, label: "Listings" },
            ].map((tab) => (
              <motion.button
                key={tab.value}
                onClick={() => setActiveTab(tab.value as any)}
                className={cn(
                  "relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all",
                  activeTab === tab.value
                    ? "text-gold-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <tab.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-[10px]">{tab.label.split(" ")[0]}</span>

                {/* Active indicator with layout animation */}
                {activeTab === tab.value && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content with Animated Transitions */}
      <AnimatePresence mode="wait">
        {activeTab === "store" && (
          <motion.div
            key="store"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Hero Banner with Animated 3D Rotating Featured Pack */}
            <TiltCard glowColor="purple" showSparkles className="rounded-2xl p-6 md:p-10">
              <div className="relative z-10 grid gap-6 md:grid-cols-2 md:items-center">
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-purple-300 border border-purple-400/30"
                  >
                    <Sparkles className="h-4 w-4" />
                    Featured This Season
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-3xl md:text-5xl font-black text-white"
                  >
                    Discover, Bid, and Collect in the IxCards Store
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm md:text-base text-gray-300"
                  >
                    Shop curated singles, browse featured auctions, and open premium packs — all in one place.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-wrap gap-3 pt-2"
                  >
                    <motion.button
                      onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}
                      className="rounded-lg bg-orange-500 px-5 py-2.5 font-black text-black hover:opacity-90 flex items-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Shop Cards <ArrowRight className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                      onClick={() => setActiveTab("auctions")}
                      className="rounded-lg border border-purple-400/40 px-5 py-2.5 font-bold text-purple-200 hover:bg-white/5 flex items-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Live Auctions <Flame className="h-4 w-4" />
                    </motion.button>
                  </motion.div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative h-48 w-full md:h-64">
                    {/* Animated rotating pack cards */}
                    <motion.div
                      className="absolute left-1/4 top-8 h-44 w-32 rounded-xl bg-gradient-to-br from-purple-600/30 to-purple-900/30 border border-purple-500/50 backdrop-blur-md shadow-2xl vault-glow-purple"
                      animate={{ rotate: [-8, -12, -8], y: [0, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute left-1/2 -translate-x-1/2 top-0 h-48 w-36 rounded-xl bg-gradient-to-br from-gold-600/40 to-orange-900/40 border border-gold-500/60 backdrop-blur-md shadow-2xl vault-glow-gold z-10"
                      animate={{ rotate: [3, 8, 3], y: [0, -8, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="h-16 w-16 text-gold-400/60" />
                      </div>
                    </motion.div>
                    <motion.div
                      className="absolute right-1/4 top-10 h-44 w-32 rounded-xl bg-gradient-to-br from-cyan-600/30 to-cyan-900/30 border border-cyan-500/50 backdrop-blur-md shadow-2xl vault-glow-cyan"
                      animate={{ rotate: [4, 8, 4], y: [0, -3, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    />
                  </div>
                </div>
              </div>
            </TiltCard>

            {/* Featured Auctions Section */}
            <div id="featured-auctions" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Star className="h-6 w-6 text-gold-400" />
                  Featured Auctions
                </h3>
                <motion.button
                  onClick={() => setActiveTab("auctions")}
                  className="text-sm font-semibold text-gold-400 hover:text-gold-300 flex items-center gap-1"
                  whileHover={{ x: 3 }}
                >
                  View All <ArrowRight className="h-4 w-4" />
                </motion.button>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featuredAuctions.length === 0 ? (
                  <TiltCard glowColor="purple" className="col-span-full rounded-xl p-10">
                    <div className="text-center text-gray-400">
                      <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No featured auctions yet.</p>
                    </div>
                  </TiltCard>
                ) : (
                  featuredAuctions.slice(0, 3).map((auction: any) => (
                    <FeaturedAuctionCard key={auction.id} auction={auction} onBid={handleBid} />
                  ))
                )}
              </div>
            </div>

            {/* Shop Singles Section */}
            <div id="shop" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <ShoppingCart className="h-6 w-6 text-cyan-400" />
                  Shop Singles
                </h3>
                <span className="text-xs text-gray-400 px-3 py-1 bg-white/5 rounded-full">Coming Soon</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <TiltCard key={i} glowColor="cyan" className="rounded-xl p-4">
                    <div className="aspect-[3/4] overflow-hidden rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 to-black/60">
                      <div className="flex h-full items-center justify-center">
                        <Box className="h-12 w-12 text-cyan-400/40" />
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="font-bold text-white text-sm">Featured Single #{i}</div>
                        <div className="text-xs text-gray-400">Legendary • Season {5 + i}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <NumberFlowDisplay value={100 + i * 50} prefix="" suffix=" IxC" className="text-gold-400 text-sm font-black" />
                        <button className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-black text-black opacity-40 cursor-not-allowed">
                          Soon
                        </button>
                      </div>
                    </div>
                  </TiltCard>
                ))}
              </div>
            </div>

            {/* Limited Time Offers (placeholder for countdown timer) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Timer className="h-6 w-6 text-orange-400" />
                  Limited Time Offers
                </h3>
              </div>
              <TiltCard glowColor="orange" className="rounded-xl p-6">
                <div className="text-center text-gray-400">
                  <Timer className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Special offers will appear here with countdown timers</p>
                </div>
              </TiltCard>
            </div>
          </motion.div>
        )}

        {/* Auctions Tab */}
        {activeTab === "auctions" && (
          <motion.div
            key="auctions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Flame className="h-7 w-7 text-orange-400" />
                </motion.div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Live Auctions</h2>
                <motion.span
                  className="rounded-lg bg-orange-500/20 px-3 py-1 text-sm font-bold text-orange-400 border border-orange-500/30"
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {allAuctions.length} Active
                </motion.span>
              </div>
            </div>

            {/* Search and Controls */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search auctions by card name..."
                  className="w-full rounded-lg border border-white/20 bg-black/40 py-3 pl-12 pr-4 text-white placeholder-gray-500 backdrop-blur-md focus:border-orange-500 focus:outline-none transition-all glass-hierarchy-interactive"
                />
              </div>

              <motion.button
                onClick={() => setShowFilters(!showFilters)}
                className="glass-hierarchy-interactive flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-bold transition-all hover:bg-white/5 sm:w-auto"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Filter className="h-5 w-5" />
                <span className="hidden sm:inline">Filters</span>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", showFilters && "rotate-180")}
                />
              </motion.button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="glass-hierarchy-interactive rounded-lg px-6 py-3 font-bold text-white focus:outline-none focus:border-orange-500 transition-all"
              >
                <option value="endingSoon" className="bg-black">Ending Soon</option>
                <option value="price" className="bg-black">Price: Low to High</option>
                <option value="bids" className="bg-black">Most Bids</option>
              </select>
            </div>

            {/* Filters panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  className="glass-hierarchy-child overflow-hidden rounded-xl"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <div className="space-y-4 p-6">
                    <h3 className="text-lg font-bold text-white">Advanced Filters</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-400">
                          Rarity
                        </label>
                        <div className="space-y-2">
                          {["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"].map((rarity) => (
                            <label key={rarity} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedRarities.includes(rarity)}
                                onChange={() => {
                                  setSelectedRarities((prev) =>
                                    prev.includes(rarity)
                                      ? prev.filter((r) => r !== rarity)
                                      : [...prev, rarity]
                                  );
                                }}
                                className="h-4 w-4"
                              />
                              <span className="text-sm text-gray-300">{rarity}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Auction Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allAuctions.length === 0 ? (
                <TiltCard glowColor="orange" className="col-span-full rounded-2xl p-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Gavel className="mb-4 h-16 w-16 text-gray-400 opacity-40" />
                    <h3 className="mb-2 text-xl font-bold text-white">No Active Auctions</h3>
                    <p className="text-gray-400 mb-4">Check back soon for new listings!</p>
                    <motion.button
                      onClick={() => setActiveTab("search")}
                      className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-black text-black"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Browse All Cards
                    </motion.button>
                  </div>
                </TiltCard>
              ) : (
                allAuctions.map((auction: any) => (
                  <AuctionGridItem
                    key={auction.id}
                    auction={auction}
                    onBid={handleBid}
                    onWatch={handleWatch}
                    isWatched={watchedAuctions.has(auction.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* Card Search Tab */}
        {activeTab === "search" && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TiltCard glowColor="blue" className="rounded-xl p-2">
              <MarketBrowser showAnalytics currentUserId={userId || undefined} />
            </TiltCard>
          </motion.div>
        )}

        {/* My Bids Tab */}
        {activeTab === "bids" && (
          <motion.div
            key="bids"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TiltCard glowColor="purple" className="rounded-xl p-16">
              <div className="flex flex-col items-center justify-center text-center">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Gavel className="mb-4 h-16 w-16 text-purple-400 opacity-60" />
                </motion.div>
                <h3 className="mb-2 text-2xl font-bold text-white">My Bids</h3>
                <p className="mb-6 text-gray-400 max-w-md">
                  Track your active bids and bid history. See which auctions you're winning and manage your offers.
                </p>
                <div className="flex gap-3">
                  <motion.button
                    onClick={() => setActiveTab("auctions")}
                    className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-black text-black"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Browse Live Auctions
                  </motion.button>
                  <motion.button
                    onClick={() => setActiveTab("search")}
                    className="rounded-lg border border-purple-400/40 px-6 py-2.5 text-sm font-bold text-purple-200 hover:bg-white/5"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Search Cards
                  </motion.button>
                </div>
              </div>
            </TiltCard>
          </motion.div>
        )}

        {/* My Listings Tab */}
        {activeTab === "listings" && (
          <motion.div
            key="listings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TiltCard glowColor="gold" className="rounded-xl p-16">
              <div className="flex flex-col items-center justify-center text-center">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <BadgeDollarSign className="mb-4 h-16 w-16 text-gold-400 opacity-60" />
                </motion.div>
                <h3 className="mb-2 text-2xl font-bold text-white">My Listings</h3>
                <p className="mb-6 text-gray-400 max-w-md">
                  Create and manage your marketplace listings. Set prices, auction durations, and track sales.
                </p>
                <div className="flex gap-3">
                  <motion.button
                    className="rounded-lg bg-gold-500 px-6 py-2.5 text-sm font-black text-black opacity-60 cursor-not-allowed"
                    disabled
                  >
                    Create Listing (Soon)
                  </motion.button>
                  <motion.button
                    onClick={() => setActiveTab("store")}
                    className="rounded-lg border border-gold-400/40 px-6 py-2.5 text-sm font-bold text-gold-200 hover:bg-white/5"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Back to Store
                  </motion.button>
                </div>
              </div>
            </TiltCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
