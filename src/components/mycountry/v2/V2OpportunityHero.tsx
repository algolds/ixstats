"use client";

import { useMemo } from "react";
import {
  Shield,
  Handshake,
  Scale,
  TrendingUp,
  Command,
  ArrowUpRight,
  Sparkles,
  Compass,
} from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCountryData } from "../primitives";
import type { V2Drill } from "./V2DrillSheets";
import type { MyCountrySection } from "../MyCountrySidebarNav";

interface Opportunity {
  id: string;
  domain: "defense" | "diplomacy" | "politics" | "economy" | "intent";
  title: string;
  subtitle: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  directiveGoal: string;
  icon: typeof Shield;
  glowCls: string;
  badgeCls: string;
  borderCls: string;
  buttonCls: string;
  drillKind?: Exclude<V2Drill, { kind: "intent" } | null>;
}

export function V2OpportunityHero({
  countryId,
  onDeclare,
  onNavigate,
  onOpenDrill,
}: {
  countryId: string;
  onDeclare?: (prefilled?: string) => void;
  onNavigate?: (section: MyCountrySection) => void;
  onOpenDrill?: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
}) {
  const { country } = useCountryData();

  // Queries for opportunity priority evaluation
  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const civilService = api.government.getCivilServiceStatus.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Dynamic Priority Engine calculation
  const opportunity = useMemo<Opportunity>(() => {
    const readiness = country?.militaryReadiness ?? country?.readiness ?? 94;
    const posture = country?.defensePosture ?? country?.posture ?? "Defensive";

    const embassies = country?.activeEmbassiesCount ?? country?.embassies?.length ?? 12;
    const dipStance = country?.diplomaticStance ?? "Active Alliance";

    const rawStab = country?.currentStability ?? country?.stability ?? 0.78;
    const stabPct = Math.round(rawStab > 1 ? rawStab : rawStab * 100);

    const rawGrowth = country?.gdpGrowth ?? country?.currentGdpGrowth ?? 0.034;
    const growthPct = (rawGrowth > 1 ? rawGrowth : rawGrowth * 100).toFixed(1);

    // 1. Defense Crisis / Low Readiness (Priority 1)
    if (readiness < 85) {
      return {
        id: "defense-readiness",
        domain: "defense",
        title: "Military Readiness Alert",
        subtitle: "Defense Sector Warning",
        description:
          "Armed forces readiness has dropped below optimal operational thresholds. Strategic supply reallocation and defensive posture adjustments are urgently recommended.",
        metricLabel: "Combat Readiness",
        metricValue: `${readiness}% (${posture})`,
        directiveGoal: "Rebalance military readiness and reinforce defensive border posture",
        icon: Shield,
        glowCls: "from-red-500/20 via-rose-500/10 to-transparent",
        badgeCls: "bg-red-500/15 text-red-400 border-red-500/30",
        borderCls: "border-red-500/30",
        buttonCls: "bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40",
        drillKind: { kind: "defense" },
      };
    }

    // 2. Civil Service Over-Capacity (Priority 2)
    if (civilService.data?.overCapacity) {
      return {
        id: "civil-service-overcap",
        domain: "politics",
        title: "Civil Service Bottleneck",
        subtitle: "Governance Alert",
        description:
          "Administrative personnel utilization is over-capacity. Executive policy direction is required to expand operational slots or rebalance staff allocations.",
        metricLabel: "Staff Utilization",
        metricValue: `${civilService.data.utilizationPercent}% Over-Capacity`,
        directiveGoal: "Authorize civil service staffing expansion and administrative restructuring",
        icon: Scale,
        glowCls: "from-amber-500/20 via-orange-500/10 to-transparent",
        badgeCls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        borderCls: "border-amber-500/30",
        buttonCls: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40",
        drillKind: { kind: "politics" },
      };
    }

    // 3. Active Intent Directive in Progress (Priority 3)
    const intentsList = Array.isArray(intentTree.data)
      ? intentTree.data
      : intentTree.data?.allIntents ?? [];
    const activeIntents = intentsList.filter(
      (i: any) => i.status?.toLowerCase() === "active"
    );
    if (activeIntents.length > 0) {
      const topIntent = activeIntents[0];
      return {
        id: `intent-${topIntent.id}`,
        domain: "intent",
        title: `Directive: ${topIntent.goal}`,
        subtitle: "Executive Focus",
        description:
          "Your government is actively executing this strategic directive. Monitor key implementation milestones or issue follow-up policies.",
        metricLabel: "Directive Status",
        metricValue: `${topIntent.tier?.toUpperCase() ?? "ACTIVE"} • ${topIntent.category ?? "Executive"}`,
        directiveGoal: `Accelerate implementation of ${topIntent.goal}`,
        icon: Command,
        glowCls: "from-amber-500/25 via-yellow-500/10 to-transparent",
        badgeCls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        borderCls: "border-amber-500/30",
        buttonCls: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40",
      };
    }

    // 4. Diplomatic Opportunity (Priority 4)
    if (embassies > 0) {
      return {
        id: "diplomacy-opportunity",
        domain: "diplomacy",
        title: "Bilateral Alliance Opportunity",
        subtitle: "Diplomatic Horizon",
        description:
          "Regional diplomatic conditions favor establishing strategic bilateral accords and expanding international trade pacts across allied nations.",
        metricLabel: "Active Embassies",
        metricValue: `${embassies} Embassies • ${dipStance}`,
        directiveGoal: "Establish bilateral economic trade agreement and expand diplomatic alliances",
        icon: Handshake,
        glowCls: "from-teal-500/20 via-emerald-500/10 to-transparent",
        badgeCls: "bg-teal-500/15 text-teal-400 border-teal-500/30",
        borderCls: "border-teal-500/30",
        buttonCls: "bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-teal-500/40",
        drillKind: { kind: "relations" },
      };
    }

    // 5. Default Macroeconomic Growth Opportunity (Priority 5)
    return {
      id: "economy-growth",
      domain: "economy",
      title: "Economic Expansion Target",
      subtitle: "Macroeconomic Horizon",
      description:
        "National economic telemetry indicates favorable conditions for targeted industrial investment and fiscal policy stimulus.",
      metricLabel: "GDP Growth",
      metricValue: `+${growthPct}% Growth (${stabPct}% Stability)`,
      directiveGoal: "Implement targeted macroeconomic development directive and tax incentive package",
      icon: TrendingUp,
      glowCls: "from-emerald-500/20 via-teal-500/10 to-transparent",
      badgeCls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      borderCls: "border-emerald-500/30",
      buttonCls: "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40",
      drillKind: { kind: "economy" },
    };
  }, [country, intentTree.data, civilService.data]);

  const Icon = opportunity.icon;

  return (
    <FacetCard
      depth={2}
      className={cn(
        "relative overflow-hidden border p-5 backdrop-blur-xl transition-all duration-300",
        opportunity.borderCls
      )}
    >
      {/* Ambient Radial Glow Background */}
      <div
        className={cn(
          "pointer-events-none absolute -top-12 -right-12 h-64 w-64 rounded-full bg-gradient-to-br blur-3xl opacity-40 select-none",
          opportunity.glowCls
        )}
      />

      {/* Ambient Watermark Glyph */}
      <Icon
        className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 text-foreground opacity-[0.04] select-none stroke-[1]"
      />

      <div className="relative z-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        {/* Left: Badge, Title & Description */}
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "flex items-center rounded-full border px-3 py-1 text-[10px] font-extrabold tracking-wider uppercase backdrop-blur-md shadow-xs",
                opportunity.badgeCls
              )}
            >
              <span>{opportunity.subtitle}</span>
            </span>

            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-mono font-semibold text-muted-foreground">
              {opportunity.metricLabel}: <strong className="text-foreground">{opportunity.metricValue}</strong>
            </span>
          </div>

          <h2 className="text-lg font-black tracking-tight text-foreground sm:text-xl leading-snug">
            {opportunity.title}
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground/90 leading-relaxed font-normal">
            {opportunity.description}
          </p>
        </div>

        {/* Right: Primary 1-Click Action Button & Drill Link */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onDeclare?.(opportunity.directiveGoal)}
            className={cn(
              "group relative flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-extrabold transition-all duration-200 shadow-md active:scale-95 cursor-pointer",
              opportunity.buttonCls
            )}
          >
            <Command className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
            <span>Declare Directive to Resolve</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </button>

          {opportunity.drillKind ? (
            <button
              type="button"
              onClick={() => onOpenDrill?.(opportunity.drillKind!)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Inspect Details</span>
            </button>
          ) : opportunity.domain ? (
            <button
              type="button"
              onClick={() => onNavigate?.(opportunity.domain as MyCountrySection)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Open Domain Surface</span>
            </button>
          ) : null}
        </div>
      </div>
    </FacetCard>
  );
}
