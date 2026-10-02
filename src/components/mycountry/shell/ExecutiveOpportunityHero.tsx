"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Community as Handshake,
  ScaleFrameEnlarge as Scale,
  StatUp as TrendingUp,
  KeyCommand as Command,
  ArrowUpRight,
  Compass,
  WarningCircle as AlertCircle,
  Xmark as X,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import type { DrillSheetKind, V2Drill } from "~/components/mycountry/shell/DrillSheets";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";
import { formatGrowthPeek } from "./ExecutiveActionCards";
import { type StatusTone } from "./status-tone";
import { HUE_ACCENT, HUE_BADGE, type DomainHue } from "./domain-hue";
import { FlagWatermark, WatermarkGlyph } from "~/components/ui/facet/identity/FlagWatermark";
import { assetUrl } from "~/lib/base-path";
import { Card } from "~/components/ui/card";

interface Opportunity {
  id: string;
  domain: "defense" | "diplomacy" | "politics" | "economy" | "intent";
  title: string;
  subtitle: string;
  description: string;
  metricLabel?: string;
  metricValue?: string;
  directiveGoal: string;
  icon: typeof Shield;
  tone: StatusTone;
  /** v2 hero hue (`badgeCls`/`borderCls`): the glass wash, border, glow and badge colour. */
  hue: DomainHue;
  intentId?: string;
  drillKind?: Exclude<V2Drill, { kind: "intent" } | null>;
}

interface CountryIssueItem {
  id: string;
  title: string;
  description?: string | null;
  severity?: string | null;
  urgency?: number | null;
  category?: string | null;
  status?: string | null;
}

interface CountryIntentItem {
  id: string;
  goal?: string | null;
  status?: string | null;
  tier?: string | null;
  category?: string | null;
}

export interface ExecutiveOpportunityHeroProps {
  countryId: string;
  onDeclare?: (prefilled?: string) => void;
  onNavigate?: (section: MyCountrySection) => void;
  onOpenDrill?: (drill: Exclude<DrillSheetKind, { kind: "intent" } | null>) => void;
  onOpenIntent?: (intentId: string) => void;
}

function ExecutiveOpportunityHeroComponent({
  countryId,
  onDeclare,
  onNavigate,
  onOpenDrill,
  onOpenIntent,
}: ExecutiveOpportunityHeroProps): React.JSX.Element | null {
  const { country } = useCountryData();
  const storageKey = countryId ? `ixstats:dismissedHero:${countryId}` : null;

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window === "undefined" || !storageKey) return [];
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const handleDismiss = React.useCallback(
    (id: string) => {
      setDismissedIds((prev) => {
        const next = prev.includes(id) ? prev : [...prev, id];
        if (typeof window !== "undefined" && storageKey) {
          try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // ignore storage quota errors
          }
        }
        return next;
      });
    },
    [storageKey]
  );

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
  const opportunity = useMemo<Opportunity | null>(() => {
    // Only real figures drive the hero: a missing value skips its card, it is never invented.
    const rawReadiness = country?.militaryReadiness ?? country?.readiness;
    const readiness =
      typeof rawReadiness === "number" && Number.isFinite(rawReadiness) ? rawReadiness : null;
    const posture: string | null = country?.defensePosture ?? country?.posture ?? null;

    const rawEmbassies = country?.activeEmbassiesCount ?? country?.embassies?.length;
    const embassies =
      typeof rawEmbassies === "number" && Number.isFinite(rawEmbassies) ? rawEmbassies : 0;
    const dipStance: string | null = country?.diplomaticStance ?? null;

    // InternalStabilityMetrics.stabilityScore (0-100); omitted until it has been computed
    const rawStab = country?.stabilityMetrics?.stabilityScore;
    const stabilityNote = typeof rawStab === "number" ? ` · ${Math.round(rawStab)}% stability` : "";

    const growth = formatGrowthPeek(country);

    // 0. Active National Issue / Crisis (Priority 0 - Critical & Urgent issues first)
    const rawActiveIssues = (issuesData.data?.issues ?? []) as CountryIssueItem[];
    const activeIssues = [...rawActiveIssues].sort((a: CountryIssueItem, b: CountryIssueItem) => {
      const aSev = String(a.severity ?? "").toLowerCase();
      const bSev = String(b.severity ?? "").toLowerCase();
      const sevRank = (s: string) =>
        s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1;
      const scoreA = sevRank(aSev) * 100 + (a.urgency ?? 0);
      const scoreB = sevRank(bSev) * 100 + (b.urgency ?? 0);
      return scoreB - scoreA;
    });

    const availableIssues = activeIssues.filter(
      (iss: CountryIssueItem) => !dismissedIds.includes(`issue-${iss.id}`)
    );

    if (availableIssues.length > 0) {
      const topIssue = availableIssues[0]!;
      const sev = String(topIssue.severity ?? "").toLowerCase();
      const isUrgent = sev === "critical" || sev === "high" || (topIssue.urgency ?? 0) > 70;

      return {
        id: `issue-${topIssue.id}`,
        domain: "politics",
        title: topIssue.title,
        subtitle: isUrgent ? "Priority national issue" : "Open national issue",
        description:
          topIssue.description ||
          "This issue is waiting for your decision. Open the brief to weigh the options.",
        directiveGoal: `Resolve national policy issue: ${topIssue.title}`,
        icon: AlertCircle,
        tone: isUrgent ? "critical" : "warning",
        hue: "red",
        drillKind: { kind: "issue", issueId: topIssue.id },
      };
    }

    // 1. Defense Crisis / Low Readiness (Priority 1)
    if (readiness !== null && readiness < 85 && !dismissedIds.includes("defense-readiness")) {
      return {
        id: "defense-readiness",
        domain: "defense",
        title: "Military readiness is below target",
        subtitle: "Defense warning",
        description:
          "Armed forces readiness has dropped below optimal operational thresholds. Strategic supply reallocation and defensive posture adjustments are urgently recommended.",
        metricLabel: "Readiness",
        metricValue: posture ? `${readiness}% · ${posture}` : `${readiness}%`,
        directiveGoal: "Rebalance military readiness and reinforce defensive border posture",
        icon: Shield,
        tone: "critical",
        hue: "red",
        drillKind: { kind: "defense" },
      };
    }

    // 2. Civil Service Over-Capacity (Priority 2)
    if (civilService.data?.overCapacity && !dismissedIds.includes("civil-service-overcap")) {
      return {
        id: "civil-service-overcap",
        domain: "politics",
        title: "Civil service bottleneck",
        subtitle: "Governance alert",
        description:
          "Administrative personnel utilization is over-capacity. Executive policy direction is required to expand operational slots or rebalance staff allocations.",
        metricLabel: "Staff capacity",
        metricValue: `${civilService.data.utilizationPercent}% used`,
        directiveGoal:
          "Authorize civil service staffing expansion and administrative restructuring",
        icon: Scale,
        tone: "warning",
        hue: "indigo",
        drillKind: { kind: "politics" },
      };
    }

    // 3. Active Intent Directive in Progress (Priority 3)
    const intentsList = (
      Array.isArray(intentTree.data) ? intentTree.data : (intentTree.data?.allIntents ?? [])
    ) as CountryIntentItem[];
    const activeIntents = intentsList.filter(
      (i: CountryIntentItem) =>
        i.status?.toLowerCase() === "active" && !dismissedIds.includes(`intent-${i.id}`)
    );
    if (activeIntents.length > 0) {
      const topIntent = activeIntents[0]!;
      return {
        id: `intent-${topIntent.id}`,
        domain: "intent",
        title: topIntent.goal ?? "Active directive",
        subtitle: "Directive in progress",
        description:
          "Your government is actively executing this strategic directive. Monitor key implementation milestones or issue follow-up policies.",
        metricLabel: "Package",
        metricValue:
          [topIntent.tier, topIntent.category]
            .filter((part): part is string => !!part)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" · ") || "Active",
        directiveGoal: `Accelerate implementation of ${topIntent.goal}`,
        icon: Command,
        tone: "accent",
        hue: "yellow",
        intentId: topIntent.id,
      };
    }

    // 4. Diplomatic Opportunity (Priority 4)
    if (embassies > 0 && !dismissedIds.includes("diplomacy-opportunity")) {
      return {
        id: "diplomacy-opportunity",
        domain: "diplomacy",
        title: "Bilateral alliance opportunity",
        subtitle: "Diplomatic opportunity",
        description:
          "Regional diplomatic conditions favor establishing strategic bilateral accords and expanding international trade pacts across allied nations.",
        metricLabel: "Embassies",
        metricValue: dipStance ? `${embassies} · ${dipStance}` : `${embassies}`,
        directiveGoal:
          "Establish bilateral economic trade agreement and expand diplomatic alliances",
        icon: Handshake,
        tone: "neutral",
        hue: "cyan",
        drillKind: { kind: "relations" },
      };
    }

    // 5. Default Macroeconomic Growth Opportunity (Priority 5)
    if (!dismissedIds.includes("economy-growth")) {
      return {
        id: "economy-growth",
        domain: "economy",
        title: "Set an economic priority",
        subtitle: "Suggested next step",
        description:
          "Nothing urgent needs you right now. Point your government at growth with targeted investment, tax incentives or fiscal stimulus.",
        ...(growth ? { metricLabel: "GDP growth", metricValue: `${growth}${stabilityNote}` } : {}),
        directiveGoal:
          "Implement targeted macroeconomic development directive and tax incentive package",
        icon: TrendingUp,
        tone: "neutral",
        hue: "green",
        drillKind: { kind: "economy" },
      };
    }

    return null;
  }, [country, intentTree.data, civilService.data, issuesData.data, dismissedIds]);

  if (!opportunity) return null;

  const Icon = opportunity.icon;
  const isIssue = opportunity.drillKind?.kind === "issue";
  const secondary: { label: string; onClick: () => void } | null = isIssue
    ? null
    : opportunity.intentId
      ? {
          label: "View directive",
          onClick: () => onOpenIntent?.(opportunity.intentId!),
        }
      : opportunity.drillKind
        ? {
            label: `View ${DRILL_LABEL[opportunity.domain] ?? "details"}`,
            onClick: () => onOpenDrill?.(opportunity.drillKind!),
          }
        : opportunity.domain !== "intent"
          ? {
              label: "Open domain",
              onClick: () => onNavigate?.(opportunity.domain as MyCountrySection),
            }
          : null;

  const accent = HUE_ACCENT[opportunity.hue];
  const flagUrl = assetUrl(country?.flagUrl || country?.flag);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.section
        key={opportunity.id}
        aria-labelledby="priority-title"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, transition: { duration: 0.15, ease: "easeOut" } }}
        transition={{ type: "spring", stiffness: 450, damping: 32 }}
        className="w-full"
      >
        {/* The v2 priority hero (c5c6b382) on the Facet 3.1 glass hero: the priority's hue is the
            card's accent — the glass wash, border, glow and badge (v2 `borderCls`/`badgeCls`) —
            the country's flag bleeds off the top-right corner and the priority's glyph sits as a
            fine watermark. */}
        <Card variant="hero" className="group p-5 sm:p-6">
          <FlagWatermark src={flagUrl} />
          <WatermarkGlyph icon={Icon} className="text-facet-accent opacity-[0.06]" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleDismiss(opportunity.id)}
            className="text-label-secondary absolute top-2 right-2 z-10 size-11 rounded-full sm:top-3 sm:right-3 sm:size-8"
            aria-label="Dismiss this priority for now"
            title="Dismiss for this session"
          >
            <X aria-hidden="true" />
          </Button>

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl min-w-0 space-y-3 pr-10">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "text-footnote inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold",
                    HUE_BADGE
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                  {opportunity.subtitle}
                </span>
                {opportunity.metricLabel && opportunity.metricValue && (
                  <span className="border-separator bg-surface text-label-secondary text-footnote rounded-full border px-3 py-1">
                    {opportunity.metricLabel}:{" "}
                    <span className="text-label font-data font-semibold tabular-nums">
                      {opportunity.metricValue}
                    </span>
                  </span>
                )}
              </div>
              <h2 id="priority-title" className="text-label text-title-2 sm:text-title-1">
                {opportunity.title}
              </h2>
              <p className="text-label-secondary text-body line-clamp-3 leading-relaxed">
                {opportunity.description}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
              {isIssue ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={() => onOpenDrill?.(opportunity.drillKind!)}
                  className="group/cta h-11 font-semibold"
                >
                  <Compass aria-hidden="true" />
                  <span>Open issue brief</span>
                  <ArrowUpRight aria-hidden="true" className={CTA_ARROW} />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={() => onDeclare?.(opportunity.directiveGoal)}
                  className="group/cta h-11 font-semibold"
                >
                  <Command aria-hidden="true" />
                  <span>{opportunity.intentId ? "Follow-up Directive" : "Declare Directive"}</span>
                  <ArrowUpRight aria-hidden="true" className={CTA_ARROW} />
                </Button>
              )}
              {secondary && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={secondary.onClick}
                  className="bg-surface h-11 sm:h-9"
                >
                  <Compass aria-hidden="true" className="text-facet-accent" />
                  <span>{secondary.label}</span>
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.section>
    </AnimatePresence>
  );
}

/**
 * v2 CTA arrow: dimmed at rest, drifting up-right on hover and keyboard focus (no drift under
 * Reduce Motion).
 */
const CTA_ARROW =
  "opacity-70 transition-[opacity,translate] duration-150 group-hover/cta:opacity-100 group-focus-visible/cta:opacity-100 motion-safe:group-hover/cta:translate-x-0.5 motion-safe:group-hover/cta:-translate-y-0.5 motion-safe:group-focus-visible/cta:translate-x-0.5 motion-safe:group-focus-visible/cta:-translate-y-0.5";

const DRILL_LABEL: Partial<Record<Opportunity["domain"], string>> = {
  defense: "defense",
  diplomacy: "relations",
  politics: "politics",
  economy: "economy",
};

export const ExecutiveOpportunityHero = React.memo(ExecutiveOpportunityHeroComponent);
