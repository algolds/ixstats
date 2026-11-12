"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Compass, Xmark as X } from "iconoir-react";
import { Button } from "~/components/ui/button";
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
import { REDUCED_MOTION_FADE, springSmooth, tweenExit } from "~/lib/design/motion";
import { Card, CardTitle } from "~/components/ui/card";

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
  const reduceMotion = useReducedMotion();
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
  const execBandwidth = api.policies.getPolicyReconContext.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 20_000 }
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
    execBandwidth: execBandwidth.data,
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

  return (
    // popLayout: the next priority arrives at once while the dismissed one fades out of flow.
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.section
        key={opportunity.id}
        aria-labelledby="priority-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: tweenExit }}
        transition={reduceMotion ? REDUCED_MOTION_FADE : springSmooth}
        className="w-full"
      >
        <Card className="p-4 sm:p-5">
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

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl min-w-0 space-y-2 pr-10">
              <CardTitle icon={<Icon className={STATUS_TEXT[opportunity.tone]} />}>
                <span className="text-label-secondary text-footnote font-normal">
                  {opportunity.subtitle}
                </span>
              </CardTitle>
              <h2 id="priority-title" className="text-label text-title-3 sm:text-title-2">
                {opportunity.title}
              </h2>
              <p className="text-label-secondary text-body line-clamp-3 leading-relaxed">
                {opportunity.description}
              </p>
              {opportunity.metricLabel && opportunity.metricValue && (
                <p className="flex items-baseline gap-2 pt-0.5">
                  <span className="text-label-secondary text-footnote">
                    {opportunity.metricLabel}
                  </span>
                  <span className="text-label text-headline tabular-nums">
                    {opportunity.metricValue}
                  </span>
                </p>
              )}
            </div>

            {action && (
              <Button type="button" onClick={action.run} className="shrink-0 max-sm:h-11">
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
  politics: "politics",
  economy: "economy",
  intent: "details",
};

export const ExecutiveOpportunityHero = React.memo(ExecutiveOpportunityHeroComponent);
