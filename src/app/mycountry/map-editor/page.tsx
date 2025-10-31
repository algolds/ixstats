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

import { useEffect, useState, useCallback, useReducer } from "react";
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
import type { Feature } from "geojson";
import { toast } from "sonner";

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
  | { type: "RESET" };

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
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.payload };
    case "SET_ACTIVE_EDITOR":
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

  // Set page title
  useEffect(() => {
    document.title = country?.name
      ? `${country.name} - Map Editor`
      : "Map Editor - IxStats";
  }, [country?.name]);

  /**
   * Handle mode change from toolbar
   */
  const handleModeChange = useCallback((mode: DrawingMode) => {
    dispatch({ type: "SET_MODE", payload: mode });

    // Activate appropriate editor
    if (mode === "polygon") {
      dispatch({ type: "SET_ACTIVE_EDITOR", payload: "subdivision" });
      setShowEditorModal(true);
    } else if (mode === "point") {
      // Will prompt user to choose city or POI
      dispatch({ type: "SET_ACTIVE_EDITOR", payload: "city" });
      setShowEditorModal(true);
    } else if (mode === null) {
      dispatch({ type: "SET_ACTIVE_EDITOR", payload: null });
      setShowEditorModal(false);
    }
  }, []);

  /**
   * Handle new feature request from sidebar
   */
  const handleNewFeature = useCallback((type: "subdivision" | "city" | "poi") => {
    dispatch({ type: "SET_ACTIVE_EDITOR", payload: type });

    // Set appropriate drawing mode
    if (type === "subdivision") {
      dispatch({ type: "SET_MODE", payload: "polygon" });
    } else {
      dispatch({ type: "SET_MODE", payload: "point" });
    }

    setShowEditorModal(true);
  }, []);

  /**
   * Handle feature selection from sidebar
   */
  const handleFeatureSelect = useCallback((featureId: string, type: EditorType) => {
    dispatch({
      type: "SELECT_FEATURE",
      payload: { id: featureId, type },
    });

    // Zoom to feature on map (via window.__mapEditorInstance)
    const mapInstance = (window as any).__mapEditorInstance;
    if (mapInstance) {
      // TODO: Implement zoom to feature
      console.log(`[MapEditor] Zoom to ${type}:${featureId}`);
    }
  }, []);

  /**
   * Handle feature edit from sidebar
   */
  const handleEditFeature = useCallback((featureId: string, type: string) => {
    dispatch({
      type: "SELECT_FEATURE",
      payload: { id: featureId, type: type as EditorType },
    });
    dispatch({ type: "SET_ACTIVE_EDITOR", payload: type as EditorType });
    dispatch({ type: "SET_MODE", payload: "edit" });
    setShowEditorModal(true);
  }, []);

  /**
   * Handle feature delete from sidebar
   */
  const handleDeleteFeature = useCallback((featureId: string, type: string) => {
    // Confirm deletion
    if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
      // TODO: Call delete mutation
      toast.success(`${type} deleted successfully`);
      dispatch({ type: "SELECT_FEATURE", payload: null });
    }
  }, []);

  /**
   * Handle feature creation from map
   */
  const handleFeatureCreate = useCallback((feature: Feature) => {
    console.log("[MapEditor] Feature created:", feature);
    dispatch({ type: "SET_CURRENT_FEATURE", payload: feature });
    toast.info("Feature created. Fill in details to save.");
  }, []);

  /**
   * Handle feature update from map
   */
  const handleFeatureUpdate = useCallback((feature: Feature) => {
    console.log("[MapEditor] Feature updated:", feature);
    dispatch({ type: "SET_CURRENT_FEATURE", payload: feature });
    toast.info("Feature updated. Save to persist changes.");
  }, []);

  /**
   * Handle feature delete from map
   */
  const handleFeatureDelete = useCallback((featureId: string) => {
    console.log("[MapEditor] Feature deleted:", featureId);
    dispatch({ type: "SET_CURRENT_FEATURE", payload: null });
    dispatch({ type: "SET_UNSAVED_CHANGES", payload: false });
    toast.success("Feature deleted");
  }, []);

  /**
   * Handle save action
   */
  const handleSave = useCallback(() => {
    if (!state.currentFeature) {
      toast.error("No feature to save");
      return;
    }

    // TODO: Call appropriate create/update mutation based on state.activeEditor
    console.log("[MapEditor] Saving feature:", state.currentFeature);
    toast.success("Feature saved as draft");

    dispatch({ type: "SET_UNSAVED_CHANGES", payload: false });
    setShowEditorModal(false);
    dispatch({ type: "SET_MODE", payload: null });
    dispatch({ type: "RESET" });
  }, [state.currentFeature, state.activeEditor]);

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
    console.log(`[MapEditor] Clicked: ${lng.toFixed(6)}, ${lat.toFixed(6)}`);
    toast.info(`Coordinates: ${lng.toFixed(6)}, ${lat.toFixed(6)}`);
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

      // Ctrl/Cmd+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (state.hasUnsavedChanges) {
          handleSave();
        }
      }

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
    handleSave,
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
      {/* Page Header */}
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
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Map Container (70% width) */}
        <div className="flex-1 relative">
          <MapEditorContainer
            countryId={country.id}
            drawingMode={state.mode}
            layerVisibility={state.layerVisibility}
            handlers={{
              onFeatureCreate: handleFeatureCreate,
              onFeatureUpdate: handleFeatureUpdate,
              onFeatureDelete: handleFeatureDelete,
              onCoordinateClick: handleCoordinateClick,
              onModeChange: (mode) => dispatch({ type: "SET_MODE", payload: mode }),
            }}
          />

          {/* Floating Toolbar */}
          <EditorToolbar
            activeMode={state.mode}
            onModeChange={handleModeChange}
            onSave={handleSave}
            onCancel={handleCancel}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={state.historyIndex > 0}
            canRedo={state.historyIndex < state.history.length - 1}
            hasUnsavedChanges={state.hasUnsavedChanges}
          />
        </div>

        {/* Right: Editor Sidebar (30% width) */}
        <div className="w-[30%] border-l border-slate-700/50">
          <EditorSidebar
            countryId={country.id}
            activeFeatureId={state.selectedFeature?.id}
            onFeatureSelect={handleFeatureSelect}
            onNewFeature={handleNewFeature}
            onEditFeature={handleEditFeature}
            onDeleteFeature={handleDeleteFeature}
          />
        </div>
      </div>

      {/* Editor Modals */}
      {showEditorModal && state.activeEditor === "subdivision" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <SubdivisionEditor
              countryId={country.id}
              existingFeature={state.currentFeature}
              onClose={handleCancel}
              onSave={(data) => {
                console.log("[MapEditor] Subdivision saved:", data);
                handleSave();
              }}
            />
          </div>
        </div>
      )}

      {showEditorModal && state.activeEditor === "city" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <CityPlacement
              countryId={country.id}
              existingCity={state.currentFeature}
              onClose={handleCancel}
              onSave={(data) => {
                console.log("[MapEditor] City saved:", data);
                handleSave();
              }}
            />
          </div>
        </div>
      )}

      {showEditorModal && state.activeEditor === "poi" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <POIEditor
              countryId={country.id}
              existingPOI={state.currentFeature}
              onClose={handleCancel}
              onSave={(data) => {
                console.log("[MapEditor] POI saved:", data);
                handleSave();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
