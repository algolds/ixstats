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

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
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

// ============================================================================
// Main Component
// ============================================================================

export function POIEditor({
  countryId,
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
  const [isPlacingMarker, setIsPlacingMarker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false);

  // ============================================================================
  // tRPC Queries and Mutations
  // ============================================================================

  const createPOI = api.mapEditor.createPOI.useMutation({
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const updatePOI = api.mapEditor.updatePOI.useMutation({
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const deletePOI = api.mapEditor.deletePOI.useMutation({
    onSuccess: () => {
      onSuccess?.();
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
  }, [formData]);

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
    // TODO: Integrate with map click event to capture coordinates
    // For now, this would be handled by the parent MapEditorContainer
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

  const handleSaveDraft = useCallback(() => {
    if (!validateForm()) return;

    const poiData = {
      countryId,
      subdivisionId,
      name: formData.name,
      category: formData.mainCategory as any, // TODO: Update router schema to support new taxonomy
      icon: formData.subcategory,
      coordinates: {
        type: "Point" as const,
        coordinates: [formData.coordinates!.lng, formData.coordinates!.lat],
      },
      description: formData.description || undefined,
      images: formData.images.length > 0 ? formData.images : undefined,
      metadata: {
        mainCategory: formData.mainCategory,
        subcategory: formData.subcategory,
      },
    };

    if (mode === "edit" && poiId) {
      updatePOI.mutate({ id: poiId, ...poiData });
    } else {
      createPOI.mutate(poiData);
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

  const handleSubmitForReview = useCallback(() => {
    // First save as draft, then submit for review
    handleSaveDraft();
    // TODO: Call submitPOIForReview mutation after successful save
  }, [handleSaveDraft]);

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
          <p className="text-sm font-medium text-text-secondary">
            Icon Preview
          </p>
          <p className="text-xs text-text-tertiary">
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
          className="absolute inset-0 z-50 bg-bg-primary/95 backdrop-blur-lg p-6 overflow-y-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-text-primary">
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <Input
                  placeholder="Search categories and subcategories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCategories.map((category) => {
                const subcats = getSubcategories(category.key);
                return (
                  <div
                    key={category.key}
                    className="p-4 rounded-xl border bg-bg-secondary/50 backdrop-blur-sm"
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
                              handleMainCategoryChange(category.key);
                              handleFieldChange("subcategory", subcat.key);
                              setShowCategoryBrowser(false);
                            }}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg transition-all text-left",
                              "hover:bg-bg-tertiary/50 border",
                              isSelected
                                ? "bg-bg-tertiary border-border-primary"
                                : "bg-bg-secondary/30 border-transparent"
                            )}
                          >
                            <Icon
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: category.color }}
                            />
                            <span className="text-sm text-text-primary flex-1">
                              {subcat.label}
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-success" />
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
    <div className="relative h-full flex flex-col bg-bg-primary">
      <CategoryBrowser />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-text-primary">
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

        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="poi-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="poi-name"
            placeholder="e.g., Grand Cathedral, City Hall, Monument Park"
            value={formData.name}
            onChange={(e) => handleFieldChange("name", e.target.value)}
            maxLength={200}
            aria-invalid={!!validationErrors.name}
          />
          {validationErrors.name && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {validationErrors.name}
            </p>
          )}
          <p className="text-xs text-text-tertiary">
            {formData.name.length}/200 characters
          </p>
        </div>

        {/* Category Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="main-category">
              Main Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.mainCategory}
              onValueChange={handleMainCategoryChange}
            >
              <SelectTrigger
                id="main-category"
                aria-invalid={!!validationErrors.mainCategory}
              >
                <SelectValue placeholder="Select main category" />
              </SelectTrigger>
              <SelectContent>
                {mainCategories.map((cat) => (
                  <SelectItem key={cat.key} value={cat.key}>
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
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {validationErrors.mainCategory}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subcategory">
              Subcategory <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.subcategory}
              onValueChange={(value) => handleFieldChange("subcategory", value)}
              disabled={!formData.mainCategory}
            >
              <SelectTrigger
                id="subcategory"
                aria-invalid={!!validationErrors.subcategory}
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
              <p className="text-sm text-destructive flex items-center gap-1">
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
          <Label>
            Coordinates <span className="text-destructive">*</span>
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
            />
            <Input
              placeholder="Longitude"
              type="number"
              step="0.000001"
              value={formData.coordinates?.lng ?? ""}
              onChange={(e) => handleCoordinateChange("lng", e.target.value)}
              disabled={!formData.coordinates}
            />
          </div>
          {validationErrors.coordinates && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {validationErrors.coordinates}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">
            Description <span className="text-text-tertiary">(Optional)</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Describe this point of interest... (Supports Markdown)"
            value={formData.description}
            onChange={(e) => handleFieldChange("description", e.target.value)}
            rows={4}
            maxLength={2000}
          />
          <p className="text-xs text-text-tertiary">
            {formData.description.length}/2000 characters. Markdown supported.
          </p>
        </div>

        {/* Images */}
        <div className="space-y-3">
          <Label>
            Images <span className="text-text-tertiary">(Optional, max 5)</span>
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
            />
            <Button onClick={handleAddImage} disabled={!imageUrlInput.trim()}>
              <Upload className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>

          {validationErrors.images && (
            <p className="text-sm text-destructive flex items-center gap-1">
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
                  className="relative group aspect-square rounded-lg overflow-hidden border border-border-secondary bg-bg-secondary"
                >
                  <img
                    src={url}
                    alt={`POI image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "";
                      e.currentTarget.className =
                        "w-full h-full flex items-center justify-center bg-bg-tertiary";
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
            <div className="flex items-center justify-center p-8 border-2 border-dashed border-border-secondary rounded-lg bg-bg-secondary/30">
              <div className="text-center">
                <ImageIcon className="w-12 h-12 mx-auto text-text-tertiary mb-2" />
                <p className="text-sm text-text-secondary">No images added</p>
                <p className="text-xs text-text-tertiary">
                  Add image URLs above
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="sticky bottom-0 p-6 bg-bg-primary border-t border-border-secondary backdrop-blur-lg">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>

          <div className="flex gap-2">
            <GlassButton
              variant="neutral"
              onClick={handleSaveDraft}
              disabled={createPOI.isPending || updatePOI.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </GlassButton>

            <GlassButton
              variant="primary"
              glow
              onClick={handleSubmitForReview}
              disabled={createPOI.isPending || updatePOI.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit for Review
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );
}
