"use client";

/**
 * Map Editor Page - User-facing geographic data editing interface
 *
 * Comprehensive map editor for creating and editing geographic features:
 * - Subdivisions (administrative regions)
 * - Cities and settlements
 * - Points of Interest (POIs)
 *
 * Features:
 * - Full MapLibre GL JS integration with drawing tools
 * - Real-time validation and feedback
 * - Multi-editor modal system
 * - Undo/redo support
 * - Auto-save drafts
 * - Keyboard shortcuts
 *
 * All submissions go through admin approval workflow.
 */

import { useEffect, useState, useCallback, useReducer, useMemo } from "react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { createUrl } from "~/lib/url-utils";
import { LoadingState } from "~/components/shared/feedback/LoadingState";
import { useUserCountry } from "~/hooks/useUserCountry";
import { MapEditorContainer, type DrawingMode, type LayerVisibility } from "~/components/maps/editor/MapEditorContainer";
import { EditorSidebar } from "~/components/maps/editor/EditorSidebar";
import { EditorToolbar } from "~/components/maps/editor/EditorToolbar";
import { SubdivisionEditor } from "~/components/maps/editor/SubdivisionEditor";
import { CityPlacement } from "~/components/maps/editor/CityPlacement";
import { POIEditor } from "~/components/maps/editor/POIEditor";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { toast } from "sonner";
import type { ProjectionType } from "~/types/maps";
import { api } from "~/trpc/react";

export const dynamic = "force-dynamic";

/**
 * Editor state type
 */
type EditorType = "subdivision" | "city" | "poi" | null;

/**
 * Feature selection type
 */
interface SelectedFeature {
  id: string;
  type: EditorType;
  feature?: Feature;
}

/**
 * Editor state reducer
 */
interface EditorState {
  mode: DrawingMode;
  activeEditor: EditorType;
  selectedFeature: SelectedFeature | null;
  layerVisibility: LayerVisibility;
  hasUnsavedChanges: boolean;
  currentFeature: Feature | null;
  history: Feature[];
  historyIndex: number;
  editingFeatureId: string | null; // NEW: Track what feature we're editing
  editingFeatureData: any | null;  // NEW: Store loaded feature data for editing
}

type EditorAction =
  | { type: "SET_MODE"; payload: DrawingMode }
  | { type: "SET_ACTIVE_EDITOR"; payload: EditorType }
  | { type: "SELECT_FEATURE"; payload: SelectedFeature | null }
  | { type: "TOGGLE_LAYER"; payload: keyof LayerVisibility }
  | { type: "SET_UNSAVED_CHANGES"; payload: boolean }
  | { type: "SET_CURRENT_FEATURE"; payload: Feature | null }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET" }
  | { type: "OPEN_EDITOR"; payload: { type: EditorType; featureId?: string; data?: any } }
  | { type: "CLOSE_EDITOR" };

const initialEditorState: EditorState = {
  mode: null,
  activeEditor: null,
  selectedFeature: null,
  layerVisibility: {
    boundaries: true,
    subdivisions: true,
    cities: true,
    pois: true,
  },
  hasUnsavedChanges: false,
  currentFeature: null,
  history: [],
  historyIndex: -1,
  editingFeatureId: null,
  editingFeatureData: null,
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_MODE":
      // Prevent unnecessary re-renders if mode hasn't changed
      if (state.mode === action.payload) {
        return state;
      }
      return { ...state, mode: action.payload };
    case "SET_ACTIVE_EDITOR":
      // Prevent unnecessary re-renders if activeEditor hasn't changed
      if (state.activeEditor === action.payload) {
        return state;
      }
      return { ...state, activeEditor: action.payload };
    case "SELECT_FEATURE":
      return { ...state, selectedFeature: action.payload };
    case "TOGGLE_LAYER":
      return {
        ...state,
        layerVisibility: {
          ...state.layerVisibility,
          [action.payload]: !state.layerVisibility[action.payload],
        },
      };
    case "SET_UNSAVED_CHANGES":
      return { ...state, hasUnsavedChanges: action.payload };
    case "SET_CURRENT_FEATURE":
      if (action.payload) {
        // Add to history
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(action.payload);
        return {
          ...state,
          currentFeature: action.payload,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          hasUnsavedChanges: true,
        };
      }
      return { ...state, currentFeature: action.payload };
    case "UNDO":
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return {
          ...state,
          currentFeature: state.history[newIndex] || null,
          historyIndex: newIndex,
        };
      }
      return state;
    case "REDO":
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return {
          ...state,
          currentFeature: state.history[newIndex] || null,
          historyIndex: newIndex,
        };
      }
      return state;
    case "RESET":
      return initialEditorState;
    case "OPEN_EDITOR":
      // Set appropriate drawing mode based on editor type
      const mode = action.payload.type === "subdivision" ? "polygon" : "point";
      return {
        ...state,
        activeEditor: action.payload.type,
        editingFeatureId: action.payload.featureId ?? null,
        editingFeatureData: action.payload.data ?? null,
        mode: mode,
      };
    case "CLOSE_EDITOR":
      return {
        ...state,
        activeEditor: null,
        editingFeatureId: null,
        editingFeatureData: null,
        mode: null,
        hasUnsavedChanges: false,
      };
    default:
      return state;
  }
}

/**
 * Map Editor Page Component
 *
 * Protected page that requires:
 * 1. User authentication (Clerk)
 * 2. Linked country (userProfile.countryId exists)
 *
 * Layout:
 * - Left: Full-height map container (70% width)
 * - Right: Editor sidebar with tabs (30% width)
 * - Floating: Toolbar for drawing tools
 * - Modal: Editor forms (SubdivisionEditor, CityPlacement, POIEditor)
 */
export default function MapEditorPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { country, profileLoading, countryLoading, userProfile } = useUserCountry();

  // Editor state
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [showEditorModal, setShowEditorModal] = useState(false);

  // Map display state (editor always uses mercator for proper tile loading)
  const [projection, setProjection] = useState<ProjectionType>('mercator');
  const [mapType, setMapType] = useState<'map' | 'climate' | 'terrain'>('map');

  // Fetch country geometry for boundary validation
  const { data: countryBordersData } = api.geo.getCountryBorders.useQuery(
    {
      countryIds: country?.id ? [country.id] : [],
    },
    {
      enabled: !!country?.id,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  // Extract country geometry for boundary validation
  const countryGeometry = useMemo(() => {
    if (!countryBordersData?.countries || countryBordersData.countries.length === 0) {
      return null;
    }

    const countryBorder = countryBordersData.countries[0];
    if (!countryBorder?.geometry) {
      return null;
    }

    // Convert geometry to GeoJSON Feature
    const geometry = countryBorder.geometry as { type: string; coordinates: any };
    return {
      type: "Feature" as const,
      properties: {},
      geometry: geometry as Polygon | MultiPolygon,
    } as Feature<Polygon | MultiPolygon>;
  }, [countryBordersData]);

  // Set page title
  useEffect(() => {
    document.title = country?.name
      ? `${country.name} - Map Editor`
      : "Map Editor - IxStats";
  }, [country?.name]);

  // Load map settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('ixstats-map-settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          if (parsed.projection) {
            setProjection(parsed.projection);
          }
          if (parsed.mapType) {
            setMapType(parsed.mapType);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, []);

  // Save map settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('ixstats-map-settings');
      let settings = {};
      try {
        settings = savedSettings ? JSON.parse(savedSettings) : {};
      } catch (e) {
        // Ignore parse errors
      }
      localStorage.setItem('ixstats-map-settings', JSON.stringify({
        ...settings,
        projection,
        mapType,
      }));
    }
  }, [projection, mapType]);

  /**
   * Handle mode change from toolbar
   */
  const [showTypeChooser, setShowTypeChooser] = useState(false);

  const handleModeChange = useCallback((mode: DrawingMode) => {
    dispatch({ type: "SET_MODE", payload: mode });

    // Activate appropriate editor
    if (mode === "polygon") {
      dispatch({ type: "OPEN_EDITOR", payload: { type: "subdivision" } });
    } else if (mode === "point") {
      // Show chooser modal: City or POI?
      setShowTypeChooser(true);
    } else if (mode === null) {
      dispatch({ type: "CLOSE_EDITOR" });
    }
  }, []);

  // Fetch data for zoom-to-feature functionality (MUST be before handleFeatureSelect)
  // These queries need to fetch ALL statuses (including draft/pending) so the View button can find them
  const { data: subdivisionsData } = api.mapEditor.getMySubdivisions.useQuery(
    { countryId: country?.id ?? "", limit: 100, offset: 0 },
    { enabled: !!country?.id }
  );
  const { data: citiesData } = api.mapEditor.getMyCities.useQuery(
    { countryId: country?.id ?? "", limit: 100, offset: 0 },
    { enabled: !!country?.id }
  );
  const { data: poisData } = api.mapEditor.getMyPOIs.useQuery(
    { countryId: country?.id ?? "", limit: 100, offset: 0 },
    { enabled: !!country?.id }
  );

  /**
   * Handle new feature request from sidebar
   */
  const handleNewFeature = useCallback((type: "subdivision" | "city" | "poi") => {
    dispatch({ type: "OPEN_EDITOR", payload: { type } });
  }, []);

  /**
   * Handle feature selection from sidebar
   */
  const handleFeatureSelect = useCallback((featureId: string, type: EditorType) => {
    console.log("[handleFeatureSelect] Called with:", { featureId, type });

    dispatch({
      type: "SELECT_FEATURE",
      payload: { id: featureId, type },
    });

    // Zoom to feature on map
    const mapInstance = (window as any).__mapEditorInstance;
    if (!mapInstance) {
      console.warn("[handleFeatureSelect] No map instance found");
      toast.error("Map not ready");
      return;
    }

    // Get appropriate data query
    const queryData =
      type === "subdivision" ? subdivisionsData :
      type === "city" ? citiesData :
      type === "poi" ? poisData :
      null;

    console.log("[handleFeatureSelect] Query data:", queryData);

    if (!queryData) {
      console.warn("[handleFeatureSelect] No query data available");
      toast.error("Data not loaded yet");
      return;
    }

    // Find the feature
    const features =
      type === "subdivision" ? (queryData as any).subdivisions :
      type === "city" ? (queryData as any).cities :
      type === "poi" ? (queryData as any).pois :
      [];

    console.log("[handleFeatureSelect] Searching in features:", features.length);

    const feature = features.find((f: any) => f.id === featureId);
    if (!feature) {
      console.warn(`[handleFeatureSelect] Feature not found - ID: ${featureId}, Type: ${type}`);
      console.warn("[handleFeatureSelect] Available IDs:", features.map((f: any) => f.id));
      toast.error(`${type} not found. Try refreshing the page.`);
      return;
    }

    console.log("[handleFeatureSelect] Found feature:", feature);

    // Calculate bounds and zoom
    if (type === "subdivision" && feature.geometry) {
      // For subdivisions, use the geometry bounds
      const coords = feature.geometry.type === "Polygon"
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates[0][0];

      const lngs = coords.map((c: number[]) => c[0]);
      const lats = coords.map((c: number[]) => c[1]);
      const bounds: [number, number, number, number] = [
        Math.min(...lngs),
        Math.min(...lats),
        Math.max(...lngs),
        Math.max(...lats),
      ];

      console.log("[handleFeatureSelect] Fitting bounds:", bounds);
      mapInstance.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 1500 });
      toast.success(`Viewing ${feature.name}`);
    } else if ((type === "city" || type === "poi") && feature.coordinates) {
      // For points, fly to coordinates with reasonable zoom level
      const [lng, lat] = feature.coordinates.coordinates;
      console.log("[handleFeatureSelect] Flying to:", { lng, lat });
      // Use zoom 10 instead of 14 - shows more context and markers are visible at this zoom
      mapInstance.flyTo({ center: [lng, lat], zoom: 10, duration: 1500 });
      toast.success(`Viewing ${feature.name}`);
    } else {
      console.warn("[handleFeatureSelect] No coordinates or geometry found");
      toast.error("Location data not available");
    }
  }, [subdivisionsData, citiesData, poisData]);

  /**
   * Handle feature edit from sidebar
   */
  const handleEditFeature = useCallback((featureId: string, type: EditorType, featureData?: any) => {
    // Open editor with feature data for editing
    dispatch({
      type: "OPEN_EDITOR",
      payload: {
        type,
        featureId,
        data: featureData,
      },
    });
  }, []);

  // Delete mutations are handled by EditorSidebar directly, no need for page-level handler

  /**
   * Handle feature creation from map
   */
  const handleFeatureCreate = useCallback((feature: Feature) => {
    dispatch({ type: "SET_CURRENT_FEATURE", payload: feature });
    toast.info("Feature created. Fill in details to save.");
  }, []);

  /**
   * Handle feature update from map
   */
  const handleFeatureUpdate = useCallback((feature: Feature) => {
    dispatch({ type: "SET_CURRENT_FEATURE", payload: feature });
    toast.info("Feature updated. Save to persist changes.");
  }, []);

  /**
   * Handle feature delete from map
   */
  const handleFeatureDelete = useCallback((featureId: string) => {
    dispatch({ type: "SET_CURRENT_FEATURE", payload: null });
    dispatch({ type: "SET_UNSAVED_CHANGES", payload: false });
    toast.success("Feature deleted");
  }, []);

  /**
   * Handle map click for coordinate capture (cities and POIs)
   */
  const handleMapClick = useCallback((coordinates: { lng: number; lat: number }) => {
    // Only handle clicks when in city or POI mode
    if (state.activeEditor === "city" || state.activeEditor === "poi") {
      // Store coordinates in a way the editors can access
      (window as any).__mapEditorClickCoords = coordinates;

      // Trigger a custom event that editors can listen to
      window.dispatchEvent(new CustomEvent('mapeditor:click', {
        detail: { coordinates }
      }));
    }
  }, [state.activeEditor]);

  // Save is handled by individual editors (CityPlacement, POIEditor, SubdivisionEditor)
  // Each editor has its own save mutation logic

  /**
   * Handle cancel action
   */
  const handleCancel = useCallback(() => {
    if (state.hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes. Discard them?")) {
        return;
      }
    }

    setShowEditorModal(false);
    dispatch({ type: "RESET" });
    toast.info("Changes discarded");
  }, [state.hasUnsavedChanges]);

  /**
   * Handle undo
   */
  const handleUndo = useCallback(() => {
    dispatch({ type: "UNDO" });
    toast.info("Undo");
  }, []);

  /**
   * Handle redo
   */
  const handleRedo = useCallback(() => {
    dispatch({ type: "REDO" });
    toast.info("Redo");
  }, []);

  /**
   * Handle coordinate click from map
   */
  const handleCoordinateClick = useCallback((lng: number, lat: number) => {
    // Call the map click handler to dispatch to active editors
    handleMapClick({ lng, lat });

    // Show toast for user feedback
    if (state.activeEditor === "city" || state.activeEditor === "poi") {
      toast.success(`Coordinates captured: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } else {
      toast.info(`Coordinates: ${lng.toFixed(6)}, ${lat.toFixed(6)}`);
    }
  }, [handleMapClick, state.activeEditor]);

  /**
   * Handle projection change
   */
  const handleProjectionChange = useCallback((newProjection: ProjectionType) => {
    setProjection(newProjection);
    toast.success(`Switched to ${newProjection} projection`);
  }, []);

  /**
   * Handle map type change
   */
  const handleMapTypeChange = useCallback((newMapType: 'map' | 'climate' | 'terrain') => {
    setMapType(newMapType);
    toast.success(`Switched to ${newMapType} mode`);
  }, []);

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc - Cancel/Close
      if (e.key === "Escape") {
        if (showEditorModal) {
          handleCancel();
        } else if (state.mode !== null) {
          dispatch({ type: "SET_MODE", payload: null });
        }
      }

      // Ctrl/Cmd+S - Save (handled by individual editors)

      // Ctrl/Cmd+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y - Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        handleRedo();
      }

      // P - Polygon mode
      if (e.key === "p" || e.key === "P") {
        if (!showEditorModal) {
          handleModeChange("polygon");
        }
      }

      // M - Point mode (marker)
      if (e.key === "m" || e.key === "M") {
        if (!showEditorModal) {
          handleModeChange("point");
        }
      }

      // E - Edit mode
      if (e.key === "e" || e.key === "E") {
        if (!showEditorModal) {
          handleModeChange("edit");
        }
      }

      // D - Delete mode
      if (e.key === "d" || e.key === "D") {
        if (!showEditorModal) {
          handleModeChange("delete");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showEditorModal,
    state.mode,
    state.hasUnsavedChanges,
    handleCancel,
    handleUndo,
    handleRedo,
    handleModeChange,
  ]);

  /**
   * Auto-save drafts to localStorage
   */
  useEffect(() => {
    if (state.currentFeature && state.hasUnsavedChanges) {
      const draftKey = `map-editor-draft-${country?.id}-${state.activeEditor}`;
      localStorage.setItem(draftKey, JSON.stringify(state.currentFeature));
    }
  }, [state.currentFeature, state.hasUnsavedChanges, state.activeEditor, country?.id]);

  // Memoize handlers to prevent infinite loops
  // IMPORTANT: This must be BEFORE any early returns (Rules of Hooks)
  const mapEditorHandlers = useMemo(() => ({
    onFeatureCreate: handleFeatureCreate,
    onFeatureUpdate: handleFeatureUpdate,
    onFeatureDelete: handleFeatureDelete,
    onCoordinateClick: handleCoordinateClick,
    // DO NOT include onModeChange here - it causes infinite loop
    // The mode is controlled by the drawingMode prop, not by internal map events
  }), [handleFeatureCreate, handleFeatureUpdate, handleFeatureDelete, handleCoordinateClick]);

  // Authentication guard
  if (!isLoaded || profileLoading) {
    return <LoadingState message="Loading profile..." />;
  }

  if (!user) {
    router.push(createUrl("/sign-in"));
    return <LoadingState message="Redirecting to sign in..." />;
  }

  // Country ownership guard
  if (!userProfile?.countryId) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="glass-panel p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4">
            No Country Linked
          </h1>
          <p className="text-slate-400 mb-6">
            You need to create or link a country before accessing the map editor.
          </p>
          <button
            onClick={() => router.push(createUrl("/builder"))}
            className="px-6 py-3 bg-gold-500/20 text-gold-300 rounded-lg hover:bg-gold-500/30 transition-colors font-medium"
          >
            Create Your Country
          </button>
        </div>
      </div>
    );
  }

  if (countryLoading || !country) {
    return <LoadingState message="Loading country data..." />;
  }

  // Main editor interface
  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Page Header - Using MyCountry navigation system */}
      {/* Note: Could integrate MyCountryCompactHeader here in future for consistent nav */}
      <div className="glass-panel border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Map Editor</h1>
            <p className="text-sm text-slate-400 mt-1">
              {country.name} - Edit geographic features
            </p>
          </div>
          <button
            onClick={() => router.push(createUrl("/mycountry"))}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Back to MyCountry
          </button>
        </div>
      </div>

      {/* Main Editor Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Map Container (70% width) */}
        <div className="flex-1 relative z-0">
          <MapEditorContainer
            countryId={country.id}
            // No initialCenter - calculated automatically from vector tiles in WGS84
            initialZoom={6}
            drawingMode={state.mode}
            layerVisibility={state.layerVisibility}
            handlers={mapEditorHandlers}
            projection={projection}
            onProjectionChange={handleProjectionChange}
            mapType={mapType}
          />

          {/* Floating Toolbar */}
          <EditorToolbar
            activeMode={state.mode}
            onModeChange={handleModeChange}
            onCancel={() => dispatch({ type: "CLOSE_EDITOR" })}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={state.historyIndex > 0}
            canRedo={state.historyIndex < state.history.length - 1}
            hasUnsavedChanges={state.hasUnsavedChanges}
          />
        </div>

        {/* Right: Editor Sidebar (30% width) - Elevated above map */}
        <div className="w-[30%] border-l border-slate-700/50 bg-slate-900 relative z-10 shadow-2xl">
          <EditorSidebar
            countryId={country.id}
            countryGeometry={countryGeometry}
            onFeatureSelect={handleFeatureSelect}
            onNewFeature={handleNewFeature}
            onEditFeature={handleEditFeature}
          />
        </div>
      </div>

      {/* Full-Screen Editor Overlays */}
      {state.activeEditor === "subdivision" && (
        <div className="fixed inset-0 z-[100] flex pointer-events-none">
          <div className="flex-1 pointer-events-none" /> {/* Transparent left shows map */}
          <div className="w-[500px] bg-slate-900 shadow-2xl overflow-y-auto pointer-events-auto border-l border-slate-700">
            <SubdivisionEditor
              map={(window as any).__mapEditorInstance || null}
              countryId={country.id}
              countryGeometry={countryGeometry ?? undefined}
              subdivisionId={state.editingFeatureId ?? undefined}
              isActive={true}
              onClose={() => dispatch({ type: "CLOSE_EDITOR" })}
              onSaved={() => {
                dispatch({ type: "CLOSE_EDITOR" });
                toast.success("Subdivision saved!");
              }}
            />
          </div>
        </div>
      )}

      {state.activeEditor === "city" && (
        <div className="fixed inset-0 z-[100] flex pointer-events-none">
          <div className="flex-1 pointer-events-none" /> {/* Transparent left shows map */}
          <div className="w-[600px] bg-slate-900 shadow-2xl overflow-y-auto pointer-events-auto border-l border-slate-700">
            <CityPlacement
              countryId={country.id}
              countryGeometry={countryGeometry}
              onCityPlaced={() => {
                dispatch({ type: "CLOSE_EDITOR" });
                toast.success("City created!");
              }}
              onCityUpdated={() => {
                dispatch({ type: "CLOSE_EDITOR" });
                toast.success("City updated!");
              }}
              initialCity={state.editingFeatureData}
            />
          </div>
        </div>
      )}

      {state.activeEditor === "poi" && (
        <div className="fixed inset-0 z-[100] flex pointer-events-none">
          <div className="flex-1 pointer-events-none" /> {/* Transparent left shows map */}
          <div className="w-[600px] bg-slate-900 shadow-2xl overflow-y-auto pointer-events-auto border-l border-slate-700">
            <POIEditor
              countryId={country.id}
              countryGeometry={countryGeometry}
              mode={state.editingFeatureId ? "edit" : "create"}
              poiId={state.editingFeatureId ?? undefined}
              onSuccess={() => {
                dispatch({ type: "CLOSE_EDITOR" });
                toast.success(state.editingFeatureId ? "POI updated!" : "POI created!");
              }}
              onCancel={() => dispatch({ type: "CLOSE_EDITOR" })}
            />
          </div>
        </div>
      )}

      {/* Type Chooser Modal for Point Tool */}
      {showTypeChooser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel p-8 max-w-md">
            <h3 className="text-2xl font-bold text-white mb-4">What do you want to place?</h3>
            <p className="text-slate-400 mb-6">Choose the type of point feature to add to the map</p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  dispatch({ type: "OPEN_EDITOR", payload: { type: "city" } });
                  setShowTypeChooser(false);
                }}
                className="flex-1 glass-interactive p-6 rounded-lg hover:bg-blue-500/20 transition-all group"
              >
                <div className="text-4xl mb-2">🏙️</div>
                <div className="text-lg font-semibold text-white">City</div>
                <div className="text-sm text-slate-400 mt-1">Settlement or town</div>
              </button>
              <button
                onClick={() => {
                  dispatch({ type: "OPEN_EDITOR", payload: { type: "poi" } });
                  setShowTypeChooser(false);
                }}
                className="flex-1 glass-interactive p-6 rounded-lg hover:bg-purple-500/20 transition-all group"
              >
                <div className="text-4xl mb-2">📍</div>
                <div className="text-lg font-semibold text-white">POI</div>
                <div className="text-sm text-slate-400 mt-1">Point of interest</div>
              </button>
            </div>
            <button
              onClick={() => {
                setShowTypeChooser(false);
                dispatch({ type: "SET_MODE", payload: null });
              }}
              className="mt-4 w-full px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
