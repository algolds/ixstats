"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Compass, Xmark as X } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import {
  type CountryIntentItem,
  type CountryIssueItem,
  type Opportunity,
  type OpportunityDrill,
  deriveOpportunity,
} from "./opportunityRules";
import { STATUS_TEXT } from "./status-tone";
import { FlagWatermark } from "~/components/ui/facet/identity/FlagWatermark";
import { assetUrl } from "~/lib/base-path";
import { Card } from "~/components/ui/card";

interface ExecutiveOpportunityHeroProps {
  countryId: string;
  onOpenDrill?: (drill: OpportunityDrill) => void;
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

  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const civilService = api.government.getCivilServiceStatus.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const issuesData = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const opportunity = deriveOpportunity({
    country,
    issues: (issuesData.data?.issues ?? []) as CountryIssueItem[],
    intents: (Array.isArray(intentTree.data)
      ? intentTree.data
      : (intentTree.data?.allIntents ?? [])) as CountryIntentItem[],
    civilService: civilService.data,
    isDismissed: (id) => dismissedIds.includes(id),
  });

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
        <Card className="p-5 sm:p-6">
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
