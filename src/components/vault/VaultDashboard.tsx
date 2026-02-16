"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  TrendingUp,
  Package,
  ShoppingBag,
  Layers,
  Calendar,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "motion/react";
import React, { useState, useEffect } from "react";

interface EarningSource {
  type: string;
  label: string;
  amount: number;
}

interface RecentActivity {
  id: string;
  type: string;
  amount: number;
  source: string;
  createdAt: Date;
}

interface VaultStats {
  totalCards: number;
  deckValue: number;
  unopenedPacks: number;
  activeAuctions: number;
}

interface VaultDashboardProps {
  stats?: VaultStats;
  todayEarnings?: {
    total: number;
    sources: EarningSource[];
  };
  recentActivity?: RecentActivity[];
  loginStreak?: number;
  dailyBonusAvailable?: boolean;
  loading?: boolean;
  onClaimDailyBonus?: () => void;
}

/**
 * Animated counter component with morphing numbers
 */
const AnimatedCounter = React.memo(({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000; // 1 second
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.span
      key={displayValue}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="tabular-nums"
    >
      {displayValue.toLocaleString()}
      {suffix}
    </motion.span>
  );
});

AnimatedCounter.displayName = "AnimatedCounter";

/**
 * 3D Stat Card with tilt and shimmer effects
 */
const StatCard = React.memo(
  ({
    title,
    value,
    subtitle,
    icon: Icon,
    color,
    loading,
    trend,
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    loading?: boolean;
    trend?: "up" | "down" | "neutral";
  }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 300, damping: 20 });
    const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), { stiffness: 300, damping: 20 });
    const [isHovering, setIsHovering] = useState(false);

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      x.set((event.clientX - centerX) / rect.width);
      y.set((event.clientY - centerY) / rect.height);
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
      setIsHovering(false);
    };

    const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

    return (
      <motion.div
        style={{ perspective: 1000 }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={handleMouseLeave}
        >
          <Card className="glass-hierarchy-child relative overflow-hidden transition-all duration-300 vault-glow-gold">
            {/* Shimmer overlay on hover */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{
                background: isHovering
                  ? "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)"
                  : "transparent",
                backgroundPosition: isHovering ? ["0% 0%", "200% 200%"] : "0% 0%",
              }}
              transition={{ duration: 1.5, repeat: isHovering ? Infinity : 0 }}
              style={{ backgroundSize: "200% 200%" }}
            />

            {/* Sparkle effects on corners */}
            <AnimatePresence>
              {isHovering && (
                <>
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    className="absolute top-2 right-2"
                  >
                    <Sparkles className={cn("h-3 w-3", color)} />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                    className="absolute bottom-2 left-2"
                  >
                    <Sparkles className={cn("h-3 w-3", color)} />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
              <motion.div
                animate={{ rotate: isHovering ? 360 : 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                <Icon className={cn("h-3 w-3 sm:h-4 sm:w-4", color)} />
              </motion.div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" />
              ) : (
                <div className="space-y-1">
                  <div className={cn("text-xl sm:text-2xl font-bold", color)}>
                    {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                    {trend && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-1"
                      >
                        <TrendIcon
                          className={cn(
                            "h-3 w-3",
                            trend === "up" && "text-green-400",
                            trend === "down" && "text-red-400",
                            trend === "neutral" && "text-gray-400"
                          )}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>

            {/* Bottom glow line - keep subtle */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{
                background: `linear-gradient(90deg, transparent, ${color.includes("gold") ? "rgb(251, 191, 36)" : color.includes("green") ? "rgb(34, 197, 94)" : color.includes("purple") ? "rgb(168, 85, 247)" : "rgb(59, 130, 246)"}, transparent)`,
              }}
              animate={{ opacity: isHovering ? [0.2, 0.4, 0.2] : 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </Card>
        </motion.div>
      </motion.div>
    );
  }
);

StatCard.displayName = "StatCard";

export function VaultDashboard({
  stats,
  todayEarnings,
  recentActivity,
  loginStreak = 0,
  dailyBonusAvailable = false,
  loading = false,
  onClaimDailyBonus,
}: VaultDashboardProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick stats grid with 3D cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Cards"
          value={stats?.totalCards ?? 0}
          subtitle="In your collection"
          icon={Layers}
          color="text-gold-400"
          loading={loading}
          trend="up"
        />
        <StatCard
          title="Deck Value"
          value={`${(stats?.deckValue ?? 0).toLocaleString()} IxC`}
          subtitle="Total market value"
          icon={TrendingUp}
          color="text-green-400"
          loading={loading}
          trend="up"
        />
        <StatCard
          title="Unopened Packs"
          value={stats?.unopenedPacks ?? 0}
          subtitle="Ready to open"
          icon={Package}
          color="text-purple-400"
          loading={loading}
        />
        <StatCard
          title="Active Auctions"
          value={stats?.activeAuctions ?? 0}
          subtitle="In the market"
          icon={ShoppingBag}
          color="text-blue-400"
          loading={loading}
        />
      </div>

      {/* Today's earnings with animation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass-hierarchy-child vault-glow-gold relative overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
                <Calendar className="h-5 w-5 text-gold-400" />
              </motion.div>
              Today&apos;s Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="mb-4 text-2xl sm:text-3xl font-bold text-gold-400"
                >
                  +<AnimatedCounter value={todayEarnings?.total ?? 0} suffix=" IxC" />
                </motion.div>
                <div className="space-y-2">
                  {todayEarnings?.sources.map((source, index) => (
                    <motion.div
                      key={`${source.type}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      className="flex items-center justify-between rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
                    >
                      <span className="text-sm">{source.label}</span>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="font-semibold text-gold-400"
                      >
                        +{source.amount.toLocaleString()} IxC
                      </motion.span>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Login streak with flame animation */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <Card className="glass-hierarchy-child relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, -5, 5, 0],
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Flame className="h-5 w-5 text-orange-400" />
                </motion.div>
                Login Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="mb-4 text-3xl sm:text-4xl font-bold text-orange-400"
              >
                <AnimatedCounter value={loginStreak} suffix=" days" />
              </motion.div>
              {dailyBonusAvailable && onClaimDailyBonus && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClaimDailyBonus}
                  className="w-full rounded-lg bg-gold-500 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold text-black transition-all shadow-lg shadow-gold-500/30 hover:shadow-gold-500/50 touch-manipulation relative overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="relative">Claim Daily Bonus</span>
                </motion.button>
              )}
              {!dailyBonusAvailable && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground"
                >
                  Come back tomorrow to claim your next bonus
                </motion.p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent activity with animations */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <motion.div animate={{ y: [-2, 2, -2] }} transition={{ duration: 2, repeat: Infinity }}>
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                </motion.div>
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto hide-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {recentActivity?.slice(0, 10).map((activity, index) => {
                      const isPositive = activity.type.startsWith("EARN_");
                      const Icon = isPositive ? ArrowUp : isPositive === false ? ArrowDown : Minus;

                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02, x: 4 }}
                          className="flex items-center justify-between rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
                        >
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{ y: isPositive ? [-2, 0, -2] : [2, 0, 2] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              <Icon
                                className={cn(
                                  "h-4 w-4",
                                  isPositive ? "text-green-400" : "text-red-400"
                                )}
                              />
                            </motion.div>
                            <span className="text-sm">{activity.source}</span>
                          </div>
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={cn(
                              "font-semibold",
                              isPositive ? "text-green-400" : "text-red-400"
                            )}
                          >
                            {isPositive ? "+" : "-"}
                            {Math.abs(activity.amount).toLocaleString()} IxC
                          </motion.span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
