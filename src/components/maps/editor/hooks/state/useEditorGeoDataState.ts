"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
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
      { featureId: mapSelectedCountry?.featureId ?? "" },
      { enabled: !!mapSelectedCountry?.featureId }
    );

  const { data: featureList } = api.geoCore.listCountries.useQuery(undefined, {
    enabled: isWorldMode,
  });

  const recalculateAreaMutation = api.geoCore.recalculateArea.useMutation({
    onSuccess: () => {
      refetchFeatureDetails();
      alert("Area successfully recalculated!");
    },
    onError: (err) => {
      alert(`Failed to recalculate area: ${err.message}`);
    },
  });

  const { data: dbCountries } = api.countries.getAll.useQuery(
    { limit: 500 },
    { enabled: isWorldMode, staleTime: 60_000 }
  );

  const { data: relations, isLoading: relationsLoading } =
    api.geoSovereignty.getSovereigntyRelations.useQuery(undefined, { enabled: isWorldMode });

  const { data: validationData, refetch: refetchValidation } =
    api.geoEditor.validateLinkage.useQuery(undefined, {
      enabled: isWorldMode,
      staleTime: 10_000,
      retry: false,
    });

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
      alert("Linkages synced successfully!");
    },
  });

  const autoMatchMutation = api.geoEditor.repairLinkage.useMutation({
    onSuccess: () => {
      utils.geoEditor.validateLinkage.invalidate();
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      refetchValidation();
      alert("Auto-matching complete!");
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
      alert("Feature properties updated successfully!");
    },
    onError: (err) => {
      alert(`Failed to save feature properties: ${err.message}`);
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
      alert(`Failed to create country: ${err.message}`);
    },
  });

  const createCountryFromShapeAction = useCallback(
    (name: string) => {
      if (!mapSelectedCountry?.featureId) return;
      createCountryFromShapeMutation.mutate({
        featureId: mapSelectedCountry.featureId,
        name,
      });
    },
    [mapSelectedCountry, createCountryFromShapeMutation]
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
    assignMutation.mutate({ featureId, countryId: assignCountryId });
  };

  const handleUnlink = (featureId: string) => {
    if (confirm(`Unlink this feature (${featureId}) from its country?`)) {
      unlinkMutation.mutate({ featureId });
    }
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

  const handleDeleteSovereignty = (id: string) => {
    if (confirm("Are you sure you want to delete this sovereignty relationship?")) {
      deleteSovereignty.mutate({ id });
    }
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
