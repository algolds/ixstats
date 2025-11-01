/**
 * CityPlacement Component
 *
 * Interactive tool for placing and managing city markers on the map.
 * Supports click-to-place functionality with auto-detection of subdivisions,
 * comprehensive metadata forms, and different marker styles based on city type.
 *
 * Features:
 * - Point placement with lat/lng display
 * - Auto-detect subdivision from coordinates
 * - Type-specific icons (capital/city/town/village)
 * - Validation for country bounds and national capitals
 * - Draft/Review workflow integration
 * - Glass physics styling with professional UX
 */

"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Crown,
  Building2,
  Home,
  House,
  MapPin,
  Move,
  Save,
  Send,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import type { Feature, Polygon, MultiPolygon } from "geojson";
// @ts-ignore - @turf/turf lacks declaration files
import { booleanPointInPolygon } from "@turf/turf";

// ============================================================================
// Types & Interfaces
// ============================================================================

type CityType = "capital" | "city" | "town" | "village";

interface CityFormData {
  name: string;
  type: CityType;
  population: string;
  elevation: string;
  foundedYear: string;
  isNationalCapital: boolean;
  isSubdivisionCapital: boolean;
  description: string;
}

interface CityMarker {
  id?: string;
  lat: number;
  lng: number;
  formData: CityFormData;
  subdivisionId?: string | null;
  status?: "draft" | "pending" | "approved" | "rejected";
}

interface ValidationError {
  field: string;
  message: string;
}

interface CityPlacementProps {
  countryId: string;
  countryBounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  countryGeometry?: Feature<Polygon | MultiPolygon> | null;
  onCityPlaced?: (city: CityMarker) => void;
  onCityUpdated?: (city: CityMarker) => void;
  onCityDeleted?: (cityId: string) => void;
  initialCity?: CityMarker;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get icon component based on city type
 */
function getCityIcon(type: CityType, isNationalCapital: boolean) {
  if (isNationalCapital) {
    return <Crown className="size-5" />;
  }

  switch (type) {
    case "capital":
      return <Crown className="size-5" />;
    case "city":
      return <Building2 className="size-4" />;
    case "town":
      return <Home className="size-4" />;
    case "village":
      return <House className="size-3.5" />;
    default:
      return <MapPin className="size-4" />;
  }
}

/**
 * Get marker size based on city type
 */
function getMarkerSize(type: CityType, isNationalCapital: boolean): string {
  if (isNationalCapital) return "w-8 h-8";
  switch (type) {
    case "capital":
      return "w-7 h-7";
    case "city":
      return "w-6 h-6";
    case "town":
      return "w-5 h-5";
    case "village":
      return "w-4 h-4";
    default:
      return "w-5 h-5";
  }
}

/**
 * Validate form data
 */
function validateFormData(
  data: CityFormData,
  hasNationalCapital: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Name validation
  if (!data.name.trim()) {
    errors.push({ field: "name", message: "City name is required" });
  } else if (data.name.length > 200) {
    errors.push({ field: "name", message: "Name must be 200 characters or less" });
  }

  // Population validation
  if (data.population && isNaN(Number(data.population))) {
    errors.push({ field: "population", message: "Population must be a number" });
  } else if (data.population && Number(data.population) < 0) {
    errors.push({ field: "population", message: "Population cannot be negative" });
  }

  // Elevation validation
  if (data.elevation && isNaN(Number(data.elevation))) {
    errors.push({ field: "elevation", message: "Elevation must be a number" });
  }

  // Founded year validation
  if (data.foundedYear) {
    const year = Number(data.foundedYear);
    const currentYear = new Date().getFullYear();
    if (isNaN(year)) {
      errors.push({ field: "foundedYear", message: "Year must be a number" });
    } else if (year < 0 || year > currentYear) {
      errors.push({
        field: "foundedYear",
        message: `Year must be between 0 and ${currentYear}`,
      });
    } else if (data.foundedYear.length !== 4) {
      errors.push({ field: "foundedYear", message: "Year must be 4 digits" });
    }
  }

  // National capital validation
  if (data.isNationalCapital && hasNationalCapital) {
    errors.push({
      field: "isNationalCapital",
      message: "This country already has a national capital",
    });
  }

  return errors;
}

/**
 * Check if coordinates are within country bounds (bounding box check)
 */
function isWithinBounds(
  lat: number,
  lng: number,
  bounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }
): boolean {
  if (!bounds) return true;
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

/**
 * Check if coordinates are within country geometry (precise point-in-polygon check)
 * Uses Turf.js booleanPointInPolygon for accurate validation
 */
function isWithinCountryGeometry(
  lat: number,
  lng: number,
  geometry?: Feature<Polygon | MultiPolygon> | null
): boolean {
  if (!geometry) return true; // No geometry provided, skip validation

  try {
    // Create GeoJSON point from coordinates
    const point: Feature<{ type: "Point"; coordinates: [number, number] }> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: [lng, lat], // GeoJSON uses [lng, lat] order
      },
    };

    // Use Turf.js to check if point is within polygon
    return booleanPointInPolygon(point, geometry);
  } catch (error) {
    console.error("Error checking point in polygon:", error);
    return true; // On error, allow placement (fail open)
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function CityPlacement({
  countryId,
  countryBounds,
  countryGeometry,
  onCityPlaced,
  onCityUpdated,
  onCityDeleted,
  initialCity,
}: CityPlacementProps) {
  // ============================================================================
  // State Management
  // ============================================================================

  const [mode, setMode] = useState<"place" | "move" | "edit">(
    initialCity ? "edit" : "place"
  );
  const [marker, setMarker] = useState<CityMarker | null>(initialCity ?? null);
  const [formData, setFormData] = useState<CityFormData>(
    initialCity?.formData ?? {
      name: "",
      type: "city",
      population: "",
      elevation: "",
      foundedYear: "",
      isNationalCapital: false,
      isSubdivisionCapital: false,
      description: "",
    }
  );
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>("");

  // ============================================================================
  // Data Fetching
  // ============================================================================

  // Get existing cities to check for national capital
  const { data: existingCities } = api.mapEditor.getCountryCities.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Get subdivisions for auto-detection
  const { data: subdivisions } = api.mapEditor.getCountrySubdivisions.useQuery(
    { countryId, includeGeometry: true },
    { enabled: !!countryId }
  );

  // ============================================================================
  // Mutations
  // ============================================================================

  const createCity = api.mapEditor.createCity.useMutation({
    onSuccess: (data) => {
      console.log("[CityPlacement] Create city SUCCESS:", data);
      setSuccessMessage("City saved as draft!");
      if (onCityPlaced && marker) {
        onCityPlaced({
          ...marker,
          id: data.city.id,
          status: data.city.status as "draft" | "pending",
        });
      }
      // Reset form
      setTimeout(() => {
        handleReset();
      }, 2000);
    },
    onError: (error) => {
      console.error("[CityPlacement] Create city ERROR:", error);
      setErrors([{ field: "general", message: error.message }]);
    },
  });

  const updateCity = api.mapEditor.updateCity.useMutation({
    onSuccess: (data) => {
      setSuccessMessage("City updated successfully!");
      if (onCityUpdated && marker) {
        onCityUpdated({
          ...marker,
          status: data.city.status as "draft" | "pending",
        });
      }
    },
    onError: (error) => {
      setErrors([{ field: "general", message: error.message }]);
    },
  });

  const deleteCity = api.mapEditor.deleteCity.useMutation({
    onSuccess: () => {
      setSuccessMessage("City deleted successfully!");
      if (onCityDeleted && marker?.id) {
        onCityDeleted(marker.id);
      }
      handleReset();
    },
    onError: (error) => {
      setErrors([{ field: "general", message: error.message }]);
    },
  });

  const submitForReview = api.mapEditor.submitCityForReview.useMutation({
    onSuccess: () => {
      setSuccessMessage("City submitted for review!");
      setTimeout(() => {
        handleReset();
      }, 2000);
    },
    onError: (error) => {
      setErrors([{ field: "general", message: error.message }]);
    },
  });

  // ============================================================================
  // Map Click Event Listener
  // ============================================================================

  useEffect(() => {
    if (mode !== "place" && mode !== "move") return;

    const handleMapClickEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { coordinates } = customEvent.detail;

      // Validate coordinates are within country geometry
      const withinBounds = countryBounds
        ? isWithinBounds(coordinates.lat, coordinates.lng, countryBounds)
        : true;
      const withinGeometry = countryGeometry
        ? isWithinCountryGeometry(coordinates.lat, coordinates.lng, countryGeometry)
        : true;

      // Check boundaries and show immediate error if outside
      if (!withinBounds || !withinGeometry) {
        setErrors([
          {
            field: "coordinates",
            message: "ERROR: This location is outside your country's boundaries. Cities must be placed within your territory.",
          },
        ]);
        // Still allow placement (marker will be shown as invalid)
        // but save will be prevented by isOutOfBounds check
      } else {
        // Clear coordinate errors if within bounds
        setErrors((prev) => prev.filter((e) => e.field !== "coordinates"));
      }

      // Auto-detect subdivision (simplified - would need actual point-in-polygon check)
      let detectedSubdivisionId: string | null = null;
      if (subdivisions?.subdivisions) {
        // TODO: Implement actual point-in-polygon check with subdivision geometries
        // For now, just set to null
        detectedSubdivisionId = null;
      }

      setMarker({
        lat: coordinates.lat,
        lng: coordinates.lng,
        subdivisionId: detectedSubdivisionId,
        formData,
      });

      if (mode === "place") {
        setMode("edit");
      }
    };

    window.addEventListener("mapeditor:click", handleMapClickEvent);

    return () => {
      window.removeEventListener("mapeditor:click", handleMapClickEvent);
    };
  }, [mode, subdivisions?.subdivisions, formData, countryBounds, countryGeometry]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const hasNationalCapital = useMemo(() => {
    if (!existingCities?.cities) return false;
    return existingCities.cities.some(
      (city) => city.isNationalCapital && city.id !== marker?.id
    );
  }, [existingCities?.cities, marker?.id]);

  const isOutOfBounds = useMemo(() => {
    if (!marker) return false;

    // First check bounding box (fast, approximate check)
    if (countryBounds && !isWithinBounds(marker.lat, marker.lng, countryBounds)) {
      return true;
    }

    // Then check precise geometry (slower, accurate check)
    if (countryGeometry && !isWithinCountryGeometry(marker.lat, marker.lng, countryGeometry)) {
      return true;
    }

    return false;
  }, [marker, countryBounds, countryGeometry]);

  const nearestCity = useMemo(() => {
    if (!marker || !existingCities?.cities || existingCities.cities.length === 0) {
      return null;
    }

    let nearest: any = null;
    let minDistance = Infinity;

    existingCities.cities.forEach((city) => {
      if (city.id === marker.id) return; // Skip self

      const coords = city.coordinates as { coordinates: [number, number] };
      const [lng, lat] = coords.coordinates;

      // Simple Euclidean distance (good enough for proximity check)
      const distance = Math.sqrt(
        Math.pow(lat - marker.lat, 2) + Math.pow(lng - marker.lng, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = { city, distance };
      }
    });

    return nearest
      ? {
          name: nearest.city.name,
          distanceKm: Math.round(minDistance * 111), // Rough conversion to km
        }
      : null;
  }, [marker, existingCities?.cities]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (mode !== "place" && mode !== "move") return;

      // Auto-detect subdivision (simplified - would need actual point-in-polygon check)
      let detectedSubdivisionId: string | null = null;
      if (subdivisions?.subdivisions) {
        // TODO: Implement actual point-in-polygon check with subdivision geometries
        // For now, just set to null
        detectedSubdivisionId = null;
      }

      setMarker({
        ...marker,
        lat,
        lng,
        subdivisionId: detectedSubdivisionId,
        formData,
      });

      if (mode === "place") {
        setMode("edit");
      }
    },
    [mode, subdivisions?.subdivisions, marker, formData]
  );

  const handleFormChange = useCallback(
    (field: keyof CityFormData, value: string | boolean) => {
      const newFormData = { ...formData, [field]: value };
      setFormData(newFormData);

      if (marker) {
        setMarker({ ...marker, formData: newFormData });
      }

      // Clear errors for this field
      setErrors((prev) => prev.filter((e) => e.field !== field));
      setSuccessMessage("");
    },
    [formData, marker]
  );

  const handleSaveDraft = useCallback(() => {
    console.log("[CityPlacement] handleSaveDraft called");

    if (!marker) {
      console.log("[CityPlacement] No marker, aborting save");
      return;
    }

    const validationErrors = validateFormData(formData, hasNationalCapital);
    if (validationErrors.length > 0) {
      console.log("[CityPlacement] Validation errors:", validationErrors);
      setErrors(validationErrors);
      return;
    }

    if (isOutOfBounds) {
      console.log("[CityPlacement] City is out of bounds");
      setErrors([
        {
          field: "coordinates",
          message: "City marker is outside country boundaries",
        },
      ]);
      return;
    }

    const cityInput = {
      countryId,
      subdivisionId: marker.subdivisionId ?? undefined,
      name: formData.name,
      type: formData.type,
      coordinates: {
        type: "Point" as const,
        coordinates: [marker.lng, marker.lat] as [number, number],
      },
      population: formData.population ? Number(formData.population) : undefined,
      isNationalCapital: formData.isNationalCapital,
      isSubdivisionCapital: formData.isSubdivisionCapital,
      elevation: formData.elevation ? Number(formData.elevation) : undefined,
      foundedYear: formData.foundedYear ? Number(formData.foundedYear) : undefined,
    };

    console.log("[CityPlacement] Prepared city input:", cityInput);

    if (marker.id) {
      console.log("[CityPlacement] Updating existing city:", marker.id);
      updateCity.mutate({ id: marker.id, ...cityInput });
    } else {
      console.log("[CityPlacement] Creating new city");
      createCity.mutate(cityInput);
    }
  }, [
    marker,
    formData,
    hasNationalCapital,
    isOutOfBounds,
    countryId,
    createCity,
    updateCity,
  ]);

  const handleSubmitForReview = useCallback(() => {
    if (!marker?.id) {
      setErrors([
        {
          field: "general",
          message: "Please save as draft before submitting for review",
        },
      ]);
      return;
    }

    submitForReview.mutate({ id: marker.id });
  }, [marker?.id, submitForReview]);

  const handleDelete = useCallback(() => {
    if (!marker?.id) return;

    if (confirm("Are you sure you want to delete this city?")) {
      deleteCity.mutate({ id: marker.id });
    }
  }, [marker?.id, deleteCity]);

  const handleReset = useCallback(() => {
    setMarker(null);
    setFormData({
      name: "",
      type: "city",
      population: "",
      elevation: "",
      foundedYear: "",
      isNationalCapital: false,
      isSubdivisionCapital: false,
      description: "",
    });
    setErrors([]);
    setSuccessMessage("");
    setMode("place");
  }, []);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const getErrorMessage = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

  const hasError = (field: string): boolean => {
    return errors.some((e) => e.field === field);
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="glass-panel bg-white dark:bg-slate-900 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glass-interactive rounded-lg p-2">
              <MapPin className="size-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">City Placement</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {mode === "place"
                  ? "Click on the map to place a city marker"
                  : mode === "move"
                    ? "Click on the map to move the marker"
                    : "Edit city details below"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleReset}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Mode Buttons */}
          {marker && (
            <div className="glass-hierarchy-child rounded-lg p-4">
              <Label className="mb-3 text-slate-900 dark:text-white">Placement Mode</Label>
              <div className="flex gap-2">
                <Button
                  variant={mode === "place" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("place")}
                  className="flex-1"
                >
                  <MapPin className="mr-2 size-4" />
                  Place
                </Button>
                <Button
                  variant={mode === "move" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("move")}
                  className="flex-1"
                >
                  <Move className="mr-2 size-4" />
                  Move
                </Button>
                <Button
                  variant={mode === "edit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("edit")}
                  className="flex-1"
                >
                  Edit
                </Button>
              </div>
            </div>
          )}

          {/* Coordinates Display */}
          {marker && (
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Label className="mb-2 text-slate-900 dark:text-white">Coordinates</Label>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Latitude:</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {marker.lat.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Longitude:</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {marker.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "rounded-lg p-2",
                    getMarkerSize(formData.type, formData.isNationalCapital),
                    formData.isNationalCapital
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-blue-500/20 text-blue-400"
                  )}
                >
                  {getCityIcon(formData.type, formData.isNationalCapital)}
                </div>
              </div>

              {/* Bounds Warning */}
              {isOutOfBounds && (
                <div className="mt-3 flex items-start gap-3 rounded-lg bg-red-500/20 border border-red-500/30 p-4 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 size-5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-300">⚠️ Invalid Location - Outside Country Boundaries</p>
                    <p className="mt-1.5 text-xs opacity-90">
                      The marker is currently placed outside your country's territory.
                      Please click on the map within your borders to place the city in a valid location.
                    </p>
                    <p className="mt-2 text-xs font-medium">
                      → Save and submit buttons are disabled until the city is placed within valid boundaries.
                    </p>
                  </div>
                </div>
              )}

              {/* Nearest City Info */}
              {nearestCity && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-blue-500/10 p-3 text-sm text-blue-400">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Nearest city: <strong>{nearestCity.name}</strong> (~
                    {nearestCity.distanceKm} km)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* City Form */}
          {marker && (
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-900 dark:text-white">
                    City Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleFormChange("name", e.target.value)}
                    placeholder="Enter city name"
                    maxLength={200}
                    aria-invalid={hasError("name")}
                    className={cn(
                      "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      hasError("name") && "border-red-500"
                    )}
                  />
                  {hasError("name") && (
                    <p className="text-sm text-red-400">{getErrorMessage("name")}</p>
                  )}
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-slate-900 dark:text-white">
                    City Type
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: CityType) => handleFormChange("type", value)}
                  >
                    <SelectTrigger id="type" className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="capital">
                        <div className="flex items-center gap-2">
                          <Crown className="size-4" />
                          Capital
                        </div>
                      </SelectItem>
                      <SelectItem value="city">
                        <div className="flex items-center gap-2">
                          <Building2 className="size-4" />
                          City
                        </div>
                      </SelectItem>
                      <SelectItem value="town">
                        <div className="flex items-center gap-2">
                          <Home className="size-4" />
                          Town
                        </div>
                      </SelectItem>
                      <SelectItem value="village">
                        <div className="flex items-center gap-2">
                          <House className="size-4" />
                          Village
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Population */}
                <div className="space-y-2">
                  <Label htmlFor="population" className="text-slate-900 dark:text-white">
                    Population (optional)
                  </Label>
                  <Input
                    id="population"
                    type="number"
                    min="0"
                    value={formData.population}
                    onChange={(e) => handleFormChange("population", e.target.value)}
                    placeholder="e.g., 150000"
                    aria-invalid={hasError("population")}
                    className={cn(
                      "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      hasError("population") && "border-red-500"
                    )}
                  />
                  {hasError("population") && (
                    <p className="text-sm text-red-400">
                      {getErrorMessage("population")}
                    </p>
                  )}
                </div>

                {/* Elevation */}
                <div className="space-y-2">
                  <Label htmlFor="elevation" className="text-slate-900 dark:text-white">
                    Elevation (meters, optional)
                  </Label>
                  <Input
                    id="elevation"
                    type="number"
                    value={formData.elevation}
                    onChange={(e) => handleFormChange("elevation", e.target.value)}
                    placeholder="e.g., 250"
                    aria-invalid={hasError("elevation")}
                    className={cn(
                      "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      hasError("elevation") && "border-red-500"
                    )}
                  />
                  {hasError("elevation") && (
                    <p className="text-sm text-red-400">
                      {getErrorMessage("elevation")}
                    </p>
                  )}
                </div>

                {/* Founded Year */}
                <div className="space-y-2">
                  <Label htmlFor="foundedYear" className="text-slate-900 dark:text-white">
                    Founded Year (optional)
                  </Label>
                  <Input
                    id="foundedYear"
                    type="number"
                    min="0"
                    max={new Date().getFullYear()}
                    value={formData.foundedYear}
                    onChange={(e) => handleFormChange("foundedYear", e.target.value)}
                    placeholder="e.g., 1850"
                    aria-invalid={hasError("foundedYear")}
                    className={cn(
                      "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      hasError("foundedYear") && "border-red-500"
                    )}
                  />
                  {hasError("foundedYear") && (
                    <p className="text-sm text-red-400">
                      {getErrorMessage("foundedYear")}
                    </p>
                  )}
                </div>

                {/* National Capital Checkbox */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="isNationalCapital"
                    checked={formData.isNationalCapital}
                    onCheckedChange={(checked) =>
                      handleFormChange("isNationalCapital", !!checked)
                    }
                    disabled={hasNationalCapital && !formData.isNationalCapital}
                    aria-invalid={hasError("isNationalCapital")}
                  />
                  <div className="flex-1">
                    <Label htmlFor="isNationalCapital" className="text-slate-900 dark:text-white">
                      National Capital
                    </Label>
                    {hasNationalCapital && !formData.isNationalCapital && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        This country already has a national capital
                      </p>
                    )}
                    {hasError("isNationalCapital") && (
                      <p className="mt-1 text-sm text-red-400">
                        {getErrorMessage("isNationalCapital")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Subdivision Capital Checkbox */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="isSubdivisionCapital"
                    checked={formData.isSubdivisionCapital}
                    onCheckedChange={(checked) =>
                      handleFormChange("isSubdivisionCapital", !!checked)
                    }
                  />
                  <Label htmlFor="isSubdivisionCapital" className="text-slate-900 dark:text-white">
                    Subdivision Capital
                  </Label>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-900 dark:text-white">
                    Description (optional)
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleFormChange("description", e.target.value)}
                    placeholder="Brief description of the city..."
                    rows={3}
                    className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-4 text-green-400">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* General Errors */}
          {errors.some((e) => e.field === "general") && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-4 text-red-400">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />
              <span>{getErrorMessage("general")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      {marker && (
        <div className="glass-panel bg-white dark:bg-slate-900 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700/50 p-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={createCity.isPending || updateCity.isPending || isOutOfBounds}
              className="flex-1"
              title={isOutOfBounds ? "Cannot save: city is outside country boundaries" : undefined}
            >
              <Save className="mr-2 size-4" />
              {marker.id ? "Update Draft" : "Save as Draft"}
            </Button>

            {marker.id && marker.status === "draft" && (
              <Button
                onClick={handleSubmitForReview}
                disabled={submitForReview.isPending || isOutOfBounds}
                className="flex-1"
                title={isOutOfBounds ? "Cannot submit: city is outside country boundaries" : undefined}
              >
                <Send className="mr-2 size-4" />
                Submit for Review
              </Button>
            )}

            {marker.id && (
              <Button
                variant="destructive"
                size="icon"
                onClick={handleDelete}
                disabled={deleteCity.isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
