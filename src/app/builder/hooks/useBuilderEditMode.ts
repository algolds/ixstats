import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import type { CountryWithEditorFields } from "~/types/country-editor";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { ComponentType } from "~/lib/enums";
import type { BuilderState } from "./builderStateTypes";
import {
  hydrateEconomicInputs,
  hydrateEconomyBuilderState,
  hydrateGovernmentStructure,
  type EditorRelationsData,
} from "../lib/edit-hydration";
import {
  mergeRecoveredDraft,
  readStoredDraft,
  removeStoredDraft,
  type RecoveredDraft,
} from "../lib/recovered-draft";

interface UseBuilderEditModeProps {
  mode: "create" | "edit";
  countryId?: string;
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
  setHasRestoredState: (restored: boolean) => void;
  setLastSaved: (date: Date | null) => void;
}

export function useBuilderEditMode({
  mode,
  countryId,
  setBuilderState,
  setHasRestoredState,
  setLastSaved,
}: UseBuilderEditModeProps) {
  const editModeInitialized = useRef(false);
  const editRestoreDone = useRef(false);
  const isEditing = mode === "edit" && !!countryId && countryId.trim() !== "";

  // The editor always loads the country fresh (refetchOnMount "always", and hydration waits
  // for that fetch): a cached copy from before the last save would otherwise become the
  // editor's starting point. Once loaded, the data is not refetched underneath the edits.
  const editorQueryOptions = {
    enabled: isEditing,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  } as const;

  const countryQuery = api.countries.getByIdAtTime.useQuery(
    { id: countryId || "" },
    { ...editorQueryOptions, retry: false, gcTime: 30 * 60 * 1000 }
  );
  const governmentQuery = api.government.getByCountryId.useQuery(
    { countryId: countryId || "" },
    editorQueryOptions
  );
  const taxSystemQuery = api.taxSystem.getByCountryId.useQuery(
    { countryId: countryId || "" },
    editorQueryOptions
  );
  const relationsQuery = api.countries.getEditorRelations.useQuery(
    { countryId: countryId || "" },
    editorQueryOptions
  );

  const existingCountry = countryQuery.data;
  const existingGovernment = governmentQuery.data;
  const existingTaxSystem = taxSystemQuery.data;
  const editorRelations = relationsQuery.data;

  const editorQueries = [countryQuery, governmentQuery, taxSystemQuery, relationsQuery];
  const isLoadingCountry =
    isEditing &&
    editorQueries.some(
      (query) =>
        (!query.isFetchedAfterMount && !query.isError) || (query.isError && query.isFetching)
    );

  // A missing government, tax system or relation record hydrates defaults, but a failed load
  // must stop the editor: autosave would otherwise write those defaults over the real data.
  const failedQuery = editorQueries.find((query) => query.isError);
  const countryLoadError =
    isEditing && !isLoadingCountry && (failedQuery || !existingCountry)
      ? (failedQuery?.error?.message ?? "The country could not be loaded.")
      : null;
  const refetchers = editorQueries.map((query) => query.refetch);
  const refetchersRef = useRef(refetchers);
  refetchersRef.current = refetchers;
  const retryCountryLoad = useCallback(() => {
    for (const refetch of refetchersRef.current) void refetch();
  }, []);

  // The local copy of an earlier visit, read before this visit's autosave can replace it.
  const [storedDraft] = useState<RecoveredDraft | null>(() =>
    isEditing && countryId ? readStoredDraft(countryId) : null
  );
  const [recoveredDraft, setRecoveredDraft] = useState<RecoveredDraft | null>(null);

  // Initialize edit mode with existing data
  useEffect(() => {
    if (
      mode === "edit" &&
      existingCountry &&
      !editModeInitialized.current &&
      !isLoadingCountry &&
      !countryLoadError
    ) {
      editModeInitialized.current = true;

      const country = existingCountry as CountryWithEditorFields;
      const rel = editorRelations as EditorRelationsData | undefined;
      const inputs = hydrateEconomicInputs(country, rel);
      const economyBuilderState = hydrateEconomyBuilderState(inputs, rel);
      const governmentStructure = hydrateGovernmentStructure(
        country,
        existingGovernment,
        inputs.coreIndicators.nominalGDP
      );
      const taxSystemData = (existingTaxSystem as TaxBuilderState | null | undefined) ?? null;

      setBuilderState((prev) => ({
        step: "core",
        selectedCountry: null,
        selectedArchetypeId: null,
        economicInputs: inputs,
        governmentComponents: (rel?.governmentComponents ?? []).map(
          (c) => c.componentType as ComponentType
        ),
        taxSystemData,
        governmentStructure,
        completedSteps: ["foundation"],
        activeCoreTab: "identity",
        activeIdentitySubTab: "basic",
        activeGovernmentTab: "components",
        activeEconomicsTab: "components",
        showAdvancedMode: prev.showAdvancedMode,
        economyBuilderState,
      }));
    }
  }, [
    mode,
    existingCountry,
    existingGovernment,
    existingTaxSystem,
    editorRelations,
    isLoadingCountry,
    countryLoadError,
    setBuilderState,
  ]);

  // After the country loads: offer the local copy of an earlier visit when it is newer than
  // the saved country (the editor shell hides the offer when the copy changes nothing).
  useEffect(() => {
    if (
      mode !== "edit" ||
      !countryId ||
      !editModeInitialized.current ||
      isLoadingCountry ||
      editRestoreDone.current
    ) {
      return;
    }
    editRestoreDone.current = true;
    if (!storedDraft) return;

    const updatedAt = (existingCountry as { updatedAt?: string | Date } | undefined)?.updatedAt;
    const dbUpdatedAt = updatedAt ? new Date(updatedAt).getTime() : 0;
    if (storedDraft.savedAt.getTime() <= dbUpdatedAt) {
      removeStoredDraft(countryId);
      return;
    }
    setRecoveredDraft(storedDraft);
  }, [mode, countryId, existingCountry, isLoadingCountry, storedDraft]);

  const applyRecoveredDraft = useCallback(() => {
    if (!recoveredDraft) return;
    setBuilderState((prev) => mergeRecoveredDraft(prev, recoveredDraft.state));
    setHasRestoredState(true);
    setLastSaved(recoveredDraft.savedAt);
    setRecoveredDraft(null);
  }, [recoveredDraft, setBuilderState, setHasRestoredState, setLastSaved]);

  const dismissRecoveredDraft = useCallback(() => {
    setRecoveredDraft(null);
  }, []);

  return {
    isLoadingCountry,
    countryLoadError,
    retryCountryLoad,
    recoveredDraft,
    applyRecoveredDraft,
    dismissRecoveredDraft,
    existingCountry,
    existingGovernment,
    existingTaxSystem,
    editorRelations,
    editModeInitialized,
  };
}
