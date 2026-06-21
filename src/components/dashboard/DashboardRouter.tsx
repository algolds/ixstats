// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
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
  Coins,
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
  // eslint-disable-next-line unused-imports/no-unused-imports
  TrendingUp,
  Users,
  Map as MapIcon,
} from "lucide-react";
import { DashboardSidebarLayout } from "./sidebar/DashboardSidebarLayout";
import { NewVersionNotice } from "./NewVersionNotice";
import { UnifiedDashboardSection } from "./sections/UnifiedDashboardSection";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import * as LucideIcons from "lucide-react";
import { useUser } from "~/context/auth-context";
import { usePremium } from "~/hooks/usePremium";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
// eslint-disable-next-line unused-imports/no-unused-imports
import { normalizeFlagUrl } from "~/lib/unified-flag-service";
import { createUrl } from "~/lib/url-utils";
import { cn, toTitleCase } from "~/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { SECTION_THEME_CLASSES } from "~/lib/mycountry-theme";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { EconomicTierBadge, PopulationTierBadge, LocationBadge } from "~/components/ui/tier-badge";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { HealthRing } from "~/components/ui/health-ring";
import { PreText } from "~/components/ui/pretext";

// eslint-disable-next-line unused-imports/no-unused-imports
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";

const DASHBOARD_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to IxStats",
    body: "This is your global dashboard — a live snapshot of your nation and the wider world. Use it to keep tabs on your standing and jump into the systems that matter.",
  },
  {
    title: "Your nation at a glance",
    body: "The hero shows your flag, leader, GDP per capita, population, land area, and momentum (growth + global rank). The map highlights your territory and capital.",
  },
  {
    title: "Switch perspectives",
    body: "Use the Overview, Executive, Diplomacy, Intelligence, and Defense tabs to see different slices of your nation right from the dashboard.",
  },
  {
    title: "Explore the world",
    body: "From the nav you can browse global rankings and stats, the interactive world map, ThinkPages social feeds, and the IxVault marketplace.",
  },
  {
    title: "Run your country",
    body: "Click “Go to MyCountry” to enter your command suite — hold cabinet meetings, enact policies, resolve national issues, and edit your nation.",
  },
];

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-52 animate-pulse rounded-xl" /> }
);

const GdpDetailsModal = dynamic(
  () => import("~/components/modals/GdpDetailsModal").then((m) => ({ default: m.GdpDetailsModal })),
  { ssr: false }
);

const PopulationDetailsModal = dynamic(
  () =>
    import("~/components/modals/PopulationDetailsModal").then((m) => ({
      default: m.PopulationDetailsModal,
    })),
  { ssr: false }
);

const GovernmentSpendingModal = dynamic(
  () =>
    import("~/components/modals/metric-details/GovernmentSpendingModal").then((m) => ({
      default: m.GovernmentSpendingModal,
    })),
  { ssr: false }
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

function MiniBar({
  value,
  max = 100,
  color = "bg-amber-500",
}: {
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function IndicatorRow({
  label,
  value,
  valueClass = "text-foreground",
  barValue,
  barMax = 100,
  barColor = "bg-amber-500",
}: {
  label: string;
  value: string;
  valueClass?: string;
  barValue?: number;
  barMax?: number;
  barColor?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-[9px]">
        <span className="text-muted-foreground/70 truncate">{label}</span>
        <span className={cn("shrink-0 font-bold", valueClass)}>{value}</span>
      </div>
      {barValue != null && <MiniBar value={barValue} max={barMax} color={barColor} />}
    </div>
  );
}

function DetailList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1 rounded-lg bg-white/[0.02] p-2">
      <p className="text-muted-foreground/50 text-[8px] font-semibold tracking-wider uppercase">
        {title}
      </p>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5">{children}</div>
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
  // Intelligence & Defense are MyCountry-premium only
  const { isPremium } = usePremium();
  const visibleNav = isPremium
    ? HERO_NAV
    : HERO_NAV.filter((i) => i.section !== "Intelligence" && i.section !== "Defense");
  const { avatarGlow, chatBadge, neonFrame } = useActiveCosmetics();
  const CrownIcon = (LucideIcons as any)[chatBadge.icon] || LucideIcons.Crown;
  const [activeSection, setActiveSection] = useState<HeroSection>("Overview");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggleable metric views for Overview
  const [metricView, setMetricView] = useState({
    gdp: "perCapita" as "perCapita" | "total",
    population: "total" as "total" | "density",
    area: "km" as "km" | "mi",
  });
  const [activeModal, setActiveModal] = useState<"gdp" | "population" | "government" | null>(null);

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
          const sections: HeroSection[] = isPremium
            ? ["Overview", "Executive", "Diplomacy", "Intelligence", "Defense"]
            : ["Overview", "Executive", "Diplomacy"];
          const idx = sections.indexOf(prev);
          return sections[(idx + 1) % sections.length]!;
        });
      }
    }, 60_000);
    return () => {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    };
  }, [isPremium]);

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
          className="h-full"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {activeSection === "Overview" && renderOverviewSnapshot()}
          {activeSection === "Executive" && renderExecutiveSnapshot()}
          {activeSection === "Diplomacy" && renderDiplomacySnapshot()}
          {activeSection === "Intelligence" && isPremium && renderIntelligenceSnapshot()}
          {activeSection === "Defense" && isPremium && renderDefenseSnapshot()}
        </motion.div>
      </AnimatePresence>
    );
  };

  const getMetricColor = (val: number) => {
    if (val < 35) return "#ef4444";
    if (val < 60) return "#f97316";
    if (val < 80) return "#eab308";
    return "#10b981";
  };

  const getMetricLabelClass = (val: number) => {
    if (val < 35) return "text-red-600 dark:text-red-400";
    if (val < 60) return "text-orange-600 dark:text-orange-400";
    if (val < 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  // ── Overview: At a Glance (toggleable) ──
  const renderOverviewSnapshot = () => (
    <div className="flex h-full flex-col">
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
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1.5 text-left transition-all hover:bg-white/[0.07] active:scale-[0.98]"
            >
              <Coins className="h-3 w-3 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-muted-foreground/60 text-[8px] tracking-wider uppercase">
                  {metricView.gdp === "perCapita" ? "GDP/Cap" : "Total GDP"}
                </p>
                <p className="text-foreground text-[11px] font-bold">
                  $
                  {metricView.gdp === "perCapita"
                    ? Math.round(stats.gdpPerCapita).toLocaleString("en-US")
                    : Math.round(stats.currentTotalGdp).toLocaleString("en-US")}
                </p>
              </div>
            </button>

            <button
              onClick={() =>
                setMetricView((v) => ({
                  ...v,
                  population: v.population === "total" ? "density" : "total",
                }))
              }
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1.5 text-left transition-all hover:bg-white/[0.07] active:scale-[0.98]"
            >
              <Users className="h-3 w-3 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-muted-foreground/60 text-[8px] tracking-wider uppercase">
                  {metricView.population === "total" ? "Population" : "Density"}
                </p>
                <p className="text-foreground text-[11px] font-bold">
                  {metricView.population === "total"
                    ? Math.round(stats.population).toLocaleString("en-US")
                    : stats.populationDensity
                      ? `${Math.round(stats.populationDensity).toLocaleString()}/km²`
                      : "N/A"}
                </p>
              </div>
            </button>

            <button
              onClick={
                stats.areaSqMi && stats.landArea
                  ? () => setMetricView((v) => ({ ...v, area: v.area === "km" ? "mi" : "km" }))
                  : undefined
              }
              className={cn(
                "flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1.5 text-left transition-all",
                stats.areaSqMi && stats.landArea && "hover:bg-white/[0.07] active:scale-[0.98]"
              )}
            >
              <MapIcon className="h-3 w-3 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-muted-foreground/60 text-[8px] tracking-wider uppercase">
                  Land Area
                </p>
                <p className="text-foreground text-[11px] font-bold">
                  {metricView.area === "km"
                    ? stats.landArea
                      ? `${Math.round(stats.landArea).toLocaleString()} km²`
                      : "N/A"
                    : stats.areaSqMi
                      ? `${Math.round(stats.areaSqMi).toLocaleString()} mi²`
                      : "N/A"}
                </p>
              </div>
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="space-y-1 text-xs">
            <p className="text-foreground font-semibold">Click metrics to toggle views</p>
            <div className="text-muted-foreground my-1 space-y-0.5 border-t border-white/10 pt-1">
              {stats.gdpGrowth !== 0 && (
                <p className="flex items-center gap-1">
                  GDP Growth:{" "}
                  <span
                    className={cn(
                      "flex items-center gap-0.5 font-bold",
                      stats.gdpGrowth > 0 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {stats.gdpGrowth > 0 ? "+" : ""}
                    {stats.gdpGrowth.toFixed(2)}%
                  </span>
                </p>
              )}
              {stats.popGrowth !== 0 && (
                <p className="flex items-center gap-1">
                  Pop Growth:{" "}
                  <span
                    className={cn(
                      "font-bold",
                      stats.popGrowth > 0 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {stats.popGrowth > 0 ? "+" : ""}
                    {stats.popGrowth.toFixed(2)}%
                  </span>
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
      <DetailList title="National Health">
        {activityRingsData ? (
          <div className="grid grid-cols-4 gap-2 py-1">
            {[
              {
                value: activityRingsData.economicVitality || 0,
                label: "Economy",
                onClick: () => setActiveModal("gdp"),
                tooltip: "Economic health and performance index",
              },
              {
                value: activityRingsData.populationWellbeing || 0,
                label: "Pop.",
                onClick: () => setActiveModal("population"),
                tooltip: "Quality of life and population wellbeing index",
              },
              {
                value: activityRingsData.diplomaticStanding || 0,
                label: "Diplo.",
                onClick: () => setActiveSection("Diplomacy"),
                tooltip: "International relations and diplomatic standing index",
              },
              {
                value: activityRingsData.governmentalEfficiency || 0,
                label: "Gov.",
                onClick: () => setActiveModal("government"),
                tooltip: "Governance effectiveness and efficiency index",
              },
            ].map((ring) => (
              <div key={ring.label} className="flex flex-col items-center gap-0.5">
                <HealthRing
                  value={ring.value}
                  size={48}
                  color={getMetricColor(ring.value)}
                  label={ring.label}
                  tooltip={ring.tooltip}
                  hideValue={true}
                  onClick={ring.onClick}
                  isClickable={true}
                />
                <PreText
                  className={cn(
                    "hover:text-foreground/90 text-[9px] font-medium transition-colors",
                    getMetricLabelClass(ring.value)
                  )}
                  whiteSpace="nowrap"
                >
                  {ring.label}: {ring.value}%
                </PreText>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground flex h-16 animate-pulse items-center justify-center text-xs">
            Loading health indicators...
          </div>
        )}
      </DetailList>
    </div>
  );

  // ── Executive snapshot ──
  const renderExecutiveSnapshot = () => {
    const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
    const totalPolicies = policies?.length ?? 0;
    const pendingActions =
      meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0;
    const activeList = (policies?.filter((p) => p.status === "active") ?? []).slice(0, 3);

    return (
      <div className="flex h-full flex-col">
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
        <DetailList title="Active Policies">
          {activeList.length > 0 ? (
            activeList.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-[9px]">
                <span className="text-foreground/80 flex min-w-0 items-center gap-1">
                  <FileText className="h-2.5 w-2.5 shrink-0 text-amber-500" />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="text-muted-foreground/60 shrink-0 capitalize">{p.category}</span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground/50 text-[9px]">No active policies yet.</p>
          )}
          {pendingActions > 0 && (
            <div className="mt-0.5 flex items-center justify-between border-t border-white/5 pt-1 text-[9px]">
              <span className="text-muted-foreground/70">Action Items</span>
              <span className="font-bold text-orange-400">{pendingActions} pending</span>
            </div>
          )}
        </DetailList>
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
    const topTies = (relations ?? []).slice(0, 3);

    return (
      <div className="flex h-full flex-col">
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
        <DetailList title="Strongest Ties">
          {topTies.length > 0 ? (
            topTies.map((r) => (
              <div key={r.id} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[9px]">
                  <span className="text-foreground/80 truncate">{r.targetCountryName}</span>
                  <span className="shrink-0 font-bold text-cyan-400">{r.strength}%</span>
                </div>
                <MiniBar value={r.strength ?? 0} color="bg-cyan-500" />
              </div>
            ))
          ) : (
            <p className="text-muted-foreground/50 text-[9px]">No diplomatic relations yet.</p>
          )}
        </DetailList>
      </div>
    );
  };

  // ── Intelligence snapshot ──
  const renderIntelligenceSnapshot = () => {
    const secScore = defenseOverview?.overallScore ?? 0;
    const critAlerts = intelligenceOverview?.alerts?.critical ?? 0;
    const activeEmbs =
      embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const alertItems = (intelligenceOverview?.alerts?.items ?? []) as any[];

    return (
      <div className="flex h-full flex-col">
        <div className="grid grid-cols-3 gap-1.5 py-1">
          <StatPill
            icon={Shield}
            label="Security"
            value={`${secScore}/100`}
            color="text-blue-500"
          />
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
        <DetailList title="Threat Picture">
          <IndicatorRow
            label="Security Index"
            value={`${secScore}/100`}
            valueClass={
              secScore >= 75
                ? "text-emerald-400"
                : secScore >= 50
                  ? "text-blue-400"
                  : "text-orange-400"
            }
            barValue={secScore}
            barColor={
              secScore >= 75 ? "bg-emerald-500" : secScore >= 50 ? "bg-blue-500" : "bg-orange-500"
            }
          />
          {alertItems.length > 0 ? (
            alertItems.slice(0, 2).map((a) => (
              <div key={a.id} className="flex items-center gap-1 text-[9px]">
                <AlertTriangle
                  className={cn(
                    "h-2.5 w-2.5 shrink-0",
                    a.severity === "CRITICAL" || a.severity === "critical"
                      ? "text-red-500"
                      : "text-amber-500"
                  )}
                />
                <span className="text-foreground/80 truncate">{a.title}</span>
              </div>
            ))
          ) : (
            <p className="flex items-center gap-1 text-[9px] text-emerald-400/80">
              <Shield className="h-2.5 w-2.5" /> No active alerts.
            </p>
          )}
        </DetailList>
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
    const topBranches = (militaryBranches ?? []).slice(0, 3);

    return (
      <div className="flex h-full flex-col">
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
        <DetailList title="Force Readiness">
          {topBranches.length > 0 ? (
            topBranches.map((b: any) => {
              const r = Math.round(b.readinessLevel ?? 0);
              return (
                <div key={b.id} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[9px]">
                    <span className="text-foreground/80 truncate">{b.name}</span>
                    <span
                      className={cn(
                        "shrink-0 font-bold",
                        r >= 70 ? "text-emerald-400" : r >= 40 ? "text-yellow-400" : "text-red-400"
                      )}
                    >
                      {r}%
                    </span>
                  </div>
                  <MiniBar
                    value={r}
                    color={r >= 70 ? "bg-emerald-500" : r >= 40 ? "bg-yellow-500" : "bg-red-500"}
                  />
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground/50 text-[9px]">No military branches configured.</p>
          )}
        </DetailList>
      </div>
    );
  };

  return (
    <div className="glass-surface relative overflow-hidden rounded-xl shadow-sm">
      {/* Neon Frame Overlay */}
      {neonFrame.enabled && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 rounded-xl"
          style={{
            border: `2px solid ${neonFrame.color}`,
            boxShadow: `0 0 12px ${neonFrame.color}, inset 0 0 8px ${neonFrame.color}`,
          }}
          animate={
            neonFrame.style === "pulse"
              ? {
                  opacity: [0.5, 1, 0.5],
                }
              : undefined
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      <TextureOverlay texture="paperGrain" opacity={0.09} />

      <button
        onClick={() => onCollapsedChange(true)}
        className="text-muted-foreground hover:bg-muted/30 relative z-10 flex w-full cursor-pointer items-center justify-end px-4 py-1.5 text-[10px] transition-colors"
      >
        <ChevronUp className="h-3 w-3 shrink-0" />
      </button>

      <div className="relative z-10 grid gap-4 p-4 pt-1 md:grid-cols-5">
        <div className="border-border/30 h-[250px] overflow-hidden rounded-xl border md:col-span-3 md:h-full md:min-h-[300px]">
          <CountryMapEmbed
            countryId={countryId}
            height="h-full"
            showNeighbors={true}
            showCities={true}
            showSubdivisions={true}
            interactive={true}
            boundsPadding={30}
          />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] p-3 shadow-sm backdrop-blur-md md:col-span-2 dark:border-white/10 dark:bg-black/25">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-start justify-between gap-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "relative flex shrink-0 items-center justify-center rounded-sm shadow-sm",
                    !avatarGlow.enabled && "border border-white/20"
                  )}
                  style={
                    avatarGlow.enabled
                      ? {
                          boxShadow: `0 0 ${avatarGlow.intensity} ${avatarGlow.color}`,
                          border: `1px solid ${avatarGlow.color}`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-center overflow-hidden rounded-sm">
                    <UnifiedCountryFlag
                      showTooltip={false}
                      countryName={stats.countryName}
                      size="lg"
                      className="shrink-0"
                    />
                  </div>
                </div>
                <div>
                  <Link
                    href={createUrl(`/countries/${stats.slug}`)}
                    className="flex items-center gap-1.5 text-sm font-bold hover:underline"
                  >
                    <span>{stats.countryName}</span>
                    {chatBadge.enabled && (
                      <CrownIcon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: chatBadge.color }}
                      />
                    )}
                  </Link>
                  <p className="text-muted-foreground text-[10px]">{stats.leader}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <HeroHelpModal
                  title="Dashboard guide"
                  steps={DASHBOARD_HELP_STEPS}
                  accentClass="text-blue-400"
                />
                {econTier && <EconomicTierBadge tier={econTier} />}
                {popTier && <PopulationTierBadge tier={popTier} />}
                {gdpRank && (
                  <span className="bg-muted/50 text-muted-foreground rounded-md px-2 py-0.5 text-[10px]">
                    #{gdpRank.global.position}/{gdpRank.global.total}
                  </span>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1">{renderSectionContent()}</div>

            <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
              {vaultData && (
                <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-amber-600 dark:text-amber-400">
                  <Wallet className="h-3 w-3 shrink-0" />
                  <UnifiedCountryFlag
                    showTooltip={false}
                    countryName={stats.countryName}
                    size="sm"
                    className="mr-0.5 h-3.5 w-auto shrink-0 rounded-sm border border-white/10"
                  />
                  {vaultData.credits.toLocaleString()}
                  <Flame className="ml-0.5 h-2.5 w-2.5 shrink-0" />
                  {vaultData.loginStreak}d
                </span>
              )}
              {stats.continent && <LocationBadge type="continent" value={stats.continent} />}
              {stats.governmentType && (
                <LocationBadge type="government" value={toTitleCase(stats.governmentType)} />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-x-2 gap-y-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {visibleNav.map((item) => {
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
            </div>

            <Link
              href={createUrl("/mycountry")}
              className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-0.5 text-[9px] whitespace-nowrap transition-colors"
            >
              Go to MyCountry →
            </Link>
          </div>
        </div>
      </div>
      {activeModal === "gdp" && (
        <GdpDetailsModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          countryId={countryId}
          countryName={stats.countryName}
        />
      )}
      {activeModal === "population" && (
        <PopulationDetailsModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          countryId={countryId}
          countryName={stats.countryName}
        />
      )}
      {activeModal === "government" && (
        <GovernmentSpendingModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          countryId={countryId}
          countryName={stats.countryName}
        />
      )}
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
      alerts={<NewVersionNotice />}
      heroSection={
        !heroCollapsed ? (
          <DashboardHero collapsed={heroCollapsed} onCollapsedChange={setHeroCollapsed} />
        ) : undefined
      }
      heroCollapsed={heroCollapsed}
      onHeroExpand={() => setHeroCollapsed(false)}
      discordBadge={discordBadge}
      disableCollapse={true}
    >
      <UnifiedDashboardSection globalStats={globalStats} />
    </DashboardSidebarLayout>
  );
}
