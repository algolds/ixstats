"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { PageHeader } from "~/components/shell/PageHeader";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";
import { Inspector } from "~/components/ui/inspector";
import { Skeleton } from "~/components/ui/skeleton";
import { StepIndicator } from "~/components/ui/step-indicator";
import { AuthenticationGuard } from "~/components/mycountry/shared/primitives";
import { usePageTitle } from "~/hooks/usePageTitle";
import { MYCOUNTRY_WELCOME_PATH } from "~/lib/mycountry/routes";
import { getArchetypeOption } from "./lib/founding-archetypes";
import {
  EMPTY_IDENTITY,
  FOUNDING_STEP_LABELS,
  applyImport,
  applyStart,
  chooseForm,
  renameInstitution,
  resolveStep,
  startNeedsConfirm,
  toggleComponent,
  validateEconomy,
  validateIdentity,
  visibleSteps,
  type EconomyFieldId,
  type FoundingDraft,
  type FoundingStepId,
  type IdentityFieldId,
} from "./lib/founding-draft";
import { describeFoundingError, type FoundingError } from "./lib/founding-errors";
import { createInput } from "./lib/founding-payload";
import { useFoundingDraft } from "./hooks/useFoundingDraft";
import { useFoundingPreview } from "./hooks/useFoundingPreview";
import { EconomyStep, economyFieldId } from "./components/EconomyStep";
import { FoundingFooter } from "./components/FoundingFooter";
import { GovernmentStep } from "./components/GovernmentStep";
import { IdentityStep, MORE_DETAIL_FIELD_IDS, fieldId } from "./components/IdentityStep";
import { ImportSheet } from "./components/ImportSheet";
import { NationCard } from "./components/NationCard";
import { RealmStep } from "./components/RealmStep";
import { ReviewStep } from "./components/ReviewStep";
import { StartStep } from "./components/StartStep";

/** The founding flow's address; `?step=` names the step. */
export const FOUNDING_PATH = "/builder";

const stepHref = (step: FoundingStepId) => `${FOUNDING_PATH}?step=${step}`;

/** Moves focus to a field, or to the chosen (else first) option of a choice group. */
function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  const target = element.matches("input, textarea, button, [tabindex]")
    ? element
    : element.querySelector<HTMLElement>(
        "[role=radio][data-state=checked], [role=radio]:not([disabled]), input, button"
      );
  target?.focus();
  target?.scrollIntoView?.({ block: "center" });
}

const IDENTITY_ORDER = Object.keys(EMPTY_IDENTITY) as IdentityFieldId[];
const ECONOMY_ORDER: EconomyFieldId[] = ["exactPopulation", "exactGdpPerCapita"];

function FoundingSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading your draft">
      <Skeleton className="rounded-card h-12" />
      <Card padding="lg" className="flex flex-col gap-4">
        <Skeleton className="h-7 w-64" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="rounded-row h-36" />
          <Skeleton className="rounded-row h-36" />
          <Skeleton className="rounded-row h-36" />
          <Skeleton className="rounded-row h-36" />
        </div>
      </Card>
    </div>
  );
}

/** Founding a nation, step by step, at `/builder`. */
export function FoundingFlowView() {
  usePageTitle({ title: "Found a nation" });
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStep = searchParams.get("step");
  const utils = api.useUtils();

  const realmsQuery = api.realms.builderRealms.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
  });
  const { draft, resumed, status, update, retry, discard } = useFoundingDraft();
  const { summary, stale } = useFoundingPreview(draft);
  const { mutateAsync: createCountry, isPending: founding } =
    api.countries.createCountry.useMutation();

  const [attempted, setAttempted] = useState<Partial<Record<FoundingStepId, boolean>>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [nationOpen, setNationOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(() => searchParams.get("import") === "1");
  const [pendingStart, setPendingStart] = useState<{ key: string | null } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [foundError, setFoundError] = useState<FoundingError | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const shownStep = useRef<FoundingStepId | null>(null);

  // Realms: the step is shown only when more than one realm has room for another nation.
  const realmData = realmsQuery.data;
  const creatable = useMemo(
    () => (realmData?.realms ?? []).filter((realm) => realm.canCreate),
    [realmData]
  );
  const chooseRealm = creatable.length > 1;
  const steps = useMemo(() => visibleSteps(chooseRealm), [chooseRealm]);
  const context = useMemo(
    () => ({ creatableRealmIds: realmData ? creatable.map((realm) => realm.id) : null }),
    [realmData, creatable]
  );
  const shownRealmId =
    draft?.realmId && creatable.some((realm) => realm.id === draft.realmId)
      ? draft.realmId
      : creatable.some((realm) => realm.id === realmData?.defaultRealmId)
        ? (realmData?.defaultRealmId ?? null)
        : null;
  const realmIdToSend = chooseRealm
    ? (draft?.realmId ?? undefined)
    : creatable.length === 1
      ? creatable[0]!.id
      : undefined;
  const realmName =
    realmData?.realms.find(
      (realm) =>
        realm.id === (chooseRealm ? shownRealmId : (realmIdToSend ?? realmData.defaultRealmId))
    )?.name ?? null;

  const ready = draft !== null && !realmsQuery.isLoading;
  const step: FoundingStepId | null =
    draft && ready ? resolveStep(draft, urlStep ?? draft.step, steps, context) : null;

  // The address always names the step shown (a deep link to a step whose prerequisites are
  // missing lands on the first incomplete step instead).
  useEffect(() => {
    if (step && urlStep !== step) router.replace(stepHref(step), { scroll: false });
  }, [step, urlStep, router]);

  // The draft remembers the step, so a refresh or another device resumes there.
  useEffect(() => {
    if (draft && step && draft.step !== step) update((current) => ({ ...current, step }));
  }, [draft, step, update]);

  // A new step announces itself: focus its heading (not on first load).
  useEffect(() => {
    if (!step) return;
    if (shownStep.current && shownStep.current !== step) headingRef.current?.focus();
    shownStep.current = step;
  }, [step]);

  const goTo = useCallback(
    (target: FoundingStepId, returnToReview = false) => {
      if (draft && draft.returnToReview !== returnToReview) {
        update((current) => ({ ...current, returnToReview }));
      }
      router.push(stepHref(target));
    },
    [draft, update, router]
  );

  const goNext = useCallback(() => {
    if (!draft || !step) return;
    const target = draft.returnToReview ? "review" : steps[steps.indexOf(step) + 1];
    if (target) goTo(target);
  }, [draft, step, steps, goTo]);

  const applyStartAndGo = useCallback(
    (key: string | null) => {
      update((current) => applyStart(current, key));
      goNext();
    },
    [update, goNext]
  );

  /** Continue with a start: straight on if nothing changes, a confirm if it would replace work. */
  const chooseStart = useCallback(
    (key: string | null) => {
      if (!draft) return;
      if (draft.start.applied && draft.start.archetypeKey === key) goNext();
      else if (startNeedsConfirm(draft, key)) setPendingStart({ key });
      else applyStartAndGo(key);
    },
    [draft, goNext, applyStartAndGo]
  );

  const showErrors = (stepId: FoundingStepId, beforeFocus?: () => void) =>
    flushSync(() => {
      setAttempted((current) => ({ ...current, [stepId]: true }));
      beforeFocus?.();
    });

  const handleContinue = () => {
    if (!draft || !step) return;
    switch (step) {
      case "realm":
        if (!shownRealmId) {
          showErrors("realm");
          focusField("founding-realm-choice");
          return;
        }
        if (draft.realmId !== shownRealmId) {
          update((current) => ({ ...current, realmId: shownRealmId }));
        }
        goNext();
        return;
      case "start":
        if (!draft.start.applied && draft.start.selection === null) {
          showErrors("start");
          focusField("founding-start-choice");
          return;
        }
        chooseStart(draft.start.selection);
        return;
      case "identity": {
        const errors = validateIdentity(draft.identity);
        const first = IDENTITY_ORDER.find((field) => errors[field]);
        if (first) {
          showErrors("identity", () => {
            if (MORE_DETAIL_FIELD_IDS.includes(first)) setMoreOpen(true);
          });
          focusField(fieldId(first));
          return;
        }
        goNext();
        return;
      }
      case "economy": {
        const errors = validateEconomy(draft.economy);
        const first = ECONOMY_ORDER.find((field) => errors[field]);
        if (first) {
          showErrors("economy");
          focusField(economyFieldId(first));
          return;
        }
        goNext();
        return;
      }
      case "government":
        goNext();
        return;
      case "review":
        setFoundError(null);
        setConfirmOpen(true);
        return;
    }
  };

  const handleBack = () => {
    if (!step) return;
    const previous = steps[steps.indexOf(step) - 1];
    if (previous) goTo(previous);
  };

  const handleFound = async () => {
    if (!draft) return;
    try {
      await createCountry(createInput(draft, realmIdToSend));
      await discard();
      void utils.invalidate();
      router.push(MYCOUNTRY_WELCOME_PATH);
    } catch (error) {
      setConfirmOpen(false);
      setFoundError(describeFoundingError(error, chooseRealm));
    }
  };

  const editFromReview = (target: FoundingStepId) => {
    setFoundError(null);
    goTo(target, true);
  };

  const setDraft = (change: (current: FoundingDraft) => FoundingDraft) => update(change);

  if (!draft || !step) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-8 sm:px-6">
        <PageHeader title="Found a nation" />
        <FoundingSkeleton />
      </div>
    );
  }

  const index = steps.indexOf(step);
  const identityErrors = attempted.identity ? validateIdentity(draft.identity) : {};
  const economyErrors = attempted.economy ? validateEconomy(draft.economy) : {};
  const pendingLabel = pendingStart
    ? (getArchetypeOption(pendingStart.key)?.display.displayName ?? "a blank start")
    : "";
  const nationName = draft.identity.name.trim();
  const primaryLabel =
    step === "review" ? "Found nation" : draft.returnToReview ? "Back to review" : "Continue";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-8 sm:px-6">
      <PageHeader
        title="Found a nation"
        subtitle={realmName ? `Founding in ${realmName}` : undefined}
      />
      <FacetMaterial layer="chrome" className="px-3 py-2">
        <StepIndicator
          aria-label="Founding steps"
          steps={steps.map((id) => ({ id, label: FOUNDING_STEP_LABELS[id] }))}
          current={index}
          onStepClick={(target) => goTo(steps[target]!)}
          compactOnPhones
        />
      </FacetMaterial>

      {step === "realm" && (
        <RealmStep
          ref={headingRef}
          realms={realmData?.realms ?? []}
          value={shownRealmId}
          onChange={(realmId) => setDraft((current) => ({ ...current, realmId }))}
          error={attempted.realm && !shownRealmId ? "Choose a realm to continue." : undefined}
        />
      )}
      {step === "start" && (
        <StartStep
          // A new suggestion remounts the grid on the suggestion's era.
          key={draft.imported?.suggestedArchetype ?? "none"}
          ref={headingRef}
          selection={draft.start.selection}
          suggested={draft.imported?.suggestedArchetype ?? null}
          importedTitle={draft.imported?.title ?? null}
          onSelect={(key) =>
            setDraft((current) => ({ ...current, start: { ...current.start, selection: key } }))
          }
          onImport={() => setImportOpen(true)}
          onBlank={() => chooseStart(null)}
          error={
            attempted.start && draft.start.selection === null && !draft.start.applied
              ? "Choose a kind of nation, or start blank."
              : undefined
          }
        />
      )}
      {step === "identity" && (
        <IdentityStep
          ref={headingRef}
          identity={draft.identity}
          errors={identityErrors}
          moreOpen={moreOpen}
          onMoreOpenChange={setMoreOpen}
          onChange={(field, value) =>
            setDraft((current) => ({
              ...current,
              identity: { ...current.identity, [field]: value },
            }))
          }
        />
      )}
      {step === "government" && (
        <GovernmentStep
          ref={headingRef}
          government={draft.government}
          onChooseForm={(formId) =>
            setDraft((current) => ({
              ...current,
              government: chooseForm(current.government, formId),
            }))
          }
          onToggleComponent={(type) =>
            setDraft((current) => ({
              ...current,
              government: toggleComponent(current.government, type),
            }))
          }
          onRename={(key, value) =>
            setDraft((current) => ({
              ...current,
              government: renameInstitution(current.government, key, value),
            }))
          }
          onResetComponents={() =>
            setDraft((current) => ({
              ...current,
              government: { ...current.government, components: null },
            }))
          }
        />
      )}
      {step === "economy" && (
        <EconomyStep
          ref={headingRef}
          draft={draft}
          errors={economyErrors}
          onPopulationBand={(band) =>
            setDraft((current) => ({
              ...current,
              economy: { ...current.economy, populationBand: band, exactPopulation: null },
            }))
          }
          onWealthBand={(band) =>
            setDraft((current) => ({
              ...current,
              economy: { ...current.economy, wealthBand: band, exactGdpPerCapita: null },
            }))
          }
          onExact={(field, value) =>
            setDraft((current) => ({ ...current, economy: { ...current.economy, [field]: value } }))
          }
          onReset={(field) => {
            const typical = getArchetypeOption(draft.start.archetypeKey)?.display;
            setDraft((current) => ({
              ...current,
              economy:
                field === "exactPopulation"
                  ? {
                      ...current.economy,
                      exactPopulation: null,
                      populationBand: typical?.typicalPopulationBand ?? null,
                    }
                  : {
                      ...current.economy,
                      exactGdpPerCapita: null,
                      wealthBand: typical?.typicalWealthBand ?? null,
                    },
            }));
          }}
        />
      )}
      {step === "review" && (
        <ReviewStep
          ref={headingRef}
          draft={draft}
          realmName={realmName}
          showRealm={chooseRealm}
          summary={summary}
          stale={stale}
          error={foundError}
          onEdit={editFromReview}
        />
      )}

      <FoundingFooter
        canGoBack={index > 0}
        onBack={handleBack}
        primaryLabel={primaryLabel}
        onPrimary={handleContinue}
        primaryDisabled={founding}
        onOpenNation={() => setNationOpen(true)}
        status={status}
        resumed={resumed}
        onRetry={retry}
      />

      <Inspector title="Nation" open={nationOpen} onOpenChange={setNationOpen}>
        <Card padding="md" content="data">
          <NationCard summary={summary} stale={stale} />
        </Card>
      </Inspector>

      <ImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        onApply={(nation, keep) => {
          setDraft((current) => applyImport(current, nation, keep));
          setImportOpen(false);
          if (step !== "start") goTo("start");
        }}
      />

      <AlertDialog
        open={pendingStart !== null}
        onOpenChange={(open) => !open && setPendingStart(null)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {pendingLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching to {pendingLabel} replaces your size, wealth and government. Your name, flag
              and other identity stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep what I have</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                const key = pendingStart?.key ?? null;
                setPendingStart(null);
                applyStartAndGo(key);
              }}
            >
              Switch
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !founding && setConfirmOpen(open)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Found {nationName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {nationName} will be founded{realmName ? ` in ${realmName}` : ""} and become your
              active nation there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={founding}>Not yet</AlertDialogCancel>
            <Button type="button" disabled={founding} onClick={() => void handleFound()}>
              {founding ? "Founding…" : "Found nation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The founding flow behind sign-in. */
export function FoundingFlow() {
  return (
    <AuthenticationGuard redirectPath={FOUNDING_PATH}>
      <FoundingFlowView />
    </AuthenticationGuard>
  );
}
