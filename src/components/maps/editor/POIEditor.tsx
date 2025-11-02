/**
 * POIEditor Component
 *
 * Point of Interest editor for IxStats Map Editor with category-based taxonomy,
 * dynamic icon rendering, image upload support, and comprehensive validation.
 *
 * Features:
 * - Point placement tool with click-to-place coordinates
 * - Hierarchical POI category/subcategory selection
 * - Dynamic icon rendering from lucide-react based on subcategory
 * - Image upload support with drag-and-drop and preview
 * - Rich text description editor (markdown support)
 * - Coordinate validation and manual adjustment
 * - Category browser with visual icon picker
 * - Glass physics UI with category-based color accents
 */

"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
// @ts-ignore - @turf/turf lacks complete TypeScript declarations
import { booleanPointInPolygon } from "@turf/turf";
import {
  poiTaxonomy,
  getCategoryColor,
  getSubcategoryIcon,
  getMainCategories,
  getSubcategories,
  type POIMainCategoryKey,
} from "~/lib/poi-taxonomy";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { GlassButton } from "~/components/ui/glass-button";
import {
  MapPin,
  Upload,
  X,
  Search,
  Save,
  Send,
  Trash2,
  Move,
  Check,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface POIEditorProps {
  countryId: string;
  countryGeometry?: Feature<Polygon | MultiPolygon> | null;
  subdivisionId?: string;
  mode?: "create" | "edit";
  poiId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface POIFormData {
  name: string;
  mainCategory: POIMainCategoryKey | "";
  subcategory: string;
  description: string;
  images: string[];
  coordinates: {
    lat: number;
    lng: number;
  } | null;
}

interface ValidationErrors {
  name?: string;
  mainCategory?: string;
  subcategory?: string;
  coordinates?: string;
  images?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the appropriate Lucide icon component from icon name string
 */
function getLucideIcon(iconName: string): LucideIcon {
  const IconComponent = (Icons as any)[iconName];
  return IconComponent || Icons.MapPin;
}

/**
 * Validate image URL format
 */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Validate coordinates are within reasonable bounds
 */
function validateCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Check if coordinates are within country geometry using Turf.js
 * Returns true if point is inside the country boundary polygon
 */
function isWithinCountryGeometry(
  lat: number,
  lng: number,
  geometry?: Feature<Polygon | MultiPolygon> | null
): boolean {
  if (!geometry) {
    return true; // No geometry to check against - allow placement
  }

  try {
    const point = {
      type: "Point" as const,
      coordinates: [lng, lat] as [number, number],
    };

    // Use Turf.js to check if point is within polygon
    return booleanPointInPolygon(point, geometry);
  } catch (error) {
    console.error("[POIEditor] Error checking point in polygon:", error);
    return true; // On error, allow placement (fail open)
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function POIEditor({
  countryId,
  countryGeometry,
  subdivisionId,
  mode = "create",
  poiId,
  onSuccess,
  onCancel,
}: POIEditorProps) {
  // ============================================================================
  // State Management
  // ============================================================================

  const [formData, setFormData] = useState<POIFormData>({
    name: "",
    mainCategory: "",
    subcategory: "",
    description: "",
    images: [],
    coordinates: null,
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [imageUrlInput, setImageUrlInput] = useState("");
  // Auto-activate marker placement for new POIs
  const [isPlacingMarker, setIsPlacingMarker] = useState(mode === "create");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false);

  // ============================================================================
  // Effect: Listen for map clicks when placing marker
  // ============================================================================

  useEffect(() => {
    if (!isPlacingMarker) return;

    const handleMapClickEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { coordinates } = customEvent.detail;

      // Check if coordinates are within country geometry
      const withinGeometry = countryGeometry
        ? isWithinCountryGeometry(coordinates.lat, coordinates.lng, countryGeometry)
        : true;

      if (!withinGeometry) {
        setValidationErrors((prev) => ({
          ...prev,
          coordinates: "ERROR: This location is outside your country's boundaries. POIs must be placed within your territory.",
        }));
      } else {
        setValidationErrors((prev) => ({
          ...prev,
          coordinates: undefined,
        }));
      }

      setFormData((prev) => ({
        ...prev,
        coordinates: {
          lat: coordinates.lat,
          lng: coordinates.lng,
        },
      }));
      setIsPlacingMarker(false);
    };

    window.addEventListener("mapeditor:click", handleMapClickEvent);

    return () => {
      window.removeEventListener("mapeditor:click", handleMapClickEvent);
    };
  }, [isPlacingMarker]);

  // ============================================================================
  // tRPC Queries and Mutations
  // ============================================================================

  const utils = api.useUtils();

  const createPOI = api.mapEditor.createPOI.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh the POI lists
      void utils.mapEditor.getCountryPOIs.invalidate();
      void utils.mapEditor.getMyPOIs.invalidate();

      onSuccess?.();
    },
    onError: (error) => {
      console.error("[POIEditor] Create error:", error);
      setValidationErrors((prev) => ({
        ...prev,
        name: error.message || "Failed to create POI",
      }));
    },
  });

  const updatePOI = api.mapEditor.updatePOI.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh the POI lists
      void utils.mapEditor.getCountryPOIs.invalidate();
      void utils.mapEditor.getMyPOIs.invalidate();

      onSuccess?.();
    },
    onError: (error) => {
      console.error("[POIEditor] Update error:", error);
      setValidationErrors((prev) => ({
        ...prev,
        name: error.message || "Failed to update POI",
      }));
    },
  });

  const deletePOI = api.mapEditor.deletePOI.useMutation({
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (error) => {
      console.error("[POIEditor] Delete error:", error);
      alert(error.message || "Failed to delete POI");
    },
  });

  const submitPOIForReview = api.mapEditor.submitPOIForReview.useMutation({
    onSuccess: () => {
      console.log("[POIEditor] POI submitted for review successfully");
      onSuccess?.();
    },
    onError: (error) => {
      console.error("[POIEditor] Submit for review error:", error);
      setValidationErrors((prev) => ({
        ...prev,
        name: error.message || "Failed to submit for review",
      }));
    },
  });

  // Query existing POI data if in edit mode
  const { data: existingPOI } = api.mapEditor.getMyPOIs.useQuery(
    {
      limit: 1,
      offset: 0,
    },
    {
      enabled: mode === "edit" && !!poiId,
    }
  );

  // ============================================================================
  // Computed Values
  // ============================================================================

  const mainCategories = useMemo(() => getMainCategories(), []);

  const subcategories = useMemo(() => {
    if (!formData.mainCategory) return [];
    return getSubcategories(formData.mainCategory);
  }, [formData.mainCategory]);

  const currentCategoryColor = useMemo(() => {
    if (!formData.mainCategory) return "#6B7280";
    return getCategoryColor(formData.mainCategory);
  }, [formData.mainCategory]);

  const currentIcon = useMemo(() => {
    if (!formData.mainCategory || !formData.subcategory) return Icons.MapPin;
    const iconName = getSubcategoryIcon(formData.mainCategory, formData.subcategory);
    return getLucideIcon(iconName);
  }, [formData.mainCategory, formData.subcategory]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return mainCategories;
    const query = searchQuery.toLowerCase();
    return mainCategories.filter(
      (cat) =>
        cat.label.toLowerCase().includes(query) ||
        Object.values(poiTaxonomy[cat.key]!.subcategories).some((sub) =>
          sub.label.toLowerCase().includes(query)
        )
    );
  }, [mainCategories, searchQuery]);

  const isOutOfBounds = useMemo(() => {
    if (!formData.coordinates) return false;

    // Check if coordinates are within country geometry
    if (countryGeometry && !isWithinCountryGeometry(
      formData.coordinates.lat,
      formData.coordinates.lng,
      countryGeometry
    )) {
      return true;
    }

    return false;
  }, [formData.coordinates, countryGeometry]);

  // ============================================================================
  // Validation
  // ============================================================================

  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = "Name is required";
    } else if (formData.name.length > 200) {
      errors.name = "Name must be 200 characters or less";
    }

    // Category validation
    if (!formData.mainCategory) {
      errors.mainCategory = "Main category is required";
    }

    if (!formData.subcategory) {
      errors.subcategory = "Subcategory is required";
    }

    // Coordinates validation
    if (!formData.coordinates) {
      errors.coordinates = "Please place a marker on the map";
    } else if (
      !validateCoordinates(formData.coordinates.lat, formData.coordinates.lng)
    ) {
      errors.coordinates = "Invalid coordinates";
    } else if (isOutOfBounds) {
      errors.coordinates = "POI marker is outside country boundaries";
    }

    // Image validation
    const invalidImages = formData.images.filter((url) => !isValidImageUrl(url));
    if (invalidImages.length > 0) {
      errors.images = `Invalid image URLs: ${invalidImages.join(", ")}`;
    }

    if (formData.images.length > 5) {
      errors.images = "Maximum 5 images allowed";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, isOutOfBounds]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleFieldChange = useCallback(
    (field: keyof POIFormData, value: any) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear validation error for this field
      setValidationErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    },
    []
  );

  const handleMainCategoryChange = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      mainCategory: value as POIMainCategoryKey,
      subcategory: "", // Reset subcategory when main category changes
    }));
    setValidationErrors((prev) => ({
      ...prev,
      mainCategory: undefined,
      subcategory: undefined,
    }));
  }, []);

  const handleAddImage = useCallback(() => {
    if (!imageUrlInput.trim()) return;

    if (!isValidImageUrl(imageUrlInput)) {
      setValidationErrors((prev) => ({
        ...prev,
        images: "Invalid image URL format",
      }));
      return;
    }

    if (formData.images.length >= 5) {
      setValidationErrors((prev) => ({
        ...prev,
        images: "Maximum 5 images allowed",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, imageUrlInput.trim()],
    }));
    setImageUrlInput("");
    setValidationErrors((prev) => ({
      ...prev,
      images: undefined,
    }));
  }, [imageUrlInput, formData.images]);

  const handleRemoveImage = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  }, []);

  const handlePlaceMarker = useCallback(() => {
    setIsPlacingMarker(true);
    // Map click event listener (in useEffect) will capture coordinates
  }, []);

  const handleCoordinateChange = useCallback(
    (type: "lat" | "lng", value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return;

      setFormData((prev) => ({
        ...prev,
        coordinates: {
          lat: type === "lat" ? numValue : prev.coordinates?.lat ?? 0,
          lng: type === "lng" ? numValue : prev.coordinates?.lng ?? 0,
        },
      }));
    },
    []
  );

  const handleSaveDraft = useCallback(async () => {
    // Validate form first
    if (!validateForm()) {
      console.warn("[POIEditor] Validation failed, cannot save");
      return;
    }

    // Build POI data structure matching the router schema
    const poiData = {
      countryId,
      subdivisionId: subdivisionId || undefined,
      name: formData.name.trim(),
      category: formData.mainCategory as any, // Maps to enum: monument, landmark, military, cultural, natural, religious, government
      icon: formData.subcategory || undefined,
      coordinates: {
        type: "Point" as const,
        coordinates: [formData.coordinates!.lng, formData.coordinates!.lat] as [number, number],
      },
      description: formData.description.trim() || undefined,
      images: formData.images.length > 0 ? formData.images : undefined,
      metadata: {
        mainCategory: formData.mainCategory,
        subcategory: formData.subcategory,
      },
    };

    console.log("[POIEditor] Saving POI:", { mode, poiId, poiData });

    try {
      if (mode === "edit" && poiId) {
        // Update existing POI
        await updatePOI.mutateAsync({ id: poiId, ...poiData });
        console.log("[POIEditor] POI updated successfully");
      } else {
        // Create new POI
        await createPOI.mutateAsync(poiData);
        console.log("[POIEditor] POI created successfully");
      }
    } catch (error) {
      console.error("[POIEditor] Save failed:", error);
      // Error handling is done in mutation onError callbacks
    }
  }, [
    validateForm,
    formData,
    countryId,
    subdivisionId,
    mode,
    poiId,
    createPOI,
    updatePOI,
  ]);

  const handleSubmitForReview = useCallback(async () => {
    // Validate form first
    if (!validateForm()) {
      console.warn("[POIEditor] Validation failed, cannot submit");
      return;
    }

    // Build POI data structure matching the router schema
    const poiData = {
      countryId,
      subdivisionId: subdivisionId || undefined,
      name: formData.name.trim(),
      category: formData.mainCategory as any,
      icon: formData.subcategory || undefined,
      coordinates: {
        type: "Point" as const,
        coordinates: [formData.coordinates!.lng, formData.coordinates!.lat] as [number, number],
      },
      description: formData.description.trim() || undefined,
      images: formData.images.length > 0 ? formData.images : undefined,
      metadata: {
        mainCategory: formData.mainCategory,
        subcategory: formData.subcategory,
      },
    };

    console.log("[POIEditor] Submitting POI for review:", { mode, poiId, poiData });

    try {
      let savedPoiId = poiId;

      if (mode === "edit" && poiId) {
        // Update existing POI (keeps draft status)
        await updatePOI.mutateAsync({ id: poiId, ...poiData });
        console.log("[POIEditor] POI updated");
      } else {
        // Create new POI (created with draft status)
        const result = await createPOI.mutateAsync(poiData);
        savedPoiId = result.poi.id;
        console.log("[POIEditor] POI created:", savedPoiId);
      }

      // Now submit for review (changes status from draft to pending)
      if (savedPoiId) {
        await submitPOIForReview.mutateAsync({ id: savedPoiId });
        console.log("[POIEditor] POI submitted for review");
      }

      // Success callback will be triggered by submitPOIForReview onSuccess
    } catch (error) {
      console.error("[POIEditor] Submit failed:", error);
      // Error handling is done in mutation onError callbacks
    }
  }, [
    validateForm,
    formData,
    countryId,
    subdivisionId,
    mode,
    poiId,
    createPOI,
    updatePOI,
    submitPOIForReview,
  ]);

  const handleDelete = useCallback(() => {
    if (!poiId) return;
    if (confirm("Are you sure you want to delete this POI?")) {
      deletePOI.mutate({ id: poiId });
    }
  }, [poiId, deletePOI]);

  // ============================================================================
  // Icon Preview Component
  // ============================================================================

  const IconPreview = () => {
    const Icon = currentIcon;
    return (
      <motion.div
        className="flex items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all"
        style={{
          borderColor: currentCategoryColor,
          backgroundColor: `${currentCategoryColor}15`,
        }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div
          className="p-4 rounded-full"
          style={{ backgroundColor: `${currentCategoryColor}30` }}
        >
          <Icon
            className="w-8 h-8"
            style={{ color: currentCategoryColor, strokeWidth: 2 }}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Icon Preview
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formData.subcategory
              ? poiTaxonomy[formData.mainCategory]?.subcategories[
                  formData.subcategory
                ]?.label
              : "Select a subcategory"}
          </p>
        </div>
      </motion.div>
    );
  };

  // ============================================================================
  // Category Browser Component
  // ============================================================================

  const CategoryBrowser = () => (
    <AnimatePresence>
      {showCategoryBrowser && (
        <motion.div
          className="absolute inset-0 z-50 bg-white dark:bg-slate-900 backdrop-blur-lg p-6 overflow-y-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Category Browser
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCategoryBrowser(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
                <Input
                  placeholder="Search categories and subcategories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCategories.map((category) => {
                const subcats = getSubcategories(category.key);
                return (
                  <div
                    key={category.key}
                    className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 backdrop-blur-sm"
                    style={{ borderColor: `${category.color}40` }}
                  >
                    <h4
                      className="font-semibold mb-3 flex items-center gap-2"
                      style={{ color: category.color }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.label}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {subcats.map((subcat) => {
                        const Icon = getLucideIcon(subcat.icon);
                        const isSelected =
                          formData.mainCategory === category.key &&
                          formData.subcategory === subcat.key;

                        return (
                          <button
                            key={subcat.key}
                            onClick={() => {
                              handleMainCategoryChange(String(category.key));
                              handleFieldChange("subcategory", String(subcat.key));
                              setShowCategoryBrowser(false);
                            }}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg transition-all text-left",
                              "hover:bg-slate-200 dark:hover:bg-slate-700/50 border",
                              isSelected
                                ? "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                                : "bg-slate-100 dark:bg-slate-800/30 border-transparent"
                            )}
                          >
                            <Icon
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: category.color }}
                            />
                            <span className="text-sm text-slate-900 dark:text-white flex-1">
                              {subcat.label}
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-green-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="relative h-full flex flex-col bg-white dark:bg-slate-900 backdrop-blur-xl">
      <CategoryBrowser />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {mode === "edit" ? "Edit" : "Create"} Point of Interest
          </h2>
          {mode === "edit" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deletePOI.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>

        {/* Prominent Click Instructions (when placing marker) */}
        {isPlacingMarker && !formData.coordinates && (
          <div className="glass-panel bg-blue-500/20 border border-blue-400/30 p-5 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/30 animate-pulse">
                <MapPin className="w-8 h-8 text-blue-300 animate-bounce" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold text-white mb-2">
                  📍 Click the map to place your POI
                </p>
                <p className="text-sm text-blue-200">
                  Click anywhere on the map to set the location for this point of interest. Ensure it's within your country's borders.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="poi-name" className="text-slate-900 dark:text-white mb-2">
            Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="poi-name"
            placeholder="e.g., Grand Cathedral, City Hall, Monument Park"
            value={formData.name}
            onChange={(e) => handleFieldChange("name", e.target.value)}
            maxLength={200}
            aria-invalid={!!validationErrors.name}
            className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {validationErrors.name && (
            <p className="text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {validationErrors.name}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formData.name.length}/200 characters
          </p>
        </div>

        {/* Category Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="main-category" className="text-slate-900 dark:text-white mb-2">
              Main Category <span className="text-red-400">*</span>
            </Label>
            <Select
              value={formData.mainCategory ? String(formData.mainCategory) : undefined}
              onValueChange={handleMainCategoryChange}
            >
              <SelectTrigger
                id="main-category"
                aria-invalid={!!validationErrors.mainCategory}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <SelectValue placeholder="Select main category" />
              </SelectTrigger>
              <SelectContent>
                {mainCategories.map((cat) => (
                  <SelectItem key={cat.key} value={String(cat.key)}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.mainCategory && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {validationErrors.mainCategory}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subcategory" className="text-slate-900 dark:text-white mb-2">
              Subcategory <span className="text-red-400">*</span>
            </Label>
            <Select
              value={formData.subcategory}
              onValueChange={(value) => handleFieldChange("subcategory", value)}
              disabled={!formData.mainCategory}
            >
              <SelectTrigger
                id="subcategory"
                aria-invalid={!!validationErrors.subcategory}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <SelectValue placeholder="Select subcategory" />
              </SelectTrigger>
              <SelectContent>
                {subcategories.map((subcat) => {
                  const Icon = getLucideIcon(subcat.icon);
                  return (
                    <SelectItem key={subcat.key} value={subcat.key}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {subcat.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {validationErrors.subcategory && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {validationErrors.subcategory}
              </p>
            )}
          </div>
        </div>

        {/* Category Browser Button */}
        <Button
          variant="outline"
          onClick={() => setShowCategoryBrowser(true)}
          className="w-full"
        >
          <Search className="w-4 h-4 mr-2" />
          Browse All Categories
        </Button>

        {/* Icon Preview */}
        {formData.mainCategory && formData.subcategory && <IconPreview />}

        {/* Coordinates */}
        <div className="space-y-2">
          <Label className="text-slate-900 dark:text-white mb-2">
            Coordinates <span className="text-red-400">*</span>
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={handlePlaceMarker}
              className={cn(
                "md:col-span-1",
                isPlacingMarker && "border-warning bg-warning/10"
              )}
            >
              {isPlacingMarker ? (
                <>
                  <Move className="w-4 h-4 mr-2" />
                  Click Map to Place
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 mr-2" />
                  Place Marker
                </>
              )}
            </Button>
            <Input
              placeholder="Latitude"
              type="number"
              step="0.000001"
              value={formData.coordinates?.lat ?? ""}
              onChange={(e) => handleCoordinateChange("lat", e.target.value)}
              disabled={!formData.coordinates}
              className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <Input
              placeholder="Longitude"
              type="number"
              step="0.000001"
              value={formData.coordinates?.lng ?? ""}
              onChange={(e) => handleCoordinateChange("lng", e.target.value)}
              disabled={!formData.coordinates}
              className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          {validationErrors.coordinates && (
            <p className="text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {validationErrors.coordinates}
            </p>
          )}

          {/* Boundary Warning */}
          {isOutOfBounds && formData.coordinates && (
            <div className="mt-3 flex items-start gap-3 rounded-lg bg-red-500/20 border border-red-500/30 p-4 text-sm text-red-400">
              <AlertTriangle className="mt-0.5 w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-300">⚠️ Invalid Location - Outside Country Boundaries</p>
                <p className="mt-1.5 text-xs opacity-90">
                  The marker is currently placed outside your country's territory.
                  Please click "Place on Map" and select a location within your borders.
                </p>
                <p className="mt-2 text-xs font-medium">
                  → Save and submit buttons are disabled until the POI is placed within valid boundaries.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-slate-900 dark:text-white mb-2">
            Description <span className="text-slate-500 dark:text-slate-400">(Optional)</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Describe this point of interest... (Supports Markdown)"
            value={formData.description}
            onChange={(e) => handleFieldChange("description", e.target.value)}
            rows={4}
            maxLength={2000}
            className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formData.description.length}/2000 characters. Markdown supported.
          </p>
        </div>

        {/* Images */}
        <div className="space-y-3">
          <Label className="text-slate-900 dark:text-white mb-2">
            Images <span className="text-slate-500 dark:text-slate-400">(Optional, max 5)</span>
          </Label>

          {/* Image URL Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Image URL (https://...)"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddImage();
                }
              }}
              className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <Button onClick={handleAddImage} disabled={!imageUrlInput.trim()}>
              <Upload className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>

          {validationErrors.images && (
            <p className="text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {validationErrors.images}
            </p>
          )}

          {/* Image Preview Grid */}
          {formData.images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {formData.images.map((url, index) => (
                <div
                  key={index}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                >
                  <img
                    src={url}
                    alt={`POI image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "";
                      e.currentTarget.className =
                        "w-full h-full flex items-center justify-center bg-slate-700";
                      e.currentTarget.alt = "Failed to load image";
                    }}
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Image Upload Placeholder */}
          {formData.images.length === 0 && (
            <div className="flex items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/30">
              <div className="text-center">
                <ImageIcon className="w-12 h-12 mx-auto text-slate-500 dark:text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-300">No images added</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add image URLs above
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="sticky bottom-0 p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 backdrop-blur-lg">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>

          <div className="flex gap-2">
            <GlassButton
              variant="neutral"
              onClick={handleSaveDraft}
              disabled={createPOI.isPending || updatePOI.isPending || submitPOIForReview.isPending || isOutOfBounds}
              title={isOutOfBounds ? "Cannot save: POI is outside country boundaries" : undefined}
            >
              <Save className="w-4 h-4 mr-2" />
              {createPOI.isPending || updatePOI.isPending ? "Saving..." : "Save Draft"}
            </GlassButton>

            <GlassButton
              variant="primary"
              glow
              onClick={handleSubmitForReview}
              disabled={createPOI.isPending || updatePOI.isPending || submitPOIForReview.isPending || isOutOfBounds}
              title={isOutOfBounds ? "Cannot submit: POI is outside country boundaries" : undefined}
            >
              <Send className="w-4 h-4 mr-2" />
              {createPOI.isPending || updatePOI.isPending || submitPOIForReview.isPending
                ? "Submitting..."
                : "Submit for Review"}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );
}
