"use client";

import React, { useCallback, useRef, useEffect } from "react";
import { useStudioState } from "../../context/StudioStateContext";
import { api } from "~/trpc/react";

export function PreviewSection() {
  const { state, dispatch, navigateTo } = useStudioState();
  const stats = state.generationStats;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  const generateMutation = api.studio.generateWorld.useMutation({
    onSuccess: (data) => {
      dispatch({
        type: "SET_PREVIEW",
        layers: data.layers as Record<string, import("geojson").FeatureCollection>,
        stats: data.stats as unknown as Record<string, number>,
      });
    },
    onError: (err) => {
      dispatch({
        type: "SET_GENERATION_STATUS",
        status: "error",
        message: err.message,
      });
    },
  });

  const handleGenerate = useCallback(() => {
    dispatch({
      type: "SET_GENERATION_STATUS",
      status: "generating",
      progress: 10,
      message: "Starting world generation...",
    });

    const p = state.worldGenParams;
    generateMutation.mutate({
      seed: p.seed,
      cellCount: p.cellCount ?? 20000,
      continentCount: p.continentCount,
      countryCountMin: p.countryCountRange[0],
      countryCountMax: p.countryCountRange[1],
      oceanPercentage: p.oceanPercentage,
      terrainRoughness: p.terrainRoughness,
      hasIcecaps: p.hasIcecaps,
      hasRivers: p.hasRivers,
      hasLakes: p.hasLakes,
      useIxWorldTemplate: p.useIxWorldTemplate ?? true,
      templateStrength: p.templateStrength ?? 0.6,
      useMarkovNaming: p.useMarkovNaming,
      languageFamilies: p.languageFamilies,
    });
  }, [state.worldGenParams, generateMutation, dispatch]);

  const handleRegenerate = useCallback(() => {
    dispatch({
      type: "UPDATE_PARAMS",
      params: { seed: Math.floor(Math.random() * 999999) },
    });
    setTimeout(handleGenerate, 50);
  }, [dispatch, handleGenerate]);

  // Render generated layers on a MapLibre map
  useEffect(() => {
    if (!state.previewLayers || !mapContainerRef.current) return;

    let mounted = true;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (!mounted || !mapContainerRef.current) return;

      // Clean up previous map
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          name: "WorldStudio",
          sources: {},
          layers: [{ id: "bg", type: "background", paint: { "background-color": "#b3cde0" } }],
          glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
        },
        center: [56.18, 0],
        zoom: 1.8,
        minZoom: 0.5,
        maxZoom: 6,
        projection: { type: "globe" } as any,
      } as any);

      mapRef.current = map;

      map.on("load", () => {
        if (!mounted) return;

        // Add layers in order: altitudes → rivers → lakes → climate → political → icecaps
        const layerOrder = ["altitudes", "rivers", "lakes", "climate", "political", "icecaps"];

        for (const layerType of layerOrder) {
          const fc = state.previewLayers?.[layerType];
          if (!fc || !fc.features?.length) continue;

          const sourceId = `src-${layerType}`;
          map.addSource(sourceId, { type: "geojson", data: fc });

          if (layerType === "rivers") {
            map.addLayer({
              id: `line-${layerType}`,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": "#7cb5d2",
                "line-width": 1.2,
                "line-opacity": 0.6,
              },
              layout: { "line-cap": "round", "line-join": "round" },
            });
          } else {
            // Fill layer
            const usePropColor =
              layerType === "altitudes" || layerType === "climate" || layerType === "political";
            map.addLayer({
              id: `fill-${layerType}`,
              type: "fill",
              source: sourceId,
              paint: {
                "fill-color": usePropColor
                  ? ["coalesce", ["get", "_fillColor"], ["get", "fill"], "#e8e5da"]
                  : layerType === "lakes"
                    ? "#7cb5d2"
                    : layerType === "icecaps"
                      ? "#f0f4f8"
                      : "#e8e5da",
                "fill-opacity":
                  layerType === "political"
                    ? 0.4
                    : layerType === "altitudes"
                      ? 0.75
                      : layerType === "climate"
                        ? 0.3
                        : layerType === "icecaps"
                          ? 0.7
                          : layerType === "lakes"
                            ? 0.65
                            : 1,
              },
            });

            // Stroke for political borders
            if (layerType === "political") {
              map.addLayer({
                id: `stroke-${layerType}`,
                type: "line",
                source: sourceId,
                paint: { "line-color": "#888", "line-width": 0.8, "line-opacity": 0.8 },
              });
            }
          }
        }
      });
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [state.previewLayers]);

  const handleNext = () => {
    dispatch({ type: "COMPLETE_SECTION", section: "preview" });
    navigateTo("publish");
  };

  const statEntries = stats
    ? Object.entries(stats).map(([key, value]) => ({
        label: key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (s) => s.toUpperCase())
          .trim(),
        value,
      }))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">World Preview</h1>
        <p className="mt-2 text-sm text-white/60">
          Generate and review your world on the interactive globe.
        </p>
      </div>

      {/* Map Preview */}
      <div className="relative overflow-hidden rounded-xl border border-white/10">
        {state.previewLayers ? (
          <div ref={mapContainerRef} className="h-[500px] w-full" />
        ) : (
          <div className="flex h-[500px] items-center justify-center bg-gradient-to-b from-sky-200/20 to-slate-900/50">
            <div className="text-center">
              <p className="text-5xl">🌍</p>
              <p className="mt-3 text-sm font-medium text-white/50">
                Click &quot;Generate World&quot; to create your realm
              </p>
            </div>
          </div>
        )}

        {/* Generation overlay */}
        {state.generationStatus === "generating" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
              <p className="mt-3 text-sm text-white/80">
                {state.generationMessage || "Generating..."}
              </p>
            </div>
          </div>
        )}

        {state.generationStatus === "error" && (
          <div className="absolute right-4 bottom-4 left-4 rounded-lg bg-red-900/80 p-3 text-sm text-red-200">
            Error: {state.generationMessage}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {statEntries.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">Generation Summary</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statEntries.map((entry) => (
              <div
                key={entry.label}
                className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <p className="text-xs text-white/40">{entry.label}</p>
                <p className="mt-1 text-xl font-bold text-teal-300">
                  {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="rounded-lg bg-gradient-to-r from-teal-600 to-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-teal-500 hover:to-blue-500 disabled:opacity-50"
        >
          {generateMutation.isPending ? "Generating..." : "Generate World"}
        </button>
        <button
          onClick={handleRegenerate}
          disabled={generateMutation.isPending}
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          🎲 New Seed
        </button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => navigateTo("economics")}
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10"
        >
          ← Back: Economics
        </button>
        <button
          onClick={handleNext}
          className="rounded-lg bg-gradient-to-r from-teal-600 to-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-teal-500 hover:to-blue-500"
        >
          Next: Publish →
        </button>
      </div>
    </div>
  );
}
