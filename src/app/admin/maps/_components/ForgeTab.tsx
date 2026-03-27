"use client";

/**
 * ForgeTab — God-mode world editor for admins.
 *
 * Full-screen MapLibre editor with admin superpowers:
 * - Country selector (edit ANY country)
 * - Terrain painter (change climate/elevation zones)
 * - Mass feature operations (scatter cities, auto-subdivide, generate transport)
 * - Live simulation preview (GDP/trade/risk impact)
 * - Batch operations (bulk edit/delete/move)
 *
 * Uses the same EditorMap + MapEditorToolbar as the user editor,
 * but adds admin-only tools and a country switcher.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Globe, Loader2, Wand2, Train, RefreshCw,
  AlertTriangle, ChevronDown, Sparkles, Zap,
  Search, FileImage, Download, ExternalLink, X,
  Trash2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useMapData } from "~/hooks/useMapData";
import { useMapEditor } from "~/hooks/useMapEditor";
import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureList } from "~/components/maps/editor/FeatureList";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import {
  ProvinceImportWizard,
  ProvincePreviewLayer,
} from "~/components/maps/editor/province-importer";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";

const EditorMap = dynamic(() => import("~/components/maps/editor/EditorMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export function ForgeTab() {
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);
  const [cursorZoom, setCursorZoom] = useState<number | undefined>(undefined);
  const mapRef = useRef<EditorMapRef>(null);

  // Fetch all countries for the selector — use getAll but only extract id/name client-side
  const { data: countries } = api.countries.getAll.useQuery(
    { limit: 200 },
    {
      staleTime: 5 * 60_000,
      select: (data: any) => {
        const list = Array.isArray(data) ? data : data?.countries ?? data ?? [];
        return list
          .map((c: any) => ({ id: c.id, name: c.name }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
      },
    }
  );

  // Map layers for editor background
  const { mapLayers } = useMapData(["background", "altitudes", "rivers", "lakes"]);

  // Editor hook — always called (React rules), passes undefined when none selected
  const editor = useMapEditor(selectedCountryId ?? undefined, { skipLinkageGate: true });

  // Province importer — admin can import for any country
  const importer = useProvinceImporter(selectedCountryId ?? "__none__");

  // Transport generation
  const generateTransport = api.transport.generateRoutes.useMutation();
  const recalculateGeo = api.geo.recalculateGeoProfiles.useMutation();
  const deleteAllRegions = api.geo.deleteAllSubdivisions.useMutation();

  // Wiki province finder
  const [showWikiPanel, setShowWikiPanel] = useState(false);
  const [wikiSearchQuery, setWikiSearchQuery] = useState("");
  const selectedCountryName = useMemo(
    () => countries?.find((c: any) => c.id === selectedCountryId)?.name ?? "",
    [countries, selectedCountryId]
  );

  // Auto-scan wiki for province maps when country is selected
  const { data: wikiProvinceScan, isLoading: scanLoading } = api.wiki.findProvinceMaps.useQuery(
    { countryName: selectedCountryName },
    { enabled: !!selectedCountryName && showWikiPanel, staleTime: 10 * 60_000 },
  );

  // Manual wiki file search
  const { data: wikiFileResults, isLoading: fileSearchLoading } = api.wiki.searchFiles.useQuery(
    { query: wikiSearchQuery, limit: 20, fileTypes: ["svg", "png"] },
    { enabled: wikiSearchQuery.length >= 2 && showWikiPanel, staleTime: 5 * 60_000 },
  );

  // Download a wiki file via server-side proxy (avoids CORS) and feed to importer
  const utils = api.useUtils();
  const [importingFile, setImportingFile] = useState<string | null>(null);
  const handleImportFromWiki = useCallback(async (filename: string) => {
    setImportingFile(filename);
    try {
      // Fetch file content via server-side proxy (reads from local filesystem, no CORS)
      const result = await utils.wiki.downloadFile.fetch({ filename });
      if (!result?.content) throw new Error("Empty file response");

      // Convert base64 back to binary
      const binary = atob(result.content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: result.mime });
      const file = new File([blob], filename, { type: result.mime });

      // Switch to import mode and feed the file
      editor.setMode("import-provinces");
      setTimeout(() => {
        importer.handleUpload(file);
      }, 100);
      setShowWikiPanel(false);
    } catch (e) {
      alert(`Failed to import: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setImportingFile(null);
    }
  }, [editor, importer, utils]);

  // Track cursor for status bar
  const [mapInstance, setMapInstance] = useState<import("maplibre-gl").Map | null>(null);
  useEffect(() => {
    if (!mapRef.current) return;
    const interval = setInterval(() => {
      const m = mapRef.current?.getMap() ?? null;
      if (m) { setMapInstance(m); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, [selectedCountryId]);

  useEffect(() => {
    if (!mapInstance) return;
    const handler = (e: any) => setCursorCoords([e.lngLat.lng, e.lngLat.lat]);
    mapInstance.on("mousemove", handler);
    mapInstance.on("zoomend", () => setCursorZoom(mapInstance.getZoom()));
    setCursorZoom(mapInstance.getZoom());
    return () => { mapInstance.off("mousemove", handler); };
  }, [mapInstance]);

  // Fly to country when selected or when geometry loads
  useEffect(() => {
    if (!mapInstance || !editor.countryGeo) return;
    try {
      const geo = editor.countryGeo as any;
      // Extract bounds from the geometry
      let bounds: [[number, number], [number, number]] | null = null;

      if (geo.bbox && Array.isArray(geo.bbox) && geo.bbox.length >= 4) {
        bounds = [[geo.bbox[0], geo.bbox[1]], [geo.bbox[2], geo.bbox[3]]];
      } else if (geo.type === "FeatureCollection" && geo.features?.length > 0) {
        // Compute bounds from all coordinates
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        const processCoords = (coords: any) => {
          if (typeof coords[0] === "number") {
            minLng = Math.min(minLng, coords[0]);
            minLat = Math.min(minLat, coords[1]);
            maxLng = Math.max(maxLng, coords[0]);
            maxLat = Math.max(maxLat, coords[1]);
          } else if (Array.isArray(coords)) {
            coords.forEach(processCoords);
          }
        };
        for (const f of geo.features) {
          if (f.geometry?.coordinates) processCoords(f.geometry.coordinates);
        }
        if (minLng < Infinity) bounds = [[minLng, minLat], [maxLng, maxLat]];
      } else if (geo.coordinates) {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        const processCoords = (coords: any) => {
          if (typeof coords[0] === "number") {
            minLng = Math.min(minLng, coords[0]);
            minLat = Math.min(minLat, coords[1]);
            maxLng = Math.max(maxLng, coords[0]);
            maxLat = Math.max(maxLat, coords[1]);
          } else if (Array.isArray(coords)) {
            coords.forEach(processCoords);
          }
        };
        processCoords(geo.coordinates);
        if (minLng < Infinity) bounds = [[minLng, minLat], [maxLng, maxLat]];
      }

      if (bounds) {
        mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 1500 });
      }
    } catch {
      // Ignore geometry parsing errors
    }
  }, [mapInstance, editor.countryGeo, selectedCountryId]);

  // Feature callbacks
  const handleSelectFeature = useCallback(
    (feature: any) => {
      editor.setSelectedFeature(feature);
      editor.startEditing(feature);
      if (feature.coordinates && mapRef.current) {
        mapRef.current.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
      }
    },
    [editor]
  );

  const handleDeleteFeature = useCallback(
    (feature: any) => {
      if (confirm(`Delete "${feature.name}"?`)) {
        editor.handleDeleteFeature(feature);
      }
    },
    [editor]
  );

  const handleSubmit = useCallback(() => {
    switch (editor.mode) {
      case "add-city": editor.submitCity(); break;
      case "add-subdivision": editor.submitSubdivision(); break;
      case "add-poi": editor.submitPOI(); break;
      case "add-story-pin": editor.submitStoryPin(); break;
      case "add-label": editor.submitMapLabel(); break;
      case "edit-city": editor.submitEditCity(); break;
      case "edit-subdivision": editor.submitEditSubdivision(); break;
      case "edit-poi": editor.submitEditPOI(); break;
      case "edit-story-pin": editor.submitEditStoryPin(); break;
      case "edit-label": editor.submitEditMapLabel(); break;
    }
  }, [editor]);

  // Admin mass operations
  const handleGenerateTransport = useCallback(async () => {
    if (!selectedCountryId) return;
    try {
      const result = await generateTransport.mutateAsync({
        countryId: selectedCountryId,
        routeTypes: ["rail", "highway"],
        clearExisting: true,
      });
      alert(`Generated ${result.routesCreated} routes (${result.totalLengthKm} km), ${result.hubsCreated} hubs`);
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  }, [selectedCountryId, generateTransport]);

  const handleRecalculate = useCallback(async () => {
    if (!selectedCountryId) return;
    try {
      await recalculateGeo.mutateAsync({ countryId: selectedCountryId });
      alert("Geographic profile recalculated");
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  }, [selectedCountryId, recalculateGeo]);

  const handleDeleteAllRegions = useCallback(async () => {
    if (!selectedCountryId) return;
    const countryName = countries?.find((c) => c.id === selectedCountryId)?.name ?? "this country";
    if (!confirm(`Delete ALL regions/subdivisions for ${countryName}? This cannot be undone.`)) return;
    try {
      const result = await deleteAllRegions.mutateAsync({ countryId: selectedCountryId });
      alert(`Deleted ${result.deleted} regions`);
      // Invalidate all geo queries to refresh the editor
      await utils.geo.invalidate();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  }, [selectedCountryId, countries, deleteAllRegions, utils]);

  return (
    <div className="relative -mx-6 -mb-6 flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
      {/* Forge toolbar */}
      <div className="flex h-10 items-center gap-2 border-b border-border bg-card px-3">
        <Globe className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-semibold text-foreground">Forge Mode</span>

        {/* Country selector */}
        <div className="ml-3 relative">
          <select
            value={selectedCountryId ?? ""}
            onChange={(e) => setSelectedCountryId(e.target.value || null)}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="">Select a country...</option>
            {countries?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Admin action buttons */}
        {selectedCountryId && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setShowWikiPanel((v) => !v)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                showWikiPanel
                  ? "bg-amber-500/20 text-amber-500"
                  : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
              }`}
              title="Search wiki for province maps and files"
            >
              <Search className="h-3 w-3" />
              Wiki Scan
            </button>
            <button
              onClick={handleGenerateTransport}
              disabled={generateTransport.isPending}
              className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-500/20 disabled:opacity-50 dark:text-indigo-400"
              title="Generate transport network for this country"
            >
              <Train className="h-3 w-3" />
              {generateTransport.isPending ? "Generating..." : "Gen Transport"}
            </button>
            <button
              onClick={handleRecalculate}
              disabled={recalculateGeo.isPending}
              className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
              title="Recalculate geographic profile + economic modifiers"
            >
              <RefreshCw className={`h-3 w-3 ${recalculateGeo.isPending ? "animate-spin" : ""}`} />
              Recalc Geo
            </button>
            <button
              onClick={handleDeleteAllRegions}
              disabled={deleteAllRegions.isPending}
              className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
              title="Delete all regions/subdivisions for this country"
            >
              <Trash2 className="h-3 w-3" />
              {deleteAllRegions.isPending ? "Deleting..." : "Delete Regions"}
            </button>
          </div>
        )}
      </div>

      {/* Wiki Province Finder Panel */}
      {showWikiPanel && selectedCountryId && (
        <div className="border-b border-border bg-card">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <FileImage className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold">Wiki Province Finder — {selectedCountryName}</span>
            </div>
            <button onClick={() => setShowWikiPanel(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex gap-4 px-3 pb-3">
            {/* Auto-scan results */}
            <div className="flex-1 min-w-0">
              <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Auto-detected from wiki article
              </p>
              {scanLoading ? (
                <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Scanning wiki...
                </div>
              ) : wikiProvinceScan ? (
                <div className="space-y-1.5">
                  {wikiProvinceScan.sections.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Sections found: {wikiProvinceScan.sections.join(", ")}
                    </p>
                  )}
                  {wikiProvinceScan.infoboxData && (
                    <div className="text-[11px] text-muted-foreground">
                      {Object.entries(wikiProvinceScan.infoboxData).map(([k, v]) => (
                        <span key={k} className="mr-2">{k}: <span className="text-foreground">{v}</span></span>
                      ))}
                    </div>
                  )}
                  {wikiProvinceScan.files.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {wikiProvinceScan.files.map((file, idx) => (
                        <button
                          key={file}
                          onClick={() => handleImportFromWiki(file)}
                          disabled={!!importingFile}
                          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                            idx === 0
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                              : "border-amber-500/30 bg-amber-500/5 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400"
                          }`}
                          title={`Import ${file} as province map${idx === 0 ? " (recommended)" : ""}`}
                        >
                          {importingFile === file ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />}
                          {idx === 0 && <Sparkles className="h-2.5 w-2.5" />}
                          {file.length > 40 ? file.slice(0, 37) + "..." : file}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      No province map files found in article. Try manual search →
                    </p>
                  )}
                  {wikiProvinceScan.allImageFiles && wikiProvinceScan.allImageFiles.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">
                        All images in article ({wikiProvinceScan.allImageFiles.length})
                      </summary>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {wikiProvinceScan.allImageFiles.map((file: string) => (
                          <button
                            key={file}
                            onClick={() => handleImportFromWiki(file)}
                            className="flex items-center gap-1 rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                          >
                            <Download className="h-2 w-2" />
                            {file.length > 35 ? file.slice(0, 32) + "..." : file}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">No wiki article found for "{selectedCountryName}"</p>
              )}
            </div>

            {/* Manual file search */}
            <div className="w-72 shrink-0 border-l border-border pl-4">
              <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Search wiki files
              </p>
              <input
                type="text"
                value={wikiSearchQuery}
                onChange={(e) => setWikiSearchQuery(e.target.value)}
                placeholder="Search by filename..."
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400"
              />
              {fileSearchLoading && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Searching...
                </div>
              )}
              {wikiFileResults && wikiFileResults.length > 0 && (
                <div className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto">
                  {wikiFileResults.map((file: any) => (
                    <div key={file.name} className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted/50">
                      <button
                        onClick={() => handleImportFromWiki(file.name)}
                        className="flex-1 min-w-0 text-left text-[11px] truncate text-foreground hover:text-amber-500"
                        title={file.name}
                      >
                        {file.name}
                      </button>
                      <span className="shrink-0 text-[9px] text-muted-foreground">
                        {file.width}×{file.height}
                      </span>
                      <a
                        href={file.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title="View on wiki"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
              {wikiFileResults && wikiFileResults.length === 0 && wikiSearchQuery.length >= 2 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground italic">No files found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main editor area */}
      {!selectedCountryId ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-amber-500/50" />
            <p className="text-sm font-medium">Select a country to begin editing</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Forge mode gives you full control over any country&apos;s geography, features, and infrastructure
            </p>
          </div>
        </div>
      ) : selectedCountryId ? (
        <div className="flex flex-1 min-h-0">
          {/* Tool rail */}
          <MapEditorToolbar
            mode={editor.mode}
            onModeChange={editor.setMode}
            disabled={false}
          />

          {/* Map */}
          <div className="relative flex-1 min-w-0">
            <EditorMap
              ref={mapRef}
              countryGeometry={(editor.countryGeo as any)?.geometry ?? null}
              countryCentroid={(editor.countryGeo as any)?.centroid ?? null}
              countryBbox={(editor.countryGeo as any)?.bbox ?? null}
              features={editor.allFeatures}
              mode={editor.mode}
              pendingCoordinates={editor.pendingCoordinates}
              pendingGeometry={editor.pendingGeometry}
              selectedFeature={editor.selectedFeature}
              onMapClick={editor.handleMapClick}
              onDrawComplete={editor.handleDrawComplete}
              worldMapLayers={mapLayers}
            />
            {/* Province import preview — mount when provinces are loaded */}
            {importer.currentProvinces.length > 0 && (mapInstance || mapRef.current?.getMap()) && (
              <ProvincePreviewLayer
                map={(mapInstance || mapRef.current?.getMap())!}
                provinces={importer.currentProvinces}
                countryBorder={importer.countryBorder}
                visible
              />
            )}
          </div>

          {/* Panel */}
          <EditorPanel
            mode={editor.mode}
            collapsed={panelCollapsed}
            onToggleCollapse={() => setPanelCollapsed((v) => !v)}
            featureCount={editor.allFeatures.length}
            propertiesContent={
              <FeaturePropertyPanel
                mode={editor.mode}
                cityForm={editor.cityForm}
                subdivisionForm={editor.subdivisionForm}
                poiForm={editor.poiForm}
                storyPinForm={editor.storyPinForm}
                mapLabelForm={editor.mapLabelForm}
                onCityFormChange={editor.setCityForm}
                onSubdivisionFormChange={editor.setSubdivisionForm}
                onPOIFormChange={editor.setPOIForm}
                onStoryPinFormChange={editor.setStoryPinForm}
                onMapLabelFormChange={editor.setMapLabelForm}
                pendingCoordinates={editor.pendingCoordinates}
                pendingGeometry={editor.pendingGeometry}
                isMutating={editor.isMutating}
                mutationError={editor.mutationError}
                lastSavedAt={editor.lastSavedAt}
                onSubmit={handleSubmit}
                onCancel={editor.resetForm}
                pointInfo={editor.pointInfo}
                isPointInfoLoading={editor.isPendingPointInfoLoading}
                countryId={selectedCountryId}
              />
            }
            featureListContent={
              <FeatureList
                features={editor.allFeatures}
                selectedFeature={editor.selectedFeature}
                onSelectFeature={handleSelectFeature}
                onEditFeature={(f) => editor.startEditing(f)}
                onDeleteFeature={handleDeleteFeature}
                isLoading={editor.featuresLoading}
                collapseAll={editor.mode.startsWith("add-") || editor.mode.startsWith("edit-") || editor.mode === "paint"}
              />
            }
            importWizardContent={
              editor.mode === "import-provinces" ? (
                <ProvinceImportWizard
                  importer={importer}
                  onComplete={() => {
                    editor.setMode("view");
                    editor.refetchFeatures();
                  }}
                  onCancel={() => {
                    importer.reset();
                    editor.setMode("view");
                  }}
                />
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Status bar */}
      {editor && (
        <EditorStatusBar
          cursorCoords={cursorCoords}
          mode={editor.mode}
          terrainInfo={editor.pointInfo ? {
            elevation: editor.pointInfo.elevation?.zoneName ?? null,
            climate: editor.pointInfo.climate?.climateName ?? null,
          } : null}
          zoom={cursorZoom}
          featureCount={editor.allFeatures.length}
        />
      )}
    </div>
  );
}
