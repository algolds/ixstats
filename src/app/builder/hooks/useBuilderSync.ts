import { useEffect, useRef } from "react";
import { safeGetItemSync, safeRemoveItemSync } from "~/lib/system/local-storage-mutex";
import { createDefaultEconomicInputs } from "../lib/economy-data-service";
import { buildWikiImportState, type WikiImportPayload } from "../lib/wiki-import-state";
import type { BuilderStep } from "../components/enhanced/builderConfig";
import type { BuilderState } from "./builderStateTypes";

interface UseBuilderSyncProps {
  mode: "create" | "edit";
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
  setHasRestoredState: (restored: boolean) => void;
  setLastSaved: (date: Date | null) => void;
  localHadDataRef: React.MutableRefObject<boolean>;
}

export function useBuilderSync({
  mode,
  setBuilderState,
  setHasRestoredState,
  setLastSaved,
  localHadDataRef,
}: UseBuilderSyncProps) {
  const quickStartProcessed = useRef(false);

  useEffect(() => {
    if (mode !== "create") return;

    try {
      const quickStartSection = safeGetItemSync("builder_quick_start_section");

      if (quickStartSection === "core" && !quickStartProcessed.current) {
        quickStartProcessed.current = true;

        setBuilderState((prev) => ({
          ...prev,
          creationOrigin: "scratch",
          step: "core",
          selectedCountry: null,
          economicInputs: createDefaultEconomicInputs(),
          completedSteps: [...new Set([...prev.completedSteps, "foundation" as BuilderStep])],
        }));
        safeRemoveItemSync("builder_quick_start_section");
        return;
      }

      // Check for wiki import data
      const importedData = safeGetItemSync("builder_imported_data");
      if (importedData && !quickStartProcessed.current) {
        quickStartProcessed.current = true;

        try {
          const wikiState = buildWikiImportState(JSON.parse(importedData) as WikiImportPayload);
          setBuilderState((prev) => ({
            ...prev,
            ...wikiState,
          }));

          safeRemoveItemSync("builder_imported_data");
          return;
        } catch (parseError) {
          console.error("[useBuilderSync] Failed to parse wiki import data:", parseError);
        }
      }

      if (!quickStartProcessed.current) {
        let savedState = safeGetItemSync("builder_state");
        let savedLastSaved = safeGetItemSync("builder_last_saved");

        if (!savedState) {
          try {
            savedState = sessionStorage.getItem("builder_state");
            savedLastSaved = sessionStorage.getItem("builder_last_saved");
          } catch (error) {
            console.warn("[BuilderState] Failed to access sessionStorage:", error);
          }
        }

        if (savedState) {
          let parsedState: BuilderState;
          try {
            parsedState = JSON.parse(savedState);
          } catch {
            return;
          }
          const {
            step: _step,
            completedSteps: _completedSteps,
            selectedCountry: _selectedCountry,
            selectedArchetypeId: _selectedArchetypeId,
            ...dataFields
          } = parsedState;
          setBuilderState((prev) => ({
            ...prev,
            ...dataFields,
            economyBuilderState: parsedState.economyBuilderState ?? null,
          }));
          const hasProgress =
            !!parsedState.selectedCountry ||
            !!parsedState.selectedArchetypeId ||
            (!!parsedState.economicInputs && !!parsedState.economicInputs.countryName) ||
            (Array.isArray(parsedState.completedSteps) && parsedState.completedSteps.length > 0);
          if (hasProgress) {
            setHasRestoredState(true);
            localHadDataRef.current = true;
          }
        }

        if (savedLastSaved) {
          setLastSaved(new Date(savedLastSaved));
        }
      }
    } catch {
      // Failed to load saved state, continue with default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
}
