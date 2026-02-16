"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Crown,
  ChevronRight,
  Briefcase,
  BarChart3,
  Globe,
  Swords,
  AlertTriangle,
} from "lucide-react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { SimpleFlag } from "~/components/SimpleFlag";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/url-utils";
import { Skeleton } from "~/components/ui/skeleton";

function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

const QUICK_LINKS = [
  { href: "/mycountry", icon: Crown, label: "Overview" },
  { href: "/mycountry/executive", icon: Briefcase, label: "Executive" },
  { href: "/mycountry/diplomacy", icon: Globe, label: "Diplomacy" },
  { href: "/mycountry/intelligence", icon: BarChart3, label: "Intelligence" },
  { href: "/mycountry/defense", icon: Swords, label: "Defense" },
] as const;

const VITALITY_BARS = [
  { key: "economicVitality", label: "Economy", hex: "#10b981" },
  { key: "populationWellbeing", label: "Social", hex: "#3b82f6" },
  { key: "diplomaticStanding", label: "Diplomacy", hex: "#6366f1" },
  { key: "governmentalEfficiency", label: "Governance", hex: "#f59e0b" },
] as const;

/* ── Liquid glass bar ── */
function GlassVitalityBar({ value, hex, delay }: { value: number; hex: string; delay: number }) {
  const pct = Math.min(value, 100);
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      {/* Track border */}
      <div className="absolute inset-0 rounded-full border border-black/5 dark:border-white/10" />

      {/* Animated fill */}
      <motion.div
        className="absolute inset-y-0 left-0 overflow-hidden rounded-full"
        style={{
          background: `linear-gradient(135deg, ${hex}50 0%, ${hex}90 40%, ${hex}b0 60%, ${hex}90 80%, ${hex}50 100%)`,
          boxShadow: `inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.15), 0 0 6px ${hex}30`,
        }}
        initial={{ width: "0%" }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1], delay }}
      >
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 40%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.35) 60%, transparent 100%)`,
          }}
          animate={{ x: ["-120%", "220%"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: delay + 1.5 }}
        />

        {/* Bubble dots */}
        {pct > 25 && (
          <>
            <motion.div
              className="absolute h-1 w-1 rounded-full bg-white/40"
              style={{ top: "15%", left: "35%" }}
              animate={{ scale: [0.4, 1, 0.4], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: delay + 0.8 }}
            />
            <motion.div
              className="absolute h-0.5 w-0.5 rounded-full bg-white/30"
              style={{ top: "55%", left: "65%" }}
              animate={{ scale: [0.3, 0.9, 0.3], opacity: [0.15, 0.4, 0.15] }}
              transition={{ duration: 2, repeat: Infinity, delay: delay + 1.6 }}
            />
          </>
        )}
      </motion.div>

    </div>
  );
}

export function DashboardPlayerWidget() {
  const { user, isSignedIn } = useUser();

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id },
  );

  const countryId = userProfile?.countryId || "";
  const hasCountry = !!countryId && countryId.trim() !== "";

  const { data: country, isLoading: countryLoading } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: hasCountry },
  );

  // Live vitality from getCountryDashboard (computed, not cached snapshots)
  const { data: dashboard } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: hasCountry },
  );

  const { data: rankings } = api.mycountry.getRankings.useQuery(
    { countryId },
    { enabled: hasCountry },
  );

  // Not signed in
  if (!isSignedIn) return null;

  const isLoading = profileLoading || countryLoading;

  if (isLoading) {
    return (
      <div className="w-56 space-y-3 rounded-xl border border-white/10 bg-white/60 p-3.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-11 rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-2 w-3/4 rounded-full" />
        </div>
      </div>
    );
  }

  if (!country || !hasCountry) {
    return (
      <div className="w-56 rounded-xl border border-white/10 bg-white/60 p-3.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
        <p className="text-xs text-muted-foreground text-center py-3">
          No country linked
        </p>
        <Link
          href={createUrl("/setup")}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
        >
          Complete Setup
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  // Resolved stats — prefer dashboard (same DB values rankings use), fallback to calculatedStats
  const stats = {
    gdpPerCapita: (dashboard as any)?.currentGdpPerCapita ?? country.calculatedStats?.currentGdpPerCapita ?? 0,
    population: (dashboard as any)?.currentPopulation ?? country.calculatedStats?.currentPopulation ?? 0,
    growth: (dashboard as any)?.adjustedGdpGrowth ?? country.calculatedStats?.adjustedGdpGrowth ?? country.adjustedGdpGrowth ?? 0,
    tier: (dashboard as any)?.economicTier ?? country.calculatedStats?.economicTier ?? "—",
  };

  // Rankings
  const gdpRank = rankings?.find((r) => r.category === "GDP per Capita");
  const popRank = rankings?.find((r) => r.category === "Population");

  // Vitality scores (live-computed)
  const vitality = dashboard
    ? {
        economicVitality: dashboard.economicVitality ?? 0,
        populationWellbeing: dashboard.populationWellbeing ?? 0,
        diplomaticStanding: dashboard.diplomaticStanding ?? 0,
        governmentalEfficiency: dashboard.governmentalEfficiency ?? 0,
        overallScore: dashboard.overallScore ?? 0,
      }
    : null;

  return (
    <div className="w-56 space-y-3 rounded-xl border border-white/10 bg-white/60 p-3.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
      {/* Country identity */}
      <Link
        href={createUrl("/mycountry")}
        className="group flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
      >
        <SimpleFlag countryName={country.name} size="md" className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold leading-tight">{country.name}</p>
          <p className="truncate text-[10px] text-muted-foreground">{country.leader}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>

      <div className="border-t border-border/40" />

      {/* At-a-glance stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-emerald-500/8 px-2.5 py-2 dark:bg-emerald-500/10">
          <p className="text-[10px] text-muted-foreground">GDP/Cap</p>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            ${formatCompact(stats.gdpPerCapita)}
          </p>
        </div>
        <div className="rounded-lg bg-blue-500/8 px-2.5 py-2 dark:bg-blue-500/10">
          <p className="text-[10px] text-muted-foreground">Population</p>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            {formatCompact(stats.population)}
          </p>
        </div>
        <div className="rounded-lg bg-amber-500/8 px-2.5 py-2 dark:bg-amber-500/10">
          <p className="text-[10px] text-muted-foreground">Growth</p>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {(stats.growth * 100).toFixed(2)}%
          </p>
        </div>
        <div className="rounded-lg bg-indigo-500/8 px-2.5 py-2 dark:bg-indigo-500/10">
          <p className="text-[10px] text-muted-foreground">Tier</p>
          <p className="truncate text-xs font-semibold text-indigo-700 dark:text-indigo-400">
            {stats.tier}
          </p>
        </div>
      </div>

      {/* Rankings */}
      {(gdpRank || popRank) && (
        <>
          <div className="border-t border-border/40" />
          <div className="space-y-1.5 px-0.5">
            {gdpRank && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">GDP Rank</span>
                <span className={cn(
                  "text-xs font-semibold",
                  gdpRank.trend === "improving" ? "text-green-600 dark:text-green-400" :
                  gdpRank.trend === "declining" ? "text-red-600 dark:text-red-400" :
                  "text-foreground",
                )}>
                  #{gdpRank.global.position}
                  <span className="text-[10px] font-normal text-muted-foreground">/{gdpRank.global.total}</span>
                </span>
              </div>
            )}
            {popRank && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Pop Rank</span>
                <span className={cn(
                  "text-xs font-semibold",
                  popRank.trend === "improving" ? "text-green-600 dark:text-green-400" :
                  popRank.trend === "declining" ? "text-red-600 dark:text-red-400" :
                  "text-foreground",
                )}>
                  #{popRank.global.position}
                  <span className="text-[10px] font-normal text-muted-foreground">/{popRank.global.total}</span>
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Vitality — liquid glass bars */}
      {vitality && (
        <>
          <div className="border-t border-border/40" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground">National Vitality</p>
              <p className="text-[10px] font-semibold">{vitality.overallScore}</p>
            </div>
            {VITALITY_BARS.map((bar, i) => {
              const val = vitality[bar.key] as number;
              return (
                <div key={bar.key} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{bar.label}</span>
                    <span className="text-[10px] font-medium">{val}</span>
                  </div>
                  <GlassVitalityBar value={val} hex={bar.hex} delay={i * 0.15} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Quick links */}
      <div className="border-t border-border/40" />
      <div className="space-y-0.5">
        <p className="px-0.5 text-[10px] font-medium text-muted-foreground">MyCountry</p>
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={createUrl(link.href)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
