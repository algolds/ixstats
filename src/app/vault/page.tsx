"use client";

import { Package, ShoppingCart, ShoppingBag, Folder, Sparkles, Star, Trophy, Layers, TrendingUp, Zap, Gift, ArrowRight, Lock } from "lucide-react";
import { VaultDashboard } from "~/components/vault/VaultDashboard";
import { TiltCard, TiltStatCard } from "~/components/vault/3DTiltCard";
import { VaultStatusIndicator } from "~/components/vault/VaultStatusIndicator";
import { useVaultStats } from "~/hooks/vault/useVaultStats";
import { useRecentActivity } from "~/hooks/vault/useRecentActivity";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Card, CardContent } from "~/components/ui/card";
import NumberFlow from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import Link from "next/link";

export default function VaultPage() {
  const { user } = useUser();
  const { stats, loading: statsLoading } = useVaultStats();
  const { activities, loading: activitiesLoading } = useRecentActivity();

  // Fetch today's earnings
  const { data: earningsData, isLoading: earningsLoading } =
    api.vault.getTodayEarnings.useQuery(undefined, {
      enabled: !!user,
    });

  // Fetch balance for login streak info
  const { data: balanceData, refetch: refetchBalance } = api.vault.getBalance.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );

  // Daily bonus mutation
  const claimDailyBonus = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      void refetchBalance();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleClaimDailyBonus = () => {
    claimDailyBonus.mutate();
  };

  const quickActions = [
    {
      label: "Open Pack",
      href: "/vault/packs",
      icon: Package,
      description: "Open your card packs",
      badge: stats?.unopenedPacks,
      badgeColor: "purple" as const,
    },
    {
      label: "Visit Market",
      href: "/vault/market",
      icon: ShoppingCart,
      description: "Browse card auctions",
      badge: stats?.activeAuctions,
      badgeColor: "blue" as const,
    },
    {
      label: "View Collections",
      href: "/vault/collections",
      icon: Folder,
      description: "Organize your cards",
      badge: undefined, // No badge for collections
      badgeColor: "gold" as const,
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Section - Vault Command Center */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="vault-card-featured relative overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
              {/* Left: 3D Holographic Vault */}
              <div className="flex items-center justify-center">
                <motion.div
                  className="relative"
                  animate={{
                    rotateY: [0, 360],
                  }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Vault Icon with glow */}
                  <div className="relative h-40 w-40 sm:h-48 sm:w-48 flex items-center justify-center">
                    <motion.div
                      className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-gold-500/20 blur-3xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.8, 0.5],
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                    <Lock className="relative h-24 w-24 sm:h-32 sm:w-32 text-gold-400" />
                    <motion.div
                      className="absolute -top-2 -right-2 px-3 py-1 rounded-full bg-green-500 text-white text-xs font-black shadow-lg shadow-green-500/50"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      SECURE
                    </motion.div>
                  </div>
                </motion.div>
              </div>

              {/* Right: Live Stats Grid */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">Vault Command Center</h2>
                  <p className="text-white/60 text-sm">Real-time overview of your collection</p>
                </div>

                {/* Security Status */}
                <VaultStatusIndicator
                  securityLevel={85}
                  status="secure"
                  size="md"
                  animated
                />

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg glass-hierarchy-child p-3 sm:p-4 vault-glow-gold">
                    <p className="text-xs text-white/60 mb-1">Total Cards</p>
                    <p className="text-2xl sm:text-3xl font-black text-gold-400">
                      <NumberFlow value={stats?.totalCards ?? 0} />
                    </p>
                  </div>
                  <div className="rounded-lg glass-hierarchy-child p-3 sm:p-4 vault-glow-purple">
                    <p className="text-xs text-white/60 mb-1">Deck Value</p>
                    <p className="text-xl sm:text-2xl font-black text-purple-400">
                      <NumberFlow value={stats?.deckValue ?? 0} />
                    </p>
                  </div>
                  <div className="rounded-lg glass-hierarchy-child p-3 sm:p-4">
                    <p className="text-xs text-white/60 mb-1">Weekly +/-</p>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
                      <p className="text-lg sm:text-xl font-black text-green-400">+12.5%</p>
                    </div>
                  </div>
                  <div className="rounded-lg glass-hierarchy-child p-3 sm:p-4">
                    <p className="text-xs text-white/60 mb-1">Collector Lvl</p>
                    <div className="flex items-center gap-2">
                      <Star className="h-3 w-3 sm:h-4 sm:w-4 text-gold-400 fill-gold-400" />
                      <p className="text-lg sm:text-xl font-black text-gold-400">7</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats with 3D Tilt Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TiltStatCard
          title="Total Cards"
          value={stats?.totalCards ?? 0}
          subtitle="In your collection"
          icon={Layers}
          glowColor="purple"
          trend="up"
          loading={statsLoading}
        />
        <TiltStatCard
          title="Deck Value"
          value={`${(stats?.deckValue ?? 0).toLocaleString()} IxC`}
          subtitle="Total market value"
          icon={TrendingUp}
          glowColor="gold"
          trend="up"
          loading={statsLoading}
        />
        <TiltStatCard
          title="Unopened Packs"
          value={stats?.unopenedPacks ?? 0}
          subtitle="Ready to open"
          icon={Package}
          glowColor="purple"
          loading={statsLoading}
        />
        <TiltStatCard
          title="Active Auctions"
          value={stats?.activeAuctions ?? 0}
          subtitle="In the market"
          icon={ShoppingBag}
          glowColor="cyan"
          loading={statsLoading}
        />
      </div>

      {/* Enhanced Quick Actions Grid */}
      <div>
        <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-gold-400" />
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Open Packs", desc: "Open your card packs", icon: Package, href: "/vault/packs", color: "purple", badge: stats?.unopenedPacks },
            { title: "Browse Market", desc: "Buy and sell cards", icon: ShoppingCart, href: "/vault/market", color: "blue" },
            { title: "Manage Collections", desc: "Organize your cards", icon: Layers, href: "/vault/collections", color: "gold" },
            { title: "Import Deck", desc: "Import from NS", icon: Gift, href: "/vault/import", color: "cyan" },
          ].map((action, index) => (
            <Link key={action.href} href={action.href}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <TiltCard
                  glowColor={action.color as any}
                  className="cursor-pointer h-full"
                  showSparkles
                >
                  <div className="p-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <div
                        className={cn(
                          "rounded-full p-3 bg-black/40",
                          action.color === "purple" && "ring-2 ring-purple-400/30",
                          action.color === "blue" && "ring-2 ring-blue-400/30",
                          action.color === "gold" && "ring-2 ring-gold-400/30",
                          action.color === "cyan" && "ring-2 ring-cyan-400/30"
                        )}
                      >
                        <action.icon
                          className={cn(
                            "h-6 w-6",
                            action.color === "purple" && "text-purple-400",
                            action.color === "blue" && "text-blue-400",
                            action.color === "gold" && "text-gold-400",
                            action.color === "cyan" && "text-cyan-400"
                          )}
                        />
                      </div>
                      {action.badge && action.badge > 0 && (
                        <motion.div
                          className="px-2 py-1 rounded-full bg-purple-500 text-white text-xs font-black"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {action.badge}
                        </motion.div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-white text-lg mb-1">{action.title}</h3>
                      <p className="text-sm text-white/60">{action.desc}</p>
                    </div>
                    <div className="flex items-center gap-1 text-white/60 text-sm font-semibold group-hover:text-white transition-colors">
                      Go <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Vault hub tiles */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-gold-400" />
          <h2 className="text-xl font-bold text-white">Your Vault Hub</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            { label: "Storefront", href: "/vault/market", icon: ShoppingCart, desc: "Buy cards, see featured" },
            { label: "Live Auctions", href: "/vault/market", icon: Trophy, desc: "Bid in real-time" },
            { label: "Card Browser", href: "/vault/market", icon: Star, desc: "Search market" },
            { label: "Packs", href: "/vault/packs", icon: Package, desc: "Open and buy packs" },
            { label: "Collections", href: "/vault/collections", icon: Folder, desc: "Organize and share" },
            { label: "Inventory", href: "/vault/inventory", icon: Star, desc: "Manage all cards" },
            { label: "NS Import", href: "/vault/import", icon: Sparkles, desc: "Import NationStates deck" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="group glass-hierarchy-child rounded-xl p-4 transition-all hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/5 p-2">
                    <Icon className="h-5 w-5 text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{item.label}</div>
                    <div className="text-xs text-gray-400">{item.desc}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Dashboard content */}
      <VaultDashboard
        stats={stats}
        todayEarnings={earningsData}
        recentActivity={activities}
        loginStreak={balanceData?.loginStreak ?? 0}
        dailyBonusAvailable={balanceData?.canClaimDailyBonus ?? false}
        loading={statsLoading || activitiesLoading || earningsLoading}
        onClaimDailyBonus={handleClaimDailyBonus}
      />
    </div>
  );
}
