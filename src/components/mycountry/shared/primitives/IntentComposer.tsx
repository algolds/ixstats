"use client";

import React, { useCallback, useEffect, useState } from "react";
import { WarningCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useIxTimeStore } from "~/stores/ixtime-store";
import {
  OFFERED_TIERS,
  categoryLabel,
  suggestedDomain,
  tierMeta,
  type DirectiveCountrySignals,
  type OfferedTier,
} from "~/components/mycountry/directives/directive-model";
import { useCountryData } from "./CountryDataProvider";
import {
  DIRECTIVE_DOMAINS,
  DIRECTIVE_PRESETS,
  type DirectiveDomain,
} from "./composer/directive-presets";
import { StepSection } from "./composer/StepSection";
import { DeclaredCard } from "./composer/DeclaredCard";
import { GoalStep, MAX_GOAL, MIN_GOAL } from "./composer/GoalStep";
import { ApproachPicker } from "./composer/ApproachPicker";
import { ImpactPreview } from "./composer/ImpactPreview";
import { DeclarePanel } from "./composer/DeclarePanel";

export type IntentCommitResult = RouterOutputs["intent"]["commit"];

export interface DirectiveRef {
  id: string;
  goal: string;
}

interface IntentComposerProps {
  countryId: string;
  /** Prefilled goal (e.g. from an issue brief). A value ending in ":" is left in the field to finish. */
  initialGoal?: string;
  /** The directive this one follows up (stored as `parentId`). */
  followUpOf?: DirectiveRef | null;
  onFollowUpChange?: (next: DirectiveRef | null) => void;
  onCommitted?: (res: IntentCommitResult) => void;
  /** Shown on the success card to jump to the active list. */
  onViewActive?: () => void;
}

const randomItem = <T,>(items: readonly T[]): T | undefined =>
  items[Math.floor(Math.random() * items.length)];

/** A random preset from the domain the country most needs, else from any domain. */
function randomPreset(signals: DirectiveCountrySignals) {
  const domain = suggestedDomain(signals) ?? randomItem(DIRECTIVE_DOMAINS);
  return randomItem(DIRECTIVE_PRESETS.filter((p) => p.domain === domain));
}

function isCompleteGoal(text: string): boolean {
  const t = text.trim();
  return t.length >= MIN_GOAL && !t.endsWith(":");
}

function SuggestErrorStep({
  message,
  onChangeGoal,
  onRetry,
}: {
  message: string;
  onChangeGoal: () => void;
  onRetry: () => void;
}) {
  return (
    <StepSection step={2} title="Choose an approach">
      <Alert variant="destructive" className="border-destructive/30">
        <WarningCircle aria-hidden />
        <AlertDescription className="gap-2">
          <p>{message}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="text-label max-sm:h-11" onClick={onChangeGoal}>
              Change goal
            </Button>
            <Button variant="ghost" className="text-label max-sm:h-11" onClick={onRetry}>
              Try again
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </StepSection>
  );
}

/** The packages `intent.suggest` offers for a goal, and the one matching the chosen approach. */
function useDirectiveSuggestions(countryId: string, goal: string, tier: OfferedTier) {
  const suggest = api.intent.suggest.useQuery(
    { countryId, goal },
    { enabled: !!countryId && goal.length >= MIN_GOAL, retry: false, staleTime: 60_000 }
  );
  const brokerUnlocked = suggest.data?.broker?.unlocked ?? false;
  const packages = (suggest.data?.packages ?? []).filter(
    (p) =>
      (OFFERED_TIERS as readonly string[]).includes(p.tier) &&
      (p.tier !== "broker_unlocked" || brokerUnlocked)
  );
  const activePackage =
    packages.find((p) => p.tier === tier) ?? packages.find((p) => p.tier === "moderate");
  return { suggest, packages, activePackage };
}

function ProjectedImpactStep({
  pkg,
  broker,
}: {
  pkg: ReturnType<typeof useDirectiveSuggestions>["activePackage"];
  broker: React.ComponentProps<typeof ImpactPreview>["broker"];
}) {
  return (
    <StepSection
      step={3}
      title="Projected impact"
      description={pkg ? `${tierMeta(pkg.tier).label} approach` : undefined}
    >
      {pkg ? (
        <ImpactPreview pkg={pkg} broker={broker} />
      ) : (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="rounded-row h-24 w-full" />
          <Skeleton className="rounded-row h-16 w-full" />
        </div>
      )}
    </StepSection>
  );
}

/**
 * The directive composer: goal → approach → projected impact → review and declare.
 * Packages come from `intent.suggest`; declaring calls `intent.commit`.
 */
export const IntentComposer = React.memo(function IntentComposer({
  countryId,
  initialGoal = "",
  followUpOf = null,
  onFollowUpChange,
  onCommitted,
  onViewActive,
}: IntentComposerProps) {
  const { country, isViewingOtherCountry, isPublicReadOnly } = useCountryData();
  const nowIxTime = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 60_000) * 60_000);
  const utils = api.useUtils();

  const [query, setQuery] = useState(initialGoal);
  const [goal, setGoal] = useState(isCompleteGoal(initialGoal) ? initialGoal.trim() : "");
  const [tier, setTier] = useState<OfferedTier>("moderate");
  const [domain, setDomain] = useState<DirectiveDomain | "All">("All");
  const [err, setErr] = useState<string | null>(null);
  const [declared, setDeclared] = useState<{ res: IntentCommitResult; goal: string } | null>(null);

  // A new prefilled goal (another "Declare" from elsewhere) restarts the flow.
  useEffect(() => {
    if (!initialGoal) return;
    // oxlint-disable-next-line -- syncing a prop into the form
    setQuery(initialGoal);
    setGoal(isCompleteGoal(initialGoal) ? initialGoal.trim() : "");
    setDeclared(null);
    setErr(null);
  }, [initialGoal]);

  const statusQuery = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });
  const civCapQuery = api.policies.getPolicyReconContext.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { suggest, packages, activePackage } = useDirectiveSuggestions(countryId, goal, tier);

  const commit = api.intent.commit.useMutation({
    onSuccess: (res) => {
      setDeclared({ res, goal });
      setGoal("");
      setQuery("");
      setErr(null);
      onFollowUpChange?.(null);
      for (const endpoint of [
        utils.intent.getStatus,
        utils.intent.getTree,
        utils.policies.getPolicyReconContext,
        utils.mycountry.getCanonFeed,
        utils.nationalIssues.getMyIssues,
        utils.countries.getByIdWithEconomicData,
      ]) {
        void endpoint.invalidate();
      }
      onCommitted?.(res);
    },
    onError: (e) => setErr(e.message),
  });

  const chooseGoal = useCallback((text: string) => {
    const next = text.trim().slice(0, MAX_GOAL);
    if (next.length < MIN_GOAL) return;
    setGoal(next);
    setQuery(next);
    setErr(null);
    setDeclared(null);
  }, []);

  const changeGoal = useCallback(() => {
    setGoal("");
    setErr(null);
  }, []);

  const suggestOne = () => {
    const preset = randomPreset((country ?? {}) as DirectiveCountrySignals);
    if (preset) chooseGoal(preset.label);
  };

  const declare = () => {
    if (!activePackage || !goal) return;
    setErr(null);
    commit.mutate({
      countryId,
      goal,
      tier: activePackage.tier as OfferedTier,
      parentId: followUpOf?.id,
    });
  };

  if (declared) {
    return (
      <DeclaredCard
        declared={declared}
        onViewActive={onViewActive}
        onFollowUp={
          onFollowUpChange
            ? () => {
                onFollowUpChange({ id: declared.res.intent.id, goal: declared.goal });
                setDeclared(null);
              }
            : undefined
        }
        onDismiss={() => setDeclared(null)}
      />
    );
  }

  if (!goal) {
    return (
      <GoalStep
        query={query}
        onQueryChange={setQuery}
        domain={domain}
        onDomainChange={setDomain}
        followUpOf={followUpOf}
        onClearFollowUp={() => onFollowUpChange?.(null)}
        onChooseGoal={chooseGoal}
        onSuggest={suggestOne}
      />
    );
  }

  const readOnly = !!isViewingOtherCountry || !!isPublicReadOnly;
  const suggestError = suggest.error?.message ?? null;

  return (
    <div className="space-y-4">
      <StepSection
        step={1}
        title="Goal"
        description={
          <>
            <span className="text-label font-medium">{goal}</span>
            {suggest.data && (
              <span className="text-label-secondary text-footnote block">
                Handled as {categoryLabel(suggest.data.category)}
              </span>
            )}
          </>
        }
        action={
          <Button variant="outline" className="max-sm:h-11" onClick={changeGoal}>
            Change
          </Button>
        }
      />

      {suggestError ? (
        <SuggestErrorStep
          message={suggestError}
          onChangeGoal={changeGoal}
          onRetry={() => void suggest.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
          <div className="min-w-0 space-y-4">
            <StepSection
              step={2}
              title="Choose an approach"
              description="How hard your government pushes. Bigger pushes move more, cost more CivCap, and meet more resistance."
            >
              <ApproachPicker
                packages={packages}
                selected={(activePackage?.tier as OfferedTier | undefined) ?? tier}
                onSelect={setTier}
                isLoading={suggest.isLoading}
              />
            </StepSection>

            <ProjectedImpactStep pkg={activePackage} broker={suggest.data?.broker ?? null} />
          </div>

          <StepSection
            step={4}
            title="Review and declare"
            className="lg:sticky lg:top-(--shell-top-offset)"
          >
            <DeclarePanel
              goal={goal}
              approachLabel={activePackage ? tierMeta(activePackage.tier).label : "—"}
              civCapCost={activePackage?.civCapCost ?? null}
              civCap={civCapQuery.isLoading ? undefined : (civCapQuery.data ?? null)}
              slots={statusQuery.data}
              nowIxTime={nowIxTime}
              followUpOf={followUpOf}
              onClearFollowUp={onFollowUpChange ? () => onFollowUpChange(null) : undefined}
              readOnly={readOnly}
              isPending={commit.isPending}
              error={err}
              disabled={!activePackage}
              onDeclare={declare}
            />
          </StepSection>
        </div>
      )}
    </div>
  );
});
