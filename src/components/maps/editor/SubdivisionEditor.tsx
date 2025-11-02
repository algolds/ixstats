/**
 * SubdivisionEditor Component
 *
 * Comprehensive editor for creating and editing country subdivisions with:
 * - MapLibre-Geoman polygon drawing/editing
 * - Real-time validation (boundary containment, area calculation, overlap detection)
 * - Metadata form (name, type, level, population, capital, description)
 * - Draft/Submit workflow with visual feedback
 * - Glass physics styling matching IxStats design system
 *
 * @see BorderEditor.tsx for MapLibre-Geoman integration pattern
 * @see mapEditor.ts router for tRPC API endpoints
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { BorderEditor } from "../editing/BorderEditor";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
// @ts-ignore - @turf/turf lacks complete TypeScript declarations
import { booleanWithin, booleanOverlap, booleanIntersects, booleanContains } from "@turf/turf";
import {
  Save,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Edit3,
  Trash2,
  MapPin,
} from "lucide-react";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface SubdivisionEditorProps {
  map: MapLibreMap | null;
  countryId: string;
  countryGeometry?: Feature<Polygon | MultiPolygon>;
  subdivisionId?: string; // If editing existing subdivision
  isActive: boolean;
  onClose?: () => void;
  onSaved?: (subdivisionId: string) => void;
}

interface FormData {
  name: string;
  type: "state" | "province" | "region" | "territory" | "district" | "county";
  level: number;
  population: string;
  capital: string;
  description: string;
}

interface ValidationResult {
  isValid: boolean;
  areaSqKm: number;
  withinBoundary: boolean;
  overlapsExisting: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Constants
// =============================================================================

const SUBDIVISION_TYPES = [
  { value: "state", label: "State" },
  { value: "province", label: "Province" },
  { value: "region", label: "Region" },
  { value: "territory", label: "Territory" },
  { value: "district", label: "District" },
  { value: "county", label: "County" },
] as const;

const LEVELS = [
  { value: 1, label: "Level 1 (Primary)" },
  { value: 2, label: "Level 2 (Secondary)" },
  { value: 3, label: "Level 3 (Tertiary)" },
  { value: 4, label: "Level 4 (Quaternary)" },
  { value: 5, label: "Level 5 (Quinary)" },
] as const;

const IXEARTH_SCALE_FACTOR = 1.4777; // IxEarth is ~1.48x larger than Earth

// =============================================================================
// SubdivisionEditor Component
// =============================================================================

export function SubdivisionEditor({
  map,
  countryId,
  countryGeometry,
  subdivisionId,
  isActive,
  onClose,
  onSaved,
}: SubdivisionEditorProps) {
  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  const [mode, setMode] = useState<"draw" | "edit">("draw");
  const [geometry, setGeometry] = useState<Feature<Polygon | MultiPolygon> | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    type: "state",
    level: 1,
    population: "",
    capital: "",
    description: "",
  });
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    areaSqKm: 0,
    withinBoundary: true,
    overlapsExisting: false,
    errors: [],
    warnings: [],
  });
  const [isDraft, setIsDraft] = useState(true);

  // ---------------------------------------------------------------------------
  // tRPC Hooks
  // ---------------------------------------------------------------------------

  const utils = api.useUtils();

  // Fetch existing subdivision if editing
  const { data: existingSubdivision, isLoading: loadingSubdivision } =
    api.mapEditor.getMySubdivisions.useQuery(
      {
        countryId,
        limit: 1,
        offset: 0,
      },
      {
        enabled: !!subdivisionId && isActive,
      }
    );

  // Fetch all country subdivisions for overlap detection
  const { data: countrySubdivisions } = api.mapEditor.getCountrySubdivisions.useQuery(
    {
      countryId,
      includeGeometry: true,
    },
    {
      enabled: isActive,
    }
  );

  // Mutations (with query invalidation for View button to work)
  const createMutation = api.mapEditor.createSubdivision.useMutation({
    onSuccess: (data) => {
      // Invalidate all subdivision queries to ensure View button can find the new subdivision
      void utils.mapEditor.getMySubdivisions.invalidate();
      void utils.mapEditor.getCountrySubdivisions.invalidate();
      onSaved?.(data.subdivision.id);
    },
  });

  const updateMutation = api.mapEditor.updateSubdivision.useMutation({
    onSuccess: (data) => {
      // Invalidate all subdivision queries to ensure View button shows updated data
      void utils.mapEditor.getMySubdivisions.invalidate();
      void utils.mapEditor.getCountrySubdivisions.invalidate();
      onSaved?.(data.subdivision.id);
    },
  });

  const submitForReviewMutation = api.mapEditor.submitSubdivisionForReview.useMutation({
    onSuccess: () => {
      void utils.mapEditor.getMySubdivisions.invalidate();
      void utils.mapEditor.getCountrySubdivisions.invalidate();
      setIsDraft(false);
    },
  });

  const deleteMutation = api.mapEditor.deleteSubdivision.useMutation({
    onSuccess: () => {
      void utils.mapEditor.getMySubdivisions.invalidate();
      void utils.mapEditor.getCountrySubdivisions.invalidate();
      onClose?.();
    },
  });

  // ---------------------------------------------------------------------------
  // Load Existing Subdivision
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (existingSubdivision?.subdivisions?.[0] && subdivisionId) {
      const subdivision = existingSubdivision.subdivisions[0];
      setFormData({
        name: subdivision.name,
        type: subdivision.type as FormData["type"],
        level: subdivision.level,
        population: subdivision.population?.toString() ?? "",
        capital: subdivision.capital ?? "",
        description: "",
      });
      setGeometry(subdivision.geometry as unknown as Feature<Polygon | MultiPolygon>);
      setMode("edit");
      setIsDraft(subdivision.status === "draft" || subdivision.status === "pending");
    }
  }, [existingSubdivision, subdivisionId]);

  // ---------------------------------------------------------------------------
  // Auto-Activate Drawing Mode
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!map || !isActive) return;

    const draw = (window as any).__mapboxDrawInstance;
    if (!draw) {
      console.warn("[SubdivisionEditor] MapboxDraw not found");
      return;
    }

    console.log("[SubdivisionEditor] Activating drawing mode");

    // If creating new subdivision, activate polygon drawing
    if (!subdivisionId && !geometry) {
      draw.changeMode('draw_polygon');
      console.log("[SubdivisionEditor] Activated draw_polygon mode for new subdivision");
    }
    // If editing existing with geometry, load it and activate edit mode
    else if (subdivisionId && geometry) {
      const ids = draw.add(geometry);
      if (ids && ids.length > 0) {
        draw.changeMode('direct_select', { featureId: ids[0] });
        console.log("[SubdivisionEditor] Loaded existing geometry and activated edit mode");
      }
    }

    return () => {
      // Clean up when editor closes
      console.log("[SubdivisionEditor] Cleaning up drawing mode");
      draw.deleteAll();
      draw.changeMode('simple_select');
    };
  }, [map, isActive, subdivisionId, geometry]);

  // ---------------------------------------------------------------------------
  // Geometry Validation
  // ---------------------------------------------------------------------------

  const validateGeometry = useCallback(
    (geom: Feature<Polygon | MultiPolygon>): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Calculate area using turf.js or simple polygon area calculation
      const areaSqKm = calculatePolygonArea(geom) * IXEARTH_SCALE_FACTOR;

      // Check if within country boundary
      let withinBoundary = true;
      if (countryGeometry) {
        withinBoundary = isPolygonWithinBoundary(geom, countryGeometry);
        if (!withinBoundary) {
          errors.push("Subdivision must be entirely within country boundaries");
        }
      }

      // Check for overlaps with existing subdivisions
      let overlapsExisting = false;
      if (countrySubdivisions?.subdivisions) {
        for (const existing of countrySubdivisions.subdivisions) {
          if (subdivisionId && existing.id === subdivisionId) continue; // Skip self when editing
          if (
            existing.geometry &&
            polygonsOverlap(geom, existing.geometry as unknown as Feature<Polygon | MultiPolygon>)
          ) {
            overlapsExisting = true;
            warnings.push(`May overlap with existing subdivision: ${existing.name}`);
            break;
          }
        }
      }

      // Area warnings
      if (areaSqKm < 100) {
        warnings.push("Subdivision area is quite small (< 100 sq km)");
      }
      if (areaSqKm > 10000000) {
        warnings.push("Subdivision area is very large (> 10M sq km)");
      }

      const isValid = errors.length === 0 && formData.name.length >= 1;

      return {
        isValid,
        areaSqKm,
        withinBoundary,
        overlapsExisting,
        errors,
        warnings,
      };
    },
    [countryGeometry, countrySubdivisions, subdivisionId, formData.name]
  );

  // Update validation when geometry or form changes
  useEffect(() => {
    if (geometry) {
      setValidation(validateGeometry(geometry));
    }
  }, [geometry, validateGeometry]);

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleGeometryChange = useCallback((feature: Feature<Polygon | MultiPolygon>) => {
    setGeometry(feature);
  }, []);

  const handleFormChange = useCallback(
    (field: keyof FormData, value: string | number) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSaveDraft = useCallback(async () => {
    if (!geometry) return;

    const input = {
      countryId,
      name: formData.name,
      type: formData.type,
      level: formData.level,
      geometry: geometry.geometry,
      areaSqKm: validation.areaSqKm,
      population: formData.population ? parseFloat(formData.population) : undefined,
      capital: formData.capital || undefined,
    };

    try {
      if (subdivisionId) {
        await updateMutation.mutateAsync({ id: subdivisionId, ...input });
      } else {
        await createMutation.mutateAsync(input);
      }
    } catch (error) {
      console.error("Failed to save subdivision:", error);
    }
  }, [
    geometry,
    countryId,
    formData,
    validation.areaSqKm,
    subdivisionId,
    updateMutation,
    createMutation,
  ]);

  const handleSubmitForReview = useCallback(async () => {
    if (!subdivisionId) {
      // Save as draft first, then submit
      await handleSaveDraft();
      return;
    }

    try {
      await submitForReviewMutation.mutateAsync({ id: subdivisionId });
    } catch (error) {
      console.error("Failed to submit for review:", error);
    }
  }, [subdivisionId, handleSaveDraft, submitForReviewMutation]);

  const handleDelete = useCallback(async () => {
    if (!subdivisionId) {
      onClose?.();
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${formData.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync({ id: subdivisionId });
    } catch (error) {
      console.error("Failed to delete subdivision:", error);
    }
  }, [subdivisionId, formData.name, deleteMutation, onClose]);

  const handleCancel = useCallback(() => {
    const hasChanges = geometry !== null || formData.name !== "";
    if (hasChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to cancel?"
      );
      if (!confirmed) return;
    }
    onClose?.();
  }, [geometry, formData.name, onClose]);

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderValidationIndicator = useMemo(() => {
    if (!geometry) return null;

    const { isValid, withinBoundary, overlapsExisting, errors, warnings } = validation;

    const statusColor = isValid
      ? "text-green-400 border-green-400/30 bg-green-500/10"
      : "text-red-400 border-red-400/30 bg-red-500/10";

    return (
      <div
        className={cn(
          "glass-panel border rounded-lg p-3 mb-3 transition-all",
          statusColor
        )}
      >
        <div className="flex items-start gap-2">
          {isValid ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-sm">
                {isValid ? "Valid Subdivision" : "Invalid Subdivision"}
              </span>
              <span className="text-xs font-mono">
                {validation.areaSqKm.toLocaleString()} sq km
              </span>
            </div>

            {/* Validation Details */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    withinBoundary ? "bg-green-400" : "bg-red-400"
                  )}
                />
                <span>{withinBoundary ? "Within country bounds" : "Outside country bounds"}</span>
              </div>
              {overlapsExisting && (
                <div className="flex items-center gap-2 text-yellow-400">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span>May overlap with existing subdivision</span>
                </div>
              )}
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {errors.map((error, idx) => (
                  <div key={idx} className="text-xs text-red-300">
                    • {error}
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {warnings.map((warning, idx) => (
                  <div key={idx} className="text-xs text-yellow-300">
                    ⚠ {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [geometry, validation]);

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (loadingSubdivision) {
    return (
      <div className="glass-panel border border-slate-200 dark:border-slate-700/50 rounded-lg p-4">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading subdivision...</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Border Editor (Map Integration) */}
      <BorderEditor
        map={map}
        isActive={isActive}
        initialFeature={geometry}
        onGeometryChange={handleGeometryChange}
        options={{
          snapping: true,
          snapDistance: 20,
          allowSelfIntersection: false,
          continueDrawing: false,
        }}
      />

      {/* Editor Sidebar Form */}
      <div className="glass-panel border-l border-slate-200 dark:border-slate-700/50 w-full flex-shrink-0 overflow-y-auto bg-white dark:bg-slate-900 backdrop-blur-xl">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gold-500/20">
                <MapPin className="w-5 h-5 text-gold-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {subdivisionId ? "Edit Subdivision" : "New Subdivision"}
              </h3>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
              aria-label="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawing Instructions */}
          {!geometry && !subdivisionId && (
            <div className="glass-panel bg-blue-500/20 border border-blue-400/30 p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/30">
                  <Edit3 className="w-6 h-6 text-blue-300" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">Draw your subdivision on the map</p>
                  <p className="text-sm text-blue-200 mt-1">
                    • Click map points to draw polygon borders<br />
                    • Double-click to finish drawing<br />
                    • Subdivision must be within country bounds
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Validation Indicator */}
          {renderValidationIndicator}

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Name <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="Enter subdivision name"
                maxLength={200}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                aria-invalid={formData.name.length === 0}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {formData.name.length}/200 characters
              </p>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Type <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  handleFormChange("type", e.target.value as FormData["type"])
                }
                className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white px-3 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
              >
                {SUBDIVISION_TYPES.map((type) => (
                  <option key={type.value} value={type.value} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Administrative Level <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.level}
                onChange={(e) => handleFormChange("level", parseInt(e.target.value))}
                className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white px-3 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
              >
                {LEVELS.map((level) => (
                  <option key={level.value} value={level.value} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    {level.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Lower levels represent larger administrative units
              </p>
            </div>

            {/* Population */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Population (optional)
              </label>
              <Input
                type="number"
                value={formData.population}
                onChange={(e) => handleFormChange("population", e.target.value)}
                placeholder="0"
                min="0"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Capital City */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Capital City (optional)
              </label>
              <Input
                type="text"
                value={formData.capital}
                onChange={(e) => handleFormChange("capital", e.target.value)}
                placeholder="Enter capital city name"
                maxLength={200}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFormChange("description", e.target.value)}
                placeholder="Add notes or description"
                maxLength={2000}
                rows={4}
                className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 resize-none"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {formData.description.length}/2000 characters
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50 space-y-2">
            {/* Save as Draft */}
            <Button
              onClick={handleSaveDraft}
              disabled={
                !geometry ||
                !validation.isValid ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              className="w-full"
              variant="outline"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save as Draft
                </>
              )}
            </Button>

            {/* Submit for Review */}
            <Button
              onClick={handleSubmitForReview}
              disabled={
                !geometry ||
                !validation.isValid ||
                submitForReviewMutation.isPending ||
                !isDraft
              }
              className="w-full bg-gold-500/20 text-gold-300 hover:bg-gold-500/30"
            >
              {submitForReviewMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit for Review
                </>
              )}
            </Button>

            {/* Delete (if editing) */}
            {subdivisionId && (
              <Button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="w-full"
                variant="destructive"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Subdivision
                  </>
                )}
              </Button>
            )}

            {/* Cancel */}
            <Button onClick={handleCancel} className="w-full" variant="ghost">
              <X className="w-4 h-4" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate polygon area in square kilometers using shoelace formula
 * This is a simplified implementation - in production, use turf.js
 */
function calculatePolygonArea(feature: Feature<Polygon | MultiPolygon>): number {
  const { coordinates } = feature.geometry;

  if (feature.geometry.type === "Polygon") {
    return calculateRingArea(coordinates[0] as number[][]);
  } else {
    // MultiPolygon: sum all polygon areas
    return coordinates.reduce((total, polygon) => {
      return total + calculateRingArea(polygon[0] as number[][]);
    }, 0);
  }
}

/**
 * Calculate area of a single linear ring using shoelace formula
 * Assumes coordinates are [lng, lat] in degrees
 * Returns approximate area in sq km
 */
function calculateRingArea(ring: number[][]): number {
  if (!ring || ring.length < 3) return 0;

  let area = 0;
  const R = 6371; // Earth radius in km

  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i]!;
    const p2 = ring[i + 1]!;

    const lat1 = (p1[1]! * Math.PI) / 180;
    const lat2 = (p2[1]! * Math.PI) / 180;
    const lng1 = (p1[0]! * Math.PI) / 180;
    const lng2 = (p2[0]! * Math.PI) / 180;

    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = (Math.abs(area) * R * R) / 2;
  return area;
}

/**
 * Check if polygon is entirely within boundary using Turf.js
 * Handles both Polygon and MultiPolygon geometries
 *
 * @param polygon - The subdivision polygon to check
 * @param boundary - The country boundary to check against
 * @returns true if polygon is entirely within boundary, false otherwise
 */
function isPolygonWithinBoundary(
  polygon: Feature<Polygon | MultiPolygon>,
  boundary: Feature<Polygon | MultiPolygon>
): boolean {
  try {
    // Use booleanWithin to check if polygon is completely inside boundary
    // booleanWithin returns true if the first geometry is completely within the second
    return booleanWithin(polygon, boundary);
  } catch (error) {
    console.error("[SubdivisionEditor] Error checking polygon within boundary:", error);
    // On error, use booleanContains as fallback (inverse check)
    try {
      return booleanContains(boundary, polygon);
    } catch (fallbackError) {
      console.error("[SubdivisionEditor] Fallback boundary check also failed:", fallbackError);
      // Fail closed - don't allow invalid geometry
      return false;
    }
  }
}

/**
 * Check if two polygons overlap using Turf.js
 * Checks for both overlap and intersection to catch all cases
 *
 * @param poly1 - First polygon to check
 * @param poly2 - Second polygon to check
 * @returns true if polygons overlap or intersect, false otherwise
 */
function polygonsOverlap(
  poly1: Feature<Polygon | MultiPolygon>,
  poly2: Feature<Polygon | MultiPolygon>
): boolean {
  try {
    // Check both overlap and intersection
    // booleanOverlap: geometries share some but not all points
    // booleanIntersects: geometries have at least one point in common
    const overlaps = booleanOverlap(poly1, poly2);
    const intersects = booleanIntersects(poly1, poly2);

    return overlaps || intersects;
  } catch (error) {
    console.error("[SubdivisionEditor] Error checking polygon overlap:", error);
    // On error, fail open to avoid blocking valid geometries
    // Manual review will catch any issues
    return false;
  }
}
