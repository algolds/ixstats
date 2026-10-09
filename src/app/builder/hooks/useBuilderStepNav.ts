import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { soundEffects } from "~/lib/sound/cuelume";
import {
  type BuilderSection,
  isScratchOrImportOrigin,
  getBuilderSteps,
} from "../lib/builder-theme";
import { useBuilderContext } from "../components/enhanced/context/BuilderStateContext";
import { useBuilderFilter } from "../components/builder-filter-context";

export const SECTION_LABELS: Record<BuilderSection, string> = {
  foundation: "Foundation",
  identity: "Identity",
  government: "Government",
  economics: "Economics",
  preview: "Preview and finalize",
  import: "Wiki import",
};

interface StepNavOptions {
  activeSection: BuilderSection;
  mode: "create" | "edit";
  onNavigate: (section: BuilderSection) => void;
  onReset?: () => void;
}

/** Step list, back/preview flags and the reset action shared by the studio header and footer. */
export function useBuilderStepNav({ activeSection, mode, onNavigate, onReset }: StepNavOptions) {
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
      router.push("/mycountry");
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

  return {
    handleReset,
    steps,
    currentIndex,
    isBackDisabled: currentIndex <= 0,
    isOnPreview: activeSection === "preview",
  };
}
