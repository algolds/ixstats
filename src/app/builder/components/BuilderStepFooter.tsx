"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle, SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { soundEffects } from "~/lib/sound/cuelume";
import { createUrl } from "~/lib/utils";
import {
  type BuilderSection,
  isScratchOrImportOrigin,
  getBuilderSteps,
} from "../lib/builder-theme";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";

import { useBuilderFilter } from "./builder-filter-context";
import { BuilderRealmPicker } from "./BuilderRealmPicker";

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
  const { clearDraft, builderState, setBuilderState } = useBuilderContext();
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

  const isScratchOrImport = useMemo(() => isScratchOrImportOrigin(builderState), [builderState]);

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
    <div className="border-border mt-10 flex flex-col gap-3 border-t pt-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Previous step navigation & subtle discard link */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={isBackDisabled}>
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          <span>{previousStepLabel ? `Back to ${previousStepLabel}` : "Back"}</span>
        </Button>

        <Button
          type="button"
          variant="link"
          size="xs"
          onClick={handleReset}
          className="text-muted-foreground hover:text-destructive"
        >
          {mode === "edit" ? "Discard changes & exit" : "Restart builder"}
        </Button>
      </div>

      {/* Right: Forward action button */}
      <div className="flex items-center gap-3">
        {isOnPreview && mode === "create" && (
          <BuilderRealmPicker
            value={builderState.realmId}
            onChange={(realmId) => setBuilderState((prev) => ({ ...prev, realmId }))}
          />
        )}
        {isOnPreview ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="bg-amber-600 font-semibold text-white hover:bg-amber-600/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                <span>{mode === "edit" ? "Saving..." : "Creating Nation..."}</span>
              </>
            ) : (
              <>
                <CheckCircle aria-hidden="true" className="h-3.5 w-3.5" />
                <span>{mode === "edit" ? "Save Nation" : "Create Nation"}</span>
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onContinue}
            className="bg-amber-600 font-semibold text-white hover:bg-amber-600/90"
          >
            <span>{nextStepLabel ? `Continue to ${nextStepLabel}` : "Continue"}</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
});
