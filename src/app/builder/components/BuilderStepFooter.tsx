"use client";

import React, { useMemo } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { type BuilderSection } from "../lib/builder-theme";
import { useBuilderStepNav, SECTION_LABELS } from "../hooks/useBuilderStepNav";
import { BuilderRealmPicker } from "./BuilderRealmPicker";

interface BuilderStepFooterProps {
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
  const { handleReset, steps, currentIndex, isBackDisabled, isOnPreview } = useBuilderStepNav({
    activeSection,
    mode,
    onNavigate,
    onReset,
  });

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
    <div className="border-separator mt-10 flex flex-col gap-3 border-t pt-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
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
          className="text-label-secondary hover:text-destructive"
        >
          {mode === "edit" ? "Discard changes and exit" : "Restart builder"}
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
          <Button type="button" onClick={onSubmit} disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                <span>{mode === "edit" ? "Saving..." : "Creating nation..."}</span>
              </>
            ) : (
              <>
                <CheckCircle aria-hidden="true" className="h-3.5 w-3.5" />
                <span>{mode === "edit" ? "Save nation" : "Create nation"}</span>
              </>
            )}
          </Button>
        ) : (
          <Button type="button" onClick={onContinue}>
            <span>{nextStepLabel ? `Continue to ${nextStepLabel}` : "Continue"}</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
});
