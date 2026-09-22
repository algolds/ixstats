"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  SystemRestart as Loader2,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { soundEffects } from "~/lib/sound/cuelume";
import { createUrl } from "~/lib/utils";
import { type BuilderSection, isScratchOrImportOrigin, getBuilderSteps } from "../lib/builder-theme";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";

import { useBuilderFilter } from "./builder-filter-context";

const SECTION_LABELS: Record<BuilderSection, string> = {
  foundation: "Foundation",
  identity: "Identity",
  government: "Government",
  economics: "Economics",
  preview: "Preview & Finalize",
  import: "Wiki Import",
};

export interface BuilderStepFooterProps {
  activeSection: BuilderSection;
  mode: "create" | "edit";
  onNavigate: (section: BuilderSection) => void;
  onBack: () => void;
  onContinue: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  onReset?: () => void;
}

export const BuilderStepFooter = React.memo(function BuilderStepFooter({
  activeSection,
  mode,
  onNavigate,
  onBack,
  onContinue,
  onSubmit,
  isSubmitting = false,
  onReset,
}: BuilderStepFooterProps) {
  const { clearDraft, builderState } = useBuilderContext();
  const filter = useBuilderFilter();
  const router = useRouter();

  const handleReset = () => {
    if (onReset) {
      onReset();
      return;
    }
    soundEffects.press();
    clearDraft();
    if (mode === "edit") {
      router.push(createUrl("/mycountry"));
    } else {
      filter.clearSelection();
      onNavigate("foundation");
    }
  };

  const isScratchOrImport = useMemo(
    () => isScratchOrImportOrigin(builderState),
    [builderState]
  );

  const steps = useMemo(
    () => getBuilderSteps(activeSection, mode, isScratchOrImport),
    [activeSection, mode, isScratchOrImport]
  );

  const currentIndex = steps.indexOf(activeSection);
  const isBackDisabled = currentIndex <= 0;
  const isOnPreview = activeSection === "preview";


  const previousStepLabel = useMemo(() => {
    if (currentIndex > 0) {
      const prev = steps[currentIndex - 1];
      return prev ? SECTION_LABELS[prev] : undefined;
    }
    return undefined;
  }, [steps, currentIndex]);

  const nextStepLabel = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < steps.length - 1) {
      const next = steps[currentIndex + 1];
      return next ? SECTION_LABELS[next] : undefined;
    }
    return undefined;
  }, [steps, currentIndex]);

  return (
    <div className="border-border/40 mt-10 flex flex-col gap-3 border-t pt-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Previous step navigation & subtle discard link */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isBackDisabled}
          data-cuelume-press
          className="border-border/60 hover:bg-accent/40 rounded-xl text-xs font-semibold active:scale-[0.97] cursor-pointer"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          <span>{previousStepLabel ? `Back to ${previousStepLabel}` : "Back"}</span>
        </Button>

        <button
          type="button"
          onClick={handleReset}
          className="text-muted-foreground/60 hover:text-destructive text-xs transition-colors underline-offset-4 hover:underline cursor-pointer"
        >
          {mode === "edit" ? "Discard changes & exit" : "Restart builder"}
        </button>
      </div>

      {/* Right: Forward action button */}
      <div className="flex items-center gap-3">
        {isOnPreview ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            data-cuelume-press
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-xs font-bold text-white shadow-md transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-[0.97] cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                <span>{mode === "edit" ? "Saving..." : "Creating Nation..."}</span>
              </>
            ) : (
              <>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                <span>{mode === "edit" ? "Save Nation" : "Create Nation"}</span>
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onContinue}
            data-cuelume-press
            className="rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.97] cursor-pointer"
          >
            <span>{nextStepLabel ? `Continue to ${nextStepLabel}` : "Continue"}</span>
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
});
