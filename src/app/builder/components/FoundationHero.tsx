"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, EditPencil as Edit3, ArrowRight, ClockRotateRight, Trash } from "iconoir-react";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
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
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  accent: "amber" | "blue" | "emerald" | "indigo";
  onClick: () => void;
  badge?: string;
}

function IIWikiLogoIcon({ className }: { className?: string }) {
  return (
    <img
      src={withBasePath("/images/IIWikiLogo.png")}
      alt="IIWiki Logo"
      className={cn(
        "h-7 w-7 rounded-full object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-105",
        className
      )}
      loading="lazy"
    />
  );
}

function PathCard({
  title,
  description,
  icon: Icon,
  iconClassName,
  accent,
  onClick,
  badge,
}: PathCardProps) {
  const accentStyles = {
    amber: {
      border: "hover:border-amber-500/40 border-amber-500/20",
      glow: "group-hover:bg-amber-500/10 bg-amber-500/5",
      iconText: "text-amber-400",
      theme: "gold" as const,
      badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    blue: {
      border: "hover:border-blue-500/40 border-blue-500/20",
      glow: "group-hover:bg-blue-500/10 bg-blue-500/5",
      iconText: "text-blue-400",
      theme: "blue" as const,
      badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
    emerald: {
      border: "hover:border-emerald-500/40 border-emerald-500/20",
      glow: "group-hover:bg-emerald-500/10 bg-emerald-500/5",
      iconText: "text-emerald-400",
      theme: "emerald" as const,
      badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    indigo: {
      border: "hover:border-indigo-500/40 border-indigo-500/20",
      glow: "group-hover:bg-indigo-500/10 bg-indigo-500/5",
      iconText: "text-indigo-400",
      theme: "indigo" as const,
      badgeClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    },
  }[accent];

  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="h-full"
    >
      <button
        type="button"
        onClick={onClick}
        className="group relative h-full w-full text-left transition-all focus:outline-none"
        data-cuelume-press
      >
        <FacetCard
          depth="base"
          theme={accentStyles.theme}
          texture="chevron"
          textureOpacity={0.05}
          className={cn(
            "h-full border p-6 transition-all duration-300",
            accentStyles.border,
            "hover:shadow-lg hover:shadow-black/20"
          )}
        >
          <FacetCardContent className="flex h-full flex-col justify-between p-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 transition-colors",
                    accentStyles.glow
                  )}
                >
                  <Icon className={cn("h-6 w-6", accentStyles.iconText, iconClassName)} />
                </div>
                {badge && (
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
                      accentStyles.badgeClass
                    )}
                  >
                    {badge}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-foreground text-lg font-bold tracking-tight">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
              <span>Continue</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </FacetCardContent>
        </FacetCard>
      </button>
    </motion.div>
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
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 34,
          }}
          className="group relative select-none"
        >
          {/* Ambient Warm Glow Halo */}
          <div
            className="pointer-events-none absolute -inset-6 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/10 opacity-70 blur-2xl transition-opacity duration-700 group-hover:opacity-100 dark:opacity-40 dark:group-hover:opacity-75"
            aria-hidden="true"
          />

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
          <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Build your country.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-lg text-base sm:text-lg leading-relaxed">
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
              scale: 0.96,
              y: -10,
              height: 0,
              marginBottom: 0,
              transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] },
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
                  className="relative overflow-hidden rounded-2xl border border-destructive/40 bg-card/90 p-4 sm:p-5 shadow-xl shadow-destructive/10 backdrop-blur-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Ambient destructive glow */}
                  <div
                    className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-destructive/15 blur-3xl"
                    aria-hidden="true"
                  />

                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left: Icon & Warning copy */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/15 text-destructive shadow-xs">
                        <Trash className="h-6 w-6" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                            Confirmation Required
                          </span>
                        </div>
                        <h3 className="text-foreground truncate text-base sm:text-lg font-bold tracking-tight">
                          Discard draft for {inProgressData.name}?
                        </h3>
                        <p className="text-muted-foreground text-xs sm:text-sm">
                          All unsaved progress and configuration will be permanently deleted.
                        </p>
                      </div>
                    </div>

                    {/* Right: Cancel & Confirm buttons */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEffects.press();
                          setShowDiscardConfirm(false);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground active:scale-[0.98] transition-colors"
                        data-cuelume-press="soft"
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
                        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold active:scale-[0.98] shadow-md shadow-destructive/25 transition-all cursor-pointer"
                        data-cuelume-press
                      >
                        <Trash className="h-3.5 w-3.5" />
                        <span>Discard Draft</span>
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="resume-standard-view"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  onClick={handleResumeClick}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-amber-500/30 bg-card/60 p-4 sm:p-5 shadow-lg shadow-amber-500/5 backdrop-blur-xl transition-all duration-300 hover:border-amber-500/50 hover:bg-card/80 hover:shadow-amber-500/10 active:scale-[0.99]"
                  data-cuelume-press
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleResumeClick();
                    }
                  }}
                >
                  {/* Background ambient gradient glow */}
                  <div
                    className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-yellow-500/5 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                    aria-hidden="true"
                  />

                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left Side: Avatar / Flag + Info */}
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Flag / Emblem Thumbnail */}
                      <div className="relative shrink-0">
                        {inProgressData.flag ? (
                          <div className="relative h-12 w-16 overflow-hidden rounded-lg border border-white/10 shadow-xs bg-muted/40">
                            <img
                              src={inProgressData.flag}
                              alt={inProgressData.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-xs">
                            <ClockRotateRight className="h-6 w-6" />
                          </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background ring-2 ring-background">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        </span>
                      </div>

                      {/* Text Content */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                            Draft In Progress
                          </span>
                          <span className="text-muted-foreground/40 text-xs">•</span>
                          <span className="text-muted-foreground text-xs font-medium">
                            {inProgressData.stepLabel}
                          </span>
                        </div>

                        <h3 className="text-foreground truncate text-base sm:text-lg font-bold tracking-tight">
                          Resume {inProgressData.name}
                        </h3>
                        <p className="text-muted-foreground truncate text-xs sm:text-sm">
                          Continue configuring your nation where you left off.
                        </p>
                      </div>
                    </div>

                    {/* Right Side: Action Buttons */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEffects.press();
                          setShowDiscardConfirm(true);
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-colors"
                        title="Discard this draft and start fresh"
                        data-cuelume-press
                      >
                        Discard
                      </Button>

                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResumeClick();
                        }}
                        size="sm"
                        className="group/btn flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-xs sm:text-sm font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-400 active:scale-[0.98] transition-all cursor-pointer"
                        data-cuelume-press
                      >
                        <span>Resume Building</span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                      </Button>
                    </div>
                  </div>
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
          accent="amber"
          badge="Recommended"
          onClick={() => onSelectPath("template")}
        />

        <PathCard
          title="Start from Scratch"
          description="Customize every aspect of your country from the ground up. Only for the most dedicated worldbuilders."
          icon={Edit3}
          accent="emerald"
          onClick={() => onSelectPath("scratch")}
        />

        <PathCard
          title="Import from IIWiki"
          description="Use your existing country data from IIWiki to build your country. Core stats, flag, and relevant lore are automatically parsed."
          icon={IIWikiLogoIcon}
          iconClassName="h-7 w-7"
          accent="indigo"
          onClick={() => onSelectPath("import")}
        />
      </div>
    </div>
  );
}
