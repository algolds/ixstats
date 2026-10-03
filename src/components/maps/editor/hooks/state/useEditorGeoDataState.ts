"use client";

import { useState, useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { notifyFromStore } from "~/hooks/useNotify";
import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";
import type { TabId } from "~/components/maps/editor/EditorPanel";
import type { PropertiesPanelCountry } from "~/components/maps/editor/types/editor-state";
import { invalidateMapViews, notifySuccess } from "./geo-invalidation";
import { useEditorFeatureProperties } from "./useEditorFeatureProperties";
import { useEditorSovereigntyState } from "./useEditorSovereigntyState";

interface UseEditorGeoDataStateProps {
  isWorldMode: boolean;
  activeCountryId: string | null;
  setActiveCountryId: (id: string | null) => void;
  mapSelectedCountry: SelectedCountry | null;
  setMapSelectedCountry: (country: SelectedCountry | null) => void;
}

const includesText = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

export function useEditorGeoDataState({
  isWorldMode,
  activeCountryId,
  setActiveCountryId,
  mapSelectedCountry,
  setMapSelectedCountry,
}: UseEditorGeoDataStateProps) {
  const utils = api.useUtils();
  // The realm being edited: its features, and its nations to link them to.
  const realm = useMapRealm();

  const [activeSidebarTab, setActiveSidebarTab] = useState<TabId>(
    isWorldMode ? "linkages" : "layers"
  );

  // Linkage / assignment
  const [featureSearch, setFeatureSearch] = useState("");
  const [featureFilter, setFeatureFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [assigningFeatureId, setAssigningFeatureId] = useState<string | null>(null);
  const [assignCountryId, setAssignCountryId] = useState("");
  const [unlinkedFeatureIdToAssign, setUnlinkedFeatureIdToAssign] = useState("");
  const [validationTab, setValidationTab] = useState<"issues" | "linked" | "unlinked" | "features">(
    "issues"
  );

  const { data: featureList } = api.geoCore.listCountries.useQuery(
    { realm },
    { enabled: isWorldMode }
  );

  const { data: dbCountries } = api.countries.getAll.useQuery(
    { limit: 500, realm },
    { enabled: isWorldMode, staleTime: 60_000 }
  );

  const { data: validationData, refetch: refetchValidation } =
    api.geoEditor.validateLinkage.useQuery(
      { realm },
      {
        enabled: isWorldMode,
        staleTime: 10_000,
        retry: false,
      }
    );

  const featureProps = useEditorFeatureProperties({ mapSelectedCountry, realm, refetchValidation });
  const sovereignty = useEditorSovereigntyState({ isWorldMode, activeCountryId });

  const assignMutation = api.geoEditor.assignCountryGeometry.useMutation({
    onSuccess: () => {
      invalidateMapViews(utils, { list: true, stats: true });
      refetchValidation();
      setAssigningFeatureId(null);
      setAssignCountryId("");
    },
  });

  const unlinkMutation = api.geoEditor.unlinkCountryGeometry.useMutation({
    onSuccess: () => {
      invalidateMapViews(utils, { list: true, stats: true });
      refetchValidation();
      setMapSelectedCountry(null);
      setActiveCountryId(null);
    },
  });

  const repairLinkageOptions = (title: string) => ({
    onSuccess: () => {
      utils.geoEditor.validateLinkage.invalidate();
      invalidateMapViews(utils, { list: true });
      refetchValidation();
      notifyFromStore(notifySuccess(title));
    },
  });
  const syncMutation = api.geoEditor.repairLinkage.useMutation(
    repairLinkageOptions("Linkages synced")
  );
  const autoMatchMutation = api.geoEditor.repairLinkage.useMutation(
    repairLinkageOptions("Auto-matching complete")
  );

  useEffect(() => {
    setAssigningFeatureId(null);
  }, [activeCountryId]);

  const countries = useMemo<PropertiesPanelCountry[]>(() => {
    const list: PropertiesPanelCountry[] = Array.isArray(dbCountries)
      ? (dbCountries as PropertiesPanelCountry[])
      : ((dbCountries as { countries?: PropertiesPanelCountry[] })?.countries ?? []);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [dbCountries]);

  const availableCountries = useMemo(() => {
    if (!featureList) return [];
    const assignedCountryIds = new Set(
      featureList.filter((f) => f.countryId).map((f) => f.countryId)
    );
    return countries.filter((c) => !assignedCountryIds.has(c.id));
  }, [countries, featureList]);

  const filteredFeatures = useMemo(
    () =>
      (featureList ?? []).filter(
        (f) =>
          (featureFilter !== "linked" || f.isClaimed) &&
          (featureFilter !== "unlinked" || !f.isClaimed) &&
          (!featureSearch ||
            includesText(f.displayName, featureSearch) ||
            includesText(f.featureId, featureSearch))
      ),
    [featureList, featureFilter, featureSearch]
  );

  const selectedCountryName =
    mapSelectedCountry?.displayName ||
    (activeCountryId ? (countries.find((c) => c.id === activeCountryId)?.name ?? "") : "");

  const handleAssignLink = (featureId: string) => {
    if (!assignCountryId) return;
    assignMutation.mutate({ featureId, countryId: assignCountryId, realm });
  };

  const handleUnlink = async (featureId: string) => {
    const ok = await confirmEditorAction({
      title: "Unlink this shape from its country?",
      description: `The map shape ${featureId} will no longer belong to any country until it is linked again.`,
      confirmLabel: "Unlink",
      destructive: true,
    });
    if (ok) unlinkMutation.mutate({ featureId, realm });
  };

  return {
    ...featureProps,
    ...sovereignty,
    activeSidebarTab,
    setActiveSidebarTab,
    featureSearch,
    setFeatureSearch,
    featureFilter,
    setFeatureFilter,
    assigningFeatureId,
    setAssigningFeatureId,
    assignCountryId,
    setAssignCountryId,
    unlinkedFeatureIdToAssign,
    setUnlinkedFeatureIdToAssign,
    validationTab,
    setValidationTab,
    featureList,
    dbCountries,
    validationData,
    refetchValidation,
    assignMutation,
    unlinkMutation,
    syncMutation,
    autoMatchMutation,
    countries,
    availableCountries,
    filteredFeatures,
    selectedCountryName,
    handleAssignLink,
    handleUnlink,
  };
}
