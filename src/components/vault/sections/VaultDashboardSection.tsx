"use client";

import { Package, ShoppingCart, Folder, Sparkles, Star, Trophy, ShoppingBag, Layers, TrendingUp, Zap, Gift, ArrowRight, Lock } from "lucide-react";
import { VaultDashboard } from "~/components/vault/VaultDashboard";
import { TiltCard, TiltStatCard } from "~/components/vault/3DTiltCard";
import { VaultStatusIndicator } from "~/components/vault/VaultStatusIndicator";
import { useVaultStats } from "~/hooks/vault/useVaultStats";
import { useRecentActivity } from "~/hooks/vault/useRecentActivity";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Card, CardContent } from "~/components/ui/card";
import NumberFlow from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import type { VaultSection } from "../VaultSidebarNav";

interface VaultDashboardSectionProps {
  onNavigate?: (section: VaultSection) => void;
}

export function VaultDashboardSection({ onNavigate }: VaultDashboardSectionProps) {
  const { user } = useUser();
  const { stats, loading: statsLoading } = useVaultStats();
  const { activities, loading: activitiesLoading } = useRecentActivity();

  const { data: earningsData, isLoading: earningsLoading } =
    api.vault.getTodayEarnings.useQuery(undefined, {
      enabled: !!user,
    });

  const { data: balanceData, refetch: refetchBalance } = api.vault.getBalance.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );

  const claimDailyBonus = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      void refetchBalance();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glass-hierarchy-parent relative overflow-hidden border border-white/10">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
              <div className="flex items-center justify-center">
                <motion.div
                  className="relative"
                  animate={{ rotateY: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className="relative flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
                    <motion.div
                      className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-amber-500/20 blur-3xl"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                    <Lock className="relative h-24 w-24 text-amber-400 sm:h-32 sm:w-32" />
                    <motion.div
                      className="absolute -right-2 -top-2 rounded-full bg-green-500 px-3 py-1 text-xs font-black text-white shadow-lg shadow-green-500/50"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      SECURE
                    </motion.div>
                  </div>
                </motion.div>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="mb-1 text-2xl font-black text-foreground sm:text-3xl">Vault Command Center</h2>
                  <p className="text-sm text-muted-foreground">Real-time overview of your collection</p>
                </div>

                <VaultStatusIndicator securityLevel={85} status="secure" size="md" animated />

                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
                    <p className="mb-1 text-xs text-muted-foreground">Total Cards</p>
                    <p className="text-2xl font-black text-amber-500 sm:text-3xl">
                      <NumberFlow value={stats?.totalCards ?? 0} />
                    </p>
                  </div>
                  <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
                    <p className="mb-1 text-xs text-muted-foreground">Deck Value</p>
                    <p className="text-xl font-black text-purple-400 sm:text-2xl">
                      <NumberFlow value={stats?.deckValue ?? 0} />
                    </p>
                  </div>
                  <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
                    <p className="mb-1 text-xs text-muted-foreground">Weekly +/-</p>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-green-400 sm:h-4 sm:w-4" />
                      <p className="text-lg font-black text-green-400 sm:text-xl">+12.5%</p>
                    </div>
                  </div>
                  <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
                    <p className="mb-1 text-xs text-muted-foreground">Collector Lvl</p>
                    <div className="flex items-center gap-2">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400 sm:h-4 sm:w-4" />
                      <p className="text-lg font-black text-amber-400 sm:text-xl">7</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats 3D Tilt Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TiltStatCard title="Total Cards" value={stats?.totalCards ?? 0} subtitle="In your collection" icon={Layers} glowColor="purple" trend="up" loading={statsLoading} />
        <TiltStatCard title="Deck Value" value={`${(stats?.deckValue ?? 0).toLocaleString()} IxC`} subtitle="Total market value" icon={TrendingUp} glowColor="gold" trend="up" loading={statsLoading} />
        <TiltStatCard title="Unopened Packs" value={stats?.unopenedPacks ?? 0} subtitle="Ready to open" icon={Package} glowColor="purple" loading={statsLoading} />
        <TiltStatCard title="Active Auctions" value={stats?.activeAuctions ?? 0} subtitle="In the market" icon={ShoppingBag} glowColor="cyan" loading={statsLoading} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-foreground">
          <Zap className="h-5 w-5 text-amber-400" />
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Open Packs", desc: "Open your card packs", icon: Package, section: "acquire" as VaultSection, color: "purple", badge: stats?.unopenedPacks },
            { title: "Browse Market", desc: "Buy and sell cards", icon: ShoppingCart, section: "acquire" as VaultSection, color: "blue" },
            { title: "Manage Collections", desc: "Organize your cards", icon: Layers, section: "cards" as VaultSection, color: "gold" },
            { title: "Import Deck", desc: "Import from NS", icon: Gift, section: "import" as VaultSection, color: "cyan" },
          ].map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <TiltCard
                glowColor={action.color as any}
                className="h-full cursor-pointer"
                showSparkles
                onClick={() => onNavigate?.(action.section)}
              >
                <div className="space-y-3 p-6">
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "rounded-full bg-black/40 p-3",
                        action.color === "purple" && "ring-2 ring-purple-400/30",
                        action.color === "blue" && "ring-2 ring-blue-400/30",
                        action.color === "gold" && "ring-2 ring-amber-400/30",
                        action.color === "cyan" && "ring-2 ring-cyan-400/30"
                      )}
                    >
                      <action.icon
                        className={cn(
                          "h-6 w-6",
                          action.color === "purple" && "text-purple-400",
                          action.color === "blue" && "text-blue-400",
                          action.color === "gold" && "text-amber-400",
                          action.color === "cyan" && "text-cyan-400"
                        )}
                      />
                    </div>
                    {action.badge && action.badge > 0 && (
                      <motion.div
                        className="rounded-full bg-purple-500 px-2 py-1 text-xs font-black text-white"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {action.badge}
                      </motion.div>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1 text-lg font-black text-white">{action.title}</h3>
                    <p className="text-sm text-white/60">{action.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-white/60 transition-colors group-hover:text-white">
                    Go <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Dashboard content (earnings, activity, streak) */}
      <VaultDashboard
        stats={stats}
        todayEarnings={earningsData}
        recentActivity={activities}
        loginStreak={balanceData?.loginStreak ?? 0}
        dailyBonusAvailable={balanceData?.canClaimDailyBonus ?? false}
        loading={statsLoading || activitiesLoading || earningsLoading}
        onClaimDailyBonus={() => claimDailyBonus.mutate()}
      />
    </div>
  );
}
