import { useEffect, useRef } from "react";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import type { BuilderSection } from "../lib/builder-theme";

export function useStepCompletion(
  completedSteps: Set<BuilderSection>,
  sectionLabels: Record<BuilderSection, string>,
  totalSections: number
) {
  const prevCompleted = useRef(new Set<BuilderSection>());
  const notify = useNotify();

  useEffect(() => {
    // Only fire after initial mount (prevent spamming toasts when restoring completed steps)
    if (prevCompleted.current.size > 0 || completedSteps.size > 0) {
      for (const section of completedSteps) {
        if (!prevCompleted.current.has(section)) {
          // New completion detected
          try {
            soundEffects.bloom();
          } catch {
            // Audio may be blocked by browser autoplay policy
          }
          const remaining = totalSections - completedSteps.size;
          if (remaining > 0) {
            notify.success(
              `${sectionLabels[section]} configured — ${remaining} section${remaining > 1 ? "s" : ""} remaining`
            );
          }
        }
      }
    }
    prevCompleted.current = new Set(completedSteps);
  }, [completedSteps, sectionLabels, totalSections, notify]);
}
