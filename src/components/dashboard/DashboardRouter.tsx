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
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { SECTION_THEME_CLASSES } from "~/lib/mycountry-theme";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-52 animate-pulse rounded-xl" /> }
);

const HERO_NAV = [
  { href: "/mycountry", icon: Crown, label: "Overview", theme: SECTION_THEME_CLASSES.overview },
  {
    href: "/mycountry/executive",
    icon: Briefcase,
    label: "Executive",
    theme: SECTION_THEME_CLASSES.executive,
  },
  {
    href: "/mycountry/diplomacy",
    icon: Globe,
    label: "Diplomacy",
    theme: SECTION_THEME_CLASSES.diplomacy,
  },
  {
    href: "/mycountry/intelligence",
    icon: BarChart3,
    label: "Intelligence",
    theme: SECTION_THEME_CLASSES.intelligence,
  },
  {
    href: "/mycountry/defense",
    icon: Swords,
    label: "Defense",
    theme: SECTION_THEME_CLASSES.defense,
  },
] as const;

function DashboardHero() {
  const { user, isSignedIn } = useUser();
  const [collapsed, setCollapsed] = useState(false);

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });
  const countryId = userProfile?.countryId || "";
  const hasCountry = !!countryId && countryId.trim() !== "";

  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: hasCountry }
  );
  const { data: rankings } = api.mycountry.getRankings.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  const { data: vaultData } = api.vault.getBalance.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled: hasCountry }
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
    <div className="border-border/50 bg-card/80 overflow-hidden rounded-xl border shadow-sm backdrop-blur-lg">
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="text-muted-foreground hover:bg-muted/30 flex w-full cursor-pointer items-center justify-between px-4 py-2 text-[10px] transition-colors"
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
              <div className="border-border/30 overflow-hidden rounded-xl border md:col-span-3">
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
                  <div className="mb-2 flex items-center gap-2.5">
                    <SimpleFlag
                      countryName={stats.countryName}
                      size="lg"
                      className="flex-shrink-0"
                    />
                    <div>
                      <Link
                        href={createUrl(`/countries/${stats.slug}`)}
                        className="text-sm font-bold hover:underline"
                      >
                        {stats.countryName}
                      </Link>
                      <p className="text-muted-foreground text-[10px]">{stats.leader}</p>
                    </div>
                  </div>
                  {activityRingsData && (
                    <div className="grid grid-cols-4 gap-2 py-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex cursor-help flex-col items-center gap-1 text-center">
                            <HealthRing
                              value={activityRingsData.economicVitality || 0}
                              size={56}
                              color="#22c55e"
                              label="Economic"
                            />
                            <span className="text-[10px] font-medium text-green-700 dark:text-green-300">
                              {activityRingsData.economicVitality}%
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="glass-none bg-popover text-popover-foreground border-border text-xs shadow-md"
                        >
                          <div className="mb-0.5 font-bold text-green-500">Economic Vitality</div>
                          <div className="text-muted-foreground text-[11px]">
                            Overall health, including GDP growth trajectory, tier, employment, and
                            trade balance.
                          </div>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex cursor-help flex-col items-center gap-1 text-center">
                            <HealthRing
                              value={activityRingsData.populationWellbeing || 0}
                              size={56}
                              color="#3b82f6"
                              label="Population"
                            />
                            <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                              {activityRingsData.populationWellbeing}%
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="glass-none bg-popover text-popover-foreground border-border text-xs shadow-md"
                        >
                          <div className="mb-0.5 font-bold text-blue-500">Population Wellbeing</div>
                          <div className="text-muted-foreground text-[11px]">
                            Quality of life metrics, life expectancy, education rating, social
                            safety net, and literacy.
                          </div>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex cursor-help flex-col items-center gap-1 text-center">
                            <HealthRing
                              value={activityRingsData.diplomaticStanding || 0}
                              size={56}
                              color="#a855f7"
                              label="Diplomatic"
                            />
                            <span className="text-[10px] font-medium text-purple-700 dark:text-purple-300">
                              {activityRingsData.diplomaticStanding}%
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="glass-none bg-popover text-popover-foreground border-border text-xs shadow-md"
                        >
                          <div className="mb-0.5 font-bold text-purple-500">
                            Diplomatic Standing
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            International influence, alliance memberships, treaty compliance, and
                            global reputation.
                          </div>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex cursor-help flex-col items-center gap-1 text-center">
                            <HealthRing
                              value={activityRingsData.governmentalEfficiency || 0}
                              size={56}
                              color="#f97316"
                              label="Government"
                            />
                            <span className="text-[10px] font-medium text-orange-700 dark:text-orange-300">
                              {activityRingsData.governmentalEfficiency}%
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="glass-none bg-popover text-popover-foreground border-border text-xs shadow-md"
                        >
                          <div className="mb-0.5 font-bold text-orange-500">
                            Governmental Efficiency
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            Public service delivery, budget stability, tax structure efficiency, and
                            political stability.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                      {stats.tier}
                    </span>
                    {gdpRank && (
                      <span className="bg-muted/50 text-muted-foreground rounded-md px-2 py-0.5 text-[10px]">
                        #{gdpRank.global.position}/{gdpRank.global.total}
                      </span>
                    )}
                  </div>
                </div>

                {/* Vault + Meta */}
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-[10px]">
                  {vaultData && (
                    <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-amber-600 dark:text-amber-400">
                      <Wallet className="h-3 w-3" />
                      {vaultData.credits.toLocaleString()} IxC
                      <Flame className="ml-0.5 h-2.5 w-2.5" />
                      {vaultData.loginStreak}d
                    </span>
                  )}
                  {stats.continent && (
                    <span className="bg-muted/50 rounded-md px-2 py-1">{stats.continent}</span>
                  )}
                  {stats.governmentType && (
                    <span className="bg-muted/50 rounded-md px-2 py-1">{stats.governmentType}</span>
                  )}
                </div>

                {/* Quick nav pills */}
                <div className="flex flex-wrap gap-1">
                  {HERO_NAV.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all duration-200",
                          "text-muted-foreground hover:text-foreground",
                          link.theme.gradient,
                          "bg-gradient-to-r from-transparent via-transparent to-transparent hover:shadow-md",
                          link.label === "Overview" &&
                            "hover:from-amber-500/10 hover:to-yellow-500/10 hover:shadow-amber-500/30",
                          link.label === "Executive" &&
                            "hover:from-amber-500/10 hover:to-yellow-500/10 hover:shadow-amber-500/30",
                          link.label === "Diplomacy" &&
                            "hover:from-cyan-500/10 hover:to-blue-500/10 hover:shadow-cyan-500/30",
                          link.label === "Intelligence" &&
                            "hover:from-blue-500/10 hover:to-cyan-500/10 hover:shadow-blue-500/30",
                          link.label === "Defense" &&
                            "hover:from-red-500/10 hover:to-orange-500/10 hover:shadow-red-500/30"
                        )}
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
