"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  DiceSix,
  GitFork,
  Search,
  WarningCircle,
  Xmark,
} from "iconoir-react";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { useIxTimeStore } from "~/stores/ixtime-store";
import {
  OFFERED_TIERS,
  TONE_CLASSES,
  categoryLabel,
  parseChangeLines,
  suggestedDomain,
  tierMaySpawnResistance,
  tierMeta,
  type DirectiveCountrySignals,
  type OfferedTier,
} from "~/components/mycountry/directives/directive-model";
import { useCountryData } from "./CountryDataProvider";
import { DirectivePresetsCatalog } from "./composer/DirectivePresetsCatalog";
import {
  DIRECTIVE_DOMAINS,
  DIRECTIVE_PRESETS,
  type DirectiveDomain,
} from "./composer/directive-presets";
import { StepSection } from "./composer/StepSection";
import { ApproachPicker } from "./composer/ApproachPicker";
import { ImpactPreview } from "./composer/ImpactPreview";
import { DeclarePanel } from "./composer/DeclarePanel";

export type IntentCommitResult = RouterOutputs["intent"]["commit"];

export interface DirectiveRef {
  id: string;
  goal: string;
}

export interface IntentComposerProps {
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

const MIN_GOAL = 2;
const MAX_GOAL = 200;

function isCompleteGoal(text: string): boolean {
  const t = text.trim();
  return t.length >= MIN_GOAL && !t.endsWith(":");
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
  const suggest = api.intent.suggest.useQuery(
    { countryId, goal },
    { enabled: !!countryId && goal.length >= MIN_GOAL, retry: false, staleTime: 60_000 }
  );

  const packages = useMemo(() => {
    const brokerUnlocked = suggest.data?.broker?.unlocked ?? false;
    return (suggest.data?.packages ?? []).filter(
      (p) =>
        (OFFERED_TIERS as readonly string[]).includes(p.tier) &&
        (p.tier !== "broker_unlocked" || brokerUnlocked)
    );
  }, [suggest.data]);

  const activePackage = useMemo(
    () => packages.find((p) => p.tier === tier) ?? packages.find((p) => p.tier === "moderate"),
    [packages, tier]
  );

  const commit = api.intent.commit.useMutation({
    onSuccess: (res) => {
      setDeclared({ res, goal });
      setGoal("");
      setQuery("");
      setErr(null);
      onFollowUpChange?.(null);
      void utils.intent.getStatus.invalidate();
      void utils.intent.getTree.invalidate();
      void utils.policies.getPolicyReconContext.invalidate();
      void utils.mycountry.getCanonFeed.invalidate();
      void utils.nationalIssues.getMyIssues.invalidate();
      void utils.countries.getByIdWithEconomicData.invalidate();
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

  const suggestOne = useCallback(() => {
    const signals = (country ?? {}) as DirectiveCountrySignals;
    const pick =
      suggestedDomain(signals) ??
      DIRECTIVE_DOMAINS[Math.floor(Math.random() * DIRECTIVE_DOMAINS.length)]!;
    const pool = DIRECTIVE_PRESETS.filter((p) => p.domain === pick);
    const preset = pool[Math.floor(Math.random() * pool.length)];
    if (preset) chooseGoal(preset.label);
  }, [country, chooseGoal]);

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

  // ── Success ──────────────────────────────────────────────────────────────
  if (declared) {
    const { res } = declared;
    const changes = parseChangeLines(res.intent.changesJson);
    const meta = tierMeta(res.intent.tier);
    return (
      <FacetCard
        depth={2}
        surface="solid"
        role="region"
        aria-label="Directive declared"
        aria-live="polite"
        className="animate-in fade-in rounded-2xl p-4 duration-200 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <CheckCircle className={cn("mt-0.5 h-6 w-6 shrink-0", TONE_CLASSES.positive.text)} />
          <div className="min-w-0 flex-1">
            <h3 className="text-foreground text-lg font-semibold">Directive declared</h3>
            <p className="text-foreground mt-1 text-sm font-medium">{declared.goal}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {meta.label} approach · {categoryLabel(res.intent.category)}
              {res.intent.civCapCost ? ` · ${res.intent.civCapCost} CivCap held for a week` : ""}
            </p>
          </div>
        </div>
        {changes.length > 0 && (
          <ul className="border-border mt-4 space-y-1.5 border-t pt-4">
            {changes.map((c, i) => (
              <li key={i} className="text-muted-foreground text-sm first-letter:uppercase">
                {c.label}
              </li>
            ))}
          </ul>
        )}
        {tierMaySpawnResistance(res.intent.tier) && (
          <p className="text-muted-foreground mt-4 text-xs">
            Watch your issues: a resistance issue may follow. It must be resolved before this
            directive can be completed.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {onViewActive && (
            <Button
              className="bg-amber-500 text-amber-950 hover:bg-amber-500/90 max-sm:h-11"
              onClick={onViewActive}
            >
              View active directives
            </Button>
          )}
          {onFollowUpChange && (
            <Button
              variant="outline"
              className="max-sm:h-11"
              onClick={() => {
                onFollowUpChange({ id: res.intent.id, goal: declared.goal });
                setDeclared(null);
              }}
            >
              <GitFork /> Build a follow-up
            </Button>
          )}
          <Button variant="ghost" className="max-sm:h-11" onClick={() => setDeclared(null)}>
            Declare another
          </Button>
        </div>
      </FacetCard>
    );
  }

  // ── Step 1: goal ─────────────────────────────────────────────────────────
  if (!goal) {
    const trimmed = query.trim();
    return (
      <StepSection
        step={1}
        title="Choose a goal"
        description="Pick a preset, or describe what you want your government to achieve."
        action={
          <Button
            variant="ghost"
            className="max-sm:h-11"
            onClick={suggestOne}
            data-cuelume-press="tick"
          >
            <DiceSix /> <span className="hidden sm:inline">Suggest one</span>
            <span className="sr-only sm:hidden">Suggest a goal</span>
          </Button>
        }
      >
        <div className="space-y-4">
          {followUpOf && (
            <FacetContainer
              depth={3}
              surface="solid"
              className="flex items-center gap-2 rounded-xl py-1 pr-1 pl-3 text-xs"
            >
              <GitFork className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
              <span className="text-muted-foreground min-w-0 flex-1 truncate">
                Follow-up to <span className="text-foreground font-medium">{followUpOf.goal}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onFollowUpChange?.(null)}
                aria-label="Remove follow-up link"
                className="text-muted-foreground max-sm:h-11 max-sm:w-11"
              >
                <Xmark />
              </Button>
            </FacetContainer>
          )}

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              chooseGoal(query);
            }}
            className="space-y-2"
          >
            <label htmlFor="directive-goal" className="sr-only">
              Goal
            </label>
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id="directive-goal"
                type="text"
                value={query}
                maxLength={MAX_GOAL}
                autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search presets or type a goal, e.g. “cut youth unemployment”"
                className="facet-refraction-none h-11 rounded-xl pr-11 pl-9 focus-visible:border-amber-500/60 focus-visible:ring-amber-500/30"
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuery("")}
                  aria-label="Clear"
                  className="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2"
                >
                  <Xmark />
                </Button>
              )}
            </div>
            {trimmed.length >= MIN_GOAL && (
              <Button
                type="submit"
                variant="outline"
                className="h-auto min-h-11 w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-left"
              >
                <span className="text-muted-foreground shrink-0">Use as a custom goal:</span>
                <span className="text-foreground min-w-0 flex-1 truncate font-medium">
                  {trimmed}
                </span>
                <ArrowRight className="text-muted-foreground" aria-hidden />
              </Button>
            )}
          </form>

          <DirectivePresetsCatalog
            query={query}
            domain={domain}
            onDomainChange={setDomain}
            onSelectGoal={chooseGoal}
          />
        </div>
      </StepSection>
    );
  }

  // ── Steps 2–4 ────────────────────────────────────────────────────────────
  const readOnly = !!isViewingOtherCountry || !!isPublicReadOnly;
  const suggestError = suggest.error?.message ?? null;

  return (
    <div className="space-y-4">
      <StepSection
        step={1}
        title="Goal"
        description={
          <>
            <span className="text-foreground font-medium">{goal}</span>
            {suggest.data && (
              <span className="text-muted-foreground block text-xs">
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
        <StepSection step={2} title="Choose an approach">
          <Alert variant="destructive" className="border-destructive/30">
            <WarningCircle aria-hidden />
            <AlertDescription className="gap-2">
              <p>{suggestError}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="text-foreground max-sm:h-11"
                  onClick={changeGoal}
                >
                  Change goal
                </Button>
                <Button
                  variant="ghost"
                  className="text-foreground max-sm:h-11"
                  onClick={() => void suggest.refetch()}
                >
                  Try again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </StepSection>
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

            <StepSection
              step={3}
              title="Projected impact"
              description={
                activePackage ? `${tierMeta(activePackage.tier).label} approach` : undefined
              }
            >
              {activePackage ? (
                <ImpactPreview pkg={activePackage} broker={suggest.data?.broker ?? null} />
              ) : (
                <div className="space-y-3" aria-busy="true">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              )}
            </StepSection>
          </div>

          <StepSection step={4} title="Review and declare" className="lg:sticky lg:top-(--shell-top-offset)">
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
