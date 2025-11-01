/**
 * useBorderEditor Hook
 * Manages border editing state and validation for territory manager
 */

import { useState, useCallback, useRef } from "react";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { toast } from "sonner";
import { api } from "~/trpc/react";

/**
 * Geometry validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics?: {
    areaKm2: number;
    perimeterKm: number;
    vertexCount: number;
    ringCount: number;
  };
}

/**
 * Economic impact estimate
 */
export interface EconomicImpact {
  areaChange: {
    km2: number;
    percentChange: number;
  };
  populationImpact: {
    estimatedChange: number;
    newDensity: number;
  };
  economicImpact: {
    gdpChange: number;
    gdpPerCapitaChange: number;
  };
}

/**
 * Overlap detection result
 */
export interface OverlapDetection {
  hasOverlap: boolean;
  overlappingCountries: Array<{
    countryId: string;
    countryName: string;
    overlapAreaKm2: number;
  }>;
}

/**
 * Border editor state
 */
export interface BorderEditorState {
  isEditing: boolean;
  editingCountryId: string | null;
  editingCountryName: string | null;
  currentGeometry: Feature<Polygon | MultiPolygon> | null;
  originalGeometry: Feature<Polygon | MultiPolygon> | null;
  validation: ValidationResult | null;
  economicImpact: EconomicImpact | null;
  overlapDetection: OverlapDetection | null;
  hasUnsavedChanges: boolean;
  isPreviewMode: boolean;
  history: Array<Feature<Polygon | MultiPolygon>>;
  historyIndex: number;
}

/**
 * Country context for economic calculations
 */
export interface CountryContext {
  population: number;
  gdp: number;
  areaKm2: number;
}

/**
 * Border editor actions
 */
export interface BorderEditorActions {
  startEditing: (
    countryId: string,
    countryName: string,
    geometry: Feature<Polygon | MultiPolygon>
  ) => void;
  updateGeometry: (geometry: Feature<Polygon | MultiPolygon>) => void;
  saveChanges: (reason: string) => Promise<void>;
  cancelChanges: () => void;
  undo: () => void;
  redo: () => void;
  togglePreview: () => void;
}

/**
 * Initial state
 */
const initialState: BorderEditorState = {
  isEditing: false,
  editingCountryId: null,
  editingCountryName: null,
  currentGeometry: null,
  originalGeometry: null,
  validation: null,
  economicImpact: null,
  overlapDetection: null,
  hasUnsavedChanges: false,
  isPreviewMode: false,
  history: [],
  historyIndex: -1,
};

/**
 * useBorderEditor Hook
 *
 * Manages border editing state, validation, and mutations for the territory manager
 */
export function useBorderEditor(
  map: MapLibreMap | null,
  countryContext: CountryContext
) {
  const [state, setState] = useState<BorderEditorState>(initialState);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mutation for saving border changes
  const saveBorderMutation = api.geo.updateCountryBorder.useMutation({
    onSuccess: () => {
      toast.success("Border changes saved successfully");
      setState(initialState);
    },
    onError: (error) => {
      toast.error(`Failed to save border changes: ${error.message}`);
    },
  });

  /**
   * Validate geometry
   */
  const validateGeometry = useCallback(
    (geometry: Feature<Polygon | MultiPolygon>): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Basic geometry validation
      if (!geometry || !geometry.geometry) {
        errors.push("Invalid geometry structure");
        return { isValid: false, errors, warnings };
      }

      // Calculate metrics (simplified - would use turf.js in production)
      const metrics = {
        areaKm2: 0,
        perimeterKm: 0,
        vertexCount: 0,
        ringCount: 0,
      };

      try {
        const geomType = geometry.geometry.type;
        if (geomType === "Polygon") {
          const coords = geometry.geometry.coordinates;
          metrics.ringCount = coords.length;
          metrics.vertexCount = coords.reduce((sum, ring) => sum + ring.length, 0);
        } else if (geomType === "MultiPolygon") {
          const coords = geometry.geometry.coordinates;
          metrics.ringCount = coords.reduce((sum, poly) => sum + poly.length, 0);
          metrics.vertexCount = coords.reduce(
            (sum, poly) => sum + poly.reduce((s, ring) => s + ring.length, 0),
            0
          );
        }

        // Vertex count validation
        if (metrics.vertexCount < 4) {
          errors.push("Polygon must have at least 4 vertices");
        }

        if (metrics.vertexCount > 10000) {
          warnings.push("Large vertex count may impact performance");
        }

        // Area validation (placeholder - would calculate actual area)
        metrics.areaKm2 = countryContext.areaKm2; // Simplified
        if (metrics.areaKm2 === 0) {
          errors.push("Polygon area is zero");
        }
      } catch (error) {
        errors.push("Failed to validate geometry structure");
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metrics,
      };
    },
    [countryContext.areaKm2]
  );

  /**
   * Calculate economic impact
   */
  const calculateEconomicImpact = useCallback(
    (newGeometry: Feature<Polygon | MultiPolygon>): EconomicImpact => {
      // Simplified calculation - would use actual area calculation in production
      const oldArea = countryContext.areaKm2;
      const newArea = oldArea; // Placeholder
      const areaChange = newArea - oldArea;
      const percentChange = (areaChange / oldArea) * 100;

      const populationChange = (areaChange / oldArea) * countryContext.population;
      const newDensity = countryContext.population / newArea;

      const gdpChange = (areaChange / oldArea) * countryContext.gdp;
      const gdpPerCapitaChange = gdpChange / countryContext.population;

      return {
        areaChange: {
          km2: areaChange,
          percentChange,
        },
        populationImpact: {
          estimatedChange: populationChange,
          newDensity,
        },
        economicImpact: {
          gdpChange,
          gdpPerCapitaChange,
        },
      };
    },
    [countryContext]
  );

  /**
   * Start editing
   */
  const startEditing = useCallback(
    (
      countryId: string,
      countryName: string,
      geometry: Feature<Polygon | MultiPolygon>
    ) => {
      const validation = validateGeometry(geometry);
      const economicImpact = calculateEconomicImpact(geometry);

      setState({
        isEditing: true,
        editingCountryId: countryId,
        editingCountryName: countryName,
        currentGeometry: geometry,
        originalGeometry: geometry,
        validation,
        economicImpact,
        overlapDetection: null,
        hasUnsavedChanges: false,
        isPreviewMode: false,
        history: [geometry],
        historyIndex: 0,
      });

      toast.info(`Started editing ${countryName}`);
    },
    [validateGeometry, calculateEconomicImpact]
  );

  /**
   * Update geometry
   */
  const updateGeometry = useCallback(
    (geometry: Feature<Polygon | MultiPolygon>) => {
      // Debounce validation
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }

      validationTimeoutRef.current = setTimeout(() => {
        const validation = validateGeometry(geometry);
        const economicImpact = calculateEconomicImpact(geometry);

        setState((prev) => {
          const newHistory = prev.history.slice(0, prev.historyIndex + 1);
          newHistory.push(geometry);

          return {
            ...prev,
            currentGeometry: geometry,
            validation,
            economicImpact,
            hasUnsavedChanges: true,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
        });
      }, 500);
    },
    [validateGeometry, calculateEconomicImpact]
  );

  /**
   * Save changes
   */
  const saveChanges = useCallback(
    async (reason: string) => {
      if (!state.currentGeometry || !state.editingCountryId) {
        toast.error("No changes to save");
        return;
      }

      if (!state.validation?.isValid) {
        toast.error("Cannot save invalid geometry");
        return;
      }

      await saveBorderMutation.mutateAsync({
        countryId: state.editingCountryId,
        geometry: state.currentGeometry.geometry,
        reason,
      });
    },
    [state, saveBorderMutation]
  );

  /**
   * Cancel changes
   */
  const cancelChanges = useCallback(() => {
    setState(initialState);
    toast.info("Changes cancelled");
  }, []);

  /**
   * Undo
   */
  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex <= 0) return prev;

      const newIndex = prev.historyIndex - 1;
      const geometry = prev.history[newIndex]!;
      const validation = validateGeometry(geometry);
      const economicImpact = calculateEconomicImpact(geometry);

      return {
        ...prev,
        currentGeometry: geometry,
        validation,
        economicImpact,
        historyIndex: newIndex,
        hasUnsavedChanges: true,
      };
    });
  }, [validateGeometry, calculateEconomicImpact]);

  /**
   * Redo
   */
  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;

      const newIndex = prev.historyIndex + 1;
      const geometry = prev.history[newIndex]!;
      const validation = validateGeometry(geometry);
      const economicImpact = calculateEconomicImpact(geometry);

      return {
        ...prev,
        currentGeometry: geometry,
        validation,
        economicImpact,
        historyIndex: newIndex,
        hasUnsavedChanges: true,
      };
    });
  }, [validateGeometry, calculateEconomicImpact]);

  /**
   * Toggle preview mode
   */
  const togglePreview = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPreviewMode: !prev.isPreviewMode,
    }));
  }, []);

  const actions: BorderEditorActions = {
    startEditing,
    updateGeometry,
    saveChanges,
    cancelChanges,
    undo,
    redo,
    togglePreview,
  };

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  return {
    state,
    actions,
    isSaving: saveBorderMutation.isPending,
    canUndo,
    canRedo,
  };
}
