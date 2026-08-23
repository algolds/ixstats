"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import {
  Shield,
  Community as Handshake,
  ScaleFrameEnlarge as Scale,
  StatUp as TrendingUp,
  KeyCommand as Command,
  ArrowUpRight,
  Compass,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import type { DrillSheetKind, V2Drill } from "~/components/mycountry/shell/DrillSheets";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";

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

export interface ExecutiveOpportunityHeroProps {
  countryId: string;
  onDeclare?: (prefilled?: string) => void;
  onNavigate?: (section: MyCountrySection) => void;
  onOpenDrill?: (drill: Exclude<DrillSheetKind, { kind: "intent" } | null>) => void;
  onOpenIntent?: (intentId: string) => void;
}

export type V2OpportunityHeroProps = ExecutiveOpportunityHeroProps;

function ExecutiveOpportunityHeroComponent({
  countryId,
  onDeclare,
  onNavigate,
  onOpenDrill,
  onOpenIntent,
}: ExecutiveOpportunityHeroProps): React.JSX.Element {
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
    const customHeader =
      (country as any)?.headerImageUrl || (country as any)?.bannerUrl || (country as any)?.flagUrl;

    // 0. Active National Issue / Crisis (Priority 0 - Critical & Urgent issues first)
    const rawActiveIssues = issuesData.data?.issues ?? [];
    const activeIssues = [...rawActiveIssues].sort((a: any, b: any) => {
      const aSev = String(a.severity ?? "").toLowerCase();
      const bSev = String(b.severity ?? "").toLowerCase();
      const sevRank = (s: string) =>
        s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1;
      const scoreA = sevRank(aSev) * 100 + (a.urgency ?? 0);
      const scoreB = sevRank(bSev) * 100 + (b.urgency ?? 0);
      return scoreB - scoreA;
    });

    if (activeIssues.length > 0) {
      const topIssue = activeIssues[0]!;
      return {
        id: `issue-${topIssue.id}`,
        domain: "politics",
        title: `National Issue: ${topIssue.title}`,
        subtitle: "Urgent Policy Crisis",
        description:
          topIssue.description ||
          "An urgent national issue requires immediate executive attention and cabinet policy guidance.",
        metricLabel: "Cabinet Alert",
        metricValue: `${activeIssues.length} Active Issue${activeIssues.length > 1 ? "s" : ""}`,
        directiveGoal: `Resolve national policy issue: ${topIssue.title}`,
        icon: AlertTriangle,
        glowCls: "from-amber-500/25 via-orange-500/10 to-transparent",
        badgeCls: "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30",
        borderCls: "border-amber-500/40 dark:border-amber-500/30",
        buttonCls:
          "bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-200 border-amber-500/40",
        bgImage:
          customHeader ||
          "https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
        drillKind: { kind: "issue", issueId: topIssue.id },
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
        buttonCls:
          "bg-red-500/20 hover:bg-red-500/30 text-red-950 dark:text-red-200 border-red-500/40",
        bgImage:
          customHeader ||
          "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
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
        directiveGoal:
          "Authorize civil service staffing expansion and administrative restructuring",
        icon: Scale,
        glowCls: "from-amber-500/20 via-orange-500/10 to-transparent",
        badgeCls: "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30",
        borderCls: "border-amber-500/40 dark:border-amber-500/30",
        buttonCls:
          "bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-200 border-amber-500/40",
        bgImage:
          customHeader ||
          "https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
        drillKind: { kind: "politics" },
      };
    }

    // 3. Active Intent Directive in Progress (Priority 3)
    const intentsList = Array.isArray(intentTree.data)
      ? intentTree.data
      : (intentTree.data?.allIntents ?? []);
    const activeIntents = intentsList.filter((i: any) => i.status?.toLowerCase() === "active");
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
        buttonCls:
          "bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-200 border-amber-500/40",
        bgImage:
          customHeader ||
          "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
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
        directiveGoal:
          "Establish bilateral economic trade agreement and expand diplomatic alliances",
        icon: Handshake,
        glowCls: "from-teal-500/20 via-emerald-500/10 to-transparent",
        badgeCls: "bg-teal-500/15 text-teal-900 dark:text-teal-300 border-teal-500/30",
        borderCls: "border-teal-500/40 dark:border-teal-500/30",
        buttonCls:
          "bg-teal-500/20 hover:bg-teal-500/30 text-teal-950 dark:text-teal-200 border-teal-500/40",
        bgImage:
          customHeader ||
          "https://images.unsplash.com/photo-1529180979161-06b8b6d6f2be?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
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
      directiveGoal:
        "Implement targeted macroeconomic development directive and tax incentive package",
      icon: TrendingUp,
      glowCls: "from-emerald-500/20 via-teal-500/10 to-transparent",
      badgeCls: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border-emerald-500/30",
      borderCls: "border-emerald-500/40 dark:border-emerald-500/30",
      buttonCls:
        "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-950 dark:text-emerald-200 border-emerald-500/40",
      bgImage:
        customHeader ||
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&crop=entropy&w=1600&h=600&q=80",
      drillKind: { kind: "economy" },
    };
  }, [country, intentTree.data, civilService.data, issuesData.data]);

  const Icon = opportunity.icon;

  return (
    <FacetCard
      depth={2}
      className={cn(
        "bg-card/40 dark:bg-card/30 relative overflow-hidden border p-5 shadow-lg backdrop-blur-xl transition-all duration-300 dark:shadow-2xl",
        opportunity.borderCls
      )}
    >
      {/* Cinematic Context-Aware Photography Background Overlay */}
      {opportunity.bgImage && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
          <img
            src={opportunity.bgImage}
            alt=""
            className="h-full w-full scale-105 object-cover object-right opacity-35 transition-all duration-700 sm:object-center dark:opacity-45"
          />
          <div className="from-card via-card/80 dark:from-card dark:via-card/75 absolute inset-0 bg-gradient-to-r to-transparent dark:to-transparent" />
        </div>
      )}

      {/* Ambient Radial Glow Background */}
      <div
        className={cn(
          "pointer-events-none absolute -top-12 -right-12 h-64 w-64 rounded-full bg-gradient-to-br opacity-30 blur-3xl select-none dark:opacity-40",
          opportunity.glowCls
        )}
      />

      {/* Ambient Watermark Glyph */}
      <Icon className="text-foreground pointer-events-none absolute -right-6 -bottom-6 h-40 w-40 stroke-[1] opacity-[0.04] select-none" />

      <div className="relative z-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        {/* Left: Badge, Title & Description */}
        <div className="max-w-2xl space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "flex items-center rounded-full border px-3 py-1 text-[10px] font-extrabold tracking-wider uppercase shadow-2xs backdrop-blur-md",
                opportunity.badgeCls
              )}
            >
              <span>{opportunity.subtitle}</span>
            </span>

            <span className="border-border/60 bg-card/60 text-muted-foreground rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold shadow-2xs dark:border-white/10 dark:bg-white/5">
              {opportunity.metricLabel}:{" "}
              <strong className="text-foreground">{opportunity.metricValue}</strong>
            </span>
          </div>

          <h2 className="text-foreground text-lg leading-snug font-bold tracking-tight sm:text-xl">
            {opportunity.title}
          </h2>

          <p className="text-muted-foreground text-xs leading-relaxed font-normal sm:text-sm">
            {opportunity.description}
          </p>
        </div>

        {/* Right: Primary 1-Click Action Button & Focused Opportunity Inspection CTA */}
        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row lg:flex-col">
          <motion.button
            type="button"
            whileHover={{
              scale: 1.015,
              transition: { type: "spring", stiffness: 450, damping: 25 },
            }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onDeclare?.(opportunity.directiveGoal)}
            className={cn(
              "group relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-extrabold shadow-md transition-colors",
              opportunity.buttonCls
            )}
          >
            <Command className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
            <span>Declare Directive to Resolve</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          </motion.button>

          {opportunity.intentId ? (
            <motion.button
              type="button"
              whileHover={{
                scale: 1.01,
                transition: { type: "spring", stiffness: 450, damping: 25 },
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onOpenIntent?.(opportunity.intentId!)}
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-900 shadow-xs transition-colors hover:bg-amber-500/20 dark:text-amber-300"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Inspect Directive Tree</span>
            </motion.button>
          ) : opportunity.drillKind ? (
            <motion.button
              type="button"
              whileHover={{
                scale: 1.01,
                transition: { type: "spring", stiffness: 450, damping: 25 },
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onOpenDrill?.(opportunity.drillKind!)}
              className="border-border/80 bg-card/70 hover:bg-card text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold shadow-xs transition-colors dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>
                {opportunity.drillKind!.kind === "issue"
                  ? "Open Issue Brief"
                  : `Inspect ${
                      opportunity.domain === "defense"
                        ? "Defense"
                        : opportunity.domain === "diplomacy"
                          ? "Relations"
                          : opportunity.domain === "politics"
                            ? "Politics"
                            : "Economy"
                    } Details`}
              </span>
            </motion.button>
          ) : opportunity.domain ? (
            <motion.button
              type="button"
              whileHover={{
                scale: 1.01,
                transition: { type: "spring", stiffness: 450, damping: 25 },
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate?.(opportunity.domain as MyCountrySection)}
              className="border-border/80 bg-card/70 hover:bg-card text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold shadow-xs transition-colors dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
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

export const ExecutiveOpportunityHero = React.memo(ExecutiveOpportunityHeroComponent);
export const V2OpportunityHero = ExecutiveOpportunityHero;
