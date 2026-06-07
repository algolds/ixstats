// @ts-nocheck
"use client";

/**
 * MapEditorOverlay — Full-screen map editor with Adobe-style layout.
 *
 * Layout:
 * ┌─── Title Bar ────────────────────────────────────┐
 * ├──┬──────────────────────────────────────┬─────────┤
 * │  │                                      │ Editor  │
 * │T │           MAP CANVAS                 │ Panel   │
 * │R │                                      │ (right) │
 * ├──┴──────────────────────────────────────┴─────────┤
 * │ Status Bar                                        │
 * └───────────────────────────────────────────────────┘
 */

import React, { useRef, useCallback, useState, useEffect, useMemo, Component } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  AlertCircle,
  Map,
  ChevronRight,
  Sparkles,
  Train,
  RefreshCw,
  Minimize2,
  Grid3X3,
  Crosshair,
  Droplets,
  Mountain as MountainIcon,
  Undo2,
  Redo2,
  MousePointer2,
  Pencil,
  Scissors,
  Merge,
  Unlink as UnlinkIcon,
  Plus,
  Check,
  Loader2,
  Info,
  X,
  ShieldAlert,
  Wand2,
  Edit,
  Trash2,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import { useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureList } from "~/components/maps/editor/FeatureList";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { ToolOptionsBar } from "~/components/maps/editor/ToolOptionsBar";
import { BatchActionsBar } from "~/components/maps/editor/BatchActionsBar";
import { LayerPanel, type LayerState } from "~/components/maps/editor/LayerPanel";
import { FeatureContextMenu } from "~/components/maps/editor/FeatureContextMenu";
import { MobileEditorSheet } from "~/components/maps/editor/MobileEditorSheet";
import { WikiScannerPanel } from "~/components/maps/editor/WikiScannerPanel";
import { useWikiScanner } from "~/hooks/useWikiScanner";
import { JsonViewer } from "~/components/json-viewer";
import {
  MapPin,
  Hexagon,
  Landmark,
  BookMarked,
  Type as TypeIcon,
  Route,
  Globe,
} from "lucide-react";
import {
  ProvinceImportWizard,
  ProvincePreviewLayer,
} from "~/components/maps/editor/province-importer";
import { TransportOverlay } from "~/components/maps/overlays/TransportOverlay";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { KeyboardShortcutSheet } from "~/components/maps/editor/KeyboardShortcutSheet";
import { api } from "~/trpc/react";
import { useBorderEditor } from "~/hooks/useBorderEditor";
import { BorderEditorToolbar } from "~/components/maps/editor/BorderEditorToolbar";
import { BorderEditorPanel } from "~/components/maps/editor/BorderEditorPanel";
import { SplitMergeDialog } from "~/components/maps/editor/SplitMergeDialog";
import { SOVEREIGNTY_TYPES } from "~/lib/map-config";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";

const MapContainer = dynamic(
  () => import("~/components/maps/core/MapContainer").then((m) => m.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted flex h-full items-center justify-center">
        <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
        <p className="text-muted-foreground ml-2 text-[11px]">Loading map canvas...</p>
      </div>
    ),
  }
);

const BorderEditorMap = dynamic(
  () => import("~/components/maps/editor/BorderEditorMap").then((m) => m.BorderEditorMap),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted flex h-full items-center justify-center">
        <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
        <p className="text-muted-foreground ml-2 text-[11px]">Loading border editor...</p>
      </div>
    ),
  }
);

const EditorMap = dynamic(() => import("~/components/maps/editor/EditorMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
        <p className="text-muted-foreground text-sm">Loading map editor...</p>
      </div>
    </div>
  ),
});

interface MapEditorOverlayProps {
  countryId?: string;
  mapLayers?: MapLayerData[];
  onExit: () => void;
  isWorldMode?: boolean;
}

export default function MapEditorOverlay({
  countryId,
  mapLayers: parentMapLayers,
  onExit,
  isWorldMode = false,
}: MapEditorOverlayProps) {
  const mapRef = useRef<EditorMapRef>(null);

  // Real-time sync: invalidate map caches when any geo mutation succeeds
  useMapLiveSync();

  const [activeCountryId, setActiveCountryId] = useState<string | null>(countryId || null);
  const [activeEditorMode, setActiveEditorMode] = useState<"view" | "forge" | "border_edit">(
    isWorldMode ? "view" : "forge"
  );
  const [mapSelectedCountry, setMapSelectedCountry] = useState<SelectedCountry | null>(null);

  // --- Map Editor & Border Editor Hooks (Declared early to avoid TDZ errors) ---
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

  // ── Derived State & Tools (Declared early to prevent TDZ errors) ──
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
    // If country has no geometry, point placement/painting tools are disabled,
    // but add-subdivision and import-provinces are enabled so geometry can be created.
    if (!hasGeometry) {
      return [
        "add-city",
        "add-poi",
        "add-route",
        "add-story-pin",
        "add-label",
        "paint",
      ];
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
    } catch (e) {
      return {};
    }
  }, [propertiesJsonString]);

  // --- Queries & Mutations for World Mode & Feature Editing ---

  // Load full details for the selected feature in world mode
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

  // --- Queries & Mutations for World Mode ---
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

  // Auto-select map feature when activeCountryId changes (e.g., from sidebar lists)
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
  }, [isWorldMode, activeCountryId, mapSelectedCountry, featureList]);

  // Exit confirmation state & change detection
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const hasUnsavedChanges = useMemo(() => {
    if (borderState.isDirty) return true;
    if (importer.step !== "upload") return true;
    if (editor.mode !== "view") return true;

    // Check custom view-mode property edits
    if (mapSelectedCountry) {
      const dbFeatureName = mapSelectedCountry.displayName || "";
      const dbCountryId = mapSelectedCountry.countryId || "";
      const dbWikiTitle = featureDetails?.wikiPageTitle || "";
      const dbPropsJson = featureDetails?.properties ? JSON.stringify(featureDetails.properties, null, 2) : "";

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

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const showRightPanel = isWorldMode
    ? true
    : editor.mode !== "view" && editor.mode !== "import-provinces";

  // Auto-expand/collapse right panel based on mode
  useEffect(() => {
    if (isWorldMode) {
      if (activeEditorMode !== "view" || !!mapSelectedCountry) {
        setRightPanelCollapsed(false);
      }
    } else {
      if (editor.mode !== "view" && editor.mode !== "import-provinces") {
        setRightPanelCollapsed(false);
      }
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

  // Keyboard shortcut sheet
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    feature: { id: string; name: string; type: string; wikiPageTitle?: string | null };
  } | null>(null);

  // Layer panel state
  const [layerStates, setLayerStates] = useState<
    Record<string, { visible: boolean; locked: boolean; opacity?: number }>
  >({
    border: { visible: true, locked: false },
    regions: { visible: true, locked: false, opacity: 0.6 },
    cities: { visible: true, locked: false },
    pois: { visible: true, locked: false },
    stories: { visible: true, locked: false },
    labels: { visible: true, locked: false },
    routes: { visible: true, locked: false },
    rivers: { visible: true, locked: false },
    altitude: { visible: true, locked: false },
    grid: { visible: false, locked: false },
  });

  // (Queries and mutations block moved to top of component body to prevent TDZ initialization errors)

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

  // Features list for linkage tab
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

  // Sovereignty relations filtered lists
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

  // Specific country's sovereignty relations (if country selected)
  const countryRelations = useMemo(() => {
    if (!relations || !activeCountryId) return [];
    return relations.filter(
      (r) => r.sovereignId === activeCountryId || r.subjectId === activeCountryId
    );
  }, [relations, activeCountryId]);

  // --- Handlers for World Mode ---
  const handleMapSelect = useCallback((country: SelectedCountry | null) => {
    setMapSelectedCountry(country);
    if (country?.countryId) {
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
    if (confirm("Delete this sovereignty relationship?")) {
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
      description: rel.description ?? "",
      establishedDate: rel.establishedDate ?? "",
    });
    setShowSovereigntyForm(true);
  };

  const handleSaveFeatureProperties = () => {
    if (!mapSelectedCountry) return;

    let parsedProps = undefined;
    if (propertiesJsonString) {
      try {
        parsedProps = JSON.parse(propertiesJsonString);
      } catch (err) {
        setJsonError("Invalid JSON structure");
        return;
      }
    }

    updatePropertiesMutation.mutate(
      {
        featureId: mapSelectedCountry.featureId,
        displayName: editableFeatureName || undefined,
        countryId: editableCountryLinkageId || null,
        properties: parsedProps,
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
    [borderActions, utils]
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
    [borderActions, utils]
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

  const typeLabel = (t: string) => SOVEREIGNTY_TYPES.find((s) => s.value === t)?.label ?? t;

  // Simplify all regions (available to country owner)
  const simplifyAll = api.geoFeatures.simplifySubdivisions.useMutation({
    onSuccess: () => {
      editor.refetchFeatures();
    },
  });

  // Wiki scanner — link features to wiki pages
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
        // subdivision doesn't support wikiPageTitle in its update mutation
      }
    },
    [activeCountryId, updateCityWiki, updatePOIWiki, updateStoryPinWiki, updateMapLabelWiki]
  );

  const wikiScanner = useWikiScanner({
    features: editor.allFeatures,
    onLinkFeature: handleLinkFeature,
  });

  // Fetch country name for display
  const { data: countryInfo } = api.countries.getByIdBasic.useQuery(
    { id: activeCountryId ?? "" },
    { enabled: !!activeCountryId, staleTime: 5 * 60_000 }
  );

  // Track live map instance for province preview layer (one-shot, no polling)
  const [mapInstance, setMapInstance] = useState<import("maplibre-gl").Map | null>(null);
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
  }, []);

  // Editor's own layer data — same layers as main map, independent visibility
  const {
    mapLayers: editorMapLayers,
    toggleLayer: toggleEditorLayer,
    visibleLayers: editorVisibleLayers,
  } = useMapData(["background", "altitudes", "rivers", "lakes"]);
  const worldMapLayers = editorMapLayers;

  // Transport routes for this country (shown as overlay lines)
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

  // Paint mode: fetch subdivision stats
  const { data: subdivisionStats } = api.geoFeatures.getSubdivisionStats.useQuery(
    { countryId: activeCountryId ?? "" },
    { enabled: editor.mode === "paint" && !!activeCountryId, staleTime: 60_000 }
  );

  // Paint mode: compute color map from stats + selected mode
  const paintColors = useMemo(() => {
    if (editor.mode !== "paint" || !subdivisionStats || subdivisionStats.length === 0)
      return undefined;

    const colors: Record<string, string> = {};
    const stats = subdivisionStats;

    // Get max values for normalization
    const maxPop = Math.max(1, ...stats.map((s) => s.population ?? 0));
    const maxDev = Math.max(1, ...stats.map((s) => s.developmentScore));
    const maxRes = Math.max(1, ...stats.map((s) => s.resourceCount));

    for (const s of stats) {
      let t = 0; // normalized 0-1
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
      // Color gradient: low=cool, high=warm
      colors[s.id] =
        paintMapMode === "wiki"
          ? `hsl(${Math.round(t * 120)}, 70%, 50%)` // red(0) → green(120)
          : `hsl(${Math.round((1 - t) * 60)}, 80%, ${55 - t * 15}%)`; // yellow(60) → red(0), darker for high
    }

    return colors;
  }, [editor.mode, subdivisionStats, paintMapMode]);

  // Debounced cursor terrain query — fires 300ms after cursor stops moving
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

  // Feature interaction callbacks
  const handleSelectFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
      setSelectedRouteId(null);
      editor.setSelectedFeature(feature);
      // In paint mode, just select — don't open edit form
      if (editor.mode !== "paint") {
        editor.startEditing(feature);
      }
      setRightPanelCollapsed(false);
      if (mapRef.current) {
        if (feature.coordinates) {
          // Point feature (city/POI) — fly to coordinates
          mapRef.current.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
        } else if (feature.geometry) {
          // Polygon feature (subdivision) — fly to geometry centroid
          const geo = feature.geometry as
            | import("geojson").Polygon
            | import("geojson").MultiPolygon;
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
    [editor]
  );

  const handleEditFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
      editor.startEditing(feature);
      setRightPanelCollapsed(false);
    },
    [editor]
  );

  const handleDeleteFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Undo/Redo (works even in input fields)
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

      // Ctrl+S: force save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (editor.mode.startsWith("add-") || editor.mode.startsWith("edit-")) {
          handleSubmit();
        }
        return;
      }

      // Ctrl+A: select all visible features
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && !inInput) {
        e.preventDefault();
        editor.allFeatures.forEach((f) => {
          if (!editor.selectedIds.has(f.id)) {
            editor.toggleSelectId(f.id);
          }
        });
        return;
      }

      // Ctrl+D: deselect all
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

      // ? — show keyboard shortcut sheet
      if (e.key === "?" && !inInput) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      const shortcutsDisabled = isWorldMode
        ? !activeCountryId
        : (!editor.linkage?.isLinked || !editor.countryGeo);
      if (inInput || shortcutsDisabled) return;

      switch (e.key.toLowerCase()) {
        case "v":
          e.preventDefault();
          editor.setMode("view");
          break;
        case "1":
        case "c":
          e.preventDefault();
          if (!disabledTools.includes("add-city")) {
            editor.setMode(editor.mode === "add-city" ? "view" : "add-city");
          }
          break;
        case "2":
        case "r":
          e.preventDefault();
          if (!disabledTools.includes("add-subdivision")) {
            editor.setMode(editor.mode === "add-subdivision" ? "view" : "add-subdivision");
          }
          break;
        case "3":
        case "p":
          e.preventDefault();
          if (!disabledTools.includes("add-poi")) {
            editor.setMode(editor.mode === "add-poi" ? "view" : "add-poi");
          }
          break;
        case "4":
        case "t":
          e.preventDefault();
          if (!disabledTools.includes("add-route")) {
            editor.setMode(editor.mode === "add-route" ? "view" : "add-route");
          }
          break;
        case "i":
          e.preventDefault();
          if (!disabledTools.includes("import-provinces")) {
            editor.setMode(editor.mode === "import-provinces" ? "view" : "import-provinces");
          }
          break;
        case "f":
          e.preventDefault();
          setPanelCollapsed((v) => !v);
          break;
        case "g":
          e.preventDefault();
          setShowGrid((v) => !v);
          break;
        case "b":
          e.preventDefault();
          if (!disabledTools.includes("paint")) {
            editor.setMode(editor.mode === "paint" ? "view" : "paint");
          }
          break;
        case "s":
          e.preventDefault();
          if (!disabledTools.includes("add-story-pin")) {
            editor.setMode(editor.mode === "add-story-pin" ? "view" : "add-story-pin");
          }
          break;
        case "l":
          e.preventDefault();
          if (!disabledTools.includes("add-label")) {
            editor.setMode(editor.mode === "add-label" ? "view" : "add-label");
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, importer, handleRequestExit, handleDeleteFeature, handleSubmit, disabledTools, isWorldMode, activeCountryId]);

  // Track map cursor position + hovered features for status bar & tooltip
  const handleMapMouseMove = useCallback(
    (e: any) => {
      setCursorCoords([e.lngLat.lng, e.lngLat.lat]);

      // Detect hovered subdivision for stats overlay
      const map = mapInstance;
      if (!map || (editor.mode !== "view" && editor.mode !== "paint")) {
        if (hoveredFeature) setHoveredFeature(null);
        return;
      }

      const hits = map.queryRenderedFeatures(e.point, {
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
    [mapInstance, editor.mode, editor.allFeatures, hoveredFeature]
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

  // (Derived state & tools declarations moved to top of component body to prevent TDZ initialization errors)

  useEffect(() => {
    if (!isWorldMode) return;
    if (activeEditorMode === "border_edit") return;

    if (editor.mode === "view") {
      setActiveEditorMode("view");
    } else {
      setActiveEditorMode("forge");
    }
  }, [editor.mode, isWorldMode, activeEditorMode]);

  // featureCounts - extracted from inline to top-level to ensure hook stability
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

  // ── Loading & Initialization States ──
  const showLoadingScreen =
    !isWorldMode && (linkageLoading || (isLinked && (!hasGeometry || editor.featuresLoading)));

  // ── Not linked warning ──
  // IMPORTANT: This early return must happen AFTER all hooks have been called
  if (!isWorldMode && !linkageLoading && !isLinked) {
    return (
      <div className="bg-background absolute inset-0 z-30 flex flex-col">
        <div className="border-border bg-card flex h-10 items-center gap-2 border-b px-3">
          <button
            onClick={handleRequestExit}
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{countryInfo?.name ?? "Country"}</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="mx-auto max-w-sm text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <h3 className="text-foreground font-semibold">Country Not Linked to Map</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              This country needs to be linked to a political map feature before editing. Contact an
              admin to link it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderLinkagesContent = () => (
    <div className="space-y-4 p-3 text-xs">
      <div className="bg-muted/10 border-border/20 flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <span className="text-muted-foreground block text-[10px] font-semibold tracking-wider uppercase">
            Issues / Desyncs
          </span>
          <span className="text-foreground text-xl font-bold">
            {validationData?.issues?.length ?? 0}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => syncMutation.mutate({ action: "sync_all" })}
            disabled={syncMutation.isPending}
            className="rounded bg-blue-600/10 p-1.5 text-blue-500 transition-colors hover:bg-blue-600/20"
            title="Sync All Linked"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => autoMatchMutation.mutate({ action: "auto_match" })}
            disabled={autoMatchMutation.isPending}
            className="rounded bg-emerald-600/10 p-1.5 text-emerald-500 transition-colors hover:bg-emerald-600/20"
            title="Auto-Match by Name"
          >
            <Wand2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-border/30 bg-card/40 overflow-hidden rounded-lg border">
        <div className="bg-muted/20 border-border/30 flex border-b text-[10px] font-semibold uppercase">
          <button
            onClick={() => setValidationTab("issues")}
            className={`flex-1 border-b py-2 text-center ${validationTab === "issues" ? "bg-muted/10 border-blue-500 text-blue-500" : "text-muted-foreground border-transparent"}`}
          >
            Issues
          </button>
          <button
            onClick={() => setValidationTab("linked")}
            className={`flex-1 border-b py-2 text-center ${validationTab === "linked" ? "bg-muted/10 border-blue-500 text-blue-500" : "text-muted-foreground border-transparent"}`}
          >
            Linked
          </button>
          <button
            onClick={() => setValidationTab("unlinked")}
            className={`flex-1 border-b py-2 text-center ${validationTab === "unlinked" ? "bg-muted/10 border-blue-500 text-blue-500" : "text-muted-foreground border-transparent"}`}
          >
            Unlinked
          </button>
          <button
            onClick={() => setValidationTab("features")}
            className={`flex-1 border-b py-2 text-center ${validationTab === "features" ? "bg-muted/10 border-blue-500 text-blue-500" : "text-muted-foreground border-transparent"}`}
          >
            Features
          </button>
        </div>

        <div className="max-h-[300px] space-y-1.5 overflow-y-auto p-3">
          {validationTab === "issues" &&
            validationData &&
            (!validationData.issues || validationData.issues.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center italic">
                No linkage issues found.
              </p>
            ) : (
              validationData.issues.map((item: any) => (
                <div
                  key={`${item.type}-${item.countryId}`}
                  onClick={() => {
                    setActiveCountryId(item.countryId);
                    setMapSelectedCountry({
                      featureId: item.featureId,
                      displayName: item.featureName,
                      fillColor: "#e8e5da",
                      centroidLng: 0,
                      centroidLat: 0,
                      countryId: item.countryId,
                    });
                  }}
                  className="border-border/30 bg-muted/10 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-all hover:border-blue-500/40 hover:bg-blue-500/5"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {item.countryFlag && (
                      <img
                        src={item.countryFlag}
                        alt=""
                        className="border-border/35 h-3.5 w-5 rounded border object-cover"
                      />
                    )}
                    <span className="text-foreground truncate font-medium">{item.countryName}</span>
                  </div>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {item.featureName}
                  </span>
                </div>
              ))
            ))}

          {validationTab === "linked" &&
            validationData &&
            (validationData.linked.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center italic">No linked features.</p>
            ) : (
              validationData.linked.map((item) => (
                <div
                  key={item.featureId}
                  onClick={() => {
                    setActiveCountryId(item.countryId);
                    setMapSelectedCountry({
                      featureId: item.featureId,
                      displayName: item.featureName,
                      fillColor: "#e8e5da",
                      centroidLng: 0,
                      centroidLat: 0,
                      countryId: item.countryId,
                    });
                  }}
                  className="border-border/30 bg-muted/10 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-all hover:border-blue-500/40 hover:bg-blue-500/5"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {item.countryFlag && (
                      <img
                        src={item.countryFlag}
                        alt=""
                        className="border-border/35 h-3.5 w-5 rounded border object-cover"
                      />
                    )}
                    <span className="text-foreground truncate font-medium">{item.countryName}</span>
                  </div>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {item.featureName}
                  </span>
                </div>
              ))
            ))}

          {validationTab === "unlinked" &&
            validationData &&
            (validationData.unlinked.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center italic">All countries linked.</p>
            ) : (
              validationData.unlinked.map((item) => (
                <div
                  key={item.countryId}
                  onClick={() => {
                    setActiveCountryId(item.countryId);
                    setMapSelectedCountry(null);
                  }}
                  className="border-border/30 bg-muted/10 flex items-center justify-between rounded-lg border p-2"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {item.countryFlag && (
                      <img
                        src={item.countryFlag}
                        alt=""
                        className="border-border/35 h-3.5 w-5 rounded border object-cover"
                      />
                    )}
                    <span className="text-foreground truncate font-medium">{item.countryName}</span>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] leading-tight font-semibold ${item.hasGeometry ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}
                  >
                    {item.hasGeometry ? "Orphaned" : "No Geometry"}
                  </span>
                </div>
              ))
            ))}

          {validationTab === "features" && featureList && (
            <div className="space-y-2">
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="Search features..."
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                  className="bg-background border-border w-full rounded border px-2 py-1 text-xs"
                />
                <select
                  value={featureFilter}
                  onChange={(e: any) => setFeatureFilter(e.target.value)}
                  className="bg-background border-border rounded border px-2 py-1 text-xs"
                >
                  <option value="all">All</option>
                  <option value="linked">Linked</option>
                  <option value="unlinked">Unlinked</option>
                </select>
              </div>
              <div className="max-h-[160px] space-y-1 overflow-y-auto pr-0.5">
                {filteredFeatures.map((feat) => (
                  <div
                    key={feat.featureId}
                    onClick={() => {
                      setMapSelectedCountry({
                        featureId: feat.featureId,
                        displayName: feat.displayName,
                        fillColor: feat.fillColor,
                        centroidLng: feat.centroidLng,
                        centroidLat: feat.centroidLat,
                        countryId: feat.countryId,
                      });
                      if (feat.countryId) {
                        setActiveCountryId(feat.countryId);
                      } else {
                        setActiveCountryId(null);
                      }
                    }}
                    className="border-border/30 bg-muted/10 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-all hover:border-blue-500/40 hover:bg-blue-500/5"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <div
                        className="border-border/40 h-3 w-3 shrink-0 rounded-full border shadow-sm"
                        style={{ backgroundColor: feat.fillColor }}
                      />
                      <span className="text-foreground truncate font-medium">
                        {feat.displayName}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${feat.isClaimed ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                    >
                      {feat.isClaimed ? "Linked" : "Unlinked"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSovereigntyContent = () => (
    <div className="space-y-4 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{filteredRelations.length} Relations</span>
        {!showSovereigntyForm && (
          <button
            onClick={() => {
              resetSovereigntyForm();
              setShowSovereigntyForm(true);
            }}
            className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-3 w-3" /> New Relation
          </button>
        )}
      </div>

      {showSovereigntyForm && (
        <div className="bg-muted/40 border-border/50 space-y-2.5 rounded-lg border p-3">
          <h4 className="text-foreground border-border/30 border-b pb-1 text-[10px] font-semibold tracking-wider uppercase">
            {editingSovereigntyId ? "Edit Sovereignty" : "New Sovereignty Relation"}
          </h4>
          <div className="space-y-2 text-xs">
            <div>
              <label className="text-muted-foreground mb-0.5 block">Sovereign (Parent)</label>
              <select
                value={sovereigntyForm.sovereignId}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, sovereignId: e.target.value })
                }
                disabled={!!editingSovereigntyId}
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              >
                <option value="">Select parent...</option>
                {countries.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">Subject (Dependency)</label>
              <select
                value={sovereigntyForm.subjectId}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, subjectId: e.target.value })
                }
                disabled={!!editingSovereigntyId}
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              >
                <option value="">Select subject...</option>
                {countries
                  .filter((c: any) => c.id !== sovereigntyForm.sovereignId)
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">Type</label>
              <select
                value={sovereigntyForm.relationshipType}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, relationshipType: e.target.value })
                }
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              >
                {SOVEREIGNTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">
                Autonomy: {sovereigntyForm.autonomyLevel}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={sovereigntyForm.autonomyLevel}
                onChange={(e) =>
                  setSovereigntyForm({
                    ...sovereigntyForm,
                    autonomyLevel: parseInt(e.target.value),
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">Established</label>
              <input
                type="text"
                placeholder="e.g. 1920"
                value={sovereigntyForm.establishedDate}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, establishedDate: e.target.value })
                }
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">Description</label>
              <input
                type="text"
                placeholder="Optional notes..."
                value={sovereigntyForm.description}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, description: e.target.value })
                }
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              />
            </div>
          </div>
          <div className="border-border/30 flex justify-end gap-1.5 border-t pt-2">
            <button
              onClick={editingSovereigntyId ? handleUpdateSovereignty : handleCreateSovereignty}
              disabled={
                createSovereignty.isPending ||
                updateSovereignty.isPending ||
                !sovereigntyForm.sovereignId ||
                !sovereigntyForm.subjectId
              }
              className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={resetSovereigntyForm}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search relations..."
          value={sovereigntySearch}
          onChange={(e) => setSovereigntySearch(e.target.value)}
          className="bg-background border-border w-full rounded border px-2 py-1 text-xs"
        />
        <select
          value={sovereigntyTypeFilter}
          onChange={(e) => setSovereigntyTypeFilter(e.target.value)}
          className="bg-background border-border rounded border px-2 py-1 text-xs"
        >
          <option value="all">All Types</option>
          {SOVEREIGNTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-0.5">
        {relationsLoading ? (
          <p className="text-muted-foreground py-4 text-center italic">Loading relations...</p>
        ) : filteredRelations.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center italic">No relations found.</p>
        ) : (
          filteredRelations.map((rel) => (
            <div
              key={rel.id}
              className="border-border/30 bg-muted/10 hover:border-border/60 flex items-center justify-between rounded-lg border p-2 transition-colors"
            >
              <div className="max-w-[85%] truncate">
                <div className="flex items-center gap-1.5">
                  {rel.sovereignFlag && (
                    <img
                      src={rel.sovereignFlag}
                      alt=""
                      className="border-border/30 h-3 w-4.5 rounded border object-cover"
                    />
                  )}
                  <span className="text-foreground truncate font-semibold">
                    {rel.sovereignName}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-1 pl-6 text-[10px]">
                  <span>➔</span>
                  <span>{rel.subjectName}</span>
                  <span className="ml-1 rounded-sm bg-indigo-500/10 px-1 text-[9px] text-indigo-500">
                    {typeLabel(rel.relationshipType)}
                  </span>
                </div>
              </div>
              <div className="ml-1 flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleEditSovereignty(rel)}
                  className="rounded p-0.5 text-blue-500 hover:bg-blue-500/10 hover:text-blue-600"
                >
                  <Edit className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDeleteSovereignty(rel.id)}
                  className="rounded p-0.5 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderLayersElement = () => (
    <LayerPanel
      layers={[
        {
          id: "border",
          name: "Country Border",
          icon: Globe,
          visible: layerStates.border?.visible ?? true,
          locked: false,
        },
        {
          id: "regions",
          name: "Regions",
          icon: Hexagon,
          visible: layerStates.regions?.visible ?? true,
          locked: layerStates.regions?.locked ?? false,
          opacity: layerStates.regions?.opacity ?? 0.6,
        },
        {
          id: "cities",
          name: "Cities",
          icon: MapPin,
          visible: layerStates.cities?.visible ?? true,
          locked: layerStates.cities?.locked ?? false,
        },
        {
          id: "pois",
          name: "POIs",
          icon: Landmark,
          visible: layerStates.pois?.visible ?? true,
          locked: layerStates.pois?.locked ?? false,
        },
        {
          id: "stories",
          name: "Story Pins",
          icon: BookMarked,
          visible: layerStates.stories?.visible ?? true,
          locked: layerStates.stories?.locked ?? false,
        },
        {
          id: "labels",
          name: "Labels",
          icon: TypeIcon,
          visible: layerStates.labels?.visible ?? true,
          locked: layerStates.labels?.locked ?? false,
        },
        {
          id: "routes",
          name: "Routes",
          icon: Route,
          visible: layerStates.routes?.visible ?? true,
          locked: layerStates.routes?.locked ?? false,
        },
        {
          id: "rivers",
          name: "Rivers",
          icon: Droplets,
          visible: editorVisibleLayers.has("rivers"),
          locked: false,
          isBaseLayer: true,
        },
        {
          id: "altitude",
          name: "Altitude",
          icon: MountainIcon,
          visible: editorVisibleLayers.has("altitudes"),
          locked: false,
          isBaseLayer: true,
        },
        {
          id: "grid",
          name: "Grid",
          icon: Grid3X3,
          visible: showGrid,
          locked: false,
          isBaseLayer: true,
        },
      ]}
      onToggleVisibility={(id) => {
        if (id === "rivers") {
          toggleEditorLayer("rivers");
          return;
        }
        if (id === "altitude") {
          toggleEditorLayer("altitudes");
          return;
        }
        if (id === "grid") {
          setShowGrid((v) => !v);
          return;
        }
        setLayerStates((s) => ({
          ...s,
          [id]: { ...s[id]!, visible: !s[id]?.visible },
        }));
      }}
      onToggleLock={(id) => {
        setLayerStates((s) => ({
          ...s,
          [id]: { ...s[id]!, locked: !s[id]?.locked },
        }));
      }}
      onOpacityChange={(id, opacity) => {
        setLayerStates((s) => ({ ...s, [id]: { ...s[id]!, opacity } }));
      }}
      featureCounts={featureCounts}
    />
  );

  const renderRightPanelContent = () => {
    if (isWorldMode) {
      let mainContent: React.ReactNode = null;
      const inputClasses =
        "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground disabled:opacity-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

      if (activeEditorMode === "border_edit") {
        mainContent = (
          <BorderEditorPanel
            featureId={borderState.featureId}
            displayName={displayName || borderState.featureId || ""}
            geometry={borderState.geometry}
            neighbors={borderState.neighbors}
            mergeTargets={borderState.mergeTargets}
            onToggleMergeTarget={borderActions.toggleMergeTarget}
            mode={borderState.mode}
            areaKm2={borderState.areaKm2}
            isDirty={borderState.isDirty}
          />
        );
      } else if (activeEditorMode === "forge") {
        mainContent = (
          <FeaturePropertyPanel
            mode={editor.mode}
            cityForm={editor.cityForm}
            subdivisionForm={editor.subdivisionForm}
            poiForm={editor.poiForm}
            onCityFormChange={editor.setCityForm}
            onSubdivisionFormChange={editor.setSubdivisionForm}
            onPOIFormChange={editor.setPOIForm}
            storyPinForm={editor.storyPinForm}
            onStoryPinFormChange={editor.setStoryPinForm}
            mapLabelForm={editor.mapLabelForm}
            onMapLabelFormChange={editor.setMapLabelForm}
            pendingCoordinates={editor.pendingCoordinates}
            pendingGeometry={editor.pendingGeometry}
            isMutating={editor.isMutating}
            mutationError={editor.mutationError}
            lastSavedAt={editor.lastSavedAt}
            onSubmit={handleSubmit}
            onCancel={editor.resetForm}
            pointInfo={editor.pointInfo}
            isPointInfoLoading={editor.isPendingPointInfoLoading}
            countryId={activeCountryId ?? undefined}
            routeWaypoints={editor.routeWaypoints}
            finishRoute={editor.finishRoute}
            undoLastWaypoint={editor.undoLastWaypoint}
            clearRouteWaypoints={editor.clearRouteWaypoints}
            selectedRouteId={selectedRouteId}
            onSelectRouteId={setSelectedRouteId}
            allFeatures={editor.allFeatures}
          />
        );
      } else if (mapSelectedCountry) {
        const inputClasses =
          "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground disabled:opacity-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
        mainContent = (
          <div className="space-y-4 text-xs">
            <div className="space-y-3">
              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-semibold uppercase">
                  Feature Name
                </label>
                <input
                  type="text"
                  value={editableFeatureName}
                  onChange={(e) => setEditableFeatureName(e.target.value)}
                  className={inputClasses}
                />
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-semibold uppercase">
                  Country Linkage
                </label>
                <select
                  value={editableCountryLinkageId}
                  onChange={(e) => setEditableCountryLinkageId(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">No Country (Orphaned)</option>
                  {countries.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-semibold uppercase">
                  Wiki Integration (Linked Country)
                </label>
                <input
                  type="text"
                  value={wikiPageTitle}
                  onChange={(e) => setWikiPageTitle(e.target.value)}
                  disabled={!editableCountryLinkageId}
                  placeholder={
                    editableCountryLinkageId ? "Wiki Page Title" : "Link a country first"
                  }
                  className={inputClasses}
                />
              </div>

              {/* Common Attributes */}
              <div className="border-t border-border/30 pt-3 space-y-2">
                <label className="text-muted-foreground block text-[10px] font-semibold uppercase">
                  Common Attributes
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground mb-1 block text-[9px] uppercase">
                      Subdivision Type
                    </label>
                    <select
                      value={parsedProperties.subdivisionType || ""}
                      onChange={(e) => {
                        const newProps = { ...parsedProperties, subdivisionType: e.target.value || undefined };
                        setPropertiesJsonString(JSON.stringify(newProps, null, 2));
                      }}
                      className={inputClasses}
                    >
                      <option value="">None</option>
                      <option value="state">State</option>
                      <option value="province">Province</option>
                      <option value="territory">Territory</option>
                      <option value="district">District</option>
                      <option value="prefecture">Prefecture</option>
                      <option value="region">Region</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground mb-1 block text-[9px] uppercase">
                      Population
                    </label>
                    <input
                      type="number"
                      value={parsedProperties.population || ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        const newProps = { ...parsedProperties, population: isNaN(val as any) ? undefined : val };
                        setPropertiesJsonString(JSON.stringify(newProps, null, 2));
                      }}
                      placeholder="e.g. 5000000"
                      className={inputClasses}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground mb-1 block text-[9px] uppercase">
                      Climate
                    </label>
                    <input
                      type="text"
                      value={parsedProperties.climate || ""}
                      onChange={(e) => {
                        const newProps = { ...parsedProperties, climate: e.target.value || undefined };
                        setPropertiesJsonString(JSON.stringify(newProps, null, 2));
                      }}
                      placeholder="e.g. Temperate"
                      className={inputClasses}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="prop-is-capital"
                      checked={!!parsedProperties.isCapital}
                      onChange={(e) => {
                        const newProps = { ...parsedProperties, isCapital: e.target.checked };
                        setPropertiesJsonString(JSON.stringify(newProps, null, 2));
                      }}
                      className="rounded border-border bg-background text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="prop-is-capital" className="text-[10px] text-muted-foreground cursor-pointer select-none">
                      Is Capital / Hub
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleSaveFeatureProperties}
                  disabled={updatePropertiesMutation.isPending}
                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  {updatePropertiesMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Save Changes
                    </>
                  )}
                </button>

                {mapSelectedCountry.countryId ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setActiveEditorMode("forge");
                        setActiveSidebarTab("features");
                      }}
                      className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Forge
                    </button>
                    <button
                      onClick={() => handleUnlink(mapSelectedCountry.featureId)}
                      disabled={unlinkMutation.isPending}
                      className="bg-red-650/10 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-600/20"
                    >
                      <UnlinkIcon className="h-3.5 w-3.5" />
                      Unlink
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAssignLink(mapSelectedCountry.featureId)}
                    disabled={
                      (!assignCountryId && !editableCountryLinkageId) || assignMutation.isPending
                    }
                    className="bg-blue-650 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Assign Linkage
                  </button>
                )}

                <button
                  onClick={() => {
                    if (mapSelectedCountry.featureId) {
                      borderActions.loadFeature(mapSelectedCountry.featureId);
                      setDisplayName(mapSelectedCountry.displayName);
                      setActiveEditorMode("border_edit");
                    }
                  }}
                  className="bg-emerald-650 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Borders
                </button>
              </div>
            </div>

            {/* Geographic Metadata */}
            <div className="border-border/40 space-y-2 border-t pt-3">
              <label className="text-muted-foreground block text-[10px] font-semibold uppercase">
                Geographic Metadata
              </label>
              <div className="bg-muted/30 space-y-1.5 rounded-lg p-2.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Area</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground font-medium">
                      {featureDetails?.areaSqKm
                        ? Math.round(featureDetails.areaSqKm).toLocaleString()
                        : "0"}{" "}
                      km²
                    </span>
                    <button
                      onClick={() => {
                        if (mapSelectedCountry?.featureId) {
                          recalculateAreaMutation.mutate({
                            featureId: mapSelectedCountry.featureId,
                          });
                        }
                      }}
                      disabled={recalculateAreaMutation.isPending}
                      className="text-blue-500 hover:text-blue-600 disabled:opacity-50"
                      title="Recalculate Area using PostGIS"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${recalculateAreaMutation.isPending ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Centroid</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground">
                      {featureDetails?.centroid
                        ? `${(featureDetails.centroid as any).coordinates[1].toFixed(3)}, ${(featureDetails.centroid as any).coordinates[0].toFixed(3)}`
                        : "N/A"}
                    </span>
                    {featureDetails?.centroid && (
                      <button
                        onClick={() => {
                          const coords = (featureDetails.centroid as any).coordinates;
                          mapRef.current?.flyTo(coords[0], coords[1], 5);
                        }}
                        className="text-blue-500 hover:text-blue-600"
                        title="Center map on centroid"
                      >
                        <Crosshair className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Bounding Box</span>
                  <span className="text-foreground text-[10px] leading-tight break-all">
                    {featureDetails?.boundingBox
                      ? JSON.stringify(featureDetails.boundingBox)
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Properties JSON Viewer/Editor */}
            <div className="border-border/40 space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground block text-[10px] font-semibold uppercase">
                  GeoJSON Attributes & Custom Properties
                </label>
                <button
                  onClick={() => {
                    setIsEditingJson((v) => !v);
                    setJsonError(null);
                  }}
                  className="text-[10px] text-blue-500 hover:underline"
                >
                  {isEditingJson ? "Cancel" : "Edit JSON"}
                </button>
              </div>

              {isEditingJson ? (
                <div className="space-y-2">
                  <textarea
                    value={propertiesJsonString}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPropertiesJsonString(val);
                      try {
                        JSON.parse(val);
                        setJsonError(null);
                      } catch (err: any) {
                        setJsonError(err.message || "Invalid JSON syntax");
                      }
                    }}
                    rows={8}
                    className="border-border bg-background text-foreground w-full rounded-lg border px-3 py-2 font-mono text-[11px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  {jsonError && (
                    <p className="text-[10px] leading-tight font-medium text-red-500">
                      Error: {jsonError}
                    </p>
                  )}
                  <button
                    onClick={handleSaveFeatureProperties}
                    disabled={!!jsonError || updatePropertiesMutation.isPending}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save JSON Attributes
                  </button>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  {featureDetails?.properties ? (
                    <JsonViewer
                      data={featureDetails.properties}
                      rootName="properties"
                      defaultExpanded={1}
                    />
                  ) : (
                    <p className="text-muted-foreground text-[10px] italic">
                      No attributes loaded.
                    </p>
                  )}
                </div>
              )}
            </div>

            {activeCountryId && (
              <div className="border-border/40 space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground block text-[10px] font-semibold uppercase">
                    Sovereignty Info
                  </label>
                  <button
                    onClick={() => {
                      setSovereigntyForm({
                        sovereignId: activeCountryId,
                        subjectId: "",
                        relationshipType: "crown_possession",
                        autonomyLevel: 50,
                        description: "",
                        establishedDate: "",
                      });
                      setShowSovereigntyForm(true);
                      setActiveSidebarTab("sovereignty");
                    }}
                    className="text-[10px] text-blue-500 hover:underline"
                  >
                    + Add
                  </button>
                </div>

                <div className="space-y-1.5">
                  {countryRelations.length === 0 ? (
                    <p className="text-muted-foreground text-[10px] italic">No active relations.</p>
                  ) : (
                    countryRelations.map((rel) => (
                      <div
                        key={rel.id}
                        className="bg-muted/20 border-border/30 flex items-center justify-between rounded border p-1.5 text-[11px]"
                      >
                        <div className="truncate">
                          <span className="text-foreground font-semibold">{rel.sovereignName}</span>
                          <span className="text-muted-foreground mx-1 text-[10px]">➔</span>
                          <span className="text-foreground">{rel.subjectName}</span>
                        </div>
                        <span className="ml-1 shrink-0 rounded-sm bg-blue-500/10 px-1 text-[9px] text-blue-500">
                          {typeLabel(rel.relationshipType)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        );
      } else if (activeCountryId) {
        const unlinkedFeatures = featureList
          ? featureList.filter((f) => !f.countryId && !f.isClaimed)
          : [];
        mainContent = (
          <div className="space-y-4 text-xs animate-[fadeIn_0.2s_ease-out]">
            {/* Header / Identity */}
            <div className="flex items-center gap-3 border-b border-border/40 pb-3">
              {countryInfo?.flagUrl ? (
                <img
                  src={countryInfo.flagUrl}
                  alt={`${countryInfo.name} Flag`}
                  className="h-8 w-12 rounded object-cover shadow-md"
                />
              ) : (
                <div className="flex h-8 w-12 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                  No Flag
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  {countryInfo?.name || "Loading..."}
                </h4>
                <span className="text-[10px] text-muted-foreground">
                  Country Identity
                </span>
              </div>
            </div>

            {/* Warning status */}
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-amber-500">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">Unlinked Country</p>
                  <p className="text-[10px] leading-relaxed text-amber-500/80 mt-1">
                    This country is not currently linked to any political map feature geometry.
                  </p>
                </div>
              </div>
            </div>

            {/* Dropdown & assign button */}
            <div className="space-y-3">
              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-semibold uppercase">
                  Available Map Features
                </label>
                <select
                  value={unlinkedFeatureIdToAssign}
                  onChange={(e) => setUnlinkedFeatureIdToAssign(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">-- Select an unlinked feature --</option>
                  {unlinkedFeatures.map((f) => (
                    <option key={f.featureId} value={f.featureId}>
                      {f.displayName || f.featureId} ({f.featureId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    if (!unlinkedFeatureIdToAssign) return;
                    assignMutation.mutate({
                      featureId: unlinkedFeatureIdToAssign,
                      countryId: activeCountryId,
                    }, {
                      onSuccess: () => {
                        setUnlinkedFeatureIdToAssign("");
                      }
                    });
                  }}
                  disabled={!unlinkedFeatureIdToAssign || assignMutation.isPending}
                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {assignMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-3.5 w-3.5" />
                      Assign Linkage
                    </>
                  )}
                </button>

                {!!countryInfo?.geometry && (
                  <button
                    onClick={() => {
                      setActiveEditorMode("forge");
                      setActiveSidebarTab("features");
                    }}
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Forge
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      } else {
        mainContent = (
          <div className="border-border/40 flex h-full flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
            <Info className="text-muted-foreground/50 mb-2 h-8 w-8 animate-bounce" />
            <p className="text-foreground text-sm font-medium">No Feature Selected</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Click a feature on the map to inspect properties, rename, adjust linkages or
              manipulate borders.
            </p>
          </div>
        );
      }

      return (
        <div className="flex h-full flex-col justify-between gap-4">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{mainContent}</div>
          <div className="border-border mt-auto border-t pt-4">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <Layers className="text-muted-foreground h-3.5 w-3.5" />
              <h3 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Layers
              </h3>
            </div>
            <div className="max-h-[220px] overflow-y-auto pr-1">{renderLayersElement()}</div>
          </div>
        </div>
      );
    }

    return (
      <FeaturePropertyPanel
        mode={editor.mode}
        cityForm={editor.cityForm}
        subdivisionForm={editor.subdivisionForm}
        poiForm={editor.poiForm}
        onCityFormChange={editor.setCityForm}
        onSubdivisionFormChange={editor.setSubdivisionForm}
        onPOIFormChange={editor.setPOIForm}
        storyPinForm={editor.storyPinForm}
        onStoryPinFormChange={editor.setStoryPinForm}
        mapLabelForm={editor.mapLabelForm}
        onMapLabelFormChange={editor.setMapLabelForm}
        pendingCoordinates={editor.pendingCoordinates}
        pendingGeometry={editor.pendingGeometry}
        isMutating={editor.isMutating}
        mutationError={editor.mutationError}
        lastSavedAt={editor.lastSavedAt}
        onSubmit={handleSubmit}
        onCancel={editor.resetForm}
        pointInfo={editor.pointInfo}
        isPointInfoLoading={editor.isPendingPointInfoLoading}
        countryId={activeCountryId ?? undefined}
        routeWaypoints={editor.routeWaypoints}
        finishRoute={editor.finishRoute}
        undoLastWaypoint={editor.undoLastWaypoint}
        clearRouteWaypoints={editor.clearRouteWaypoints}
        selectedRouteId={selectedRouteId}
        onSelectRouteId={setSelectedRouteId}
        allFeatures={editor.allFeatures}
      />
    );
  };

  // ── Editor Render ──
  return (
    <div className="bg-background absolute inset-0 z-30 flex flex-col">
      {/* Loading splash — fades out when data is ready */}
      {showLoadingScreen && <EditorLoadingScreen countryName={countryInfo?.name} />}

      {/* ── Title Bar ── */}
      <div className="border-border bg-card flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <button
          onClick={handleRequestExit}
          className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5 transition-colors"
          title="Close Editor (Esc)"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {isWorldMode ? (
            <>
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-foreground font-semibold">WorldEditor</span>
              {activeCountryId && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground font-semibold">{countryInfo?.name ?? "…"}</span>
                </>
              )}
              <ChevronRight className="h-3 w-3" />
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-500">
                {activeEditorMode === "border_edit"
                  ? "BORDER EDIT"
                  : activeEditorMode === "forge"
                    ? "FORGE"
                    : "VIEW"}
              </span>
            </>
          ) : (
            <>
              <Map className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-foreground font-semibold">{countryInfo?.name ?? "…"}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{forgeMode ? "Forge Mode" : "Map Editor"}</span>
            </>
          )}
        </div>

        {/* Undo/Redo — left side after breadcrumb */}
        {(!isWorldMode || activeEditorMode === "forge") && (
          <div className="ml-2 flex items-center gap-0.5">
            <button
              disabled={!editor.historyCanUndo}
              onClick={() => editor.undo()}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={!editor.historyCanRedo}
              onClick={() => editor.redo()}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Save indicator */}
        {(!isWorldMode || activeEditorMode === "forge") && editor.isMutating && (
          <span className="ml-2 animate-pulse text-[10px] text-amber-500">Saving…</span>
        )}
        {(!isWorldMode || activeEditorMode === "forge") &&
          !editor.isMutating &&
          editor.lastSavedAt && <span className="ml-2 text-[10px] text-emerald-500">Saved</span>}

        <div className="ml-auto" />

        <div className="bg-border h-4 w-px" />

        {/* Map controls in header — grid, center */}
        <div className="ml-1 flex items-center gap-0.5">
          {/* Grid + Center */}
          <button
            onClick={() => setShowGrid((v) => !v)}
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
              showGrid
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Toggle Grid (G)"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              const geo = editor.countryGeo;
              if (geo?.centroid) {
                mapRef.current?.flyTo(geo.centroid.lng, geo.centroid.lat, 5);
              }
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors"
            title="Center on Country"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Bulk delete — shown when multi-select has items */}
        {editor.selectedIds.size > 0 && (
          <button
            onClick={async () => {
              if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
              await editor.bulkDeleteSelected();
            }}
            className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-500/20 dark:text-red-400"
          >
            Delete {editor.selectedIds.size} Selected
          </button>
        )}

        {/* Simplify All Regions — available to all users with regions */}
        {editor.allFeatures.some((f) => f.type === "subdivision") && (
          <div className="mr-1">
            <button
              onClick={async () => {
                if (!activeCountryId) return;
                try {
                  const result = await simplifyAll.mutateAsync({
                    countryId: activeCountryId,
                    targetVerticesPerProvince: 100,
                  });
                  alert(
                    `Simplified ${result.updated}/${result.total} regions\n` +
                      `Vertices: ${result.verticesBefore.toLocaleString()} → ${result.verticesAfter.toLocaleString()} (${result.reduction}% reduction)`
                  );
                } catch (e) {
                  alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                }
              }}
              disabled={simplifyAll.isPending || !activeCountryId}
              className="flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-500/20 disabled:opacity-50 dark:text-violet-400"
              title="Simplify all regions — reduce vertices while preserving shape"
            >
              <Minimize2 className={`h-3 w-3 ${simplifyAll.isPending ? "animate-pulse" : ""}`} />
              {simplifyAll.isPending ? "Simplifying..." : "Simplify All"}
            </button>
          </div>
        )}

        {/* Admin: Forge Mode toggle + actions */}
        {isAdmin && (
          <div
            className={`${editor.allFeatures.some((f) => f.type === "subdivision") ? "" : "ml-auto"} flex items-center gap-1.5`}
          >
            {/* Rivers/elevation icons moved next to Forge button */}
            <button
              onClick={() => toggleEditorLayer("rivers")}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                editorVisibleLayers.has("rivers")
                  ? "bg-blue-500/15 text-blue-500"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title="Rivers"
            >
              <Droplets className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => toggleEditorLayer("altitudes")}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                editorVisibleLayers.has("altitudes")
                  ? "bg-amber-500/15 text-amber-500"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title="Altitude/Elevation"
            >
              <MountainIcon className="h-3.5 w-3.5" />
            </button>

            <div className="bg-border mx-0.5 h-4 w-px" />

            <button
              onClick={() => {
                if (isWorldMode) {
                  if (activeEditorMode === "forge") {
                    setActiveEditorMode("view");
                    editor.setMode("view");
                  } else {
                    setActiveEditorMode("forge");
                  }
                } else {
                  setForgeMode((v) => !v);
                }
              }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                isWorldMode
                  ? activeEditorMode === "forge"
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  : forgeMode
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title={
                isWorldMode
                  ? "Toggle Forge Mode (editing features)"
                  : "Toggle Forge Mode (admin superpowers)"
              }
            >
              <Sparkles className="h-3 w-3" />
              Forge
            </button>
            {(isWorldMode ? activeEditorMode === "forge" : forgeMode) && activeCountryId && (
              <>
                <button
                  onClick={async () => {
                    try {
                      const result = await generateTransport.mutateAsync({
                        countryId: activeCountryId,
                        routeTypes: ["rail", "highway"],
                        clearExisting: true,
                      });
                      alert(
                        `Generated ${result.routesCreated} routes (${result.totalLengthKm} km)`
                      );
                    } catch (e) {
                      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                    }
                  }}
                  disabled={generateTransport.isPending}
                  className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-500/20 disabled:opacity-50 dark:text-indigo-400"
                >
                  <Train className="h-3 w-3" />
                  {generateTransport.isPending ? "..." : "Gen Transport"}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await recalculateGeo.mutateAsync({ countryId: activeCountryId });
                      alert("Geographic profile recalculated");
                    } catch (e) {
                      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                    }
                  }}
                  disabled={recalculateGeo.isPending}
                  className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${recalculateGeo.isPending ? "animate-spin" : ""}`}
                  />
                  Recalc
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Tool Options Bar (Photoshop-style context bar) ── */}
      {(!isWorldMode || activeEditorMode === "forge") && (
        <EditorErrorBoundary name="ToolOptions">
          <ToolOptionsBar
            mode={editor.mode}
            cityType={editor.cityForm.cityType}
            onCityTypeChange={(type) => editor.setCityForm((f) => ({ ...f, cityType: type }))}
            isNationalCapital={editor.cityForm.isNationalCapital}
            onCapitalChange={(val) => editor.setCityForm((f) => ({ ...f, isNationalCapital: val }))}
            subdivisionType={editor.subdivisionForm.type}
            onSubdivisionTypeChange={(type) => editor.setSubdivisionForm((f) => ({ ...f, type }))}
            subdivisionLevel={editor.subdivisionForm.level}
            onSubdivisionLevelChange={(level) =>
              editor.setSubdivisionForm((f) => ({ ...f, level }))
            }
            poiCategory={editor.poiForm.category}
            onPoiCategoryChange={(cat) => editor.setPOIForm((f) => ({ ...f, category: cat }))}
            storyCategory={editor.storyPinForm.category}
            onStoryCategoryChange={(cat) =>
              editor.setStoryPinForm((f) => ({ ...f, category: cat }))
            }
            labelFontSize={editor.mapLabelForm.fontSize}
            onLabelFontSizeChange={(size) =>
              editor.setMapLabelForm((f) => ({ ...f, fontSize: size }))
            }
            labelColor={editor.mapLabelForm.color}
            onLabelColorChange={(color) => editor.setMapLabelForm((f) => ({ ...f, color }))}
            labelBold={editor.mapLabelForm.fontWeight === "bold"}
            onLabelBoldChange={(bold) =>
              editor.setMapLabelForm((f) => ({ ...f, fontWeight: bold ? "bold" : "normal" }))
            }
            paintMode={paintMapMode}
            onPaintModeChange={(m) => setPaintMapMode(m as any)}
            selectedCount={editor.selectedIds.size}
            onDelete={
              editor.selectedIds.size > 0
                ? async () => {
                    if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
                    await editor.bulkDeleteSelected();
                  }
                : undefined
            }
          />
        </EditorErrorBoundary>
      )}

      {/* ── Main content: Rail + Canvas + Panel ── */}
      <div className="flex min-h-0 flex-1">
        {/* Left tool rail — desktop only */}
        <div className="hidden sm:block">
          {isWorldMode && activeEditorMode === "border_edit" ? (
            <div className="border-border bg-card/45 z-10 flex h-full w-12 shrink-0 flex-col items-center gap-2 border-r py-3">
              <button
                onClick={() => borderActions.setMode("select")}
                className={`rounded-md p-2 transition-colors ${
                  borderState.mode === "select"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title="Select Mode"
              >
                <MousePointer2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => borderActions.setMode("vertex_edit")}
                className={`rounded-md p-2 transition-colors ${
                  borderState.mode === "vertex_edit"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title="Edit Vertices"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => borderActions.setMode("split")}
                className={`rounded-md p-2 transition-colors ${
                  borderState.mode === "split"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title="Split Borders"
              >
                <Scissors className="h-4 w-4" />
              </button>
              <button
                onClick={() => borderActions.setMode("merge")}
                className={`rounded-md p-2 transition-colors ${
                  borderState.mode === "merge"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title="Merge Borders"
              >
                <Merge className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <MapEditorToolbar
              mode={editor.mode}
              onModeChange={editor.setMode}
              disabled={isWorldMode ? false : toolsDisabled}
              disabledTools={disabledTools}
            />
          )}
        </div>

        {/* Map canvas */}
        <div className="relative min-w-0 flex-1">
          <EditorErrorBoundary name="Map">
            {isWorldMode && activeEditorMode === "view" ? (
              <MapContainer
                showControls={true}
                showTools={false}
                showPopup={false}
                selectedCountryId={activeCountryId}
                onCountrySelect={handleMapSelect}
                forceFlatProjection={true}
                controlledVisibleLayers={editorVisibleLayers}
                onToggleLayer={toggleEditorLayer}
                hideEditButtons={true}
              />
            ) : isWorldMode && activeEditorMode === "border_edit" ? (
              <BorderEditorMap
                geometry={borderState.geometry}
                neighborGeometries={neighborGeoms}
                mode={borderState.mode}
                splitLine={borderState.splitLine}
                mergeTargets={borderState.mergeTargets}
                selectedVertex={borderState.selectedVertex}
                onMapClick={borderActions.handleMapClick}
                onVertexDrag={borderActions.handleVertexDrag}
                onDragEnd={borderActions.commitDrag}
              />
            ) : (
              <EditorMap
                ref={mapRef}
                countryGeometry={editor.countryGeo?.geometry ?? null}
                countryCentroid={editor.countryGeo?.centroid ?? null}
                countryBbox={editor.countryGeo?.bbox ?? null}
                features={editor.allFeatures}
                mode={editor.mode}
                pendingCoordinates={editor.pendingCoordinates}
                pendingGeometry={editor.pendingGeometry}
                selectedFeature={editor.selectedFeature}
                onMapClick={editor.handleMapClick}
                onDrawComplete={editor.handleDrawComplete}
                onFeatureSelect={handleSelectFeature}
                onGeometryUpdate={editor.updateSubdivisionGeometry}
                worldMapLayers={worldMapLayers}
                showGrid={showGrid}
                paintColors={paintColors}
                routeWaypoints={editor.routeWaypoints}
                layerVisibility={{
                  regions: layerStates.regions?.visible ?? true,
                  cities: layerStates.cities?.visible ?? true,
                  pois: layerStates.pois?.visible ?? true,
                  stories: layerStates.stories?.visible ?? true,
                  labels: layerStates.labels?.visible ?? true,
                  routes: layerStates.routes?.visible ?? true,
                }}
              />
            )}

            {/* Border Editor Toolbar Overlay (only visible in border edit mode) */}
            {activeEditorMode === "border_edit" && borderState.featureId && (
              <div className="absolute top-3 left-3 z-20">
                <BorderEditorToolbar
                  mode={borderState.mode}
                  onModeChange={borderActions.setMode}
                  canUndo={borderState.isDirty && borderState.undoStackState.position >= 0}
                  canRedo={
                    borderState.isDirty &&
                    borderState.undoStackState.position <
                      borderState.undoStackState.entries.length - 1
                  }
                  onUndo={borderActions.undo}
                  onRedo={borderActions.redo}
                  onSave={() => void borderActions.save()}
                  onSubmit={handleBorderToolbarSubmit}
                  onCancel={() => {
                    borderActions.reset();
                    setActiveEditorMode("view");
                  }}
                  isDirty={borderState.isDirty}
                  isSaving={isSubmitting}
                  areaKm2={borderState.areaKm2}
                  splitPointCount={borderState.splitLine.length}
                />
              </div>
            )}

            {/* Paint mode legend */}
            {editor.mode === "paint" && (
              <div className="border-border bg-card/90 absolute bottom-8 left-3 z-20 rounded-lg border px-3 py-2 shadow-md backdrop-blur-sm">
                <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                  {paintMapMode === "wiki"
                    ? "Wiki Coverage"
                    : paintMapMode.charAt(0).toUpperCase() + paintMapMode.slice(1)}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[9px]">Low</span>
                  <div
                    className="h-2.5 w-24 rounded-sm"
                    style={{
                      background:
                        paintMapMode === "wiki"
                          ? "linear-gradient(to right, hsl(0,70%,50%), hsl(60,70%,50%), hsl(120,70%,50%))"
                          : "linear-gradient(to right, hsl(60,80%,50%), hsl(30,80%,45%), hsl(0,80%,40%))",
                    }}
                  />
                  <span className="text-muted-foreground text-[9px]">High</span>
                </div>
              </div>
            )}

            {/* Region stats tooltip — hover over subdivisions in view mode */}
            {hoveredFeature && (editor.mode === "view" || editor.mode === "paint") && (
              <div
                className="border-border bg-card/95 pointer-events-none absolute z-20 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm"
                style={{
                  left: hoveredFeature.screenPos.x + 12,
                  top: hoveredFeature.screenPos.y - 8,
                  maxWidth: 220,
                }}
              >
                <div className="text-foreground text-xs font-semibold">
                  {hoveredFeature.feature.name}
                </div>
                <div className="text-muted-foreground mt-1 space-y-0.5 text-[10px]">
                  <div className="flex justify-between gap-3">
                    <span>Type</span>
                    <span className="text-foreground font-medium">
                      {hoveredFeature.feature.properties.subdivisionType ??
                        hoveredFeature.feature.type}
                    </span>
                  </div>
                  {hoveredFeature.feature.properties.areaSqKm != null && (
                    <div className="flex justify-between gap-3">
                      <span>Area</span>
                      <span className="text-foreground font-medium tabular-nums">
                        {Number(hoveredFeature.feature.properties.areaSqKm).toLocaleString()} km²
                      </span>
                    </div>
                  )}
                  {hoveredFeature.feature.properties.population != null && (
                    <div className="flex justify-between gap-3">
                      <span>Population</span>
                      <span className="text-foreground font-medium tabular-nums">
                        {Number(hoveredFeature.feature.properties.population).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {hoveredFeature.feature.geometry && (
                    <div className="flex justify-between gap-3">
                      <span>Vertices</span>
                      <span className="text-foreground font-medium tabular-nums">
                        {countGeometryVertices(hoveredFeature.feature.geometry)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Province import preview overlay — only shown during import wizard */}
            {editor.mode === "import-provinces" &&
              importer.currentProvinces.length > 0 &&
              mapInstance && (
                <ProvincePreviewLayer
                  map={mapInstance}
                  provinces={importer.currentProvinces}
                  countryBorder={importer.countryBorder}
                  visible
                />
              )}

            {/* Transport routes overlay */}
            {transportRouteData && mapInstance && (
              <TransportOverlay
                map={mapInstance}
                routeData={transportRouteData}
                visible={layerStates.routes?.visible ?? true}
                selectedRouteId={selectedRouteId}
                onRouteClick={handleRouteClick}
              />
            )}
          </EditorErrorBoundary>
        </div>

        {/* Left collapsible panel — desktop only */}
        {(!toolsDisabled || isWorldMode) && (
          <div className="hidden h-full sm:flex">
            <EditorErrorBoundary name="LeftPanel">
              <EditorPanel
                side="left"
                mode={editor.mode}
                collapsed={leftPanelCollapsed}
                onToggleCollapse={() => setLeftPanelCollapsed((v) => !v)}
                isWorldMode={isWorldMode}
                activeTabOverride={activeSidebarTab}
                onTabChange={(tab) => setActiveSidebarTab(tab as any)}
                linkagesContent={renderLinkagesContent()}
                sovereigntyContent={renderSovereigntyContent()}
                featureCount={editor.allFeatures.length}
                featuresLoading={editor.featuresLoading}
                featureListContent={
                  <FeatureList
                    features={editor.allFeatures}
                    selectedFeature={editor.selectedFeature}
                    onSelectFeature={handleSelectFeature}
                    onEditFeature={handleEditFeature}
                    onDeleteFeature={handleDeleteFeature}
                    isLoading={editor.featuresLoading}
                    selectedIds={editor.selectedIds}
                    onToggleSelect={editor.toggleSelectId}
                    collapseAll={
                      editor.mode.startsWith("add-") ||
                      editor.mode.startsWith("edit-") ||
                      editor.mode === "paint"
                    }
                  />
                }
                layersContent={!isWorldMode ? renderLayersElement() : undefined}
                importWizardContent={
                  editor.mode === "import-provinces" ? (
                    <ProvinceImportWizard
                      importer={importer}
                      onComplete={() => {
                        editor.setMode("view");
                        editor.refetchFeatures();
                      }}
                      onCancel={() => {
                        importer.reset();
                        editor.setMode("view");
                      }}
                    />
                  ) : undefined
                }
              />
            </EditorErrorBoundary>
          </div>
        )}

        {/* Right collapsible panel (Properties & Form Context) — desktop only */}
        {showRightPanel && (
          <div className="hidden h-full sm:flex">
            <EditorErrorBoundary name="RightPanel">
              <EditorPanel
                side="right"
                mode={editor.mode}
                collapsed={rightPanelCollapsed}
                onToggleCollapse={() => setRightPanelCollapsed((v) => !v)}
                propertiesContent={renderRightPanelContent()}
              />
            </EditorErrorBoundary>
          </div>
        )}
      </div>

      {/* ── Mobile: bottom tool rail ── */}
      <div className="sm:hidden">
        <MapEditorToolbar
          mode={editor.mode}
          onModeChange={editor.setMode}
          disabled={isWorldMode ? false : toolsDisabled}
          disabledTools={disabledTools}
          horizontal
        />
      </div>

      {/* ── Status Bar ── */}
      <EditorStatusBar
        cursorCoords={cursorCoords}
        mode={editor.mode}
        terrainInfo={
          cursorTerrainInfo
            ? {
                elevation: cursorTerrainInfo.elevation?.zoneName ?? null,
                climate: cursorTerrainInfo.climate?.climateName ?? null,
              }
            : editor.pointInfo
              ? {
                  elevation: editor.pointInfo.elevation?.zoneName ?? null,
                  climate: editor.pointInfo.climate?.climateName ?? null,
                }
              : null
        }
        zoom={cursorZoom}
        featureCount={editor.allFeatures.length}
      />

      {/* ── Mobile sheets ── */}
      {editor.mode !== "view" && editor.mode !== "import-provinces" && (
        <div className="sm:hidden">
          <MobileEditorSheet
            onClose={() => editor.resetForm()}
            title="Properties"
            isEditMode={
              editor.mode.startsWith("add-") ||
              editor.mode.startsWith("edit-") ||
              editor.mode === "paint"
            }
            featureListContent={
              <FeatureList
                features={editor.allFeatures}
                selectedFeature={editor.selectedFeature}
                onSelectFeature={handleSelectFeature}
                onEditFeature={handleEditFeature}
                onDeleteFeature={handleDeleteFeature}
                isLoading={editor.featuresLoading}
              />
            }
          >
            {renderRightPanelContent()}
          </MobileEditorSheet>
        </div>
      )}
      {/* Batch Actions Bar — shown when multi-select is active */}
      {editor.selectedIds.size > 1 && (
        <BatchActionsBar
          selectedCount={editor.selectedIds.size}
          onBatchDelete={async () => {
            if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
            await editor.bulkDeleteSelected();
          }}
          onDeselectAll={editor.clearMultiSelect}
          isMutating={editor.isMutating}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <FeatureContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          feature={contextMenu.feature}
          onEdit={() => {
            const feat = editor.allFeatures.find((f) => f.id === contextMenu.feature.id);
            if (feat) editor.startEditing(feat);
            setContextMenu(null);
          }}
          onDuplicate={() => {
            setContextMenu(null);
          }}
          onDelete={() => {
            editor.handleDeleteFeature(contextMenu.feature.id, contextMenu.feature.type as any);
            setContextMenu(null);
          }}
          onCopyCoords={() => {
            const feat = editor.allFeatures.find((f) => f.id === contextMenu.feature.id);
            if (feat && "coordinates" in feat && Array.isArray(feat.coordinates)) {
              navigator.clipboard.writeText(`${feat.coordinates[1]}, ${feat.coordinates[0]}`);
            }
            setContextMenu(null);
          }}
          onOpenWiki={
            contextMenu.feature.wikiPageTitle
              ? () => {
                  window.open(
                    `https://ixwiki.com/wiki/${encodeURIComponent(contextMenu.feature.wikiPageTitle!.replace(/ /g, "_"))}`,
                    "_blank"
                  );
                  setContextMenu(null);
                }
              : undefined
          }
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Keyboard Shortcut Sheet */}
      {showShortcuts && <KeyboardShortcutSheet onClose={() => setShowShortcuts(false)} />}

      {/* Split Dialog */}
      {showSplitDialog && borderState.featureId && (
        <SplitMergeDialog
          type="split"
          featureName={displayName || borderState.featureId || ""}
          onConfirm={handleSplitConfirm}
          onCancel={() => setShowSplitDialog(false)}
          isLoading={isSubmitting}
        />
      )}

      {/* Merge Dialog */}
      {showMergeDialog && borderState.featureId && (
        <SplitMergeDialog
          type="merge"
          featureNames={[displayName || borderState.featureId || "", ...borderState.mergeTargets]}
          onConfirm={handleMergeConfirm}
          onCancel={() => setShowMergeDialog(false)}
          isLoading={isSubmitting}
        />
      )}

      {/* Confirmation modal for border saving */}
      {showConfirmSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="border-border/40 bg-card/95 w-full max-w-md space-y-4 rounded-2xl border p-6 shadow-2xl backdrop-blur-md">
            <div className="border-border/30 flex items-center gap-2 border-b pb-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <h3 className="text-foreground text-lg font-bold">Confirm Border Changes</h3>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              You are about to save changes to feature border geometry. These changes will be
              applied directly to the map database.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground uppercase">
                Reason for Edit
              </label>
              <textarea
                value={saveReason}
                onChange={(e) => setSaveReason(e.target.value)}
                placeholder="e.g. Adjusted Caphiria boundary alignment..."
                className="border-border/40 bg-background text-foreground min-h-[80px] w-full rounded-lg border px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            <div className="border-border/30 flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setShowConfirmSaveModal(false)}
                className="rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBorderSave}
                disabled={!saveReason.trim() || isSubmitting}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/40 disabled:text-muted-foreground/50"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
          <div className="border-border/40 bg-card/95 w-full max-w-sm space-y-4 rounded-2xl border p-6 shadow-2xl backdrop-blur-md">
            <div className="border-border/30 flex items-center gap-2 border-b pb-2">
              <AlertCircle className="h-5 w-5 text-amber-500 animate-pulse" />
              <h3 className="text-foreground text-lg font-bold">Unsaved Changes</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              You have unsaved changes in the editor. Exiting now will discard these modifications.
            </p>
            <div className="border-border/30 flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
                className="rounded-lg bg-red-650 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editor Loading Screen ────────────────────────────────────────────

function EditorLoadingScreen({ countryName }: { countryName?: string | null }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a1628]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.06)_0%,_transparent_70%)]" />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        {/* Animated rings */}
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full border-2 border-dashed border-emerald-500/30" />
          <div className="absolute inset-3 animate-[spin_4s_linear_infinite_reverse] rounded-full border border-emerald-400/20" />
          <div className="absolute inset-6 animate-pulse rounded-full border border-emerald-300/15" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Map className="h-8 w-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          </div>
        </div>

        <div>
          <h2 className="text-foreground text-sm font-semibold">Loading Map Editor{dots}</h2>
          {countryName && <p className="text-muted-foreground mt-1 text-xs">{countryName}</p>}
        </div>

        <div className="text-muted-foreground/60 flex gap-4 text-[10px]">
          <span>Geometry</span>
          <span>Features</span>
          <span>Layers</span>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function countGeometryVertices(geometry: object): number {
  const geo = geometry as { type: string; coordinates: unknown };
  if (!geo.coordinates) return 0;
  if (geo.type === "Polygon") {
    return (geo.coordinates as number[][][]).reduce((s, ring) => s + ring.length, 0);
  }
  if (geo.type === "MultiPolygon") {
    return (geo.coordinates as number[][][][]).reduce(
      (s, poly) => s + poly.reduce((s2, ring) => s2 + ring.length, 0),
      0
    );
  }
  return 0;
}

// ── Error Boundary ──────────────────────────────────────────────────

interface ErrorBoundaryProps {
  name: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class EditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[EditorErrorBoundary:${this.props.name}]`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-muted-foreground text-xs">{this.props.name} encountered an error</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="bg-muted text-foreground hover:bg-accent rounded-md px-3 py-1 text-xs font-medium"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
