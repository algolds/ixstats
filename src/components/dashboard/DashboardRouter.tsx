// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
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
  Bell,
  FileText,
  Layers,
  Building2,
  Handshake,
  Sparkles,
  Shield,
  Sword,
  Target,
  Activity,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";
import { DashboardSidebarLayout } from "./DashboardSidebarLayout";
import { UnifiedDashboardSection } from "./sections/UnifiedDashboardSection";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { SimpleFlag } from "~/components/SimpleFlag";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { SECTION_THEME_CLASSES } from "~/lib/mycountry-theme";
import { EconomicTierBadge, PopulationTierBadge, LocationBadge } from "~/components/ui/tier-badge";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "~/components/ui/icons";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-52 animate-pulse rounded-xl" /> }
);

const HERO_NAV = [
  {
    section: "Overview" as const,
    icon: Crown,
    label: "Overview",
    theme: SECTION_THEME_CLASSES.overview,
  },
  {
    section: "Executive" as const,
    icon: Briefcase,
    label: "Executive",
    theme: SECTION_THEME_CLASSES.executive,
  },
  {
    section: "Diplomacy" as const,
    icon: Globe,
    label: "Diplomacy",
    theme: SECTION_THEME_CLASSES.diplomacy,
  },
  {
    section: "Intelligence" as const,
    icon: BarChart3,
    label: "Intelligence",
    theme: SECTION_THEME_CLASSES.intelligence,
  },
  {
    section: "Defense" as const,
    icon: Swords,
    label: "Defense",
    theme: SECTION_THEME_CLASSES.defense,
  },
] as const;

type HeroSection = "Overview" | "Executive" | "Diplomacy" | "Intelligence" | "Defense";

// ── Normalize growth rates that may be stored as raw decimals ──
function normalizeGrowth(value: number | null | undefined): number {
  if (!value || !isFinite(value)) return 0;
  let v = value;
  while (Math.abs(v) > 50) v /= 100;
  return Math.min(20, Math.max(-20, v));
}

// ── Compact stat pill for section snapshots ──
function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Shield;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1.5">
      <Icon className={cn("h-3 w-3 shrink-0", color)} />
      <div className="min-w-0">
        <p className="text-muted-foreground/60 text-[8px] tracking-wider uppercase">{label}</p>
        <p className="text-foreground text-[11px] font-bold">{value}</p>
      </div>
    </div>
  );
}

function DashboardHero({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
}) {
  const { user, isSignedIn } = useUser();
  const [activeSection, setActiveSection] = useState<HeroSection>("Overview");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggleable metric views for Overview
  const [metricView, setMetricView] = useState({
    gdp: "perCapita" as "perCapita" | "total",
    population: "total" as "total" | "density",
    area: "km" as "km" | "mi",
  });

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

  // ── Section-specific data ──
  // Executive
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: hasCountry && (activeSection === "Executive" || activeSection === "Overview") }
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: hasCountry && activeSection === "Executive" }
  );

  // Diplomacy
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: hasCountry && (activeSection === "Diplomacy" || activeSection === "Intelligence") }
  );
  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: hasCountry && activeSection === "Diplomacy" }
  );

  // Intelligence
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId },
    { enabled: hasCountry && (activeSection === "Intelligence" || activeSection === "Defense") }
  );
  const { data: intelligenceOverview } = api.intelCore.getOverview.useQuery(
    { countryId },
    { enabled: hasCountry && activeSection === "Intelligence" }
  );

  // Defense
  const { data: securityData } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: hasCountry && activeSection === "Defense" }
  );
  const { data: militaryBranches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: hasCountry && activeSection === "Defense" }
  );

  // Auto-cycle timer (60s of inactivity)
  const autoCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastInteractionRef = useRef(Date.now());

  const resetAutoCycle = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  useEffect(() => {
    autoCycleRef.current = setInterval(() => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed >= 60_000) {
        setActiveSection((prev) => {
          const sections: HeroSection[] = [
            "Overview",
            "Executive",
            "Diplomacy",
            "Intelligence",
            "Defense",
          ];
          const idx = sections.indexOf(prev);
          return sections[(idx + 1) % sections.length]!;
        });
      }
    }, 60_000);
    return () => {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    };
  }, []);

  const handlePillHover = useCallback(
    (label: HeroSection) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setActiveSection(label);
      }, 400);
      resetAutoCycle();
    },
    [resetAutoCycle]
  );

  const handlePillLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);

  const handlePillClick = useCallback(
    (label: HeroSection) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setActiveSection(label);
      resetAutoCycle();
    },
    [resetAutoCycle]
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
    gdpPerCapita: newStats.currentGdpPerCapita ?? 0,
    population: newStats.currentPopulation ?? 0,
    populationTier: newStats.populationTier ?? "1",
    // For At-a-Glance
    currentTotalGdp: newStats.currentTotalGdp ?? 0,
    economicTier: newStats.economicTier ?? "Developing",
    populationDensity: newStats.populationDensity ?? null,
    landArea: newStats.landArea ?? null,
    areaSqMi: newStats.areaSqMi ?? null,
    gdpGrowth: normalizeGrowth(newStats.realGDPGrowthRate || newStats.adjustedGdpGrowth),
    popGrowth: normalizeGrowth(newStats.populationGrowthRate),
    maxGdpGrowthRate: newStats.maxGdpGrowthRate ?? 0,
  };

  const econTier = stats.gdpPerCapita ? getEconomicTierFromGdpPerCapita(stats.gdpPerCapita) : null;
  const popTier = stats.population ? getPopulationTierFromPopulation(stats.population) : null;

  // ── Section snapshot renderers ──
  const renderSectionContent = () => {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {activeSection === "Overview" && renderOverviewSnapshot()}
          {activeSection === "Executive" && renderExecutiveSnapshot()}
          {activeSection === "Diplomacy" && renderDiplomacySnapshot()}
          {activeSection === "Intelligence" && renderIntelligenceSnapshot()}
          {activeSection === "Defense" && renderDefenseSnapshot()}
        </motion.div>
      </AnimatePresence>
    );
  };

  // ── Overview: At a Glance (toggleable) ──
  const renderOverviewSnapshot = () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="grid grid-cols-3 gap-1.5 py-1">
          <button
            onClick={() =>
              setMetricView((v) => ({
                ...v,
                gdp: v.gdp === "perCapita" ? "total" : "perCapita",
              }))
            }
            className="rounded-lg bg-white/[0.04] p-2 text-left transition-all hover:bg-white/[0.07] active:scale-[0.98]"
          >
            <p className="text-muted-foreground/60 text-[8px] font-medium tracking-wider uppercase">
              {metricView.gdp === "perCapita" ? "GDP/Cap" : "Total GDP"}
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              <p className="text-foreground text-sm font-bold tracking-tight">
                $
                {metricView.gdp === "perCapita"
                  ? Math.round(stats.gdpPerCapita).toLocaleString("en-US")
                  : Math.round(stats.currentTotalGdp).toLocaleString("en-US")}
              </p>
              {stats.gdpGrowth !== 0 && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[9px] font-semibold",
                    stats.gdpGrowth > 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {stats.gdpGrowth > 0 ? (
                    <ArrowTrendingUpIcon size={10} />
                  ) : (
                    <ArrowTrendingDownIcon size={10} />
                  )}
                  {stats.gdpGrowth > 0 ? "+" : ""}
                  {stats.gdpGrowth.toFixed(1)}%
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() =>
              setMetricView((v) => ({
                ...v,
                population: v.population === "total" ? "density" : "total",
              }))
            }
            className="rounded-lg bg-white/[0.04] p-2 text-left transition-all hover:bg-white/[0.07] active:scale-[0.98]"
          >
            <p className="text-muted-foreground/60 text-[8px] font-medium tracking-wider uppercase">
              {metricView.population === "total" ? "Population" : "Density"}
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              <p className="text-foreground text-sm font-bold tracking-tight">
                {metricView.population === "total"
                  ? Math.round(stats.population).toLocaleString("en-US")
                  : stats.populationDensity
                    ? `${Math.round(stats.populationDensity).toLocaleString()}/km²`
                    : "N/A"}
              </p>
              {stats.popGrowth !== 0 && metricView.population === "total" && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[9px] font-semibold",
                    stats.popGrowth > 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {stats.popGrowth > 0 ? "+" : ""}
                  {stats.popGrowth.toFixed(1)}%
                </span>
              )}
            </div>
          </button>
          <button
            onClick={
              stats.areaSqMi && stats.landArea
                ? () => setMetricView((v) => ({ ...v, area: v.area === "km" ? "mi" : "km" }))
                : undefined
            }
            className={cn(
              "rounded-lg bg-white/[0.04] p-2 text-left transition-all",
              stats.areaSqMi && stats.landArea && "hover:bg-white/[0.07] active:scale-[0.98]"
            )}
          >
            <p className="text-muted-foreground/60 text-[8px] font-medium tracking-wider uppercase">
              Land Area
            </p>
            <p className="text-foreground mt-0.5 text-sm font-bold tracking-tight">
              {metricView.area === "km"
                ? stats.landArea
                  ? `${stats.landArea.toLocaleString()} km²`
                  : "N/A"
                : stats.areaSqMi
                  ? `${stats.areaSqMi.toLocaleString()} mi²`
                  : "N/A"}
            </p>
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">Click metrics to toggle views</TooltipContent>
    </Tooltip>
  );

  // ── Executive snapshot ──
  const renderExecutiveSnapshot = () => {
    const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
    const totalPolicies = policies?.length ?? 0;
    const pendingActions =
      meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0;

    return (
      <div className="grid grid-cols-3 gap-1.5 py-1">
        <StatPill icon={Bell} label="Issues" value="Pending" color="text-amber-500" />
        <StatPill
          icon={FileText}
          label="Policies"
          value={`${activePolicies}/${totalPolicies}`}
          color="text-amber-500"
        />
        <StatPill
          icon={Layers}
          label="Actions"
          value={pendingActions > 0 ? `${pendingActions} pending` : "All clear"}
          color={pendingActions > 0 ? "text-orange-500" : "text-emerald-500"}
        />
      </div>
    );
  };

  // ── Diplomacy snapshot ──
  const renderDiplomacySnapshot = () => {
    const activeEmbs =
      embassies?.filter((e) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const totalRelations = relations?.length ?? 0;
    const avgStrength =
      totalRelations > 0
        ? Math.round(relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
        : 0;
    const strongTies = relations?.filter((r) => (r.strength ?? 0) >= 70).length ?? 0;

    return (
      <div className="grid grid-cols-4 gap-1 py-1">
        <StatPill
          icon={Building2}
          label="Embassies"
          value={`${activeEmbs}`}
          color="text-cyan-500"
        />
        <StatPill
          icon={Handshake}
          label="Relations"
          value={`${totalRelations}`}
          color="text-blue-500"
        />
        <StatPill
          icon={Globe}
          label="Avg Str."
          value={`${avgStrength}%`}
          color="text-emerald-500"
        />
        <StatPill
          icon={Sparkles}
          label="Allies"
          value={`${strongTies}`}
          color={strongTies > 0 ? "text-purple-500" : "text-slate-500"}
        />
      </div>
    );
  };

  // ── Intelligence snapshot ──
  const renderIntelligenceSnapshot = () => {
    const secScore = defenseOverview?.overallScore ?? 0;
    const critAlerts = intelligenceOverview?.alerts?.critical ?? 0;
    const activeEmbs =
      embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;

    return (
      <div className="grid grid-cols-3 gap-1.5 py-1">
        <StatPill icon={Shield} label="Security" value={`${secScore}/100`} color="text-blue-500" />
        <StatPill
          icon={AlertTriangle}
          label="Alerts"
          value={critAlerts > 0 ? `${critAlerts} critical` : "Clear"}
          color={critAlerts > 0 ? "text-red-500" : "text-emerald-500"}
        />
        <StatPill
          icon={Globe}
          label="Network"
          value={`${activeEmbs} active`}
          color="text-blue-500"
        />
      </div>
    );
  };

  // ── Defense snapshot ──
  const renderDefenseSnapshot = () => {
    const secScore = securityData?.overallSecurityScore ?? 0;
    const branchCount = militaryBranches?.length ?? 0;
    const avgReadiness =
      branchCount > 0
        ? Math.round(
            militaryBranches!.reduce((sum, b) => sum + (b.readinessLevel ?? 0), 0) / branchCount
          )
        : 0;
    const threats = securityData?.activeThreatCount ?? 0;

    return (
      <div className="grid grid-cols-4 gap-1 py-1">
        <StatPill
          icon={Shield}
          label="Security"
          value={`${secScore}/100`}
          color={
            secScore >= 75
              ? "text-emerald-500"
              : secScore >= 50
                ? "text-blue-500"
                : "text-orange-500"
          }
        />
        <StatPill icon={Sword} label="Branches" value={`${branchCount}`} color="text-red-500" />
        <StatPill
          icon={Target}
          label="Readiness"
          value={`${avgReadiness}%`}
          color={avgReadiness >= 70 ? "text-emerald-500" : "text-yellow-500"}
        />
        <StatPill
          icon={Activity}
          label="Threats"
          value={`${threats}`}
          color={threats > 0 ? "text-red-500" : "text-emerald-500"}
        />
      </div>
    );
  };

  return (
    <div className="glass-surface glass-refraction overflow-hidden rounded-xl shadow-sm">
      <button
        onClick={() => onCollapsedChange(true)}
        className="text-muted-foreground hover:bg-muted/30 flex w-full cursor-pointer items-center justify-end px-4 py-1.5 text-[10px] transition-colors"
      >
        <ChevronUp className="h-3 w-3 shrink-0" />
      </button>

      <div className="grid gap-4 p-4 pt-1 md:grid-cols-5">
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

        <div className="flex flex-col justify-between gap-3 md:col-span-2">
          <div>
            <div className="mb-2 flex items-center gap-2.5">
              <SimpleFlag countryName={stats.countryName} size="lg" className="shrink-0" />
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

            {renderSectionContent()}

            <div className="flex flex-wrap items-center gap-1.5">
              {econTier && <EconomicTierBadge tier={econTier} />}
              {popTier && <PopulationTierBadge tier={popTier} />}
              {gdpRank && (
                <span className="bg-muted/50 text-muted-foreground rounded-md px-2 py-0.5 text-[10px]">
                  #{gdpRank.global.position}/{gdpRank.global.total}
                </span>
              )}
            </div>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[10px]">
            {vaultData && (
              <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-amber-600 dark:text-amber-400">
                <Wallet className="h-3 w-3" />
                {vaultData.credits.toLocaleString()} IxC
                <Flame className="ml-0.5 h-2.5 w-2.5" />
                {vaultData.loginStreak}d
              </span>
            )}
            {stats.continent && <LocationBadge type="continent" value={stats.continent} />}
            {stats.governmentType && (
              <LocationBadge type="government" value={stats.governmentType} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {HERO_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.label;
              const colors = SECTION_THEME_CLASSES[item.label] ?? {};
              return (
                <button
                  key={item.label}
                  onMouseEnter={() => handlePillHover(item.label)}
                  onMouseLeave={handlePillLeave}
                  onClick={() => handlePillClick(item.label)}
                  className={cn(
                    "flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[9px] transition-all",
                    isActive
                      ? cn("font-semibold", colors.bg, colors.text)
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {item.label}
                </button>
              );
            })}
            <Link
              href={createUrl("/mycountry")}
              className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-0.5 text-[9px] transition-colors"
            >
              Go to MyCountry →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DashboardRouterProps {
  discordBadge?: ReactNode;
}

export function DashboardRouter({ discordBadge }: DashboardRouterProps) {
  const { data: globalStats } = api.countries.getGlobalStats.useQuery({});
  const [heroCollapsed, setHeroCollapsed] = useState(false);

  useEffect(() => {
    document.title = "Dashboard - IxStats";
  }, []);

  return (
    <DashboardSidebarLayout
      heroSection={
        !heroCollapsed ? (
          <DashboardHero collapsed={heroCollapsed} onCollapsedChange={setHeroCollapsed} />
        ) : undefined
      }
      heroCollapsed={heroCollapsed}
      onHeroExpand={() => setHeroCollapsed(false)}
      discordBadge={discordBadge}
    >
      <UnifiedDashboardSection globalStats={globalStats} />
    </DashboardSidebarLayout>
  );
}
