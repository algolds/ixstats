"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Community as Handshake,
  ScaleFrameEnlarge as Scale,
  StatUp as TrendingUp,
  KeyCommand as Command,
  Compass,
  WarningCircle as AlertCircle,
  Xmark as X,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import type { DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import { formatGrowthPeek } from "./ExecutiveActionCards";
import { type StatusTone, STATUS_TEXT } from "./status-tone";
import { FlagWatermark } from "~/components/ui/facet/identity/FlagWatermark";
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
  icon: typeof Shield;
  tone: StatusTone;
  intentId?: string;
  drillKind?: Exclude<DrillSheetKind, { kind: "intent" } | null>;
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

interface ExecutiveOpportunityHeroProps {
  countryId: string;
  onOpenDrill?: (drill: Exclude<DrillSheetKind, { kind: "intent" } | null>) => void;
  onOpenIntent?: (intentId: string) => void;
}

function ExecutiveOpportunityHeroComponent({
  countryId,
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
        description: topIssue.description || "This issue is waiting for your decision.",
        icon: AlertCircle,
        tone: isUrgent ? "critical" : "warning",
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
          "Armed forces readiness is under 85%. Reallocate supplies or adjust your defensive posture.",
        metricLabel: "Readiness",
        metricValue: posture ? `${readiness}% · ${posture}` : `${readiness}%`,
        icon: Shield,
        tone: "critical",
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
          "The civil service is over capacity. Add staff slots or rebalance allocations.",
        metricLabel: "Staff capacity",
        metricValue: `${civilService.data.utilizationPercent}% used`,
        icon: Scale,
        tone: "warning",
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
          "Your government is carrying out this directive. Check its progress or follow up with another.",
        metricLabel: "Package",
        metricValue:
          [topIntent.tier, topIntent.category]
            .filter((part): part is string => !!part)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" · ") || "Active",
        icon: Command,
        tone: "accent",
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
        description: "Your embassies could support new bilateral accords and trade pacts.",
        metricLabel: "Embassies",
        metricValue: dipStance ? `${embassies} · ${dipStance}` : `${embassies}`,
        icon: Handshake,
        tone: "neutral",
        drillKind: { kind: "relations" },
      };
    }

    // 5. Default Macroeconomic Growth Opportunity (Priority 5)
    if (!dismissedIds.includes("economy-growth")) {
      return {
        id: "economy-growth",
        domain: "economy",
        title: "Set an economic priority",
        subtitle: "Suggested priority",
        description:
          "No urgent issues. A growth Directive could target investment, tax incentives or fiscal stimulus.",
        ...(growth ? { metricLabel: "GDP growth", metricValue: `${growth}${stabilityNote}` } : {}),
        icon: TrendingUp,
        tone: "neutral",
        drillKind: { kind: "economy" },
      };
    }

    return null;
  }, [country, intentTree.data, civilService.data, issuesData.data, dismissedIds]);

  if (!opportunity) return null;

  const Icon = opportunity.icon;
  const { drillKind, intentId } = opportunity;
  const action = intentId
    ? { label: "View directive", run: () => onOpenIntent?.(intentId) }
    : drillKind
      ? {
          label:
            drillKind.kind === "issue"
              ? "Open issue brief"
              : `View ${DRILL_LABEL[opportunity.domain]}`,
          run: () => onOpenDrill?.(drillKind),
        }
      : null;
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
        <Card variant="hero" className="p-5 sm:p-6">
          <FlagWatermark src={flagUrl} />
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
              <p className="text-footnote flex items-center gap-2 font-semibold">
                <Icon
                  aria-hidden="true"
                  className={cn("size-4 shrink-0", STATUS_TEXT[opportunity.tone])}
                />
                {opportunity.subtitle}
              </p>
              <h2 id="priority-title" className="text-label text-title-2 sm:text-title-1">
                {opportunity.title}
              </h2>
              <p className="text-label-secondary text-body line-clamp-3 leading-relaxed">
                {opportunity.description}
              </p>
              {opportunity.metricLabel && opportunity.metricValue && (
                <p className="flex flex-col gap-0.5">
                  <span className="text-stat-label">{opportunity.metricLabel}</span>
                  <span className="text-label text-headline tabular-nums">
                    {opportunity.metricValue}
                  </span>
                </p>
              )}
            </div>

            {action && (
              <Button type="button" size="lg" onClick={action.run} className="h-11 shrink-0">
                <Compass aria-hidden="true" />
                {action.label}
              </Button>
            )}
          </div>
        </Card>
      </motion.section>
    </AnimatePresence>
  );
}

const DRILL_LABEL: Record<Opportunity["domain"], string> = {
  defense: "defense",
  diplomacy: "relations",
  politics: "politics",
  economy: "economy",
  intent: "details",
};

export const ExecutiveOpportunityHero = React.memo(ExecutiveOpportunityHeroComponent);
