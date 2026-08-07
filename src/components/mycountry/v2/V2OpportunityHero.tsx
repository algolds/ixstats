"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Shield,
  Handshake,
  Scale,
  TrendingUp,
  Command,
  ArrowUpRight,
  Compass,
  AlertTriangle,
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
  bgImage?: string;
  intentId?: string;
  drillKind?: Exclude<V2Drill, { kind: "intent" } | null>;
}

export function V2OpportunityHero({
  countryId,
  onDeclare,
  onNavigate,
  onOpenDrill,
  onOpenIntent,
}: {
  countryId: string;
  onDeclare?: (prefilled?: string) => void;
  onNavigate?: (section: MyCountrySection) => void;
  onOpenDrill?: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
  onOpenIntent?: (intentId: string) => void;
}) {
  const { country } = useCountryData();

  // Queries for opportunity priority evaluation
  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const civilService = api.government.getCivilServiceStatus.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const issuesData = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 60_000 }
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

    // Custom country header/banner fallback if present
    const customHeader = (country as any)?.headerImageUrl || (country as any)?.bannerUrl || (country as any)?.flagUrl;

    // 0. Active National Issue / Crisis (Priority 0)
    const activeIssues = issuesData.data?.issues ?? [];
    if (activeIssues.length > 0) {
      const topIssue = activeIssues[0];
      return {
        id: `issue-${topIssue.id}`,
        domain: "politics",
        title: `National Issue: ${topIssue.title}`,
        subtitle: "Urgent Policy Crisis",
        description: topIssue.description || "An urgent national issue requires immediate executive attention and cabinet policy guidance.",
        metricLabel: "Cabinet Alert",
        metricValue: `${activeIssues.length} Active Issue${activeIssues.length > 1 ? "s" : ""}`,
        directiveGoal: `Resolve national policy issue: ${topIssue.title}`,
        icon: AlertTriangle,
        glowCls: "from-amber-500/25 via-orange-500/10 to-transparent",
        badgeCls: "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30",
        borderCls: "border-amber-500/40 dark:border-amber-500/30",
        buttonCls: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-200 border-amber-500/40",
        bgImage: customHeader || "https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
        drillKind: { kind: "politics" },
      };
    }

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
        badgeCls: "bg-red-500/15 text-red-900 dark:text-red-300 border-red-500/30",
        borderCls: "border-red-500/40 dark:border-red-500/30",
        buttonCls: "bg-red-500/20 hover:bg-red-500/30 text-red-950 dark:text-red-200 border-red-500/40",
        bgImage: customHeader || "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
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
        badgeCls: "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30",
        borderCls: "border-amber-500/40 dark:border-amber-500/30",
        buttonCls: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-200 border-amber-500/40",
        bgImage: customHeader || "https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
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
        badgeCls: "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30",
        borderCls: "border-amber-500/40 dark:border-amber-500/30",
        buttonCls: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-200 border-amber-500/40",
        bgImage: customHeader || "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
        intentId: topIntent.id,
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
        badgeCls: "bg-teal-500/15 text-teal-900 dark:text-teal-300 border-teal-500/30",
        borderCls: "border-teal-500/40 dark:border-teal-500/30",
        buttonCls: "bg-teal-500/20 hover:bg-teal-500/30 text-teal-950 dark:text-teal-200 border-teal-500/40",
        bgImage: customHeader || "https://images.unsplash.com/photo-1529180979161-06b8b6d6f2be?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
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
      badgeCls: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border-emerald-500/30",
      borderCls: "border-emerald-500/40 dark:border-emerald-500/30",
      buttonCls: "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-950 dark:text-emerald-200 border-emerald-500/40",
      bgImage: customHeader || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
      drillKind: { kind: "economy" },
    };
  }, [country, intentTree.data, civilService.data, issuesData.data]);

  const Icon = opportunity.icon;

  return (
    <FacetCard
      depth={2}
      className={cn(
        "relative overflow-hidden border p-5 backdrop-blur-xl transition-all duration-300 shadow-lg dark:shadow-2xl bg-card/40 dark:bg-card/30",
        opportunity.borderCls
      )}
    >
      {/* Cinematic Context-Aware Photography Background Overlay */}
      {opportunity.bgImage && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
          <img
            src={opportunity.bgImage}
            alt=""
            className="h-full w-full object-cover object-right sm:object-center opacity-35 dark:opacity-45 transition-all duration-700 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-transparent dark:from-card dark:via-card/75 dark:to-transparent" />
        </div>
      )}

      {/* Ambient Radial Glow Background */}
      <div
        className={cn(
          "pointer-events-none absolute -top-12 -right-12 h-64 w-64 rounded-full bg-gradient-to-br blur-3xl opacity-30 dark:opacity-40 select-none",
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
                "flex items-center rounded-full border px-3 py-1 text-[10px] font-extrabold tracking-wider uppercase backdrop-blur-md shadow-2xs",
                opportunity.badgeCls
              )}
            >
              <span>{opportunity.subtitle}</span>
            </span>

            <span className="rounded-full border border-border/60 dark:border-white/10 bg-card/60 dark:bg-white/5 px-2.5 py-1 text-[10px] font-mono font-semibold text-muted-foreground shadow-2xs">
              {opportunity.metricLabel}: <strong className="text-foreground">{opportunity.metricValue}</strong>
            </span>
          </div>

          <h2 className="text-lg font-black tracking-tight text-foreground sm:text-xl leading-snug">
            {opportunity.title}
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-normal">
            {opportunity.description}
          </p>
        </div>

        {/* Right: Primary 1-Click Action Button & Focused Opportunity Inspection CTA */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
          <motion.button
            type="button"
            whileHover={{ scale: 1.015, transition: { type: "spring", stiffness: 450, damping: 25 } }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onDeclare?.(opportunity.directiveGoal)}
            className={cn(
              "group relative flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-extrabold transition-colors cursor-pointer shadow-md",
              opportunity.buttonCls
            )}
          >
            <Command className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
            <span>Declare Directive to Resolve</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </motion.button>

          {opportunity.intentId ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.01, transition: { type: "spring", stiffness: 450, damping: 25 } }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onOpenIntent?.(opportunity.intentId!)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-900 dark:text-amber-300 transition-colors cursor-pointer shadow-xs"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Inspect Directive Tree</span>
            </motion.button>
          ) : opportunity.drillKind ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.01, transition: { type: "spring", stiffness: 450, damping: 25 } }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onOpenDrill?.(opportunity.drillKind!)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 dark:border-white/10 bg-card/70 dark:bg-white/5 hover:bg-card dark:hover:bg-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-xs"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Inspect {opportunity.domain === "defense" ? "Defense" : opportunity.domain === "diplomacy" ? "Relations" : opportunity.domain === "politics" ? "Politics" : "Economy"} Details</span>
            </motion.button>
          ) : opportunity.domain ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.01, transition: { type: "spring", stiffness: 450, damping: 25 } }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate?.(opportunity.domain as MyCountrySection)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 dark:border-white/10 bg-card/70 dark:bg-white/5 hover:bg-card dark:hover:bg-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-xs"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Open Domain Surface</span>
            </motion.button>
          ) : null}
        </div>
      </div>
    </FacetCard>
  );
}
