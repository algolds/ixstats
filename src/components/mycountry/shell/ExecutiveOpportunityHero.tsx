"use client";

import React, { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Compass, Xmark as X } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { REDUCED_MOTION_FADE, springSmooth, tweenExit } from "~/lib/design/motion";
import { api } from "~/trpc/react";
import { OPPORTUNITY_CATEGORY_META, resolveOpportunityBackdropUrls } from "./opportunityBackdrop";
import {
  type CountryIntentItem,
  type CountryIssueItem,
  type Opportunity,
  type OpportunityDrill,
  deriveOpportunity,
} from "./opportunityRules";
import { STATUS_TEXT } from "./status-tone";

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
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  const handleDismiss = useCallback(
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

  const handleImageError = useCallback((url: string) => {
    setFailedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
  }, []);

  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const execBandwidth = api.policies.getPolicyReconContext.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 20_000 }
  );
  const issuesData = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const pinnedCardImages = api.cardImages.getAllByCountry.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 5 * 60_000 }
  );
  const countryName = country?.name?.trim() ?? "";
  const coverArticles = api.countries.getCoverArticles.useQuery(
    { countryName },
    { enabled: countryName.length >= 2, staleTime: 10 * 60_000 }
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

  const candidateUrls = useMemo(() => {
    if (!opportunity) return [];
    return resolveOpportunityBackdropUrls({
      id: opportunity.id,
      category: opportunity.category,
      pinnedImages: pinnedCardImages.data,
      coverArticles: coverArticles.data,
    });
  }, [opportunity, pinnedCardImages.data, coverArticles.data]);

  if (!opportunity) return null;

  const Icon = opportunity.icon;
  const categoryMeta = OPPORTUNITY_CATEGORY_META[opportunity.category];
  const CategoryIcon = categoryMeta.icon;
  const activeCandidate = candidateUrls.find((url) => !failedUrls.includes(url)) ?? null;
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
        <Card className="group/priority relative overflow-hidden p-4 sm:p-5">
          <div
            aria-hidden="true"
            data-slot="priority-backdrop"
            data-category={opportunity.category}
            className="transparency-reduced:hidden pointer-events-none absolute inset-0 overflow-hidden select-none contrast-more:hidden"
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(85% 120% at 92% 50%, color-mix(in srgb, ${categoryMeta.accentVar} 12%, transparent), transparent 70%)`,
              }}
            />
            {activeCandidate ? (
              <div className="absolute inset-y-0 right-0 w-full sm:w-[62%] lg:w-[56%]">
                {/* oxlint-disable-next-line nextjs/no-img-element -- dynamic country/category editorial art */}
                <img
                  src={proxyCardArtwork(activeCandidate)}
                  alt=""
                  decoding="async"
                  onError={() => handleImageError(activeCandidate)}
                  className="duration-drift ease-out-facet size-full scale-105 object-cover object-center opacity-25 transition-transform motion-safe:group-hover/priority:-translate-x-[1.5%] sm:mask-l-from-45% sm:mask-l-to-transparent sm:opacity-55"
                />
                <div className="from-surface via-surface/80 to-surface/25 absolute inset-0 bg-gradient-to-r" />
              </div>
            ) : (
              <CategoryIcon className="text-label pointer-events-none absolute -right-3 -bottom-4 size-28 opacity-[0.06]" />
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleDismiss(opportunity.id)}
            className="facet-well border-separator/60 text-label-secondary hover:text-label hover:bg-fill-2 absolute top-2 right-2 z-20 size-11 rounded-full border sm:top-3 sm:right-3 sm:size-8"
            aria-label="Dismiss this priority for now"
            title="Dismiss for this session"
          >
            <X aria-hidden="true" />
          </Button>

          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl min-w-0 space-y-2 pr-10">
              <CardTitle icon={<Icon className={STATUS_TEXT[opportunity.tone]} />}>
                <span className="text-label-secondary text-footnote font-normal">
                  {opportunity.subtitle}
                  {opportunity.categoryLabel ? ` · ${opportunity.categoryLabel}` : ""}
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
              <Button
                type="button"
                variant="secondary"
                onClick={action.run}
                className="facet-well border-separator/70 hover:bg-fill-2 shrink-0 border shadow-xs max-sm:h-11"
              >
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
