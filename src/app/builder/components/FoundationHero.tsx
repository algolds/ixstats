"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, EditPencil as Edit3, ArrowRight, ClockRotateRight, Trash } from "iconoir-react";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { MyCountryLogo } from "~/components/mycountry/shared/primitives/mycountry-logo";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { safeGetItemSync } from "~/lib/system/local-storage-mutex";
import { getHighResFlagUrl, getStepLabel } from "./enhanced/steps/foundation/foundationUtils";
import type { BuilderStep } from "./enhanced/builderConfig";

export type FoundationPath = "template" | "archetype" | "country" | "scratch" | "import";

interface FoundationHeroProps {
  onSelectPath: (path: FoundationPath) => void;
  onResume?: () => void;
}

interface PathCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  iconClassName?: string;
  onClick: () => void;
  badge?: string;
}

function IIWikiLogoIcon({ className }: { className?: string; "aria-hidden"?: boolean | "true" }) {
  return (
    <img
      src={withBasePath("/images/IIWikiLogo.png")}
      alt=""
      className={cn("h-7 w-7 rounded-full object-contain", className)}
      loading="lazy"
    />
  );
}

function PathCard({
  title,
  description,
  icon: Icon,
  iconClassName,
  onClick,
  badge,
}: PathCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group focus-visible:ring-tint rounded-card h-full w-full text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      data-cuelume-press
      data-cuelume-hover="tick"
    >
      <FacetCard className="rounded-card group-hover:border-tint/40 h-full p-6 transition-[border-color,transform] duration-150 group-active:scale-[0.98]">
        <FacetCardContent className="flex h-full flex-col justify-between p-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Icon
                aria-hidden="true"
                className={cn("text-label-secondary h-6 w-6", iconClassName)}
              />
              {badge && <Badge variant="tinted">{badge}</Badge>}
            </div>

            <div className="space-y-2">
              <h3 className="text-label text-title-3">{title}</h3>
              <p className="text-label-secondary text-body leading-relaxed">{description}</p>
            </div>
          </div>

          <div className="text-label-secondary group-hover:text-label text-caption mt-6 flex items-center gap-2 font-semibold transition-colors">
            <span>Continue</span>
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1"
            />
          </div>
        </FacetCardContent>
      </FacetCard>
    </button>
  );
}

export function FoundationHero({ onSelectPath, onResume }: FoundationHeroProps) {
  const { builderState, setBuilderState, hasRestoredState, clearDraft } = useBuilderContext();
  const [mounted, setMounted] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const inProgressData = useMemo(() => {
    if (!mounted || isDismissed) return null;

    // Check active builderState
    const stateCountryName =
      builderState.economicInputs?.countryName ||
      builderState.economicInputs?.nationalIdentity?.countryName ||
      builderState.selectedCountry?.name;

    const hasSubstantialInputs =
      !!builderState.economicInputs ||
      !!builderState.selectedCountry ||
      !!builderState.selectedArchetypeId ||
      builderState.governmentComponents.length > 0 ||
      builderState.economyBuilderState !== null ||
      (builderState.completedSteps && builderState.completedSteps.length > 0);

    // Check localStorage savedState if present
    let savedStep: string | null = null;
    let savedCountryName: string | null = null;
    let savedFlagUrl: string | null = null;

    try {
      const rawSaved = safeGetItemSync("builder_state") || sessionStorage.getItem("builder_state");
      if (rawSaved) {
        const parsed = JSON.parse(rawSaved);
        if (parsed.step && parsed.step !== "foundation") {
          savedStep = parsed.step;
        }
        savedCountryName =
          parsed.economicInputs?.countryName ||
          parsed.economicInputs?.nationalIdentity?.countryName ||
          parsed.selectedCountry?.name ||
          null;
        savedFlagUrl =
          parsed.economicInputs?.flagUrl ||
          parsed.selectedCountry?.flag ||
          parsed.selectedCountry?.flagUrl ||
          null;
      }
    } catch {
      // safe fallback
    }

    const name = stateCountryName || savedCountryName;
    const rawFlag =
      builderState.economicInputs?.flagUrl ||
      builderState.selectedCountry?.flag ||
      builderState.selectedCountry?.flagUrl ||
      savedFlagUrl;

    const hasProgress = hasRestoredState || hasSubstantialInputs || !!savedStep || !!name;
    if (!hasProgress) return null;

    const targetStep =
      builderState.step && builderState.step !== "foundation"
        ? builderState.step
        : savedStep && savedStep !== "foundation"
          ? savedStep
          : "core";

    const displayFlag = getHighResFlagUrl(rawFlag);

    return {
      name: name && name !== "New Nation" && name !== "Custom Nation" ? name : "In-Progress Nation",
      flag: displayFlag,
      targetStep: targetStep as BuilderStep,
      stepLabel: getStepLabel(targetStep),
    };
  }, [mounted, isDismissed, builderState, hasRestoredState]);

  const handleResumeClick = useCallback(() => {
    if (!inProgressData) return;

    if (onResume) {
      onResume();
      return;
    }

    // Default internal fallback: restore full state from localStorage if available
    try {
      const rawSaved = safeGetItemSync("builder_state") || sessionStorage.getItem("builder_state");
      if (rawSaved) {
        const parsed = JSON.parse(rawSaved);
        setBuilderState((prev) => ({
          ...prev,
          ...parsed,
          step: inProgressData.targetStep,
        }));
        return;
      }
    } catch {
      // fallback
    }

    setBuilderState((prev) => ({
      ...prev,
      step: inProgressData.targetStep,
    }));
  }, [inProgressData, onResume, setBuilderState]);

  const handleConfirmDiscard = useCallback(() => {
    soundEffects.press();
    clearDraft();
    setShowDiscardConfirm(false);
    setIsDismissed(true);
  }, [clearDraft]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col justify-center space-y-6 py-2 sm:space-y-8 sm:py-4">
      {/* Brand Header */}
      <div className="flex flex-col items-center space-y-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="relative select-none"
        >
          <MyCountryLogo
            size="xl"
            variant="full"
            animated={true}
            mode="create"
            showSubtitle={true}
            showVersion={true}
          />
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-label text-large-title sm:text-large-title lg:text-display">
            Build your country.
          </h1>
          <p className="text-label-secondary text-body sm:text-title-3 mx-auto max-w-lg leading-relaxed">
            Choose a starting point below. All 140+ options can be modified later.
          </p>
        </div>
      </div>

      {/* Resume In-Progress Country Banner */}
      <AnimatePresence mode="wait">
        {inProgressData && (
          <motion.div
            key="resume-banner-wrapper"
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -8,
              transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
            }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="w-full"
          >
            <AnimatePresence mode="wait">
              {showDiscardConfirm ? (
                <motion.div
                  key="discard-confirmation-view"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <FacetCard
                    role="alertdialog"
                    aria-labelledby="foundation-discard-title"
                    className="border-destructive/40 rounded-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <Trash aria-hidden="true" className="text-destructive h-6 w-6 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <Eyebrow className="text-destructive block">Confirmation Required</Eyebrow>
                        <h3
                          id="foundation-discard-title"
                          className="text-label text-headline sm:text-title-3 truncate"
                        >
                          Discard draft for {inProgressData.name}?
                        </h3>
                        <p className="text-label-secondary text-footnote sm:text-body">
                          All unsaved progress and configuration will be permanently deleted.
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEffects.press();
                          setShowDiscardConfirm(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmDiscard();
                        }}
                      >
                        <Trash aria-hidden="true" className="h-3.5 w-3.5" />
                        Discard Draft
                      </Button>
                    </div>
                  </FacetCard>
                </motion.div>
              ) : (
                <motion.div
                  key="resume-standard-view"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                >
                  <FacetCard
                    onClick={handleResumeClick}
                    data-cuelume-press
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleResumeClick();
                      }
                    }}
                    className="focus-visible:ring-tint rounded-card border-tint/30 hover:border-tint/50 flex flex-col gap-4 p-4 focus-visible:ring-2 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      {inProgressData.flag ? (
                        <div className="border-separator bg-fill-3 rounded-control h-12 w-16 shrink-0 overflow-hidden border">
                          <img
                            src={inProgressData.flag}
                            alt={inProgressData.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <ClockRotateRight
                          aria-hidden="true"
                          className="text-tint h-6 w-6 shrink-0"
                        />
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="tinted">Draft In Progress</Badge>
                          <span className="text-label-secondary text-caption">
                            {inProgressData.stepLabel}
                          </span>
                        </div>
                        <h3 className="text-label text-headline sm:text-title-3 truncate">
                          Resume {inProgressData.name}
                        </h3>
                        <p className="text-label-secondary text-footnote sm:text-body truncate">
                          Continue configuring your nation where you left off.
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEffects.press();
                          setShowDiscardConfirm(true);
                        }}
                        className="text-label-secondary hover:bg-destructive/10 hover:text-destructive"
                        title="Discard this draft and start fresh"
                      >
                        Discard
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResumeClick();
                        }}
                      >
                        Resume Building
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>
                  </FacetCard>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3 Starting Options */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <PathCard
          title="Start with a Template"
          description="Select a real country or archetype to use as a template. We'll do the heavy lifting to get you started."
          icon={Globe}
          badge="Recommended"
          onClick={() => onSelectPath("template")}
        />

        <PathCard
          title="Start from Scratch"
          description="Customize every aspect of your country from the ground up. Only for the most dedicated worldbuilders."
          icon={Edit3}
          onClick={() => onSelectPath("scratch")}
        />

        <PathCard
          title="Import from IIWiki"
          description="Use your existing country data from IIWiki to build your country. Core stats, flag, and relevant lore are automatically parsed."
          icon={IIWikiLogoIcon}
          iconClassName="h-7 w-7"
          onClick={() => onSelectPath("import")}
        />
      </div>
    </div>
  );
}
