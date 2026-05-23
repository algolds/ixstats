"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Crown,
  Briefcase,
  Globe,
  BarChart3,
  Swords,
  ChevronUp,
  Wallet,
  Flame,
  Map as MapIcon,
} from "lucide-react";
import { DashboardSidebarLayout } from "./DashboardSidebarLayout";
import { UnifiedDashboardSection } from "./sections/UnifiedDashboardSection";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { SimpleFlag } from "~/components/SimpleFlag";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";
import { HealthRing } from "~/components/ui/health-ring";

const CountryMapEmbed = dynamic(
  () => import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({ default: m.CountryMapEmbed })),
  { ssr: false, loading: () => <div className="h-52 animate-pulse rounded-xl bg-muted" /> }
);

const HERO_NAV = [
  { href: "/mycountry", icon: Crown, label: "Overview" },
  { href: "/mycountry/executive", icon: Briefcase, label: "Executive" },
  { href: "/mycountry/diplomacy", icon: Globe, label: "Diplomacy" },
  { href: "/mycountry/intelligence", icon: BarChart3, label: "Intelligence" },
  { href: "/mycountry/defense", icon: Swords, label: "Defense" },
] as const;

function DashboardHero() {
  const { user, isSignedIn } = useUser();
  const [collapsed, setCollapsed] = useState(false);

  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id },
  );
  const countryId = userProfile?.countryId || "";
  const hasCountry = !!countryId && countryId.trim() !== "";

  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: hasCountry },
  );
  const { data: rankings } = api.mycountry.getRankings.useQuery(
    { countryId },
    { enabled: hasCountry },
  );
  const { data: vaultData } = api.vault.getBalance.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id },
  );
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled: hasCountry },
  );

  if (!isSignedIn || !hasCountry || !country) return null;

  const gdpRank = rankings?.find((r) => r.category === "GDP per Capita");
  const newStats = (country as any)?.newStats ?? {};
  const stats = {
    tier: newStats.economicTier ?? "—",
    countryName: (country as any)?.country ?? "",
    leader: newStats.leader ?? "",
    continent: newStats.continent ?? "",
    governmentType: newStats.governmentType ?? "",
    slug: newStats.slug ?? "",
  };
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-sm backdrop-blur-lg">
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-4 py-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted/30 cursor-pointer"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <MapIcon className="h-3 w-3" />
          Your Nation
        </span>
        <ChevronUp className={cn("h-3 w-3 transition-transform", collapsed && "rotate-180")} />
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid gap-4 p-4 pt-1 md:grid-cols-5">
              {/* Map */}
              <div className="overflow-hidden rounded-xl border border-border/30 md:col-span-3">
                <CountryMapEmbed
                  countryId={countryId}
                  height="h-52"
                  showNeighbors={true}
                  showCities={true}
                  interactive={true}
                  boundsPadding={30}
                />
              </div>

              {/* At a Glance */}
              <div className="flex flex-col justify-between gap-3 md:col-span-2">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <SimpleFlag countryName={stats.countryName} size="lg" className="flex-shrink-0" />
                    <div>
                      <Link href={createUrl(`/countries/${stats.slug}`)} className="text-sm font-bold hover:underline">
                        {stats.countryName}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{stats.leader}</p>
                    </div>
                  </div>
                  {activityRingsData && (
                    <div className="grid grid-cols-4 gap-2 py-1">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <HealthRing value={activityRingsData.economicVitality || 0} size={56} color="#22c55e" label="Economic" />
                        <span className="text-[10px] font-medium text-green-700 dark:text-green-300">
                          {activityRingsData.economicVitality}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <HealthRing value={activityRingsData.populationWellbeing || 0} size={56} color="#3b82f6" label="Population" />
                        <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                          {activityRingsData.populationWellbeing}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <HealthRing value={activityRingsData.diplomaticStanding || 0} size={56} color="#a855f7" label="Diplomatic" />
                        <span className="text-[10px] font-medium text-purple-700 dark:text-purple-300">
                          {activityRingsData.diplomaticStanding}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <HealthRing value={activityRingsData.governmentalEfficiency || 0} size={56} color="#f97316" label="Government" />
                        <span className="text-[10px] font-medium text-orange-700 dark:text-orange-300">
                          {activityRingsData.governmentalEfficiency}%
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                      {stats.tier}
                    </span>
                    {gdpRank && (
                      <span className="rounded-md bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                        #{gdpRank.global.position}/{gdpRank.global.total}
                      </span>
                    )}
                  </div>
                </div>

                {/* Vault + Meta */}
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                  {vaultData && (
                    <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-amber-600 dark:text-amber-400">
                      <Wallet className="h-3 w-3" />
                      {vaultData.credits.toLocaleString()} IxC
                      <Flame className="h-2.5 w-2.5 ml-0.5" />
                      {vaultData.loginStreak}d
                    </span>
                  )}
                  {stats.continent && (
                    <span className="rounded-md bg-muted/50 px-2 py-1">{stats.continent}</span>
                  )}
                  {stats.governmentType && (
                    <span className="rounded-md bg-muted/50 px-2 py-1">{stats.governmentType}</span>
                  )}
                </div>

                {/* Quick nav pills */}
                <div className="flex flex-wrap gap-1">
                  {HERO_NAV.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={createUrl(link.href)}
                        className="flex items-center gap-1 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                      >
                        <Icon className="h-3 w-3" />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DashboardRouter() {
  const { data: globalStats } = api.countries.getGlobalStats.useQuery({});

  useEffect(() => {
    document.title = "Dashboard - IxStats";
  }, []);

  return (
    <DashboardSidebarLayout heroSection={<DashboardHero />}>
      <UnifiedDashboardSection globalStats={globalStats} />
    </DashboardSidebarLayout>
  );
}
