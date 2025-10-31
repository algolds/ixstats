"use client";

/**
 * ReviewPanel Component
 *
 * Side panel for reviewing individual map submissions.
 * Shows detailed information, map preview, and approval controls.
 *
 * Features:
 * - Submission details (name, type, country, coordinates, etc.)
 * - MapLibre GL JS preview with geometry rendering
 * - Submitter information
 * - Economic impact analysis (for subdivisions)
 * - Validation results with visual overlays
 * - Approve/Reject/Modify actions
 *
 * @module components/maps/admin/ReviewPanel
 */

import { useState, useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import * as turf from "@turf/turf";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  X,
  CheckCircle2,
  XCircle,
  MapPin,
  User,
  Calendar,
  AlertCircle,
  Layers,
  TrendingUp,
  Loader2,
  Maximize2,
} from "lucide-react";
import { LoadingState } from "~/components/shared/feedback/LoadingState";

interface ReviewPanelProps {
  entityType: "subdivision" | "city" | "poi";
  entityId: string;
  onClose: () => void;
  onRefetch: () => void;
}

/**
 * Validation results interface
 */
interface ValidationResults {
  containedWithinCountry: boolean;
  overlaps: Array<{ id: string; name: string }>;
  topologyIssues: Array<{ type: string; coordinates: [number, number] }>;
}

/**
 * Geometry statistics interface
 */
interface GeometryStats {
  areaSqKm?: number;
  areaSqMi?: number;
  perimeterKm?: number;
  coordinates?: [number, number];
  elevation?: number;
}

/**
 * ReviewPanel Component
 *
 * Displays detailed review interface for a map submission with MapLibre GL JS preview
 */
export function ReviewPanel({
  entityType,
  entityId,
  onClose,
  onRefetch,
}: ReviewPanelProps) {
  // State
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [geometryStats, setGeometryStats] = useState<GeometryStats>({});

  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);

  // Fetch detailed data based on entity type
  const { data: subdivisionData, isLoading: subdivisionLoading } =
    api.mapEditor.getMySubdivisions.useQuery(
      { limit: 1, offset: 0 },
      { enabled: entityType === "subdivision" }
    );

  const { data: cityData, isLoading: cityLoading } =
    api.mapEditor.getMyCities.useQuery(
      { limit: 1, offset: 0 },
      { enabled: entityType === "city" }
    );

  const { data: poiData, isLoading: poiLoading } =
    api.mapEditor.getMyPOIs.useQuery(
      { limit: 1, offset: 0 },
      { enabled: entityType === "poi" }
    );

  // Mutations
  const approveMutation = api.mapEditor.approveSubmission.useMutation({
    onSuccess: () => {
      onRefetch();
      onClose();
    },
  });

  const rejectMutation = api.mapEditor.rejectSubmission.useMutation({
    onSuccess: () => {
      onRefetch();
      onClose();
      setShowRejectDialog(false);
    },
  });

  // Get the appropriate data
  let data: any = null;
  let isLoading = false;

  if (entityType === "subdivision") {
    data = subdivisionData?.subdivisions.find((s) => s.id === entityId);
    isLoading = subdivisionLoading;
  } else if (entityType === "city") {
    data = cityData?.cities.find((c) => c.id === entityId);
    isLoading = cityLoading;
  } else if (entityType === "poi") {
    data = poiData?.pois.find((p) => p.id === entityId);
    isLoading = poiLoading;
  }

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await approveMutation.mutateAsync({
        entityType,
        entityId,
      });
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    setIsSubmitting(true);
    try {
      await rejectMutation.mutateAsync({
        entityType,
        entityId,
        reason: rejectReason,
      });
    } catch (error) {
      console.error("Failed to reject:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Calculate geometry statistics
   */
  const calculateGeometryStats = (geometry: any): GeometryStats => {
    const stats: GeometryStats = {};

    if (!geometry) return stats;

    try {
      if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
        // Calculate area
        const feature = turf.feature(geometry);
        const areaSqMeters = turf.area(feature);
        stats.areaSqKm = areaSqMeters / 1_000_000;
        stats.areaSqMi = stats.areaSqKm * 0.386102;

        // Calculate perimeter
        const perimeterMeters = turf.length(feature, { units: "meters" });
        stats.perimeterKm = perimeterMeters / 1000;
      } else if (geometry.type === "Point") {
        stats.coordinates = geometry.coordinates as [number, number];
      }
    } catch (error) {
      console.error("[ReviewPanel] Error calculating geometry stats:", error);
    }

    return stats;
  };

  /**
   * Get mock validation results (replace with actual API call)
   */
  const getValidationResults = (): ValidationResults => {
    // TODO: Replace with actual validation API call
    return {
      containedWithinCountry: true,
      overlaps: [],
      topologyIssues: [],
    };
  };

  /**
   * Initialize MapLibre GL JS map
   */
  useEffect(() => {
    if (!mapContainer.current || !data || map.current) return;

    try {
      // Create map instance
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            "osm": {
              type: "raster",
              tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
          },
          layers: [
            {
              id: "osm-tiles",
              type: "raster",
              source: "osm",
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [0, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 18,
      });

      // Add navigation controls
      map.current.addControl(new maplibregl.NavigationControl(), "top-right");

      // Add scale control
      map.current.addControl(
        new maplibregl.ScaleControl({
          maxWidth: 150,
          unit: "imperial",
        }),
        "bottom-right"
      );

      // Map loaded event
      map.current.on("load", () => {
        setMapLoading(false);
      });

      // Error handling
      map.current.on("error", (e) => {
        console.error("[ReviewPanel] Map error:", e);
        setMapLoading(false);
      });

    } catch (error) {
      console.error("[ReviewPanel] Failed to initialize map:", error);
      setMapLoading(false);
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [data]);

  /**
   * Render submission geometry on map
   */
  useEffect(() => {
    if (!map.current || !data || mapLoading) return;

    const mapInstance = map.current;

    try {
      // Clear existing layers
      if (mapInstance.getLayer("submission-fill")) {
        mapInstance.removeLayer("submission-fill");
      }
      if (mapInstance.getLayer("submission-outline")) {
        mapInstance.removeLayer("submission-outline");
      }
      if (mapInstance.getLayer("submission-marker")) {
        mapInstance.removeLayer("submission-marker");
      }
      if (mapInstance.getSource("submission")) {
        mapInstance.removeSource("submission");
      }

      // Handle subdivision (Polygon)
      if (entityType === "subdivision" && data.geometry) {
        const geometry = data.geometry;

        // Calculate and store statistics
        const stats = calculateGeometryStats(geometry);
        setGeometryStats(stats);

        // Add source
        mapInstance.addSource("submission", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: geometry,
          },
        });

        // Add fill layer
        mapInstance.addLayer({
          id: "submission-fill",
          type: "fill",
          source: "submission",
          paint: {
            "fill-color": "#10b981",
            "fill-opacity": 0.3,
          },
        });

        // Add outline layer
        mapInstance.addLayer({
          id: "submission-outline",
          type: "line",
          source: "submission",
          paint: {
            "line-color": "#10b981",
            "line-width": 2,
          },
        });

        // Fit to bounds
        try {
          const bbox = turf.bbox(geometry);
          mapInstance.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]],
            ],
            { padding: 50 }
          );
        } catch (error) {
          console.error("[ReviewPanel] Error fitting bounds:", error);
        }
      }
      // Handle city (Point)
      else if (entityType === "city" && data.coordinates) {
        const coordinates = data.coordinates.coordinates as [number, number];

        // Store coordinates
        setGeometryStats({
          coordinates,
          elevation: data.elevation,
        });

        // Add source
        mapInstance.addSource("submission", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: data.coordinates,
          },
        });

        // Add marker layer
        mapInstance.addLayer({
          id: "submission-marker",
          type: "circle",
          source: "submission",
          paint: {
            "circle-radius": 8,
            "circle-color": "#3b82f6",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Center on point
        mapInstance.flyTo({
          center: coordinates,
          zoom: 12,
          duration: 1000,
        });
      }
      // Handle POI (Point)
      else if (entityType === "poi" && data.coordinates) {
        const coordinates = data.coordinates.coordinates as [number, number];

        // Store coordinates
        setGeometryStats({
          coordinates,
        });

        // Determine color by category
        const categoryColors: Record<string, string> = {
          monument: "#ef4444",
          landmark: "#f59e0b",
          military: "#dc2626",
          cultural: "#8b5cf6",
          natural: "#10b981",
          religious: "#6366f1",
          government: "#3b82f6",
        };
        const color = categoryColors[data.category as string] || "#6b7280";

        // Add source
        mapInstance.addSource("submission", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: data.coordinates,
          },
        });

        // Add marker layer
        mapInstance.addLayer({
          id: "submission-marker",
          type: "circle",
          source: "submission",
          paint: {
            "circle-radius": 8,
            "circle-color": color,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Center on point
        mapInstance.flyTo({
          center: coordinates,
          zoom: 14,
          duration: 1000,
        });
      }

    } catch (error) {
      console.error("[ReviewPanel] Error rendering geometry:", error);
    }
  }, [map.current, data, mapLoading, entityType]);

  /**
   * Add validation overlays
   */
  useEffect(() => {
    if (!map.current || !data || mapLoading) return;

    const mapInstance = map.current;
    const validationResults = getValidationResults();

    try {
      // Clear existing validation layers
      if (mapInstance.getLayer("validation-errors")) {
        mapInstance.removeLayer("validation-errors");
      }
      if (mapInstance.getSource("validation-errors")) {
        mapInstance.removeSource("validation-errors");
      }

      // Add validation error markers if needed
      if (validationResults.topologyIssues.length > 0) {
        const errorPoints = {
          type: "FeatureCollection" as const,
          features: validationResults.topologyIssues.map((issue, index) => ({
            type: "Feature" as const,
            id: index,
            properties: { type: issue.type },
            geometry: {
              type: "Point" as const,
              coordinates: issue.coordinates,
            },
          })),
        };

        mapInstance.addSource("validation-errors", {
          type: "geojson",
          data: errorPoints,
        });

        mapInstance.addLayer({
          id: "validation-errors",
          type: "circle",
          source: "validation-errors",
          paint: {
            "circle-radius": 6,
            "circle-color": "#ef4444",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

    } catch (error) {
      console.error("[ReviewPanel] Error adding validation overlays:", error);
    }
  }, [map.current, data, mapLoading]);

  if (isLoading) {
    return (
      <div className="w-[500px] glass-panel border-l border-slate-700/50 p-6">
        <LoadingState message="Loading details..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-[500px] glass-panel border-l border-slate-700/50 p-6">
        <div className="text-slate-400">Submission not found</div>
        <Button onClick={onClose} variant="outline" className="mt-4">
          Close
        </Button>
      </div>
    );
  }

  // Get validation results
  const validationResults = getValidationResults();

  return (
    <>
      <div className="w-[1000px] glass-panel border-l border-slate-700/50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-700/50 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-2">{data.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {entityType}
                </Badge>
                <Badge
                  variant={
                    data.status === "approved"
                      ? "default"
                      : data.status === "rejected"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {data.status}
                </Badge>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content - Two Column Layout */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-0 h-full">

            {/* Left Column - Metadata and Actions */}
            <div className="border-r border-slate-700/50 p-6 space-y-6 overflow-auto">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-400" />
              Basic Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Type:</span>
                <span className="text-white">{data.type || data.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Country:</span>
                <span className="text-white">{data.country?.name}</span>
              </div>
              {data.subdivision && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Subdivision:</span>
                  <span className="text-white">{data.subdivision.name}</span>
                </div>
              )}
              {data.population && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Population:</span>
                  <span className="text-white">
                    {data.population.toLocaleString()}
                  </span>
                </div>
              )}
              {data.areaSqKm && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Area:</span>
                  <span className="text-white">
                    {data.areaSqKm.toLocaleString()} km²
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Submission Details */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-green-400" />
              Submission Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Submitted:</span>
                <span className="text-white">
                  {new Date(data.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Updated:</span>
                <span className="text-white">
                  {new Date(data.updatedAt).toLocaleString()}
                </span>
              </div>
              {data.reviewedBy && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reviewed By:</span>
                    <span className="text-white">{data.reviewedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reviewed At:</span>
                    <span className="text-white">
                      {new Date(data.reviewedAt).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rejection Reason (if rejected) */}
          {data.status === "rejected" && data.rejectionReason && (
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Rejection Reason
              </h3>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                {data.rejectionReason}
              </div>
            </div>
          )}

          {/* Validation Results */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              Validation Results
            </h3>
            <div className="space-y-2">
              {/* Boundary check */}
              <div className={`flex items-center gap-2 text-sm ${validationResults.containedWithinCountry ? "text-green-400" : "text-red-400"}`}>
                {validationResults.containedWithinCountry ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>{validationResults.containedWithinCountry ? "Within country boundaries" : "Out of bounds"}</span>
              </div>

              {/* Overlap check */}
              <div className={`flex items-center gap-2 text-sm ${validationResults.overlaps.length === 0 ? "text-green-400" : "text-red-400"}`}>
                {validationResults.overlaps.length === 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>
                  {validationResults.overlaps.length === 0
                    ? "No overlapping features"
                    : `${validationResults.overlaps.length} overlap(s) detected`}
                </span>
              </div>

              {/* Topology check */}
              <div className={`flex items-center gap-2 text-sm ${validationResults.topologyIssues.length === 0 ? "text-green-400" : "text-red-400"}`}>
                {validationResults.topologyIssues.length === 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>
                  {validationResults.topologyIssues.length === 0
                    ? "Valid geometry structure"
                    : `${validationResults.topologyIssues.length} topology error(s)`}
                </span>
              </div>
            </div>
          </div>
            </div>

            {/* Right Column - Map Preview */}
            <div className="relative flex flex-col p-6 space-y-4">
              {/* Map Preview Header */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-400" />
                  Geometry Preview
                </h3>

                {/* Validation Status Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge
                    variant={validationResults.containedWithinCountry ? "default" : "destructive"}
                    className={validationResults.containedWithinCountry ? "bg-green-500/20 text-green-300 border-green-500/30" : ""}
                  >
                    {validationResults.containedWithinCountry ? "✓ Within Bounds" : "✗ Out of Bounds"}
                  </Badge>
                  <Badge
                    variant={validationResults.overlaps.length === 0 ? "default" : "destructive"}
                    className={validationResults.overlaps.length === 0 ? "bg-green-500/20 text-green-300 border-green-500/30" : ""}
                  >
                    {validationResults.overlaps.length === 0 ? "✓ No Overlaps" : `✗ ${validationResults.overlaps.length} Overlap(s)`}
                  </Badge>
                  <Badge
                    variant={validationResults.topologyIssues.length === 0 ? "default" : "destructive"}
                    className={validationResults.topologyIssues.length === 0 ? "bg-green-500/20 text-green-300 border-green-500/30" : ""}
                  >
                    {validationResults.topologyIssues.length === 0 ? "✓ Valid Geometry" : "✗ Topology Errors"}
                  </Badge>
                </div>
              </div>

              {/* Map Container */}
              <div className="relative flex-1 min-h-[400px] bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                <div ref={mapContainer} className="absolute inset-0" />

                {/* Loading Overlay */}
                {mapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Loading map preview...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Geometry Statistics */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Geometry Statistics</h4>
                <div className="space-y-2 text-sm">
                  {/* Subdivision stats */}
                  {entityType === "subdivision" && (
                    <>
                      {geometryStats.areaSqKm && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Area:</span>
                          <span className="text-white">
                            {geometryStats.areaSqKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km²
                            {" "}
                            ({geometryStats.areaSqMi?.toLocaleString(undefined, { maximumFractionDigits: 2 })} mi²)
                          </span>
                        </div>
                      )}
                      {geometryStats.perimeterKm && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Perimeter:</span>
                          <span className="text-white">
                            {geometryStats.perimeterKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* City/POI stats */}
                  {(entityType === "city" || entityType === "poi") && geometryStats.coordinates && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Latitude:</span>
                        <span className="text-white font-mono text-xs">
                          {geometryStats.coordinates[1].toFixed(6)}°
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Longitude:</span>
                        <span className="text-white font-mono text-xs">
                          {geometryStats.coordinates[0].toFixed(6)}°
                        </span>
                      </div>
                      {geometryStats.elevation && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Elevation:</span>
                          <span className="text-white">
                            {geometryStats.elevation.toLocaleString()} m
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Category for POI */}
                  {entityType === "poi" && data.category && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Category:</span>
                      <span className="text-white capitalize">{data.category}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Actions Footer */}
        {data.status === "pending" && (
          <div className="border-t border-slate-700/50 p-6">
            <div className="flex gap-3">
              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex-1 bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => setShowRejectDialog(true)}
                disabled={isSubmitting}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this submission. This will
              be visible to the submitter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason *</Label>
              <Textarea
                id="reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this submission is being rejected..."
                rows={4}
                className="bg-slate-800/50 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-400">
                Minimum 10 characters required
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting || rejectReason.length < 10}
            >
              {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
