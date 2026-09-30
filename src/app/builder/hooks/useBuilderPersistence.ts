import { useState, useCallback, useEffect, useRef } from "react";
import { isEqual } from "~/lib/utils";
import { safeSetItemSync } from "~/lib/system/local-storage-mutex";
import { api, type RouterInputs } from "~/trpc/react";
import { asJsonPayload } from "../lib/json-payload";
import { type BuilderState, getInitialState, sanitizeEconomicInputs } from "./builderStateTypes";

interface UseBuilderPersistenceProps {
  mode: "create" | "edit";
  countryId?: string;
  builderState: BuilderState;
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
  isLoadingCountry: boolean;
  editModeInitialized: React.MutableRefObject<boolean>;
  localHadDataRef: React.MutableRefObject<boolean>;
  hasRestoredState: boolean;
  setHasRestoredState: (val: boolean) => void;
  lastSaved: Date | null;
  setLastSaved: React.Dispatch<React.SetStateAction<Date | null>>;
}

export function useBuilderPersistence({
  mode,
  countryId,
  builderState,
  setBuilderState,
  isLoadingCountry,
  editModeInitialized,
  localHadDataRef,
  hasRestoredState,
  setHasRestoredState,
  lastSaved,
  setLastSaved,
}: UseBuilderPersistenceProps) {
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Autosave state to localStorage with ref to prevent infinite loops
  const builderStateRef = useRef(builderState);
  builderStateRef.current = builderState;
  const lastSavedStateRef = useRef<BuilderState | null>(null);

  const serverRestoreDoneRef = useRef(false);

  const hasBuilderProgress = (s: BuilderState): boolean =>
    !!s.selectedCountry ||
    !!s.selectedArchetypeId ||
    !!s.economicInputs?.countryName ||
    !!s.economicInputs?.nationalIdentity?.countryName ||
    (Array.isArray(s.completedSteps) && s.completedSteps.length > 0);

  useEffect(() => {
    const saveState = async () => {
      const currentState = builderStateRef.current;
      if (isEqual(lastSavedStateRef.current, currentState)) return;
      lastSavedStateRef.current = currentState;

      setIsAutoSaving(true);
      try {
        const stateKey =
          mode === "edit" && countryId ? `builder_state_${countryId}` : "builder_state";
        const savedKey =
          mode === "edit" && countryId ? `builder_last_saved_${countryId}` : "builder_last_saved";

        const stateSaved = safeSetItemSync(stateKey, JSON.stringify(currentState));
        const now = new Date();
        const timestampSaved = safeSetItemSync(savedKey, now.toISOString());

        if (stateSaved && timestampSaved) {
          setLastSaved(now);
        } else {
          try {
            sessionStorage.setItem(stateKey, JSON.stringify(currentState));
            sessionStorage.setItem(savedKey, now.toISOString());
          } catch (sessionError) {
            console.error(
              "[BuilderState] Both localStorage and sessionStorage failed:",
              sessionError
            );
          }
        }
      } catch (error) {
        console.error("[BuilderState] Failed to save state:", error);
      } finally {
        setIsAutoSaving(false);
      }
    };

    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [builderState, mode, countryId, setLastSaved]);

  // Autosave on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const stateKey =
          mode === "edit" && countryId ? `builder_state_${countryId}` : "builder_state";
        const savedKey =
          mode === "edit" && countryId ? `builder_last_saved_${countryId}` : "builder_last_saved";

        safeSetItemSync(stateKey, JSON.stringify(builderStateRef.current));
        safeSetItemSync(savedKey, new Date().toISOString());
      } catch {
        // Failed to save state on unload
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [mode, countryId]);

  // DB Sync for Edit Mode
  const updateMutation = api.countries.updateCountry.useMutation({
    onSuccess: () => {
      setLastSaved(new Date());
    },
    onError: (err) => {
      console.error("[useBuilderPersistence] DB sync error:", err);
    },
  });

  const syncError = updateMutation.error
    ? updateMutation.error instanceof Error
      ? updateMutation.error
      : new Error(String(updateMutation.error))
    : null;
  const isSyncing = updateMutation.isPending;

  const lastSyncedStateRef = useRef<Parameters<typeof updateMutation.mutateAsync>[0] | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !countryId || !editModeInitialized.current || isLoadingCountry) {
      return;
    }

    const currentSyncPayload = asJsonPayload<RouterInputs["countries"]["updateCountry"]>({
      id: countryId,
      name:
        builderState.economicInputs?.countryName ||
        builderState.economicInputs?.nationalIdentity?.countryName ||
        "",
      economicInputs: sanitizeEconomicInputs(builderState.economicInputs) || undefined,
      governmentComponents:
        builderState.governmentComponents && builderState.governmentComponents.length > 0
          ? builderState.governmentComponents.map((comp) => ({ componentType: comp }))
          : undefined,
      taxSystemData: builderState.taxSystemData || undefined,
      governmentStructure: builderState.governmentStructure || undefined,
      economyBuilderState: builderState.economyBuilderState || undefined,
    });

    if (!lastSyncedStateRef.current) {
      lastSyncedStateRef.current = currentSyncPayload;
      return;
    }

    if (isEqual(lastSyncedStateRef.current, currentSyncPayload)) {
      return;
    }

    const triggerDbSync = async () => {
      try {
        lastSyncedStateRef.current = currentSyncPayload;
        await updateMutation.mutateAsync(currentSyncPayload);
      } catch {
        // Handled by mutation onError
      }
    };

    const timer = setTimeout(triggerDbSync, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    builderState.economicInputs,
    builderState.governmentComponents,
    builderState.taxSystemData,
    builderState.governmentStructure,
    builderState.economyBuilderState,
    mode,
    countryId,
    isLoadingCountry,
  ]);

  // Server-side draft persistence (create mode)
  const serverDraftQuery = api.builderDraft.get.useQuery(undefined, {
    enabled: mode !== "edit",
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const saveDraftMutation = api.builderDraft.save.useMutation();
  const clearDraftMutation = api.builderDraft.clear.useMutation();

  useEffect(() => {
    if (mode === "edit") return;
    if (serverRestoreDoneRef.current) return;
    if (serverDraftQuery.isLoading) return;

    serverRestoreDoneRef.current = true;

    if (localHadDataRef.current || hasBuilderProgress(builderStateRef.current)) return;

    const remote = serverDraftQuery.data?.data as Partial<BuilderState> | undefined;
    if (!remote) return;

    const {
      step: _step,
      completedSteps: _completedSteps,
      selectedCountry: _selectedCountry,
      selectedArchetypeId: _selectedArchetypeId,
      ...dataFields
    } = remote;
    setBuilderState((prev) => ({
      ...prev,
      ...dataFields,
      economyBuilderState: remote.economyBuilderState ?? prev.economyBuilderState ?? null,
    }));
    if (hasBuilderProgress(remote as BuilderState)) {
      setHasRestoredState(true);
    }
    if (serverDraftQuery.data?.updatedAt) {
      setLastSaved(new Date(serverDraftQuery.data.updatedAt));
    }
  }, [
    serverDraftQuery.isLoading,
    serverDraftQuery.data,
    mode,
    localHadDataRef,
    setBuilderState,
    setHasRestoredState,
    setLastSaved,
  ]);

  useEffect(() => {
    if (mode === "edit") return;
    if (!serverRestoreDoneRef.current) return;
    if (!hasBuilderProgress(builderState)) return;

    const timer = setTimeout(() => {
      saveDraftMutation.mutate({
        data: asJsonPayload<RouterInputs["builderDraft"]["save"]["data"]>(builderStateRef.current),
      });
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builderState, mode]);

  const triggerManualSave = useCallback(async () => {
    const stateKey = mode === "edit" && countryId ? `builder_state_${countryId}` : "builder_state";
    const savedKey =
      mode === "edit" && countryId ? `builder_last_saved_${countryId}` : "builder_last_saved";

    try {
      safeSetItemSync(stateKey, JSON.stringify(builderStateRef.current));
      const now = new Date();
      safeSetItemSync(savedKey, now.toISOString());
      setLastSaved(now);
    } catch (error) {
      console.warn("Manual save: localStorage write failed:", error);
    }

    if (mode === "edit" && countryId && !isLoadingCountry) {
      const currentSyncPayload = asJsonPayload<RouterInputs["countries"]["updateCountry"]>({
        id: countryId,
        name:
          builderStateRef.current.economicInputs?.countryName ||
          builderStateRef.current.economicInputs?.nationalIdentity?.countryName ||
          "",
        economicInputs: sanitizeEconomicInputs(builderStateRef.current.economicInputs) || undefined,
        governmentComponents:
          builderStateRef.current.governmentComponents &&
          builderStateRef.current.governmentComponents.length > 0
            ? builderStateRef.current.governmentComponents.map((comp) => ({
                componentType: comp,
              }))
            : undefined,
        taxSystemData: builderStateRef.current.taxSystemData || undefined,
        governmentStructure: builderStateRef.current.governmentStructure || undefined,
        economyBuilderState: builderStateRef.current.economyBuilderState || undefined,
      });
      lastSyncedStateRef.current = currentSyncPayload;
      await updateMutation.mutateAsync(currentSyncPayload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, countryId, isLoadingCountry, setLastSaved]);

  const clearDraft = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        const stateKey =
          mode === "edit" && countryId ? `builder_state_${countryId}` : "builder_state";
        const savedKey =
          mode === "edit" && countryId ? `builder_last_saved_${countryId}` : "builder_last_saved";

        localStorage.removeItem(stateKey);
        localStorage.removeItem(savedKey);
        sessionStorage.removeItem(stateKey);
        sessionStorage.removeItem(savedKey);
      }
      if (mode !== "edit") {
        clearDraftMutation.mutate();
      }
      lastSavedStateRef.current = null;
      setLastSaved(null);
      setHasRestoredState(false);
      setBuilderState(getInitialState(mode));
    } catch {
      // Failed to clear draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, countryId, setLastSaved, setHasRestoredState, setBuilderState]);

  return {
    lastSaved,
    isAutoSaving,
    isSyncing,
    syncError,
    triggerManualSave,
    clearDraft,
    hasRestoredState,
  };
}
