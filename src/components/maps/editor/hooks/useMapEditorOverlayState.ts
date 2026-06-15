// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { useBorderEditor } from "~/hooks/useBorderEditor";
import { useWikiScanner } from "~/hooks/useWikiScanner";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { TabId } from "~/components/maps/editor/EditorPanel";

interface UseMapEditorOverlayStateProps {
  countryId?: string;
  onExit: () => void;
  isWorldMode?: boolean;
  mapRef: React.RefObject<EditorMapRef>;
}

export function useMapEditorOverlayState({
  countryId,
  onExit,
  isWorldMode = false,
  mapRef,
}: UseMapEditorOverlayStateProps) {
  // Real-time sync: invalidate map caches when any geo mutation succeeds
  useMapLiveSync();

  const [activeCountryId, setActiveCountryId] = useState<string | null>(countryId || null);
  const [activeEditorMode, setActiveEditorMode] = useState<"view" | "forge" | "border_edit">(
    isWorldMode ? "view" : "forge"
  );
  const [mapSelectedCountry, setMapSelectedCountry] = useState<SelectedCountry | null>(null);

  // --- Map Editor & Border Editor Hooks ---
  const [borderState, borderActions] = useBorderEditor();
  const editor = useMapEditor(
    !isWorldMode || (activeEditorMode === "forge" && activeCountryId)
      ? activeCountryId || undefined
      : undefined,
    { skipLinkageGate: isWorldMode }
  );
  const importer = useProvinceImporter(
    !isWorldMode || (activeEditorMode === "forge" && activeCountryId)
      ? activeCountryId || undefined
      : "__none__"
  );

  const { data: neighborGeoms } = api.geoCore.getNeighborGeometries.useQuery(
    { featureId: borderState.featureId! },
    { enabled: !!borderState.featureId }
  );

  // ── Derived State & Tools ──
  const isLinked = !!editor.linkage?.isLinked;
  const linkageLoading = editor.linkageLoading;
  const hasGeometry = !!editor.countryGeo;
  const toolsDisabled = !isLinked || !hasGeometry;

  const disabledTools = useMemo(() => {
    if (!isWorldMode) return [];
    if (!activeCountryId) {
      return [
        "add-city",
        "add-subdivision",
        "add-poi",
        "add-route",
        "add-story-pin",
        "add-label",
        "import-provinces",
        "paint",
      ];
    }
    if (!hasGeometry) {
      return ["add-city", "add-poi", "add-route", "add-story-pin", "add-label", "paint"];
    }
    return [];
  }, [isWorldMode, activeCountryId, hasGeometry]);

  // --- Sidebar Tabs State ---
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "linkages" | "sovereignty" | "layers" | "features" | "wiki"
  >(isWorldMode ? "linkages" : "layers");

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

  // Admin detection for Forge Mode access
  const { user: authUser } = useUser();
  const isAdmin =
    !!authUser &&
    (isSystemOwner(authUser.id) ||
      (typeof authUser.publicMetadata?.role === "string" &&
        ["admin", "owner", "staff"].includes(authUser.publicMetadata.role)));

  // Admin mutations (only used in forge mode)
  const generateTransport = api.transport.generateRoutes.useMutation();
  const recalculateGeo = api.geoCore.recalculateGeoProfiles.useMutation();

  const utils = api.useUtils();

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
      refetchValidation();
      alert("Linkages synced successfully!");
    },
  });

  const autoMatchMutation = api.geoEditor.repairLinkage.useMutation({
    onSuccess: () => {
      utils.geoEditor.validateLinkage.invalidate();
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      refetchValidation();
      alert("Auto-matching complete!");
    },
  });

  const createSovereignty = api.geoSovereignty.createSovereignty.useMutation({
    onSuccess: () => {
      utils.geoSovereignty.getSovereigntyRelations.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapStats.invalidate();
      resetSovereigntyForm();
    },
  });

  const updateSovereignty = api.geoSovereignty.updateSovereignty.useMutation({
    onSuccess: () => {
      utils.geoSovereignty.getSovereigntyRelations.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      resetSovereigntyForm();
    },
  });

  const deleteSovereignty = api.geoSovereignty.deleteSovereignty.useMutation({
    onSuccess: () => {
      utils.geoSovereignty.getSovereigntyRelations.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapStats.invalidate();
    },
  });

  const updatePropertiesMutation = api.geoEditor.updateFeatureProperties.useMutation({
    onSuccess: () => {
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      refetchValidation();
      alert("Feature properties updated successfully!");
    },
    onError: (err) => {
      alert(`Failed to save feature properties: ${err.message}`);
    },
  });

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

  // Sync edits when country is selected
  useEffect(() => {
    if (mapSelectedCountry) {
      setEditableFeatureName(mapSelectedCountry.displayName || "");
      setEditableCountryLinkageId(mapSelectedCountry.countryId || "");
    } else {
      setEditableFeatureName("");
      setEditableCountryLinkageId("");
    }
  }, [mapSelectedCountry]);

  // Reset assigningFeatureId on country change
  useEffect(() => {
    setAssigningFeatureId(null);
  }, [activeCountryId]);

  // Auto-select map feature when activeCountryId changes
  useEffect(() => {
    if (!isWorldMode || !activeCountryId || mapSelectedCountry) return;
    if (!featureList) return;

    const linkedFeature = featureList.find((f) => f.countryId === activeCountryId);
    if (linkedFeature) {
      setMapSelectedCountry(linkedFeature);
      if (mapRef.current && (linkedFeature.centroidLng || linkedFeature.centroidLat)) {
        mapRef.current.flyTo(linkedFeature.centroidLng, linkedFeature.centroidLat, 5);
      }
    }
  }, [isWorldMode, activeCountryId, mapSelectedCountry, featureList, mapRef]);

  // Exit confirmation state & change detection
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const hasUnsavedChanges = useMemo(() => {
    if (borderState.isDirty) return true;
    if (importer.step !== "upload") return true;
    if (editor.mode !== "view") return true;

    if (mapSelectedCountry) {
      const dbFeatureName = mapSelectedCountry.displayName || "";
      const dbCountryId = mapSelectedCountry.countryId || "";
      const dbWikiTitle = featureDetails?.wikiPageTitle || "";
      const dbPropsJson = featureDetails?.properties
        ? JSON.stringify(featureDetails.properties, null, 2)
        : "";

      if (editableFeatureName !== dbFeatureName) return true;
      if (editableCountryLinkageId !== dbCountryId) return true;
      if (wikiPageTitle !== dbWikiTitle) return true;
      if (propertiesJsonString && propertiesJsonString !== dbPropsJson) return true;
    }
    return false;
  }, [
    borderState.isDirty,
    importer.step,
    editor.mode,
    mapSelectedCountry,
    featureDetails,
    editableFeatureName,
    editableCountryLinkageId,
    wikiPageTitle,
    propertiesJsonString,
  ]);

  const handleRequestExit = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onExit();
    }
  }, [hasUnsavedChanges, onExit]);

  // --- Sovereignty States ---
  const [sovereigntySearch, setSovereigntySearch] = useState("");
  const [sovereigntyTypeFilter, setSovereigntyTypeFilter] = useState("all");
  const [showSovereigntyForm, setShowSovereigntyForm] = useState(false);
  const [editingSovereigntyId, setEditingSovereigntyId] = useState<string | null>(null);
  const [sovereigntyForm, setSovereigntyForm] = useState({
    sovereignId: "",
    subjectId: "",
    relationshipType: "crown_possession",
    autonomyLevel: 50,
    description: "",
    establishedDate: "",
  });

  // --- Border Editor States ---
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [saveReason, setSaveReason] = useState("");

  // --- Flexible Panel States ---
  const [panelConfigs, setPanelConfigs] = useState<{
    panelA: { placement: "left" | "right" | "bottom"; tabs: TabId[]; collapsed: boolean };
    panelB: { placement: "left" | "right" | "bottom"; tabs: TabId[]; collapsed: boolean };
  }>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ixworld-editor-panels-config-v3");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.panelA && parsed.panelB) {
            return parsed;
          }
        } catch (_) {}
      }
    }
    return {
      panelA: {
        placement: "left",
        tabs: isWorldMode ? ["linkages", "sovereignty", "layers"] : ["layers"],
        collapsed: false,
      },
      panelB: {
        placement: "right",
        tabs: ["properties"],
        collapsed: false,
      },
    };
  });

  // Save config to local storage on change
  useEffect(() => {
    localStorage.setItem("ixworld-editor-panels-config-v3", JSON.stringify(panelConfigs));
  }, [panelConfigs]);

  // Sync tab requirements on mode shift
  useEffect(() => {
    setPanelConfigs((prev) => {
      let changed = false;
      const next = {
        panelA: { ...prev.panelA, tabs: [...prev.panelA.tabs] },
        panelB: { ...prev.panelB, tabs: [...prev.panelB.tabs] },
      };

      if (isWorldMode) {
        const oldLenA = next.panelA.tabs.length;
        const oldLenB = next.panelB.tabs.length;
        next.panelA.tabs = next.panelA.tabs.filter((t) => t !== "features");
        next.panelB.tabs = next.panelB.tabs.filter((t) => t !== "features");
        if (next.panelA.tabs.length !== oldLenA || next.panelB.tabs.length !== oldLenB) {
          changed = true;
        }

        if (!next.panelA.tabs.includes("layers") && !next.panelB.tabs.includes("layers")) {
          next.panelA.tabs.push("layers");
          changed = true;
        }
        if (!next.panelA.tabs.includes("linkages") && !next.panelB.tabs.includes("linkages")) {
          next.panelA.tabs.push("linkages");
          changed = true;
        }
        if (
          !next.panelA.tabs.includes("sovereignty") &&
          !next.panelB.tabs.includes("sovereignty")
        ) {
          next.panelA.tabs.push("sovereignty");
          changed = true;
        }
      } else {
        const oldLenA = next.panelA.tabs.length;
        const oldLenB = next.panelB.tabs.length;
        next.panelA.tabs = next.panelA.tabs.filter(
          (t) => t !== "linkages" && t !== "sovereignty" && t !== "features"
        );
        next.panelB.tabs = next.panelB.tabs.filter(
          (t) => t !== "linkages" && t !== "sovereignty" && t !== "features"
        );
        if (next.panelA.tabs.length !== oldLenA || next.panelB.tabs.length !== oldLenB) {
          changed = true;
        }
        if (!next.panelA.tabs.includes("layers") && !next.panelB.tabs.includes("layers")) {
          next.panelA.tabs.push("layers");
          changed = true;
        }
      }

      if (!next.panelA.tabs.includes("properties") && !next.panelB.tabs.includes("properties")) {
        next.panelB.tabs.push("properties");
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [isWorldMode]);

  const handleMoveTab = useCallback((tabId: TabId, targetPanelId: "panelA" | "panelB") => {
    setPanelConfigs((prev) => {
      const sourcePanelId = targetPanelId === "panelA" ? "panelB" : "panelA";
      if (prev[targetPanelId].tabs.includes(tabId)) return prev;
      return {
        ...prev,
        [sourcePanelId]: {
          ...prev[sourcePanelId],
          tabs: prev[sourcePanelId].tabs.filter((t) => t !== tabId),
        },
        [targetPanelId]: {
          ...prev[targetPanelId],
          tabs: [...prev[targetPanelId].tabs, tabId],
          collapsed: false,
        },
      };
    });
  }, []);

  const handleChangePanelPlacement = useCallback(
    (panelId: "panelA" | "panelB", placement: "left" | "right" | "bottom") => {
      setPanelConfigs((prev) => ({
        ...prev,
        [panelId]: {
          ...prev[panelId],
          placement,
        },
      }));
    },
    []
  );

  const expandPropertiesPanel = useCallback(() => {
    setPanelConfigs((prev) => {
      let changed = false;
      const next = { ...prev };
      if (prev.panelA.tabs.includes("properties") && prev.panelA.collapsed) {
        next.panelA = { ...prev.panelA, collapsed: false };
        changed = true;
      }
      if (prev.panelB.tabs.includes("properties") && prev.panelB.collapsed) {
        next.panelB = { ...prev.panelB, collapsed: false };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  // Auto-expand/collapse whichever panel contains "properties" tab when mode changes
  useEffect(() => {
    const shouldExpand = isWorldMode
      ? activeEditorMode !== "view" || !!mapSelectedCountry
      : editor.mode !== "view" && editor.mode !== "import-provinces";

    if (shouldExpand) {
      setPanelConfigs((prev) => {
        let changed = false;
        const next = { ...prev };
        if (prev.panelA.tabs.includes("properties") && prev.panelA.collapsed) {
          next.panelA = { ...prev.panelA, collapsed: false };
          changed = true;
        }
        if (prev.panelB.tabs.includes("properties") && prev.panelB.collapsed) {
          next.panelB = { ...prev.panelB, collapsed: false };
          changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, [editor.mode, activeEditorMode, mapSelectedCountry, isWorldMode]);

  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);
  const [cursorZoom, setCursorZoom] = useState<number | undefined>(undefined);
  const [forgeMode, setForgeMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [paintMapMode, setPaintMapMode] = useState<
    "population" | "development" | "resources" | "wiki"
  >("population");
  const [paintSelectedRegion, setPaintSelectedRegion] = useState<string | null>(null);
  const [paintCompareRegion, setPaintCompareRegion] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<{
    feature: (typeof editor.allFeatures)[number];
    screenPos: { x: number; y: number };
  } | null>(null);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    feature: { id: string; name: string; type: string; wikiPageTitle?: string | null };
  } | null>(null);

  const [layerStates, setLayerStates] = useState<
    Record<string, { visible: boolean; locked: boolean; opacity?: number }>
  >({
    border: { visible: true, locked: false },
    regions: { visible: true, locked: false, opacity: 0.6 },
    cities: { visible: true, locked: false },
    pois: { visible: false, locked: false },
    stories: { visible: false, locked: false },
    labels: { visible: true, locked: false },
    routes: { visible: false, locked: false },
    rivers: { visible: true, locked: false },
    altitude: { visible: true, locked: false },
    grid: { visible: false, locked: false },
  });

  // --- Memoized Computations for World Mode ---
  const countries = useMemo(() => {
    const list = Array.isArray(dbCountries) ? dbCountries : ((dbCountries as any)?.countries ?? []);
    return [...(list as any[])].sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [dbCountries]);

  const availableCountries = useMemo(() => {
    if (!countries || !featureList) return [];
    const assignedCountryIds = new Set(
      featureList.filter((f) => f.countryId).map((f) => f.countryId)
    );
    return countries.filter((c: any) => !assignedCountryIds.has(c.id));
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
      return countries.find((c: any) => c.id === activeCountryId)?.name ?? "";
    }
    return "";
  }, [mapSelectedCountry, activeCountryId, countries]);

  const countryRelations = useMemo(() => {
    if (!relations || !activeCountryId) return [];
    return relations.filter(
      (r) => r.sovereignId === activeCountryId || r.subjectId === activeCountryId
    );
  }, [relations, activeCountryId]);

  const handleMapSelect = useCallback((country: SelectedCountry | null) => {
    setMapSelectedCountry(country);
    if (country) {
      setActiveCountryId(country.countryId);
    } else {
      setActiveCountryId(null);
    }
  }, []);

  const handleAssignLink = (featureId: string) => {
    if (!assignCountryId) return;
    assignMutation.mutate({ featureId, countryId: assignCountryId });
  };

  const handleUnlink = (featureId: string) => {
    if (confirm(`Unlink this feature (${featureId}) from its country?`)) {
      unlinkMutation.mutate({ featureId });
    }
  };

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

  const handleEditSovereignty = (rel: any) => {
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
        countryId: editableCountryLinkageId || undefined,
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

  const handleConfirmBorderSave = async () => {
    try {
      setIsSubmitting(true);
      await borderActions.submitEdit(true, saveReason);
      setShowConfirmSaveModal(false);
      utils.geoCore.getWorldMap.invalidate();
      refetchValidation();
      setActiveEditorMode("view");
    } catch (err) {
      console.error("Save failed:", err);
      alert(`Save failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const enterBorderEdit = useCallback(() => {
    if (!mapSelectedCountry?.featureId) return;
    borderActions.loadFeature(mapSelectedCountry.featureId);
    setActiveEditorMode("border_edit");
  }, [mapSelectedCountry, borderActions]);

  const handleSplitConfirm = useCallback(
    async (nameA: string, nameB: string) => {
      try {
        setIsSubmitting(true);
        await borderActions.executeSplit(nameA, nameB);
        setShowSplitDialog(false);
        utils.geoCore.getWorldMap.invalidate();
        refetchValidation();
        setActiveEditorMode("view");
      } catch (err) {
        console.error("Split failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [borderActions, utils, refetchValidation]
  );

  const handleMergeConfirm = useCallback(
    async (newName: string) => {
      try {
        setIsSubmitting(true);
        await borderActions.executeMerge(newName);
        setShowMergeDialog(false);
        utils.geoCore.getWorldMap.invalidate();
        refetchValidation();
        setActiveEditorMode("view");
      } catch (err) {
        console.error("Merge failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [borderActions, utils, refetchValidation]
  );

  const handleBorderToolbarSubmit = useCallback(() => {
    if (borderState.mode === "split" && borderState.splitLine.length >= 2) {
      setShowSplitDialog(true);
    } else if (borderState.mode === "merge" && borderState.mergeTargets.length > 0) {
      setShowMergeDialog(true);
    } else {
      setShowConfirmSaveModal(true);
      setSaveReason("");
    }
  }, [borderState.mode, borderState.splitLine, borderState.mergeTargets]);

  const simplifyAll = api.geoFeatures.simplifySubdivisions.useMutation({
    onSuccess: () => {
      editor.refetchFeatures();
      alert("All subdivisions simplified successfully.");
    },
  });

  const updateCityWiki = api.geoFeatures.updateCity.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });
  const updatePOIWiki = api.geoFeatures.updatePOI.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });
  const updateStoryPinWiki = api.geoFeatures.updateStoryPin.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });
  const updateMapLabelWiki = api.geoFeatures.updateMapLabel.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });

  const handleLinkFeature = useCallback(
    async (featureId: string, featureType: string, wikiTitle: string) => {
      const targetCountryId = activeCountryId;
      if (!targetCountryId) return;
      switch (featureType) {
        case "city":
          await updateCityWiki.mutateAsync({
            countryId: targetCountryId,
            cityId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        case "poi":
          await updatePOIWiki.mutateAsync({
            countryId: targetCountryId,
            poiId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        case "storyPin":
          await updateStoryPinWiki.mutateAsync({
            countryId: targetCountryId,
            pinId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        case "mapLabel":
          await updateMapLabelWiki.mutateAsync({
            countryId: targetCountryId,
            labelId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
      }
    },
    [activeCountryId, updateCityWiki, updatePOIWiki, updateStoryPinWiki, updateMapLabelWiki]
  );

  const wikiScanner = useWikiScanner({
    features: editor.allFeatures,
    onLinkFeature: handleLinkFeature,
  });

  const { data: countryInfo } = api.countries.getByIdBasic.useQuery(
    { id: activeCountryId ?? "" },
    { enabled: !!activeCountryId, staleTime: 5 * 60_000 }
  );

  const [mapInstance, setMapInstance] = useState<any | null>(null);
  useEffect(() => {
    const m = mapRef.current?.getMap() ?? null;
    if (m) {
      setMapInstance(m);
      return;
    }
    const timer = setTimeout(() => {
      const m2 = mapRef.current?.getMap() ?? null;
      if (m2) setMapInstance(m2);
    }, 500);
    return () => clearTimeout(timer);
  }, [mapRef]);

  const {
    mapLayers: editorMapLayers,
    toggleLayer: toggleEditorLayer,
    visibleLayers: editorVisibleLayers,
  } = useMapData(["background", "altitudes", "rivers", "lakes"]);
  const worldMapLayers = editorMapLayers;

  const { data: transportRouteData } = api.transport.getCountryRoutes.useQuery(
    { countryId: activeCountryId ?? "" },
    { enabled: !!activeCountryId, staleTime: 60_000, gcTime: 5 * 60_000 }
  );

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  useEffect(() => {
    if (editor.mode !== "add-route") {
      setSelectedRouteId(null);
    }
  }, [editor.mode]);

  const handleRouteClick = useCallback(
    (routeId: string) => {
      setSelectedRouteId(routeId);
      editor.setMode("add-route");
    },
    [editor]
  );

  const { data: subdivisionStats } = api.geoFeatures.getSubdivisionStats.useQuery(
    { countryId: activeCountryId ?? "" },
    { enabled: editor.mode === "paint" && !!activeCountryId, staleTime: 60_000 }
  );

  const paintColors = useMemo(() => {
    if (editor.mode !== "paint" || !subdivisionStats || subdivisionStats.length === 0)
      return undefined;

    const colors: Record<string, string> = {};
    const stats = subdivisionStats;

    const maxPop = Math.max(1, ...stats.map((s) => s.population ?? 0));
    const maxDev = Math.max(1, ...stats.map((s) => s.developmentScore));
    const maxRes = Math.max(1, ...stats.map((s) => s.resourceCount));

    for (const s of stats) {
      let t = 0;
      switch (paintMapMode) {
        case "population":
          t = (s.population ?? 0) / maxPop;
          break;
        case "development":
          t = s.developmentScore / maxDev;
          break;
        case "resources":
          t = s.resourceCount / maxRes;
          break;
        case "wiki":
          t = s.totalFeatures > 0 ? s.wikiLinked / s.totalFeatures : 0;
          break;
      }
      colors[s.id] =
        paintMapMode === "wiki"
          ? `hsl(${Math.round(t * 120)}, 70%, 50%)`
          : `hsl(${Math.round((1 - t) * 60)}, 80%, ${55 - t * 15}%)`;
    }

    return colors;
  }, [editor.mode, subdivisionStats, paintMapMode]);

  const [debouncedCoords, setDebouncedCoords] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!cursorCoords) {
      setDebouncedCoords(null);
      return;
    }
    const timer = setTimeout(() => setDebouncedCoords(cursorCoords), 300);
    return () => clearTimeout(timer);
  }, [cursorCoords]);

  const { data: cursorTerrainInfo } = api.geoCore.getPointInfo.useQuery(
    { lng: debouncedCoords?.[0] ?? 0, lat: debouncedCoords?.[1] ?? 0 },
    { enabled: !!debouncedCoords, staleTime: 30_000, gcTime: 60_000 }
  );

  const handleSelectFeature = useCallback(
    (feature: any) => {
      setSelectedRouteId(null);
      editor.setSelectedFeature(feature);
      if (editor.mode !== "paint") {
        editor.startEditing(feature);
      }
      expandPropertiesPanel();
      if (mapRef.current) {
        if (feature.coordinates) {
          mapRef.current.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
        } else if (feature.geometry) {
          const geo = feature.geometry;
          const ring = geo.type === "Polygon" ? geo.coordinates[0] : geo.coordinates[0]?.[0];
          if (ring && ring.length > 0) {
            let cx = 0,
              cy = 0;
            for (const pt of ring) {
              cx += pt[0]!;
              cy += pt[1]!;
            }
            cx /= ring.length;
            cy /= ring.length;
            mapRef.current.flyTo(cx, cy, 7);
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, mapRef]
  );

  const handleEditFeature = useCallback(
    (feature: any) => {
      editor.startEditing(feature);
      expandPropertiesPanel();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor]
  );

  const handleDeleteFeature = useCallback(
    (feature: any) => {
      if (confirm(`Delete "${feature.name}"? This action cannot be undone.`)) {
        editor.handleDeleteFeature(feature);
      }
    },
    [editor]
  );

  const handleSubmit = useCallback(() => {
    switch (editor.mode) {
      case "add-city":
        editor.submitCity();
        break;
      case "add-subdivision":
        editor.submitSubdivision();
        break;
      case "add-poi":
        editor.submitPOI();
        break;
      case "edit-city":
        editor.submitEditCity();
        break;
      case "edit-subdivision":
        editor.submitEditSubdivision();
        break;
      case "edit-poi":
        editor.submitEditPOI();
        break;
      case "add-story-pin":
        editor.submitStoryPin();
        break;
      case "add-label":
        editor.submitMapLabel();
        break;
      case "edit-story-pin":
        editor.submitEditStoryPin();
        break;
      case "edit-label":
        editor.submitEditMapLabel();
        break;
    }
  }, [editor]);

  // Keyboard shortcuts and mouse mousemove listeners
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        editor.redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (editor.mode.startsWith("add-") || editor.mode.startsWith("edit-")) {
          handleSubmit();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "a" && !inInput) {
        e.preventDefault();
        editor.allFeatures.forEach((f) => {
          if (!editor.selectedIds.has(f.id)) {
            editor.toggleSelectId(f.id);
          }
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "d" && !inInput) {
        e.preventDefault();
        editor.clearMultiSelect();
        return;
      }

      if (e.key === "Escape") {
        if (editor.mode === "import-provinces") {
          importer.reset();
          editor.setMode("view");
        } else if (editor.mode !== "view") {
          editor.resetForm();
        } else {
          handleRequestExit();
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) {
        if (editor.selectedFeature && editor.mode === "view") {
          e.preventDefault();
          handleDeleteFeature(editor.selectedFeature);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, importer, handleSubmit, handleDeleteFeature, handleRequestExit]);

  const handleMapMouseMove = useCallback(
    (e: any) => {
      if (!mapInstance) return;
      const latlng = e.lngLat;
      if (latlng) {
        setCursorCoords([latlng.lng, latlng.lat]);
      }

      if (activeEditorMode !== "view" || (editor.mode !== "view" && editor.mode !== "paint")) {
        return;
      }

      const hits = mapInstance.queryRenderedFeatures(e.point, {
        layers: ["editor-subdivisions-fill"],
      });

      if (hits.length > 0) {
        const hitId = hits[0]?.properties?.id as string | undefined;
        if (hitId && hitId !== hoveredFeature?.feature.id) {
          const match = editor.allFeatures.find((f) => f.id === hitId);
          if (match) {
            setHoveredFeature({ feature: match, screenPos: { x: e.point.x, y: e.point.y } });
          }
        }
      } else if (hoveredFeature) {
        setHoveredFeature(null);
      }
    },
    [mapInstance, editor.mode, editor.allFeatures, hoveredFeature, activeEditorMode]
  );

  useEffect(() => {
    const map = mapInstance;
    if (!map) return;
    map.on("mousemove", handleMapMouseMove);
    map.on("zoomend", () => setCursorZoom(map.getZoom()));
    setCursorZoom(map.getZoom());
    return () => {
      map.off("mousemove", handleMapMouseMove);
    };
  }, [mapInstance, handleMapMouseMove]);

  useEffect(() => {
    if (!isWorldMode) return;
    if (activeEditorMode === "border_edit") return;

    if (editor.mode === "view") {
      setActiveEditorMode("view");
    } else {
      setActiveEditorMode("forge");
    }
  }, [editor.mode, isWorldMode, activeEditorMode]);

  const featureCounts = useMemo(
    () => ({
      regions: editor.allFeatures.filter((f) => f.type === "subdivision").length,
      cities: editor.allFeatures.filter((f) => f.type === "city").length,
      pois: editor.allFeatures.filter((f) => f.type === "poi").length,
      stories: editor.allFeatures.filter((f) => f.type === "storyPin").length,
      labels: editor.allFeatures.filter((f) => f.type === "mapLabel").length,
    }),
    [editor.allFeatures]
  );

  return {
    activeCountryId,
    setActiveCountryId,
    activeEditorMode,
    setActiveEditorMode,
    mapSelectedCountry,
    setMapSelectedCountry,
    borderState,
    borderActions,
    editor,
    importer,
    neighborGeoms,
    isLinked,
    linkageLoading,
    hasGeometry,
    toolsDisabled,
    disabledTools,
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
    isAdmin,
    generateTransport,
    recalculateGeo,
    utils,
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
    showExitConfirm,
    setShowExitConfirm,
    hasUnsavedChanges,
    handleRequestExit,
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
    displayName,
    setDisplayName,
    showSplitDialog,
    setShowSplitDialog,
    showMergeDialog,
    setShowMergeDialog,
    isSubmitting,
    setIsSubmitting,
    showConfirmSaveModal,
    setShowConfirmSaveModal,
    saveReason,
    setSaveReason,
    panelConfigs,
    setPanelConfigs,
    handleMoveTab,
    handleChangePanelPlacement,
    showRightPanel: isWorldMode
      ? true
      : editor.mode !== "view" && editor.mode !== "import-provinces",
    cursorTerrainInfo,
    cursorCoords,
    setCursorCoords,
    cursorZoom,
    setCursorZoom,
    forgeMode,
    setForgeMode,
    showGrid,
    setShowGrid,
    paintMapMode,
    setPaintMapMode,
    paintSelectedRegion,
    setPaintSelectedRegion,
    paintCompareRegion,
    setPaintCompareRegion,
    hoveredFeature,
    setHoveredFeature,
    showShortcuts,
    setShowShortcuts,
    contextMenu,
    setContextMenu,
    layerStates,
    setLayerStates,
    countries,
    availableCountries,
    filteredFeatures,
    filteredRelations,
    selectedCountryName,
    countryRelations,
    handleMapSelect,
    handleAssignLink,
    handleUnlink,
    resetSovereigntyForm,
    handleCreateSovereignty,
    handleUpdateSovereignty,
    handleDeleteSovereignty,
    handleEditSovereignty,
    handleSaveFeatureProperties,
    handleConfirmBorderSave,
    enterBorderEdit,
    handleSplitConfirm,
    handleMergeConfirm,
    handleBorderToolbarSubmit,
    simplifyAll,
    handleLinkFeature,
    wikiScanner,
    countryInfo,
    mapInstance,
    worldMapLayers,
    editorVisibleLayers,
    toggleEditorLayer,
    transportRouteData,
    selectedRouteId,
    setSelectedRouteId,
    handleRouteClick,
    subdivisionStats,
    paintColors,
    handleSelectFeature,
    handleEditFeature,
    handleDeleteFeature,
    handleSubmit,
    featureCounts,
  };
}
