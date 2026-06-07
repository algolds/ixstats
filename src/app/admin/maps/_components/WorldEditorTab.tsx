"use client";

/**
 * WorldEditorTab - The ultimate consolidated maps editor for admins.
 *
 * Integrates:
 * - Interactive world map with click-to-inspect (formerly WorldMapManager)
 * - Feature Inspector (details & quick actions)
 * - Country linkage validation & manual assignments (formerly CountryAssigner / LinkageValidator)
 * - Sovereignty & Dependency CRUD (formerly SovereigntyManager)
 * - God-mode detailed editing workspace (formerly ForgeTab)
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Globe,
  Globe2,
  Loader2,
  Wand2,
  Train,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Search,
  FileImage,
  Download,
  ExternalLink,
  X,
  Trash2,
  Edit,
  Link as LinkIcon,
  Unlink as UnlinkIcon,
  Info,
  MapPin,
  ShieldAlert,
  Plus,
  ArrowLeft,
  Check,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useMapData } from "~/hooks/useMapData";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { MapContainer } from "~/components/maps/core/MapContainer";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import { SOVEREIGNTY_TYPES } from "~/lib/map-config";

// Forge Components
import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureList } from "~/components/maps/editor/FeatureList";
import {
  ProvinceImportWizard,
  ProvincePreviewLayer,
} from "~/components/maps/editor/province-importer";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";

// Lazy load heavy EditorMap
const EditorMap = dynamic(() => import("~/components/maps/editor/EditorMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted flex h-full items-center justify-center">
      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
    </div>
  ),
});

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

interface SovereigntyFormState {
  sovereignId: string;
  subjectId: string;
  relationshipType: string;
  autonomyLevel: number;
  description: string;
  establishedDate: string;
}

const EMPTY_SOVEREIGNTY_FORM: SovereigntyFormState = {
  sovereignId: "",
  subjectId: "",
  relationshipType: "crown_possession",
  autonomyLevel: 50,
  description: "",
  establishedDate: "",
};

export function WorldEditorTab() {
  // --- Global States ---
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [mapSelectedCountry, setMapSelectedCountry] = useState<SelectedCountry | null>(null);

  // --- Sidebar Accordion States ---
  const [linkageOpen, setLinkageOpen] = useState(true);
  const [sovereigntyOpen, setSovereigntyOpen] = useState(true);

  // --- Inspector Sidebar States (Full-Screen World Editor) ---
  const [inspectorTab, setInspectorTab] = useState<"properties" | "linkages" | "sovereignty">("linkages");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(380);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = inspectorWidth;
      const onMove = (me: MouseEvent) => {
        const delta = startX - me.clientX;
        const newW = Math.min(600, Math.max(300, startW + delta));
        setInspectorWidth(newW);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [inspectorWidth]
  );

  // --- Linkage / Assignment States ---
  const [featureSearch, setFeatureSearch] = useState("");
  const [featureFilter, setFeatureFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [assigningFeatureId, setAssigningFeatureId] = useState<string | null>(null);
  const [assignCountryId, setAssignCountryId] = useState("");
  const [validationTab, setValidationTab] = useState<"issues" | "linked" | "unlinked" | "features">("issues");

  // --- Sovereignty States ---
  const [sovereigntySearch, setSovereigntySearch] = useState("");
  const [sovereigntyTypeFilter, setSovereigntyTypeFilter] = useState("all");
  const [showSovereigntyForm, setShowSovereigntyForm] = useState(false);
  const [editingSovereigntyId, setEditingSovereigntyId] = useState<string | null>(null);
  const [sovereigntyForm, setSovereigntyForm] = useState<SovereigntyFormState>({ ...EMPTY_SOVEREIGNTY_FORM });

  const utils = api.useUtils();

  // --- Queries & Mutations ---
  const { data: featureList } = api.geoCore.listCountries.useQuery();
  const { data: dbCountries } = api.countries.getAll.useQuery({ limit: 500 }, { staleTime: 60_000 });
  const { data: relations, isLoading: relationsLoading } = api.geoSovereignty.getSovereigntyRelations.useQuery();
  const { data: validationData, isLoading: validationLoading, refetch: refetchValidation } =
    api.geoEditor.validateLinkage.useQuery(undefined, { staleTime: 10_000, retry: false });

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
      setSelectedCountryId(null);
    },
  });

  const syncMutation = api.geoEditor.repairLinkage.useMutation({
    onSuccess: () => {
      utils.geoEditor.validateLinkage.invalidate();
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getWorldMap.invalidate();
    },
  });

  const autoMatchMutation = api.geoEditor.repairLinkage.useMutation({
    onSuccess: () => {
      utils.geoEditor.validateLinkage.invalidate();
      utils.geoCore.listCountries.invalidate();
      utils.geoCore.getWorldMap.invalidate();
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

  // --- Memoized Computations ---
  const countries = useMemo(() => {
    const list = Array.isArray(dbCountries)
      ? dbCountries
      : (dbCountries as any)?.countries ?? [];
    return [...(list as any[])].sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [dbCountries]);

  const availableCountries = useMemo(() => {
    if (!countries || !featureList) return [];
    const assignedCountryIds = new Set(featureList.filter((f) => f.countryId).map((f) => f.countryId));
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
      if (sovereigntyTypeFilter !== "all" && r.relationshipType !== sovereigntyTypeFilter) return false;
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
    if (selectedCountryId) {
      return countries.find((c: any) => c.id === selectedCountryId)?.name ?? "";
    }
    return "";
  }, [mapSelectedCountry, selectedCountryId, countries]);

  // Specific country's sovereignty relations (if country selected)
  const countryRelations = useMemo(() => {
    if (!relations || !selectedCountryId) return [];
    return relations.filter(
      (r) => r.sovereignId === selectedCountryId || r.subjectId === selectedCountryId
    );
  }, [relations, selectedCountryId]);

  // --- Handlers ---
  const handleMapSelect = useCallback((country: SelectedCountry | null) => {
    setMapSelectedCountry(country);
    if (country?.countryId) {
      setSelectedCountryId(country.countryId);
      setInspectorTab("properties"); // Auto switch to properties tab when clicked
    } else if (country) {
      setSelectedCountryId(null);
      setInspectorTab("properties"); // Auto switch for orphaned features too
    } else {
      setSelectedCountryId(null);
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
    setSovereigntyForm({ ...EMPTY_SOVEREIGNTY_FORM });
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

  const typeLabel = (t: string) => SOVEREIGNTY_TYPES.find((s) => s.value === t)?.label ?? t;

  // ==========================================
  // FORGE EDIT MODE CODES & HOOKS (Only active if isEditing is true)
  // ==========================================

  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);
  const [cursorZoom, setCursorZoom] = useState<number | undefined>(undefined);
  const forgeMapRef = useRef<EditorMapRef>(null);

  // Map layers for editor background
  const { mapLayers } = useMapData(["background", "altitudes", "rivers", "lakes"]);

  // Editor hook — passes undefined when editing is inactive
  const editor = useMapEditor(isEditing && selectedCountryId ? selectedCountryId : undefined, {
    skipLinkageGate: true,
  });

  // Province importer — active when a country is selected and editing
  const importer = useProvinceImporter(isEditing && selectedCountryId ? selectedCountryId : "__none__");

  // Mutations
  const generateTransport = api.transport.generateRoutes.useMutation();
  const recalculateGeo = api.geoCore.recalculateGeoProfiles.useMutation();
  const deleteAllRegions = api.geoFeatures.deleteAllSubdivisions.useMutation();

  // Wiki province finder
  const [showWikiPanel, setShowWikiPanel] = useState(false);
  const [wikiSearchQuery, setWikiSearchQuery] = useState("");

  const { data: wikiProvinceScan, isLoading: scanLoading } = api.wiki.findProvinceMaps.useQuery(
    { countryName: selectedCountryName },
    { enabled: !!selectedCountryName && showWikiPanel && isEditing, staleTime: 10 * 60_000 }
  );

  const { data: wikiFileResults, isLoading: fileSearchLoading } = api.wiki.searchFiles.useQuery(
    { query: wikiSearchQuery, limit: 20, fileTypes: ["svg", "png"] },
    { enabled: wikiSearchQuery.length >= 2 && showWikiPanel && isEditing, staleTime: 5 * 60_000 }
  );

  const [importingFile, setImportingFile] = useState<string | null>(null);
  const handleImportFromWiki = useCallback(
    async (filename: string) => {
      setImportingFile(filename);
      try {
        const result = await utils.wiki.downloadFile.fetch({ filename });
        if (!result?.content) throw new Error("Empty file response");

        const binary = atob(result.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: result.mime });
        const file = new File([blob], filename, { type: result.mime });

        editor.setMode("import-provinces");
        setTimeout(() => {
          importer.handleUpload(file);
        }, 100);
        setShowWikiPanel(false);
      } catch (e) {
        alert(`Failed to import: ${e instanceof Error ? e.message : "Unknown error"}`);
      } finally {
        setImportingFile(null);
      }
    },
    [editor, importer, utils]
  );

  // Track cursor coordinates
  const [mapInstance, setMapInstance] = useState<import("maplibre-gl").Map | null>(null);
  useEffect(() => {
    if (!isEditing || !forgeMapRef.current) return;
    const interval = setInterval(() => {
      const m = forgeMapRef.current?.getMap() ?? null;
      if (m) {
        setMapInstance(m);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isEditing, selectedCountryId]);

  useEffect(() => {
    if (!mapInstance || !isEditing) return;
    const handler = (e: any) => setCursorCoords([e.lngLat.lng, e.lngLat.lat]);
    mapInstance.on("mousemove", handler);
    mapInstance.on("zoomend", () => setCursorZoom(mapInstance.getZoom()));
    setCursorZoom(mapInstance.getZoom());
    return () => {
      mapInstance.off("mousemove", handler);
    };
  }, [mapInstance, isEditing]);

  // Fly to country in editing mode
  useEffect(() => {
    if (!mapInstance || !editor.countryGeo || !isEditing) return;
    try {
      const geo = editor.countryGeo as any;
      let bounds: [[number, number], [number, number]] | null = null;

      if (geo.bbox && Array.isArray(geo.bbox) && geo.bbox.length >= 4) {
        bounds = [
          [geo.bbox[0], geo.bbox[1]],
          [geo.bbox[2], geo.bbox[3]],
        ];
      } else if (geo.type === "FeatureCollection" && geo.features?.length > 0) {
        let minLng = Infinity,
          minLat = Infinity,
          maxLng = -Infinity,
          maxLat = -Infinity;
        const processCoords = (coords: any) => {
          if (typeof coords[0] === "number") {
            minLng = Math.min(minLng, coords[0]);
            minLat = Math.min(minLat, coords[1]);
            maxLng = Math.max(maxLng, coords[0]);
            maxLat = Math.max(maxLat, coords[1]);
          } else if (Array.isArray(coords)) {
            coords.forEach(processCoords);
          }
        };
        for (const f of geo.features) {
          if (f.geometry?.coordinates) processCoords(f.geometry.coordinates);
        }
        if (minLng < Infinity) {
          bounds = [
            [minLng, minLat],
            [maxLng, maxLat],
          ];
        }
      }

      if (bounds) {
        mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 1500 });
      }
    } catch {
      // Ignore
    }
  }, [mapInstance, editor.countryGeo, selectedCountryId, isEditing]);

  const handleSelectFeature = useCallback(
    (feature: any) => {
      editor.setSelectedFeature(feature);
      editor.startEditing(feature);
      if (feature.coordinates && forgeMapRef.current) {
        forgeMapRef.current.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
      }
    },
    [editor]
  );

  const handleDeleteFeature = useCallback(
    (feature: any) => {
      if (confirm(`Delete "${feature.name}"?`)) {
        editor.handleDeleteFeature(feature);
      }
    },
    [editor]
  );

  const handleForgeSubmit = useCallback(() => {
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
      case "add-story-pin":
        editor.submitStoryPin();
        break;
      case "add-label":
        editor.submitMapLabel();
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
      case "edit-story-pin":
        editor.submitEditStoryPin();
        break;
      case "edit-label":
        editor.submitEditMapLabel();
        break;
    }
  }, [editor]);

  const handleGenerateTransport = useCallback(async () => {
    if (!selectedCountryId) return;
    try {
      const result = await generateTransport.mutateAsync({
        countryId: selectedCountryId,
        routeTypes: ["rail", "highway"],
        clearExisting: true,
      });
      alert(`Generated ${result.routesCreated} routes (${result.totalLengthKm} km), ${result.hubsCreated} hubs`);
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  }, [selectedCountryId, generateTransport]);

  const handleRecalculate = useCallback(async () => {
    if (!selectedCountryId) return;
    try {
      await recalculateGeo.mutateAsync({ countryId: selectedCountryId });
      alert("Geographic profile recalculated");
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  }, [selectedCountryId, recalculateGeo]);

  const handleDeleteAllRegions = useCallback(async () => {
    if (!selectedCountryId) return;
    const countryName = countries?.find((c: any) => c.id === selectedCountryId)?.name ?? "this country";
    if (!confirm(`Delete ALL regions/subdivisions for ${countryName}? This cannot be undone.`)) return;
    try {
      const result = await deleteAllRegions.mutateAsync({ countryId: selectedCountryId });
      alert(`Deleted ${result.deleted} regions`);
      await Promise.all([
        utils.geoCore.invalidate(),
        utils.geoFeatures.invalidate(),
        utils.geoEditor.invalidate(),
      ]);
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  }, [selectedCountryId, countries, deleteAllRegions, utils]);

  // ==========================================
  // VIEW RENDERING
  // ==========================================

  if (isEditing) {
    return (
      <div className="relative flex flex-col h-full w-full overflow-hidden bg-background">
        {/* Forge Top Bar */}
        <div className="border-border bg-card flex h-12 items-center gap-2 border-b px-4 shrink-0">
          <Globe className="h-4 w-4 text-amber-500" />
          <span className="text-foreground text-xs font-semibold uppercase tracking-wider">Forge Editor</span>
          <span className="text-muted-foreground text-xs">|</span>
          
          <select
            value={selectedCountryId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedCountryId(id);
              const feat = featureList?.find((f) => f.countryId === id);
              setMapSelectedCountry(
                feat
                  ? {
                      featureId: feat.featureId,
                      displayName: feat.displayName,
                      fillColor: feat.fillColor,
                      centroidLng: feat.centroidLng,
                      centroidLat: feat.centroidLat,
                      countryId: feat.countryId,
                    }
                  : null
              );
            }}
            className="border-border bg-background text-foreground rounded-md border px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="">Select a country...</option>
            {countries?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {selectedCountryId && (
            <div className="flex items-center gap-1.5 ml-3">
              <button
                onClick={() => setShowWikiPanel((v) => !v)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  showWikiPanel ? "bg-amber-500/20 text-amber-500" : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                }`}
                title="Search wiki for province maps"
              >
                <Search className="h-3 w-3" />
                Wiki Scan
              </button>
              <button
                onClick={handleGenerateTransport}
                disabled={generateTransport.isPending}
                className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-500/20 disabled:opacity-50 dark:text-indigo-400"
              >
                <Train className="h-3 w-3" />
                {generateTransport.isPending ? "Generating..." : "Gen Transport"}
              </button>
              <button
                onClick={handleRecalculate}
                disabled={recalculateGeo.isPending}
                className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
              >
                <RefreshCw className={`h-3 w-3 ${recalculateGeo.isPending ? "animate-spin" : ""}`} />
                Recalc Geo
              </button>
              <button
                onClick={handleDeleteAllRegions}
                disabled={deleteAllRegions.isPending}
                className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
                Delete Regions
              </button>
            </div>
          )}

          <button
            onClick={() => setIsEditing(false)}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-600/10 text-blue-500 px-3 py-1.5 text-xs font-semibold hover:bg-blue-600/20 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Exit Edit Mode
          </button>
        </div>

        {/* Wiki Panel */}
        {showWikiPanel && selectedCountryId && (
          <div className="border-border bg-card border-b shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <FileImage className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold">Wiki Province Finder — {selectedCountryName}</span>
              </div>
              <button onClick={() => setShowWikiPanel(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-4 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wider uppercase">Auto-detected from wiki</p>
                {scanLoading ? (
                  <div className="text-muted-foreground flex items-center gap-1.5 py-2 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" /> Scanning...
                  </div>
                ) : wikiProvinceScan?.files && wikiProvinceScan.files.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {wikiProvinceScan.files.map((file: string, idx: number) => (
                      <button
                        key={file}
                        onClick={() => handleImportFromWiki(file)}
                        disabled={!!importingFile}
                        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                          idx === 0 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400" : "border-border bg-muted/30"
                        }`}
                      >
                        {importingFile === file ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />}
                        {file}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs italic">No maps found in wiki article.</p>
                )}
              </div>
              <div className="border-border w-72 shrink-0 border-l pl-4">
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wider uppercase">Search Wiki Files</p>
                <input
                  type="text"
                  value={wikiSearchQuery}
                  onChange={(e) => setWikiSearchQuery(e.target.value)}
                  placeholder="Search filename..."
                  className="border-border bg-background w-full rounded-md border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                />
                {fileSearchLoading && <p className="text-muted-foreground mt-1 text-[10px]">Searching...</p>}
                {wikiFileResults && (
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {wikiFileResults.map((file: any) => (
                      <button
                        key={file.name}
                        onClick={() => handleImportFromWiki(file.name)}
                        className="text-[11px] text-left truncate w-full text-foreground/80 hover:text-amber-500 block"
                      >
                        {file.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Forge Canvas Area */}
        {!selectedCountryId ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center bg-card">
            <div className="text-center p-6 border border-border border-dashed rounded-2xl max-w-md">
              <Sparkles className="mx-auto mb-3 h-10 w-10 text-amber-500/50" />
              <p className="text-sm font-medium text-foreground">Select a Country to Edit</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Select a country from the dropdown menu in the toolbar above to load its detailed features, subdivisions, and editing tools.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 relative">
            <MapEditorToolbar mode={editor.mode} onModeChange={editor.setMode} disabled={false} />
            <div className="relative min-w-0 flex-1 h-full">
              <EditorMap
                ref={forgeMapRef}
                countryGeometry={(editor.countryGeo as any)?.geometry ?? null}
                countryCentroid={(editor.countryGeo as any)?.centroid ?? null}
                countryBbox={(editor.countryGeo as any)?.bbox ?? null}
                features={editor.allFeatures}
                mode={editor.mode}
                pendingCoordinates={editor.pendingCoordinates}
                selectedFeature={editor.selectedFeature}
                onMapClick={editor.handleMapClick}
                onDrawComplete={editor.handleDrawComplete}
                worldMapLayers={mapLayers}
              />
              {importer.currentProvinces.length > 0 && mapInstance && (
                <ProvincePreviewLayer
                  map={mapInstance}
                  provinces={importer.currentProvinces}
                  countryBorder={importer.countryBorder}
                  visible
                />
              )}
            </div>
            <EditorPanel
              mode={editor.mode}
              collapsed={panelCollapsed}
              onToggleCollapse={() => setPanelCollapsed((v) => !v)}
              featureCount={editor.allFeatures.length}
              propertiesContent={
                <FeaturePropertyPanel
                  mode={editor.mode}
                  cityForm={editor.cityForm}
                  subdivisionForm={editor.subdivisionForm}
                  poiForm={editor.poiForm}
                  storyPinForm={editor.storyPinForm}
                  mapLabelForm={editor.mapLabelForm}
                  onCityFormChange={editor.setCityForm}
                  onSubdivisionFormChange={editor.setSubdivisionForm}
                  onPOIFormChange={editor.setPOIForm}
                  onStoryPinFormChange={editor.setStoryPinForm}
                  onMapLabelFormChange={editor.setMapLabelForm}
                  pendingCoordinates={editor.pendingCoordinates}
                  pendingGeometry={editor.pendingGeometry}
                  isMutating={editor.isMutating}
                  error={editor.mutationError}
                  lastSavedAt={editor.lastSavedAt}
                  onSubmit={handleForgeSubmit}
                  onCancel={editor.resetForm}
                  pendingPointInfo={editor.pendingPointInfo}
                  isPendingPointInfoLoading={editor.isPendingPointInfoLoading}
                  countryId={selectedCountryId}
                />
              }
              featureListContent={
                <FeatureList
                  features={editor.allFeatures}
                  selectedFeature={editor.selectedFeature}
                  onSelectFeature={handleSelectFeature}
                  onEditFeature={(f) => editor.startEditing(f)}
                  onDeleteFeature={handleDeleteFeature}
                  isLoading={editor.featuresLoading}
                  collapseAll={editor.mode.startsWith("add-") || editor.mode.startsWith("edit-") || editor.mode === "paint"}
                />
              }
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
          </div>
        )}

        {/* Forge Status Bar */}
        {editor && (
          <EditorStatusBar
            cursorCoords={cursorCoords}
            mode={editor.mode}
            terrainInfo={
              editor.pendingPointInfo
                ? {
                    elevation: editor.pendingPointInfo.elevation?.zoneName ?? null,
                    climate: editor.pendingPointInfo.climate?.climateName ?? null,
                  }
                : null
            }
            zoom={cursorZoom}
            featureCount={editor.allFeatures.length}
          />
        )}
      </div>
    );
  }

  // --- Inspector Mode Rendering ---
  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden bg-background">
      {/* World Editor Top Bar */}
      <div className="border-border bg-card flex h-12 shrink-0 items-center gap-3 border-b px-4 z-20">
        <Globe2 className="h-5 w-5 text-blue-500 animate-pulse" />
        <span className="text-foreground text-xs font-semibold uppercase tracking-wider">World Editor Workspace</span>
        <span className="text-muted-foreground text-xs">|</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <span>Linkage Rate:</span>
          {validationLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          ) : (
            <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full select-none">
              {stats?.linkageRate ?? 0}%
            </span>
          )}
        </div>

        {/* Actions Menu */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1 rounded-lg bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sync Linkages
          </button>
          <button
            onClick={() => autoMatchMutation.mutate()}
            disabled={autoMatchMutation.isPending}
            className="flex items-center gap-1 rounded-lg bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Zap className={`h-3.5 w-3.5 ${autoMatchMutation.isPending ? "animate-spin" : ""}`} />
            Auto-Match Names
          </button>
          <div className="h-4 w-px bg-border/60 mx-1" />
          <Link
            href="/admin/maps"
            className="flex items-center gap-1.5 rounded-lg bg-muted/65 text-muted-foreground px-3 py-1.5 text-xs font-semibold hover:bg-muted/80 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Close Editor
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Fullscreen Map Container */}
        <div className="flex-1 min-w-0 h-full relative z-0">
          <MapContainer
            showControls={true}
            showTools={false}
            showPopup={false}
            selectedCountryId={selectedCountryId}
            onCountrySelect={handleMapSelect}
            lockProjection={true}
          />
        </div>

        {/* Floating Sidebar Toggle Button (shows when collapsed) */}
        {inspectorCollapsed && (
          <button
            onClick={() => setInspectorCollapsed(false)}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/85 text-muted-foreground hover:text-foreground shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer animate-pulse"
            title="Expand Sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Resizable Sidebar Panel */}
        {!inspectorCollapsed && (
          <div
            className="border-l border-border bg-card/85 relative flex h-full flex-col shadow-2xl backdrop-blur-md z-10 shrink-0"
            style={{ width: inspectorWidth }}
          >
            {/* Drag Resize Handle */}
            <div
              className="hover:bg-blue-500/30 active:bg-blue-500/50 absolute top-0 left-0 z-20 h-full w-1 cursor-col-resize transition-colors"
              onMouseDown={handleResizeStart}
            />

            {/* Sidebar Tab Bar */}
            <div className="border-b border-border/50 bg-muted/20 flex h-10 shrink-0 select-none">
              <button
                onClick={() => setInspectorTab("properties")}
                className={`flex flex-1 items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                  inspectorTab === "properties"
                    ? "border-blue-500 bg-card/30 text-blue-500 border-b-2"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 text-blue-500" />
                Properties
              </button>
              <button
                onClick={() => setInspectorTab("linkages")}
                className={`flex flex-1 items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                  inspectorTab === "linkages"
                    ? "border-blue-500 bg-card/30 text-blue-500 border-b-2"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                }`}
              >
                <LinkIcon className="h-3.5 w-3.5 text-amber-500" />
                Linkages
                {validationData && validationData.unlinked.length > 0 && (
                  <span className="bg-amber-500/20 text-amber-500 rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                    {validationData.unlinked.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setInspectorTab("sovereignty")}
                className={`flex flex-1 items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                  inspectorTab === "sovereignty"
                    ? "border-blue-500 bg-card/30 text-blue-500 border-b-2"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5 text-indigo-500" />
                Sovereignty
              </button>
              
              {/* Collapse button */}
              <button
                onClick={() => setInspectorCollapsed(true)}
                className="flex items-center justify-center px-2.5 border-l border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/20 cursor-pointer"
                title="Collapse Sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Sidebar Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pr-3.5">
              {inspectorTab === "properties" && (
                <div style={{ animation: "tabFadeIn 150ms ease" }} className="space-y-4">
                  {mapSelectedCountry ? (
                    <div className="space-y-4">
                      {/* Title Header */}
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <h3 className="text-foreground text-sm font-semibold">Feature Inspector</h3>
                        </div>
                        <button
                          onClick={() => {
                            setMapSelectedCountry(null);
                            setSelectedCountryId(null);
                          }}
                          className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Swatch & Name */}
                      <div className="flex items-center gap-2.5 bg-muted/40 p-2.5 rounded-lg border border-border/40">
                        <div
                          className="border border-border/70 h-5 w-5 rounded-md shadow-sm shrink-0"
                          style={{ backgroundColor: mapSelectedCountry.fillColor }}
                        />
                        <span className="text-foreground text-base font-bold truncate">
                          {mapSelectedCountry.displayName}
                        </span>
                      </div>

                      {/* Geometry Details */}
                      <dl className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-2.5 rounded-lg border border-border/30">
                        <div>
                          <dt className="text-muted-foreground font-medium">Feature ID</dt>
                          <dd className="text-foreground font-mono mt-0.5 select-all truncate">{mapSelectedCountry.featureId}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground font-medium">Centroid</dt>
                          <dd className="text-foreground font-mono mt-0.5">
                            {mapSelectedCountry.centroidLat.toFixed(2)}, {mapSelectedCountry.centroidLng.toFixed(2)}
                          </dd>
                        </div>
                      </dl>

                      {/* Database Linkage Status */}
                      <div className="border-t border-border/40 pt-3 space-y-3">
                        <h4 className="text-foreground/90 text-xs font-semibold uppercase tracking-wider">Database Linkage</h4>

                        {mapSelectedCountry.countryId ? (
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg font-medium">
                              <Check className="h-3.5 w-3.5" />
                              <span>Linked to: <strong className="text-foreground font-bold select-all">{selectedCountryName}</strong></span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Forge Editor
                              </button>
                              <button
                                onClick={() => handleUnlink(mapSelectedCountry.featureId)}
                                disabled={unlinkMutation.isPending}
                                className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-500 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <UnlinkIcon className="h-3.5 w-3.5" />
                                Unlink
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg font-medium">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>Orphaned Map Feature</span>
                            </div>

                            {assigningFeatureId === mapSelectedCountry.featureId ? (
                              <div className="space-y-2 bg-muted/40 p-2 rounded-lg border border-border/50">
                                <select
                                  value={assignCountryId}
                                  onChange={(e) => setAssignCountryId(e.target.value)}
                                  className={inputClasses}
                                >
                                  <option value="">Select country to link...</option>
                                  {availableCountries.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => handleAssignLink(mapSelectedCountry.featureId)}
                                    disabled={!assignCountryId || assignMutation.isPending}
                                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                                  >
                                    {assignMutation.isPending ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAssigningFeatureId(null);
                                      setAssignCountryId("");
                                    }}
                                    className="text-muted-foreground hover:text-foreground px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAssigningFeatureId(mapSelectedCountry.featureId);
                                  setAssignCountryId("");
                                }}
                                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                              >
                                <LinkIcon className="h-3.5 w-3.5" />
                                Assign Country Linkage
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Sovereignty Management */}
                      {mapSelectedCountry.countryId && (
                        <div className="border-t border-border/40 pt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-foreground/90 text-xs font-semibold uppercase tracking-wider">Sovereignty Relations</h4>
                            <button
                              onClick={() => {
                                setSovereigntyForm({
                                  ...EMPTY_SOVEREIGNTY_FORM,
                                  sovereignId: mapSelectedCountry.countryId!,
                                });
                                setShowSovereigntyForm(true);
                              }}
                              className="flex items-center gap-1 rounded bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              <Plus className="h-2.5 w-2.5" /> Add
                            </button>
                          </div>

                          {/* Inline Sovereignty Creator */}
                          {showSovereigntyForm && (
                            <div className="bg-muted/40 p-3 rounded-lg border border-border/50 space-y-2.5">
                              <h5 className="text-foreground text-[11px] font-semibold">
                                {editingSovereigntyId ? "Edit Relation" : "Add Relation for " + selectedCountryName}
                              </h5>

                              {/* Sovereign */}
                              <div>
                                <label className="text-muted-foreground mb-0.5 block text-[10px] font-medium">Sovereign (Parent)</label>
                                <select
                                  value={sovereigntyForm.sovereignId}
                                  onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, sovereignId: e.target.value })}
                                  disabled={!!editingSovereigntyId || sovereigntyForm.sovereignId === mapSelectedCountry.countryId}
                                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                                >
                                  <option value="">Select sovereign...</option>
                                  {countries.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Subject */}
                              <div>
                                <label className="text-muted-foreground mb-0.5 block text-[10px] font-medium">Subject (Dependency)</label>
                                <select
                                  value={sovereigntyForm.subjectId}
                                  onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, subjectId: e.target.value })}
                                  disabled={!!editingSovereigntyId || sovereigntyForm.subjectId === mapSelectedCountry.countryId}
                                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
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

                              {/* Type */}
                              <div>
                                <label className="text-muted-foreground mb-0.5 block text-[10px] font-medium">Type</label>
                                <select
                                  value={sovereigntyForm.relationshipType}
                                  onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, relationshipType: e.target.value })}
                                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                                >
                                  {SOVEREIGNTY_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Autonomy */}
                              <div>
                                <label className="text-muted-foreground mb-0.5 block text-[10px] font-medium">Autonomy: {sovereigntyForm.autonomyLevel}%</label>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={sovereigntyForm.autonomyLevel}
                                  onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, autonomyLevel: parseInt(e.target.value) })}
                                  className="w-full accent-blue-500"
                                />
                              </div>

                              <div className="flex justify-end gap-1.5 border-t border-border/30 pt-2">
                                <button
                                  onClick={editingSovereigntyId ? handleUpdateSovereignty : handleCreateSovereignty}
                                  disabled={createSovereignty.isPending || updateSovereignty.isPending || !sovereigntyForm.sovereignId || !sovereigntyForm.subjectId}
                                  className="rounded bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 text-xs font-semibold cursor-pointer"
                                >
                                  Save
                                </button>
                                <button onClick={resetSovereigntyForm} className="text-muted-foreground text-xs hover:text-foreground cursor-pointer">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Relations List */}
                          {relationsLoading ? (
                            <p className="text-muted-foreground text-xs italic">Loading relations...</p>
                          ) : countryRelations.length === 0 ? (
                            <p className="text-muted-foreground text-xs italic bg-muted/10 p-2 rounded-lg border border-border/20 text-center">
                              No sovereignty dependencies or parents defined.
                            </p>
                          ) : (
                            <ul className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                              {countryRelations.map((rel) => {
                                const isSovereign = rel.sovereignId === selectedCountryId;
                                const partnerName = isSovereign ? rel.subjectName : rel.sovereignName;
                                const partnerFlag = isSovereign ? rel.subjectFlag : rel.sovereignFlag;
                                return (
                                  <li
                                    key={rel.id}
                                    className="flex items-center justify-between text-xs bg-muted/30 border border-border/30 rounded-lg p-2 hover:border-border/60 transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      {partnerFlag && (
                                        <img src={partnerFlag} alt="" className="h-3.5 w-5 rounded border border-border/40 object-cover shrink-0" />
                                      )}
                                      <div className="truncate">
                                        <span className="font-semibold text-foreground">{partnerName}</span>
                                        <span className="text-[10px] text-muted-foreground block leading-tight">
                                          {isSovereign ? "Subject / " : "Sovereign / "}
                                          {typeLabel(rel.relationshipType)} ({Math.round(rel.autonomyLevel * 100)}% Autonomy)
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                      <button
                                        onClick={() => handleEditSovereignty(rel)}
                                        className="text-blue-500 hover:text-blue-600 p-0.5 rounded hover:bg-blue-500/10 cursor-pointer"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSovereignty(rel.id)}
                                        className="text-red-500 hover:text-red-600 p-0.5 rounded hover:bg-red-500/10 cursor-pointer"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <MapPin className="h-10 w-10 text-muted-foreground/45 mb-3" />
                      <p className="text-sm font-semibold text-foreground">No Feature Selected</p>
                      <p className="text-xs text-muted-foreground/60 mt-1 max-w-[240px]">
                        Click on any country polygon on the map to inspect and edit its properties.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === "linkages" && (
                <div style={{ animation: "tabFadeIn 150ms ease" }} className="space-y-4">
                  {/* Title Header */}
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    <LinkIcon className="h-4 w-4 text-blue-500" />
                    <h3 className="text-foreground text-sm font-semibold">Linkage Control Center</h3>
                  </div>

                  {/* Summary Cards */}
                  {validationLoading ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-12 bg-muted/40 animate-pulse rounded-lg" />
                      <div className="h-12 bg-muted/40 animate-pulse rounded-lg" />
                    </div>
                  ) : validationData ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/10 border border-border/40 rounded-lg p-2 text-center">
                        <div className="text-base font-bold text-foreground">{validationData.totalCountries}</div>
                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</div>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center">
                        <div className="text-base font-bold text-emerald-600">{validationData.linkedCount}</div>
                        <div className="text-[10px] text-emerald-600/70 font-medium uppercase tracking-wider">Linked</div>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-center">
                        <div className="text-base font-bold text-amber-600">{validationData.unlinkedCount}</div>
                        <div className="text-[10px] text-amber-600/70 font-medium uppercase tracking-wider">Unlinked</div>
                      </div>
                      <div className={`rounded-lg p-2 text-center border ${validationData.issueCount > 0 ? "bg-red-500/5 border-red-500/10" : "bg-muted/10 border-border/40"}`}>
                        <div className={`text-base font-bold ${validationData.issueCount > 0 ? "text-red-500" : "text-foreground"}`}>
                          {validationData.issueCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Issues</div>
                      </div>
                    </div>
                  ) : null}

                  {/* Refresh Button */}
                  <div className="flex justify-between items-center border-t border-border/40 pt-3">
                    <span className="text-xs text-muted-foreground">Validator Stats</span>
                    <button
                      onClick={() => refetchValidation()}
                      className="rounded border border-border text-foreground hover:bg-muted px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>

                  {/* Sub Tabs */}
                  <div className="border-border flex gap-1 rounded-lg border p-1 bg-muted/30 shrink-0 select-none">
                    {(["issues", "linked", "unlinked", "features"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setValidationTab(t)}
                        className={`flex-1 rounded-md py-1.5 text-[10px] font-semibold capitalize transition-all ${
                          validationTab === t ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t === "features" ? "Map Features" : t}
                      </button>
                    ))}
                  </div>

                  {/* Lists Container */}
                  <div className="max-h-[350px] overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {validationLoading ? (
                      <p className="text-muted-foreground italic text-center py-4">Loading validation data...</p>
                    ) : validationTab === "issues" && validationData ? (
                      validationData.issues.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 italic">No linkage issues found.</p>
                      ) : (
                        validationData.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              if (issue.countryId) {
                                setSelectedCountryId(issue.countryId);
                                const feat = featureList?.find((f) => f.countryId === issue.countryId);
                                if (feat) {
                                  setMapSelectedCountry({
                                    featureId: feat.featureId,
                                    displayName: feat.displayName,
                                    fillColor: feat.fillColor,
                                    centroidLng: feat.centroidLng,
                                    centroidLat: feat.centroidLat,
                                    countryId: feat.countryId,
                                  });
                                }
                              } else if (issue.featureId) {
                                const feat = featureList?.find((f) => f.featureId === issue.featureId);
                                if (feat) {
                                  setMapSelectedCountry({
                                    featureId: feat.featureId,
                                    displayName: feat.displayName,
                                    fillColor: feat.fillColor,
                                    centroidLng: feat.centroidLng,
                                    centroidLat: feat.centroidLat,
                                    countryId: feat.countryId,
                                  });
                                }
                              }
                              setInspectorTab("properties"); // Switch to Properties when clicking an issue
                            }}
                            className="flex items-center justify-between border border-border/40 hover:border-blue-500/40 bg-muted/10 hover:bg-blue-500/5 rounded-lg p-2 cursor-pointer transition-all"
                          >
                            <div className="truncate max-w-[70%]">
                              <span className="font-semibold text-foreground block truncate">{issue.countryName}</span>
                              <span className="text-[10px] text-muted-foreground block truncate">{issue.detail}</span>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 uppercase">
                              Desync
                            </span>
                          </div>
                        ))
                      )
                    ) : validationTab === "linked" && validationData ? (
                      validationData.linked.map((item) => (
                        <div
                          key={item.countryId}
                          onClick={() => {
                            setSelectedCountryId(item.countryId);
                            const feat = featureList?.find((f) => f.countryId === item.countryId);
                            if (feat) {
                              setMapSelectedCountry({
                                featureId: feat.featureId,
                                displayName: feat.displayName,
                                fillColor: feat.fillColor,
                                centroidLng: feat.centroidLng,
                                centroidLat: feat.centroidLat,
                                countryId: feat.countryId,
                              });
                            }
                            setInspectorTab("properties"); // Switch to Properties when clicking a linked country
                          }}
                          className="flex items-center justify-between border border-border/30 hover:border-blue-500/40 bg-muted/10 hover:bg-blue-500/5 rounded-lg p-2 cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {item.countryFlag && (
                              <img src={item.countryFlag} alt="" className="h-3.5 w-5 rounded object-cover border border-border/35" />
                            )}
                            <span className="font-medium text-foreground truncate">{item.countryName}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">{item.featureName}</span>
                        </div>
                      ))
                    ) : validationTab === "unlinked" && validationData ? (
                      validationData.unlinked.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 italic">All countries linked.</p>
                      ) : (
                        validationData.unlinked.map((item) => (
                          <div
                            key={item.countryId}
                            onClick={() => {
                              setSelectedCountryId(item.countryId);
                              setMapSelectedCountry(null);
                              setInspectorTab("properties"); // Switch to Properties when clicking an unlinked country
                            }}
                            className="flex items-center justify-between border border-border/30 hover:border-blue-500/40 bg-muted/10 hover:bg-blue-500/5 rounded-lg p-2 cursor-pointer transition-all"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              {item.countryFlag && (
                                <img src={item.countryFlag} alt="" className="h-3.5 w-5 rounded object-cover border border-border/35" />
                              )}
                              <span className="font-medium text-foreground truncate">{item.countryName}</span>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold leading-tight ${item.hasGeometry ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>
                              {item.hasGeometry ? "Orphaned" : "No Geometry"}
                            </span>
                          </div>
                        ))
                      )
                    ) : validationTab === "features" && featureList ? (
                      <div className="space-y-2">
                        <div className="flex gap-1">
                          <input
                            type="text"
                            placeholder="Search features..."
                            value={featureSearch}
                            onChange={(e) => setFeatureSearch(e.target.value)}
                            className="w-full bg-background rounded border border-border px-2 py-1 text-xs"
                          />
                          <select
                            value={featureFilter}
                            onChange={(e: any) => setFeatureFilter(e.target.value)}
                            className="bg-background rounded border border-border px-2 py-1 text-xs"
                          >
                            <option value="all">All</option>
                            <option value="linked">Linked</option>
                            <option value="unlinked">Unlinked</option>
                          </select>
                        </div>
                        <div className="space-y-1 max-h-[260px] overflow-y-auto pr-0.5">
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
                                  setSelectedCountryId(feat.countryId);
                                } else {
                                  setSelectedCountryId(null);
                                }
                                setInspectorTab("properties"); // Switch to Properties when selecting a map feature
                              }}
                              className="flex items-center justify-between border border-border/30 hover:border-blue-500/40 bg-muted/10 hover:bg-blue-500/5 rounded-lg p-2 cursor-pointer transition-all"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <div className="h-3 w-3 rounded-full border border-border/40 shadow-sm shrink-0" style={{ backgroundColor: feat.fillColor }} />
                                <span className="font-medium text-foreground truncate">{feat.displayName}</span>
                              </div>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${feat.isClaimed ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                                {feat.isClaimed ? "Linked" : "Unlinked"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {inspectorTab === "sovereignty" && (
                <div style={{ animation: "tabFadeIn 150ms ease" }} className="space-y-4">
                  {/* Title Header */}
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-indigo-500" />
                      <h3 className="text-foreground text-sm font-semibold">Sovereignty Relations</h3>
                    </div>
                    {!showSovereigntyForm && (
                      <button
                        onClick={() => {
                          resetSovereigntyForm();
                          setShowSovereigntyForm(true);
                        }}
                        className="flex items-center gap-1 rounded bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> New
                      </button>
                    )}
                  </div>

                  {/* Sovereignty Creator Form (in sovereignty tab context) */}
                  {showSovereigntyForm && (
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/50 space-y-2.5">
                      <h4 className="text-foreground text-[11px] font-semibold uppercase tracking-wider border-b border-border/30 pb-1">
                        {editingSovereigntyId ? "Edit Sovereignty" : "New Sovereignty Relation"}
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-muted-foreground mb-0.5 block">Sovereign (Parent)</label>
                          <select
                            value={sovereigntyForm.sovereignId}
                            onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, sovereignId: e.target.value })}
                            disabled={!!editingSovereigntyId}
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
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
                            onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, subjectId: e.target.value })}
                            disabled={!!editingSovereigntyId}
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
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
                            onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, relationshipType: e.target.value })}
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                          >
                            {SOVEREIGNTY_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-muted-foreground mb-0.5 block">Autonomy: {sovereigntyForm.autonomyLevel}%</label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={sovereigntyForm.autonomyLevel}
                            onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, autonomyLevel: parseInt(e.target.value) })}
                            className="w-full accent-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-muted-foreground mb-0.5 block">Established</label>
                          <input
                            type="text"
                            placeholder="e.g. 1920"
                            value={sovereigntyForm.establishedDate}
                            onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, establishedDate: e.target.value })}
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-muted-foreground mb-0.5 block">Description</label>
                          <input
                            type="text"
                            placeholder="Optional notes..."
                            value={sovereigntyForm.description}
                            onChange={(e) => setSovereigntyForm({ ...sovereigntyForm, description: e.target.value })}
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5 pt-2 border-t border-border/30">
                        <button
                          onClick={editingSovereigntyId ? handleUpdateSovereignty : handleCreateSovereignty}
                          disabled={createSovereignty.isPending || updateSovereignty.isPending || !sovereigntyForm.sovereignId || !sovereigntyForm.subjectId}
                          className="rounded bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-xs font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                        <button onClick={resetSovereigntyForm} className="text-muted-foreground text-xs hover:text-foreground cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Filters */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search relations..."
                      value={sovereigntySearch}
                      onChange={(e) => setSovereigntySearch(e.target.value)}
                      className="w-full bg-background rounded border border-border px-2 py-1 text-xs"
                    />
                    <select
                      value={sovereigntyTypeFilter}
                      onChange={(e) => setSovereigntyTypeFilter(e.target.value)}
                      className="bg-background rounded border border-border px-2 py-1 text-xs font-medium"
                    >
                      <option value="all">All Types</option>
                      {SOVEREIGNTY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Relations List */}
                  <div className="max-h-[350px] overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {relationsLoading ? (
                      <p className="text-muted-foreground italic text-center py-4">Loading relations...</p>
                    ) : filteredRelations.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4 italic">No relations found.</p>
                    ) : (
                      filteredRelations.map((rel) => (
                        <div
                          key={rel.id}
                          className="flex items-center justify-between border border-border/30 bg-muted/10 rounded-lg p-2 hover:border-border/60 transition-colors"
                        >
                          <div className="truncate max-w-[80%]">
                            <div className="flex items-center gap-1.5">
                              {rel.sovereignFlag && <img src={rel.sovereignFlag} alt="" className="h-3 w-4.5 rounded object-cover border border-border/30" />}
                              <span className="font-semibold text-foreground truncate">{rel.sovereignName}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 pl-6 flex items-center gap-1">
                              <span>➔</span>
                              <span>{rel.subjectName}</span>
                              <span className="text-[9px] bg-indigo-500/10 text-indigo-500 px-1 rounded-sm ml-1">{typeLabel(rel.relationshipType)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            <button
                              onClick={() => handleEditSovereignty(rel)}
                              className="text-blue-500 hover:text-blue-600 p-0.5 rounded hover:bg-blue-500/10 cursor-pointer"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteSovereignty(rel.id)}
                              className="text-red-500 hover:text-red-600 p-0.5 rounded hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes tabFadeIn {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
}
