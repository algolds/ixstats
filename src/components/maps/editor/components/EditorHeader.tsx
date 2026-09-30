"use client";

import React, { useMemo } from "react";
import { useNotify } from "~/hooks/useNotify";
import {
  ArrowLeft,
  Map,
  NavArrowRight as ChevronRight,
  Undo as Undo2,
  Redo as Redo2,
  ViewGrid as Grid3X3,
  Archery as Crosshair,
  Compress as Minimize2,
  Droplet as Droplets,
  ModernTv as MountainIcon,
  Train,
  Refresh as RefreshCw,
  Settings,
  Upload as FileUp,
  HelpCircle,
  Magnet,
  Eye,
  Download,
  KeyCommand,
  Trash,
} from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { MapEditorInstance, EditorFeature } from "../types/editor-state";
import type { RouteType } from "~/lib/economy/transport-generator";
import { featuresToGeoJSON } from "~/hooks/map-editor/editor-geo-ops";

interface SimplifyAllMutation {
  isPending: boolean;
  mutateAsync: (args: { countryId: string; targetVerticesPerProvince?: number }) => Promise<{
    updated: number;
    total: number;
    verticesBefore: number;
    verticesAfter: number;
    reduction: number;
  }>;
}

interface TransportMutation {
  isPending: boolean;
  mutateAsync: (args: {
    countryId: string;
    routeTypes?: RouteType[];
    clearExisting?: boolean;
    force?: boolean;
  }) => Promise<{ routesCreated: number; hubsCreated?: number; totalLengthKm: number }>;
}

interface RecalculateGeoMutation {
  isPending: boolean;
  mutateAsync: (args?: { countryId?: string } | void) => Promise<
    | {
        processed: number;
        failed: number;
        total: number;
        errors: string[];
      }
    | { success?: boolean }
    | void
  >;
}

interface EditorHeaderProps {
  countryInfo: { name: string } | null | undefined;
  activeEditorMode: "view" | "border_edit";
  isWorldMode: boolean;
  activeCountryId: string | null;
  editor: MapEditorInstance;
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  mapRef: React.RefObject<EditorMapRef | null>;
  isAdmin: boolean;
  editorVisibleLayers: Set<string>;
  toggleEditorLayer: (layer: string) => void;
  generateTransport: TransportMutation;
  recalculateGeo: RecalculateGeoMutation;
  simplifyAll: SimplifyAllMutation;
  handleRequestExit: () => void;
  onShowHelp?: () => void;
  countryId?: string | null;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  snapTolerance: number;
  setSnapTolerance: (v: number) => void;
  panelsLocked: boolean;
  setPanelsLocked: (v: boolean) => void;
  /** Deletes the current (multi-)selection after confirmation. */
  onDeleteSelection?: () => void;
  onShowShortcuts?: () => void;
}

export const EditorHeader = React.memo(function EditorHeader({
  countryInfo,
  activeEditorMode,
  isWorldMode,
  activeCountryId,
  editor,
  showGrid,
  setShowGrid,
  mapRef,
  isAdmin,
  editorVisibleLayers,
  toggleEditorLayer,
  generateTransport,
  recalculateGeo,
  simplifyAll,
  handleRequestExit,
  onShowHelp,
  countryId,
  snapEnabled,
  setSnapEnabled,
  snapTolerance,
  setSnapTolerance,
  panelsLocked,
  setPanelsLocked,
  onDeleteSelection,
  onShowShortcuts,
}: EditorHeaderProps) {
  const notify = useNotify();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const undoAction = editor.history.actions[editor.history.position];
  const redoAction = editor.history.actions[editor.history.position + 1];

  const handleExportGeoJSON = React.useCallback(() => {
    const fc = featuresToGeoJSON(editor.allFeatures);
    if (fc.features.length === 0) {
      notify.info("Nothing to export", "This map has no features yet.");
      return;
    }
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (countryInfo?.name ?? "map").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `${slug}-features.geojson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify.success("GeoJSON exported", `${fc.features.length} features`);
  }, [editor.allFeatures, countryInfo?.name, notify]);

  const handleImportFile = React.useCallback(
    async (file: File) => {
      if (file.size > 20 * 1024 * 1024) {
        notify.error("File too large", "GeoJSON imports are limited to 20 MB.");
        return;
      }
      try {
        const doc: unknown = JSON.parse(await file.text());
        const result = await editor.importGeoJSON(doc);
        if (result.created === 0) {
          notify.warning(
            "Nothing imported",
            result.skipped > 0
              ? `${result.skipped} features were not points or polygons.`
              : "The file had no features."
          );
          return;
        }
        notify.success(
          `Imported ${result.created} feature${result.created === 1 ? "" : "s"}`,
          [
            result.skipped ? `${result.skipped} skipped (lines/unsupported)` : null,
            result.failed ? `${result.failed} rejected by the server` : null,
            "Undo (Ctrl+Z) removes the whole import.",
          ]
            .filter(Boolean)
            .join(" · ")
        );
      } catch (e) {
        notify.error("Import failed", e instanceof Error ? e.message : "Not a valid GeoJSON file");
      }
    },
    [editor, notify]
  );

  const resolvedCountryName = useMemo(() => {
    return (
      countryInfo?.name ||
      editor.countryGeo?.country?.name ||
      editor.countryGeo?.displayName ||
      (activeCountryId ? featureIdToDisplayName(activeCountryId) : "") ||
      (countryId ? featureIdToDisplayName(countryId) : "") ||
      "…"
    );
  }, [
    countryInfo?.name,
    editor.countryGeo?.country?.name,
    editor.countryGeo?.displayName,
    activeCountryId,
    countryId,
  ]);

  return (
    <div className="border-border/60 bg-card/85 pointer-events-auto z-20 flex h-10 shrink-0 items-center gap-2 border-b px-3 shadow-xs backdrop-blur-xl">
      {/* Exit button */}
      <button
        onClick={handleRequestExit}
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-100 ease-out active:scale-[0.98]"
        title="Exit Editor (Esc)"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Breadcrumbs */}
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs select-none">
        {isWorldMode ? (
          <>
            <Map className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-foreground font-semibold">World Map</span>
            {activeCountryId && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-semibold">{resolvedCountryName}</span>
              </>
            )}
            <ChevronRight className="h-3 w-3" />
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs font-semibold text-blue-500">
              {activeEditorMode === "border_edit" ? "BORDER EDIT" : "VIEW"}
            </span>
          </>
        ) : (
          <>
            <Map className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-foreground font-semibold">{resolvedCountryName}</span>
            <ChevronRight className="h-3 w-3" />
            <span>Map Editor</span>
          </>
        )}
      </div>

      {/* Undo/Redo — left side after breadcrumb */}
      {(!isWorldMode || editor.mode !== "view") && (
        <div className="ml-2 flex items-center gap-0.5">
          <button
            disabled={!editor.historyCanUndo || editor.isMutating}
            onClick={() => editor.undo()}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30"
            title={
              undoAction ? `Undo: ${undoAction.description} (Ctrl+Z)` : "Nothing to undo (Ctrl+Z)"
            }
            aria-label="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={!editor.historyCanRedo || editor.isMutating}
            onClick={() => editor.redo()}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30"
            title={
              redoAction
                ? `Redo: ${redoAction.description} (Ctrl+Shift+Z)`
                : "Nothing to redo (Ctrl+Shift+Z)"
            }
            aria-label="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="ml-auto" />

      <div className="bg-border h-4 w-px" />

      {/* Map controls in header — grid, center, settings */}
      <div className="ml-1 flex items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowGrid((v) => !v)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              showGrid
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title="Toggle grid (G)"
            aria-pressed={showGrid}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              const geo = editor.countryGeo;
              if (geo?.centroid) {
                mapRef.current?.flyTo(geo.centroid.lng, geo.centroid.lat, 5);
              }
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors"
            title="Zoom to country"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => editor.setShowGaps?.(!editor.showGaps)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              editor.showGaps
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title={`Highlight gaps & empty regions: ${editor.showGaps ? "On" : "Off"} (H)`}
            aria-pressed={editor.showGaps}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>

          {/* Snap toggle (tolerance lives in the Settings popover below) */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              snapEnabled
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title={`Snap: ${snapEnabled ? "On" : "Off"} (tolerance in Settings)`}
            aria-pressed={snapEnabled}
          >
            <Magnet className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="bg-border h-4 w-px" />

        {/* Rivers/elevation layer toggles + Settings popover */}
        <div className="flex items-center gap-1">
          {isAdmin && (
            <div className="mr-0.5 flex items-center gap-0.5">
              <button
                onClick={() => toggleEditorLayer("rivers")}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                  editorVisibleLayers.has("rivers")
                    ? "bg-blue-500/15 text-blue-500"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                title="Rivers"
              >
                <Droplets className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => toggleEditorLayer("altitudes")}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                  editorVisibleLayers.has("altitudes")
                    ? "bg-amber-500/15 text-amber-500"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                title="Altitude/Elevation"
              >
                <MountainIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {onShowShortcuts && (
            <button
              onClick={onShowShortcuts}
              className="text-muted-foreground hover:bg-accent hover:text-foreground hidden h-6 w-6 items-center justify-center rounded-md transition-colors sm:flex"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <KeyCommand className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Help & Guide Button */}
          {onShowHelp && (
            <button
              onClick={onShowHelp}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors"
              title="Map Editor Guide & Onboarding"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Settings Popover */}
          <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <PopoverTrigger
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                isSettingsOpen
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title="Map Editor Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent
              className="glass-none bg-popover border-border text-foreground z-[100] w-64 rounded-md border p-3 shadow-md"
              align="end"
            >
              <div className="flex flex-col gap-3">
                <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase select-none">
                  Map Editor Settings
                </div>

                <div className="flex flex-col gap-1">
                  {/* Import Provinces */}
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      editor.setMode("import-provinces");
                    }}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
                    title="Import provinces from external GeoJSON"
                  >
                    <FileUp className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <span className="font-medium">Import Provinces (SVG/PNG)</span>
                    <span className="bg-muted text-muted-foreground ml-auto rounded px-1 font-mono text-xs">
                      I
                    </span>
                  </button>

                  {!isWorldMode || activeCountryId ? (
                    <>
                      <button
                        onClick={() => {
                          setIsSettingsOpen(false);
                          importInputRef.current?.click();
                        }}
                        disabled={editor.isMutating}
                        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-50"
                        title="Create cities, POIs and regions from a GeoJSON file (points → cities, polygons → regions)"
                      >
                        <FileUp className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                        <span className="font-medium">Import GeoJSON…</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsSettingsOpen(false);
                          handleExportGeoJSON();
                        }}
                        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
                        title="Download every feature on this map as a GeoJSON FeatureCollection"
                      >
                        <Download className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                        <span className="font-medium">Export GeoJSON</span>
                      </button>
                    </>
                  ) : null}

                  {/* Simplify All */}
                  {editor.allFeatures.some((f: EditorFeature) => f.type === "subdivision") && (
                    <button
                      onClick={async () => {
                        setIsSettingsOpen(false);
                        if (!activeCountryId) return;
                        try {
                          const result = await simplifyAll.mutateAsync({
                            countryId: activeCountryId,
                            targetVerticesPerProvince: 100,
                          });
                          notify.success(
                            `Simplified ${result.updated}/${result.total} regions (${result.reduction}% vertex reduction)`
                          );
                        } catch (e) {
                          notify.error(
                            `Simplification error: ${e instanceof Error ? e.message : "Unknown"}`
                          );
                        }
                      }}
                      disabled={simplifyAll.isPending || !activeCountryId}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-50"
                      title="Simplify all regions — reduce vertices while preserving shape"
                    >
                      <Minimize2 className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                      <span className="font-medium">
                        {simplifyAll.isPending ? "Simplifying..." : "Simplify All Regions"}
                      </span>
                    </button>
                  )}

                  {/* Snap (always visible — universal editing feature) */}
                  <>
                    <div className="border-border/60 my-1 border-t" aria-hidden />
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Magnet className="text-muted-foreground h-3 w-3" />
                        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Snap
                        </span>
                      </div>
                      <button
                        onClick={() => setSnapEnabled(!snapEnabled)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          snapEnabled
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {snapEnabled ? "On" : "Off"}
                      </button>
                    </div>
                    {snapEnabled && (
                      <div className="flex items-center gap-2 px-2 pb-1.5">
                        <input
                          type="range"
                          min="0.001"
                          max="0.1"
                          step="0.001"
                          value={snapTolerance}
                          onChange={(e) => setSnapTolerance(parseFloat(e.target.value))}
                          className="accent-primary h-1 flex-1"
                        />
                        <span className="text-muted-foreground w-10 text-right font-mono text-xs tabular-nums">
                          {snapTolerance.toFixed(3)}°
                        </span>
                      </div>
                    )}
                  </>

                  {/* Lock Panels */}
                  <>
                    <div className="border-border/60 my-1 border-t" aria-hidden />
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Settings className="text-muted-foreground h-3 w-3" />
                        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Lock Panels
                        </span>
                      </div>
                      <button
                        onClick={() => setPanelsLocked(!panelsLocked)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          panelsLocked
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {panelsLocked ? "Locked" : "Unlocked"}
                      </button>
                    </div>
                  </>

                  {/* Admin: transport + recalc — gated, separated visually from the always-on items above */}
                  {isAdmin && activeCountryId && (
                    <>
                      <div className="border-border/60 my-1 border-t" aria-hidden />
                      <div className="text-muted-foreground/80 px-2 text-xs font-semibold tracking-wider uppercase select-none">
                        Admin
                      </div>
                      <button
                        onClick={async () => {
                          setIsSettingsOpen(false);
                          try {
                            const result = await generateTransport.mutateAsync({
                              countryId: activeCountryId,
                              routeTypes: ["rail", "highway"],
                              clearExisting: true,
                            });
                            notify.success(
                              `Generated ${result.routesCreated} routes (${result.totalLengthKm} km)`
                            );
                          } catch (e) {
                            notify.error(
                              `Transport generation error: ${e instanceof Error ? e.message : "Unknown"}`
                            );
                          }
                        }}
                        disabled={generateTransport.isPending}
                        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-50"
                        title="Generate rail + highway routes procedurally (clears existing transport routes)"
                      >
                        <Train className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                        <span className="font-medium">
                          {generateTransport.isPending ? "Generating..." : "Gen Transport"}
                        </span>
                      </button>
                      <button
                        onClick={async () => {
                          setIsSettingsOpen(false);
                          try {
                            await recalculateGeo.mutateAsync({ countryId: activeCountryId });
                            notify.success("Geographic profile recalculated successfully");
                          } catch (e) {
                            notify.error(
                              `Recalculation error: ${e instanceof Error ? e.message : "Unknown"}`
                            );
                          }
                        }}
                        disabled={recalculateGeo.isPending}
                        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-50"
                        title="Recalculate the geographic profile for the active country"
                      >
                        <RefreshCw
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-emerald-500",
                            recalculateGeo.isPending && "animate-spin"
                          )}
                        />
                        <span className="font-medium">
                          {recalculateGeo.isPending ? "Recalculating..." : "Recalc"}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Bulk delete — shown when multi-select has items */}
      {editor.selectedIds.size > 0 && onDeleteSelection && (
        <button
          onClick={onDeleteSelection}
          disabled={editor.isMutating}
          className="text-destructive bg-destructive/10 hover:bg-destructive/20 ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-[color,background-color,transform] active:scale-[0.98] disabled:opacity-50"
          title="Delete selected (Delete)"
        >
          <Trash className="h-3 w-3" />
          <span className="hidden sm:inline">Delete {editor.selectedIds.size}</span>
        </button>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept=".geojson,.json,application/geo+json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleImportFile(file);
        }}
      />
    </div>
  );
});
