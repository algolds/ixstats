import { useState, useCallback, useEffect, useRef } from "react";
import { isEqual } from "~/lib/utils";
import { safeSetItemSync } from "~/lib/system/local-storage-mutex";
import { api, type RouterInputs } from "~/trpc/react";
import { asJsonPayload } from "../lib/json-payload";
import { type BuilderState, getInitialState, sanitizeEconomicInputs } from "./builderStateTypes";
import { useInvalidateCountryData } from "./useInvalidateCountryData";

type UpdatePayload = RouterInputs["countries"]["updateCountry"];

/** After the country loads, derived fields settle for this long before edits are autosaved. */
const EDIT_SETTLE_MS = 600;

/** The countries.updateCountry payload for the editor's current state. */
function buildUpdatePayload(countryId: string, state: BuilderState): UpdatePayload {
  return asJsonPayload<UpdatePayload>({
    id: countryId,
    name:
      state.economicInputs?.countryName ||
      state.economicInputs?.nationalIdentity?.countryName ||
      "",
    economicInputs: sanitizeEconomicInputs(state.economicInputs) || undefined,
    governmentComponents:
      state.governmentComponents && state.governmentComponents.length > 0
        ? state.governmentComponents.map((comp) => ({ componentType: comp }))
        : undefined,
    taxSystemData: state.taxSystemData || undefined,
    governmentStructure: state.governmentStructure || undefined,
    economyBuilderState: state.economyBuilderState || undefined,
  });
}

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
  /**
   * Edit mode: hold the local crash-recovery copy while an unsaved draft from an
   * earlier visit is waiting for the player to restore or dismiss it.
   */
  suspendLocalAutosave?: boolean;
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
  suspendLocalAutosave = false,
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

  // Edit mode keeps a local copy only of the loaded country: before hydration the state is
  // empty, and writing it would overwrite the unsaved draft of an earlier visit.
  const isLocalCopyHeld = () =>
    mode === "edit" && (!editModeInitialized.current || isLoadingCountry || suspendLocalAutosave);

  useEffect(() => {
    if (isLocalCopyHeld()) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builderState, mode, countryId, setLastSaved, isLoadingCountry, suspendLocalAutosave]);

  // Autosave on page unload
  const isLocalCopyHeldRef = useRef(isLocalCopyHeld);
  isLocalCopyHeldRef.current = isLocalCopyHeld;
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isLocalCopyHeldRef.current()) return;
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
  const invalidateCountryData = useInvalidateCountryData();
  const updateMutation = api.countries.updateCountry.useMutation({
    onSuccess: () => {
      setLastSaved(new Date());
      invalidateCountryData();
    },
    onError: (err) => {
      console.error("[useBuilderPersistence] DB sync error:", err);
    },
  });
  const { mutateAsync: updateCountryAsync } = updateMutation;

  const syncError = updateMutation.error
    ? updateMutation.error instanceof Error
      ? updateMutation.error
      : new Error(String(updateMutation.error))
    : null;
  const isSyncing = updateMutation.isPending;

  /** Last payload sent (or in flight); an unchanged state is not resent. */
  const lastSyncedStateRef = useRef<UpdatePayload | null>(null);
  /** Last payload the server accepted. */
  const lastSuccessfulPayloadRef = useRef<UpdatePayload | null>(null);
  /** Payload of the current state. */
  const latestPayloadRef = useRef<UpdatePayload | null>(null);
  const hydratedAtRef = useRef(0);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const syncPayload = useCallback(
    async (payload: UpdatePayload) => {
      lastSyncedStateRef.current = payload;
      try {
        await updateCountryAsync(payload);
      } catch (error) {
        // Resend on the next change or retry instead of treating the failed state as saved.
        lastSyncedStateRef.current = lastSuccessfulPayloadRef.current;
        throw error;
      }
      lastSuccessfulPayloadRef.current = payload;
      setLastSyncedAt(new Date());
      if (isEqual(latestPayloadRef.current, payload)) setHasUnsyncedChanges(false);
    },
    [updateCountryAsync]
  );

  useEffect(() => {
    if (mode !== "edit" || !countryId || !editModeInitialized.current || isLoadingCountry) {
      return;
    }

    const currentSyncPayload = buildUpdatePayload(countryId, builderState);
    latestPayloadRef.current = currentSyncPayload;

    // The loaded country is the saved state, including what the builder derives from it while
    // it settles (the same window the editor's change tracking waits): opening the editor
    // must not write to the country.
    const now = Date.now();
    if (!lastSyncedStateRef.current) hydratedAtRef.current = now;
    if (!lastSyncedStateRef.current || now - hydratedAtRef.current < EDIT_SETTLE_MS) {
      lastSyncedStateRef.current = currentSyncPayload;
      lastSuccessfulPayloadRef.current = currentSyncPayload;
      return;
    }

    if (isEqual(lastSyncedStateRef.current, currentSyncPayload)) {
      if (isEqual(lastSuccessfulPayloadRef.current, currentSyncPayload))
        setHasUnsyncedChanges(false);
      return;
    }

    setHasUnsyncedChanges(true);
    const timer = setTimeout(() => {
      // A manual save may have sent this state already.
      if (isEqual(lastSyncedStateRef.current, currentSyncPayload)) return;
      syncPayload(currentSyncPayload).catch(() => {
        // Surfaced through syncError; the editor's save bar offers a retry.
      });
    }, 1500);
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
    syncPayload,
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
      const currentSyncPayload = buildUpdatePayload(countryId, builderStateRef.current);
      latestPayloadRef.current = currentSyncPayload;
      await syncPayload(currentSyncPayload);
    }
  }, [mode, countryId, isLoadingCountry, setLastSaved, syncPayload]);

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
    hasUnsyncedChanges,
    lastSyncedAt,
    triggerManualSave,
    clearDraft,
    hasRestoredState,
  };
}
