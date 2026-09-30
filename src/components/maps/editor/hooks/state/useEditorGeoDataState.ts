"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { notifyFromStore } from "~/hooks/useNotify";
import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";
import type { TabId } from "~/components/maps/editor/EditorPanel";
import type {
  PropertiesPanelCountry,
  SovereigntyRelation,
  SovereigntyFormData,
} from "~/components/maps/editor/types/editor-state";

interface UseEditorGeoDataStateProps {
  isWorldMode: boolean;
  activeCountryId: string | null;
  setActiveCountryId: (id: string | null) => void;
  mapSelectedCountry: SelectedCountry | null;
  setMapSelectedCountry: (country: SelectedCountry | null) => void;
}

export function useEditorGeoDataState({
  isWorldMode,
  activeCountryId,
  setActiveCountryId,
  mapSelectedCountry,
  setMapSelectedCountry,
}: UseEditorGeoDataStateProps) {
  const utils = api.useUtils();
  // The realm being edited: its features, and its nations to link them to (ruling E-o)
  const realm = useMapRealm();

  // --- Sidebar Tabs State ---
  const [activeSidebarTab, setActiveSidebarTab] = useState<TabId>(
    isWorldMode ? "linkages" : "layers"
  );

  // --- Linkage / Assignment States ---
  const [featureSearch, setFeatureSearch] = useState("");
  const [featureFilter, setFeatureFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [assigningFeatureId, setAssigningFeatureId] = useState<string | null>(null);
  const [assignCountryId, setAssignCountryId] = useState("");
  const [unlinkedFeatureIdToAssign, setUnlinkedFeatureIdToAssign] = useState("");
  const [validationTab, setValidationTab] = useState<"issues" | "linked" | "unlinked" | "features">(
    "issues"
  );

  // --- Inline editable Feature properties ---
  const [editableFeatureName, setEditableFeatureName] = useState("");
  const [editableCountryLinkageId, setEditableCountryLinkageId] = useState("");

  // --- Editable Wiki Linkage & Custom Properties ---
  const [wikiPageTitle, setWikiPageTitle] = useState("");
  const [propertiesJsonString, setPropertiesJsonString] = useState("");
  const [isEditingJson, setIsEditingJson] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const parsedProperties = useMemo(() => {
    try {
      return propertiesJsonString ? JSON.parse(propertiesJsonString) : {};
    } catch (_e) {
      return {};
    }
  }, [propertiesJsonString]);

  // Load details for the selected feature
  const { data: featureDetails, refetch: refetchFeatureDetails } =
    api.geoEditor.getFeatureDetails.useQuery(
      { featureId: mapSelectedCountry?.featureId ?? "", realm },
      { enabled: !!mapSelectedCountry?.featureId }
    );

  const { data: featureList } = api.geoCore.listCountries.useQuery(
    { realm },
    { enabled: isWorldMode }
  );

  const recalculateAreaMutation = api.geoCore.recalculateArea.useMutation({
    onSuccess: () => {
      refetchFeatureDetails();
      notifyFromStore({ title: "Area recalculated", type: "success", priority: "low" });
    },
    onError: (err) => {
      notifyFromStore({
        title: "Area recalculation failed",
        message: err.message,
        type: "error",
        priority: "high",
      });
    },
  });

  const { data: dbCountries } = api.countries.getAll.useQuery(
    { limit: 500, realm },
    { enabled: isWorldMode, staleTime: 60_000 }
  );

  const { data: relations, isLoading: relationsLoading } =
    api.geoSovereignty.getSovereigntyRelations.useQuery(undefined, { enabled: isWorldMode });

  const { data: validationData, refetch: refetchValidation } =
    api.geoEditor.validateLinkage.useQuery(
      { realm },
      {
        enabled: isWorldMode,
        staleTime: 10_000,
        retry: false,
      }
    );

  const assignMutation = api.geoEditor.assignCountryGeometry.useMutation({
    onSuccess: () => {
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getMapStats.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      refetchValidation();
      setAssigningFeatureId(null);
      setAssignCountryId("");
    },
  });

  const unlinkMutation = api.geoEditor.unlinkCountryGeometry.useMutation({
    onSuccess: () => {
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getMapStats.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      refetchValidation();
      setMapSelectedCountry(null);
      setActiveCountryId(null);
    },
  });

  const syncMutation = api.geoEditor.repairLinkage.useMutation({
    onSuccess: () => {
      utils.geoEditor.validateLinkage.invalidate();
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      refetchValidation();
      notifyFromStore({ title: "Linkages synced", type: "success", priority: "low" });
    },
  });

  const autoMatchMutation = api.geoEditor.repairLinkage.useMutation({
    onSuccess: () => {
      utils.geoEditor.validateLinkage.invalidate();
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      refetchValidation();
      notifyFromStore({ title: "Auto-matching complete", type: "success", priority: "low" });
    },
  });

  // --- Sovereignty States ---
  const [sovereigntySearch, setSovereigntySearch] = useState("");
  const [sovereigntyTypeFilter, setSovereigntyTypeFilter] = useState("all");
  const [showSovereigntyForm, setShowSovereigntyForm] = useState(false);
  const [editingSovereigntyId, setEditingSovereigntyId] = useState<string | null>(null);
  const [sovereigntyForm, setSovereigntyForm] = useState<SovereigntyFormData>({
    sovereignId: "",
    subjectId: "",
    relationshipType: "crown_possession",
    autonomyLevel: 50,
    description: "",
    establishedDate: "",
  });

  const resetSovereigntyForm = () => {
    setShowSovereigntyForm(false);
    setEditingSovereigntyId(null);
    setSovereigntyForm({
      sovereignId: "",
      subjectId: "",
      relationshipType: "crown_possession",
      autonomyLevel: 50,
      description: "",
      establishedDate: "",
    });
  };

  const createSovereignty = api.geoSovereignty.createSovereignty.useMutation({
    onSuccess: () => {
      utils.geoSovereignty.getSovereigntyRelations.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      utils.geoCore.getMapStats.invalidate();
      resetSovereigntyForm();
    },
  });

  const updateSovereignty = api.geoSovereignty.updateSovereignty.useMutation({
    onSuccess: () => {
      utils.geoSovereignty.getSovereigntyRelations.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      resetSovereigntyForm();
    },
  });

  const deleteSovereignty = api.geoSovereignty.deleteSovereignty.useMutation({
    onSuccess: () => {
      utils.geoSovereignty.getSovereigntyRelations.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      utils.geoCore.getMapStats.invalidate();
    },
  });

  const updatePropertiesMutation = api.geoEditor.updateFeatureProperties.useMutation({
    onSuccess: () => {
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      utils.geoCore.getMapStats.invalidate();
      refetchValidation();
      notifyFromStore({ title: "Feature properties saved", type: "success", priority: "low" });
    },
    onError: (err) => {
      notifyFromStore({
        title: "Could not save feature properties",
        message: err.message,
        type: "error",
        priority: "high",
      });
    },
  });

  const createCountryFromShapeMutation = api.geoEditor.createCountryFromShape.useMutation({
    onSuccess: () => {
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      refetchValidation();
    },
    onError: (err) => {
      notifyFromStore({
        title: "Could not create country",
        message: err.message,
        type: "error",
        priority: "high",
      });
    },
  });

  const createCountryFromShapeAction = useCallback(
    (name: string) => {
      if (!mapSelectedCountry?.featureId) return;
      createCountryFromShapeMutation.mutate({
        featureId: mapSelectedCountry.featureId,
        name,
        realm,
      });
    },
    [mapSelectedCountry, createCountryFromShapeMutation, realm]
  );

  useEffect(() => {
    if (featureDetails) {
      setWikiPageTitle(featureDetails.wikiPageTitle ?? "");
      setPropertiesJsonString(JSON.stringify(featureDetails.properties ?? {}, null, 2));
      setIsEditingJson(false);
      setJsonError(null);
    } else {
      setWikiPageTitle("");
      setPropertiesJsonString("");
      setIsEditingJson(false);
      setJsonError(null);
    }
  }, [featureDetails]);

  useEffect(() => {
    if (mapSelectedCountry) {
      setEditableFeatureName(mapSelectedCountry.displayName || "");
      setEditableCountryLinkageId(mapSelectedCountry.countryId || "");
    } else {
      setEditableFeatureName("");
      setEditableCountryLinkageId("");
    }
  }, [mapSelectedCountry]);

  useEffect(() => {
    setAssigningFeatureId(null);
  }, [activeCountryId]);

  // --- Memoized Computations for World Mode ---
  const countries = useMemo<PropertiesPanelCountry[]>(() => {
    const list: PropertiesPanelCountry[] = Array.isArray(dbCountries)
      ? (dbCountries as PropertiesPanelCountry[])
      : ((dbCountries as { countries?: PropertiesPanelCountry[] })?.countries ?? []);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [dbCountries]);

  const availableCountries = useMemo(() => {
    if (!countries || !featureList) return [];
    const assignedCountryIds = new Set(
      featureList.filter((f) => f.countryId).map((f) => f.countryId)
    );
    return countries.filter((c) => !assignedCountryIds.has(c.id));
  }, [countries, featureList]);

  const filteredFeatures = useMemo(() => {
    if (!featureList) return [];
    return featureList.filter((f) => {
      if (featureFilter === "linked" && !f.isClaimed) return false;
      if (featureFilter === "unlinked" && f.isClaimed) return false;
      if (
        featureSearch &&
        !f.displayName.toLowerCase().includes(featureSearch.toLowerCase()) &&
        !f.featureId.toLowerCase().includes(featureSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [featureList, featureFilter, featureSearch]);

  const filteredRelations = useMemo(() => {
    if (!relations) return [];
    return relations.filter((r) => {
      if (sovereigntyTypeFilter !== "all" && r.relationshipType !== sovereigntyTypeFilter)
        return false;
      if (
        sovereigntySearch &&
        !r.sovereignName.toLowerCase().includes(sovereigntySearch.toLowerCase()) &&
        !r.subjectName.toLowerCase().includes(sovereigntySearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [relations, sovereigntyTypeFilter, sovereigntySearch]);

  const selectedCountryName = useMemo(() => {
    if (mapSelectedCountry?.displayName) return mapSelectedCountry.displayName;
    if (activeCountryId) {
      return countries.find((c) => c.id === activeCountryId)?.name ?? "";
    }
    return "";
  }, [mapSelectedCountry, activeCountryId, countries]);

  const countryRelations = useMemo(() => {
    if (!relations || !activeCountryId) return [];
    return relations.filter(
      (r) => r.sovereignId === activeCountryId || r.subjectId === activeCountryId
    );
  }, [relations, activeCountryId]);

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

  const handleCreateSovereignty = () => {
    if (!sovereigntyForm.sovereignId || !sovereigntyForm.subjectId) return;
    createSovereignty.mutate({
      sovereignId: sovereigntyForm.sovereignId,
      subjectId: sovereigntyForm.subjectId,
      relationshipType: sovereigntyForm.relationshipType,
      autonomyLevel: sovereigntyForm.autonomyLevel / 100,
      description: sovereigntyForm.description || undefined,
      establishedDate: sovereigntyForm.establishedDate || undefined,
    });
  };

  const handleUpdateSovereignty = () => {
    if (!editingSovereigntyId) return;
    updateSovereignty.mutate({
      id: editingSovereigntyId,
      relationshipType: sovereigntyForm.relationshipType,
      autonomyLevel: sovereigntyForm.autonomyLevel / 100,
      description: sovereigntyForm.description || undefined,
      establishedDate: sovereigntyForm.establishedDate || undefined,
    });
  };

  const handleDeleteSovereignty = async (id: string) => {
    const ok = await confirmEditorAction({
      title: "Delete this sovereignty relationship?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) deleteSovereignty.mutate({ id });
  };

  const handleEditSovereignty = (rel: SovereigntyRelation) => {
    setEditingSovereigntyId(rel.id);
    setSovereigntyForm({
      sovereignId: rel.sovereignId,
      subjectId: rel.subjectId,
      relationshipType: rel.relationshipType,
      autonomyLevel: Math.round(rel.autonomyLevel * 100),
      description: rel.description || "",
      establishedDate: rel.establishedDate ? rel.establishedDate.split("T")[0] : "",
    });
    setShowSovereigntyForm(true);
  };

  const handleSaveFeatureProperties = () => {
    if (!mapSelectedCountry?.featureId) return;
    updatePropertiesMutation.mutate(
      {
        featureId: mapSelectedCountry.featureId,
        displayName: editableFeatureName || undefined,
        countryId: editableCountryLinkageId || null,
        properties: parsedProperties,
        wikiPageTitle: wikiPageTitle || null,
        realm,
      },
      {
        onSuccess: () => {
          refetchFeatureDetails();
          setIsEditingJson(false);
        },
      }
    );
  };

  return {
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
    editableFeatureName,
    setEditableFeatureName,
    editableCountryLinkageId,
    setEditableCountryLinkageId,
    wikiPageTitle,
    setWikiPageTitle,
    propertiesJsonString,
    setPropertiesJsonString,
    isEditingJson,
    setIsEditingJson,
    jsonError,
    setJsonError,
    parsedProperties,
    featureDetails,
    refetchFeatureDetails,
    featureList,
    recalculateAreaMutation,
    dbCountries,
    relations,
    relationsLoading,
    validationData,
    refetchValidation,
    assignMutation,
    unlinkMutation,
    syncMutation,
    autoMatchMutation,
    createSovereignty,
    updateSovereignty,
    deleteSovereignty,
    updatePropertiesMutation,
    sovereigntySearch,
    setSovereigntySearch,
    sovereigntyTypeFilter,
    setSovereigntyTypeFilter,
    showSovereigntyForm,
    setShowSovereigntyForm,
    editingSovereigntyId,
    setEditingSovereigntyId,
    sovereigntyForm,
    setSovereigntyForm,
    countries,
    availableCountries,
    filteredFeatures,
    filteredRelations,
    selectedCountryName,
    countryRelations,
    handleAssignLink,
    handleUnlink,
    resetSovereigntyForm,
    handleCreateSovereignty,
    handleUpdateSovereignty,
    handleDeleteSovereignty,
    handleEditSovereignty,
    createCountryFromShapeAction,
    createCountryFromShapeMutation,
    handleSaveFeatureProperties,
  };
}
