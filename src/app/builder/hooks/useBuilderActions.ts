import { useCallback, useMemo } from "react";
import type { BuilderStep } from "../components/enhanced/builderConfig";
import type { BuilderState } from "./useBuilderState";
import { stepOrder } from "../components/enhanced/builderConfig";

/**
 * Return value interface for useBuilderActions hook.
 * Provides navigation methods and progress tracking.
 */
export interface UseBuilderActionsReturn {
  /** Navigate to next tab or step based on current position */
  handleContinue: () => void;
  /** Navigate to previous step in workflow */
  handlePreviousStep: () => void;
  /** Navigate directly to a specific step (if accessible) */
  handleStepClick: (step: BuilderStep) => void;
  /** Change active tab within current step */
  handleTabChange: (step: BuilderStep, tab: string) => void;
  /** Check if navigation to a specific step is allowed */
  canNavigateToStep: (step: BuilderStep) => boolean;
  /** Current progress through workflow as percentage (0-100) */
  progressPercentage: number;
}

/**
 * Props interface for useBuilderActions hook.
 */
interface UseBuilderActionsProps {
  /** Current builder state from useBuilderState */
  builderState: BuilderState;
  /** State setter from useBuilderState */
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
  /** Builder mode: 'create' for new countries, 'edit' for existing */
  mode?: "create" | "edit";
}

/**
 * Builder navigation and action management hook.
 *
 * Provides intelligent navigation handlers for the multi-step builder workflow:
 * - Step navigation (next, previous, direct) with validation
 * - Tab management within steps (core, government, economics)
 * - Progress calculation for UI indicators
 * - Access control based on completion state
 *
 * Works in conjunction with useBuilderState to manage workflow progression.
 *
 * @hook
 * @param {UseBuilderActionsProps} props - Builder state and setter
 * @param {BuilderState} props.builderState - Current builder state
 * @param {Function} props.setBuilderState - State setter function
 * @returns {UseBuilderActionsReturn} Navigation methods and progress tracking
 * @returns {Function} returns.handleContinue - Progress to next tab/step
 * @returns {Function} returns.handlePreviousStep - Go back one step
 * @returns {Function} returns.handleStepClick - Jump to specific step
 * @returns {Function} returns.handleTabChange - Switch tabs within step
 * @returns {Function} returns.canNavigateToStep - Check step accessibility
 * @returns {number} returns.progressPercentage - Workflow completion (0-100)
 *
 * @example
 * ```tsx
 * function BuilderNavigation() {
 *   const { builderState, setBuilderState } = useBuilderState();
 *   const { handleContinue, handlePreviousStep, progressPercentage } =
 *     useBuilderActions({ builderState, setBuilderState });
 *
 *   return (
 *     <div>
 *       <ProgressBar value={progressPercentage} />
 *       <button onClick={handlePreviousStep}>Back</button>
 *       <button onClick={handleContinue}>Continue</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Tab navigation within a step
 * function CoreStepTabs() {
 *   const { builderState, setBuilderState } = useBuilderState();
 *   const { handleTabChange } = useBuilderActions({ builderState, setBuilderState });
 *
 *   const tabs = ['identity', 'indicators'];
 *
 *   return (
 *     <div>
 *       {tabs.map(tab => (
 *         <button
 *           key={tab}
 *           onClick={() => handleTabChange('core', tab)}
 *           className={builderState.activeCoreTab === tab ? 'active' : ''}
 *         >
 *           {tab}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Step indicator with access control
 * function StepIndicator() {
 *   const { builderState, setBuilderState } = useBuilderState();
 *   const { handleStepClick, canNavigateToStep } =
 *     useBuilderActions({ builderState, setBuilderState });
 *
 *   const steps: BuilderStep[] = ['foundation', 'core', 'government', 'economics', 'preview'];
 *
 *   return (
 *     <div className="flex gap-2">
 *       {steps.map((step, index) => (
 *         <button
 *           key={step}
 *           onClick={() => handleStepClick(step)}
 *           disabled={!canNavigateToStep(step)}
 *           className={builderState.step === step ? 'active' : ''}
 *         >
 *           {index + 1}. {step}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBuilderActions({
  builderState,
  setBuilderState,
  mode = "create",
}: UseBuilderActionsProps): UseBuilderActionsReturn {
  // Dynamic step lists based on mode
  const steps = useMemo(() => {
    return mode === "edit"
      ? ["core", "government", "economics", "preview"]
      : ["foundation", "core", "government", "economics", "preview"];
  }, [mode]);

  // Handle tab navigation within steps
  const handleTabChange = useCallback(
    (step: BuilderStep, tab: string) => {
      switch (step) {
        case "core":
          setBuilderState((prev) => ({ ...prev, activeCoreTab: tab }));
          break;
        case "government":
          setBuilderState((prev) => ({ ...prev, activeGovernmentTab: tab }));
          break;
        case "economics":
          setBuilderState((prev) => ({ ...prev, activeEconomicsTab: tab }));
          break;
      }
    },
    [setBuilderState]
  );

  // Handle continue button - moves to next tab or next step
  const handleContinue = useCallback(() => {
    const { step, activeCoreTab, activeGovernmentTab, activeEconomicsTab, selectedCountry } =
      builderState;

    switch (step) {
      case "foundation":
        if (selectedCountry) {
          setBuilderState((prev) => ({
            ...prev,
            step: "core",
            completedSteps: [...new Set([...prev.completedSteps, "foundation" as BuilderStep])],
          }));
        }
        break;

      case "core":
        if (activeCoreTab === "identity") {
          handleTabChange("core", "indicators");
        } else {
          const nextStep = "government";
          setBuilderState((prev) => ({
            ...prev,
            step: nextStep as BuilderStep,
            completedSteps: [...new Set([...prev.completedSteps, "core" as BuilderStep])],
          }));
        }
        break;

      case "government":
        const govTabs = ["components", "structure", "spending", "preview"];
        const currentGovIndex = govTabs.indexOf(activeGovernmentTab);
        if (currentGovIndex < govTabs.length - 1) {
          handleTabChange("government", govTabs[currentGovIndex + 1]!);
        } else {
          setBuilderState((prev) => ({
            ...prev,
            step: "economics",
            completedSteps: [...new Set([...prev.completedSteps, "government" as BuilderStep])],
          }));
        }
        break;

      case "economics":
        const econTabs = ["components", "structure", "fiscal", "preview"];
        const currentEconIndex = econTabs.indexOf(activeEconomicsTab);
        if (currentEconIndex < econTabs.length - 1) {
          handleTabChange("economics", econTabs[currentEconIndex + 1]!);
        } else {
          setBuilderState((prev) => ({
            ...prev,
            step: "preview",
            completedSteps: [...new Set([...prev.completedSteps, "economics" as BuilderStep])],
          }));
        }
        break;
    }
  }, [builderState, setBuilderState, handleTabChange, mode]);

  // Handle previous step - moves to previous tab or previous step
  const handlePreviousStep = useCallback(() => {
    const { step, activeCoreTab, activeGovernmentTab, activeEconomicsTab } = builderState;

    // 1. Check if we can go back a tab within the current step
    if (step === "core" && activeCoreTab === "indicators") {
      handleTabChange("core", "identity");
      return;
    }

    if (step === "government") {
      const govTabs = ["components", "structure", "spending", "preview"];
      const currentGovIndex = govTabs.indexOf(activeGovernmentTab);
      if (currentGovIndex > 0) {
        handleTabChange("government", govTabs[currentGovIndex - 1]!);
        return;
      }
    }

    if (step === "economics") {
      const econTabs = ["components", "structure", "fiscal", "preview"];
      const currentEconIndex = econTabs.indexOf(activeEconomicsTab);
      if (currentEconIndex > 0) {
        handleTabChange("economics", econTabs[currentEconIndex - 1]!);
        return;
      }
    }

    // 2. Otherwise, navigate to the previous step
    const currentIndex = steps.indexOf(step);
    if (currentIndex <= 0) {
      return;
    }

    const targetIndex = currentIndex - 1;
    const prevStep = steps[targetIndex] as BuilderStep;

    setBuilderState((prev) => {
      const updatedState = {
        ...prev,
        step: prevStep,
        // Mark current step as completed when going back to preserve state
        completedSteps: [...new Set([...prev.completedSteps, step])],
      };

      // Set target tabs to the last tab when going backward
      if (prevStep === "core") {
        updatedState.activeCoreTab = "indicators";
      } else if (prevStep === "government") {
        updatedState.activeGovernmentTab = "preview";
      } else if (prevStep === "economics") {
        updatedState.activeEconomicsTab = "preview";
      }

      return updatedState;
    });
  }, [builderState, setBuilderState, steps, handleTabChange]);

  // Handle direct step navigation
  const handleStepClick = useCallback(
    (step: BuilderStep) => {
      const currentIndex = steps.indexOf(builderState.step);
      const targetIndex = steps.indexOf(step);

      if (targetIndex === -1) return;

      // In edit mode, allow navigation to any step
      if (mode === "edit") {
        setBuilderState((prev) => ({
          ...prev,
          step,
          completedSteps: [...new Set([...prev.completedSteps, builderState.step])],
        }));
        return;
      }

      // In create mode, once unlocked (foundation completed), allow free navigation to any step
      const isUnlocked = builderState.completedSteps.includes("foundation" as BuilderStep);
      if (isUnlocked || targetIndex <= currentIndex || builderState.completedSteps.includes(step)) {
        setBuilderState((prev) => ({
          ...prev,
          step,
          completedSteps: [...new Set([...prev.completedSteps, builderState.step])],
        }));
      }
    },
    [builderState.step, builderState.completedSteps, setBuilderState, mode, steps]
  );

  // Check if navigation to a specific step is allowed
  const canNavigateToStep = useCallback(
    (step: BuilderStep): boolean => {
      const currentIndex = steps.indexOf(builderState.step);
      const targetIndex = steps.indexOf(step);

      if (targetIndex === -1) return false;
      if (mode === "edit") return true;

      // In create mode, once unlocked (foundation completed), allow free navigation to any step
      const isUnlocked = builderState.completedSteps.includes("foundation" as BuilderStep);
      if (isUnlocked) return true;

      return targetIndex <= currentIndex || builderState.completedSteps.includes(step);
    },
    [builderState.step, builderState.completedSteps, mode, steps]
  );

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    const currentIndex = steps.indexOf(builderState.step);
    if (currentIndex === -1) return 0;
    return ((currentIndex + 1) / steps.length) * 100;
  }, [builderState.step, steps]);

  return {
    handleContinue,
    handlePreviousStep,
    handleStepClick,
    handleTabChange,
    canNavigateToStep,
    progressPercentage,
  };
}
