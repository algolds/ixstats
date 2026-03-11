"use client";

import React, { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "~/trpc/react";
import { X, Loader2, Layers } from "lucide-react";
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from "geojson";

interface TemplatePreviewDialogProps {
  templateId: string;
  onClose: () => void;
}

const LAYER_COLORS: Record<string, string> = {
  political: "#48bb78",
  climate: "#ed8936",
  altitudes: "#a0522d",
  rivers: "#4299e1",
  lakes: "#63b3ed",
  icecaps: "#e2e8f0",
  background: "#2d3748",
};

export const TemplatePreviewDialog = React.memo(function TemplatePreviewDialog({
  templateId,
  onClose,
}: TemplatePreviewDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const { data, isLoading, error } = api.geo.downloadWorldTemplate.useQuery(
    { templateId },
    { refetchOnWindowFocus: false }
  );

  // Initialize map once data loads
  useEffect(() => {
    if (!containerRef.current || !data || mapRef.current) return;

    const layers = data.layers as Record<string, FeatureCollection> | null;
    if (!layers) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#0a1628" },
          },
        ],
      },
      center: [0, 20],
      zoom: 2,
      projection: { type: "globe" },
      maxTileCacheSize: 50,
      fadeDuration: 0,
    });

    map.on("load", () => {
      // Add each layer type
      const layerOrder = ["background", "altitudes", "climate", "icecaps", "lakes", "rivers", "political"];

      for (const layerType of layerOrder) {
        const fc = layers[layerType];
        if (!fc || !fc.features) continue;

        const sourceId = `template-${layerType}`;
        const color = LAYER_COLORS[layerType] || "#888";

        map.addSource(sourceId, {
          type: "geojson",
          data: fc as GeoJSON.FeatureCollection,
        });

        // Fill layer for polygons
        map.addLayer({
          id: `${sourceId}-fill`,
          type: "fill",
          source: sourceId,
          filter: ["any", ["==", "$type", "Polygon"], ["==", "$type", "MultiPolygon"]],
          paint: {
            "fill-color": color,
            "fill-opacity": layerType === "political" ? 0.4 : 0.3,
          },
        });

        // Line layer
        map.addLayer({
          id: `${sourceId}-line`,
          type: "line",
          source: sourceId,
          filter: ["any",
            ["==", "$type", "Polygon"],
            ["==", "$type", "MultiPolygon"],
            ["==", "$type", "LineString"],
            ["==", "$type", "MultiLineString"],
          ],
          paint: {
            "line-color": color,
            "line-width": layerType === "political" ? 1.5 : 0.5,
            "line-opacity": 0.7,
          },
        });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [data]);

  // Build layer summary
  const layerSummary = data?.layers
    ? Object.entries(data.layers as Record<string, { features?: unknown[] }>)
        .filter(([, fc]) => fc?.features)
        .map(([type, fc]) => ({
          type,
          count: fc.features?.length ?? 0,
        }))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex h-[80vh] w-[90vw] max-w-5xl flex-col rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-foreground">Template Preview</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Map */}
          <div className="relative flex-1">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/90">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading template data...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/90">
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  Failed to load: {error.message}
                </div>
              </div>
            )}
            <div
              ref={containerRef}
              className="h-full w-full"
              style={{ minHeight: 300 }}
            />
          </div>

          {/* Sidebar */}
          <div className="w-56 border-l border-border p-4">
            <h4 className="mb-3 text-xs font-medium uppercase text-muted-foreground">
              Layers
            </h4>
            {layerSummary.length === 0 && !isLoading && (
              <p className="text-xs text-muted-foreground/50">No layers</p>
            )}
            <div className="space-y-2">
              {layerSummary.map(({ type, count }) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: LAYER_COLORS[type] || "#888" }}
                    />
                    <span className="text-xs text-foreground capitalize">{type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>

            {data?.metadata && (
              <div className="mt-4 border-t border-border pt-3">
                <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Metadata
                </h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {(() => {
                    const meta = data.metadata as Record<string, unknown>;
                    return (
                      <>
                        {meta.totalFeatures && (
                          <div>Features: {String(meta.totalFeatures)}</div>
                        )}
                        {meta.totalCountries && (
                          <div>Countries: {String(meta.totalCountries)}</div>
                        )}
                        {meta.exportedAt && (
                          <div>
                            Exported:{" "}
                            {new Date(meta.exportedAt as string).toLocaleDateString()}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
