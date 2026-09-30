"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { safeGetItemSync, safeRemoveItemSync } from "~/lib/system/local-storage-mutex";
import { builderTutorialSteps, quickStartSteps } from "../../../data/onboarding-tutorial";
import { createDefaultEconomicInputs } from "../../../lib/economy-data-service";
import type { BuilderStep } from "../builderConfig";
import type { BuilderState } from "../../../hooks/builderStateTypes";

export function useBuilderTutorials({
  setBuilderState,
}: {
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
}) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [_tutorialMode, setTutorialMode] = useState<string | null>(null);

  useEffect(() => {
    const mode = safeGetItemSync("builder_tutorial_mode");
    if (mode) {
      setTutorialMode(mode);
      setTimeout(() => {
        if (mode === "full") {
          setShowTutorial(true);
        } else if (mode === "quick") {
          setShowQuickStart(true);
        }
        safeRemoveItemSync("builder_tutorial_mode");
      }, 1000);
    }
  }, []);

  const handleCompleteTutorial = useCallback(() => {
    setShowTutorial(false);
    setTutorialMode(null);
  }, []);

  const handleCompleteQuickStart = useCallback(() => {
    setShowQuickStart(false);
    setTutorialMode(null);
  }, []);

  const handleQuickStartNavigation = useCallback(() => {
    setShowQuickStart(false);
    setTutorialMode(null);

    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("builder_state");
        localStorage.removeItem("builder_last_saved");
      }
    } catch {
      // Failed to clear saved state
    }

    setBuilderState((prev) => ({
      ...prev,
      step: "core",
      activeCoreTab: "identity",
      activeIdentitySubTab: "symbols",
      economicInputs: prev.economicInputs || createDefaultEconomicInputs(),
      completedSteps: [...new Set([...prev.completedSteps, "foundation" as BuilderStep])],
    }));
  }, [setBuilderState]);

  const enhancedTutorialSteps = useMemo(
    () =>
      builderTutorialSteps.map((step, index) => ({
        ...step,
        action: step.action
          ? {
              ...step.action,
              onClick:
                index === builderTutorialSteps.length - 1
                  ? handleCompleteTutorial
                  : step.action.onClick,
            }
          : undefined,
      })),
    [handleCompleteTutorial]
  );

  const enhancedQuickStartSteps = useMemo(
    () =>
      quickStartSteps.map((step, index) => ({
        ...step,
        action: step.action
          ? {
              ...step.action,
              onClick:
                index === quickStartSteps.length - 1
                  ? handleQuickStartNavigation
                  : step.action.onClick,
            }
          : undefined,
      })),
    [handleQuickStartNavigation]
  );

  return {
    showTutorial,
    setShowTutorial,
    showQuickStart,
    setShowQuickStart,
    handleCompleteTutorial,
    handleQuickStartNavigation,
    handleCompleteQuickStart,
    enhancedTutorialSteps,
    enhancedQuickStartSteps,
  };
}
