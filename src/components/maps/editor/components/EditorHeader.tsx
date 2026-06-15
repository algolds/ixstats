"use client";

import React from "react";
import {
  ArrowLeft,
  Map,
  ChevronRight,
  Undo2,
  Redo2,
  Grid3X3,
  Crosshair,
  Minimize2,
  Droplets,
  Mountain as MountainIcon,
  Train,
  RefreshCw,
  Settings,
  FileUp,
  HelpCircle,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

interface EditorHeaderProps {
  countryInfo: { name: string } | null | undefined;
  activeEditorMode: "view" | "border_edit";
  isWorldMode: boolean;
  activeCountryId: string | null;
  editor: any;
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  mapRef: React.RefObject<any>;
  isAdmin: boolean;
  editorVisibleLayers: Set<string>;
  toggleEditorLayer: (layer: string) => void;
  generateTransport: any;
  recalculateGeo: any;
  simplifyAll: any;
  handleRequestExit: () => void;
  onShowHelp?: () => void;
}

export function EditorHeader({
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
}: EditorHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  return (
    <div className="border-border bg-card/95 z-20 flex h-10 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md">
      {/* Exit button */}
      <button
        onClick={handleRequestExit}
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5 transition-colors"
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
                <span className="text-foreground font-semibold">{countryInfo?.name ?? "…"}</span>
              </>
            )}
            <ChevronRight className="h-3 w-3" />
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-500">
              {activeEditorMode === "border_edit" ? "BORDER EDIT" : "VIEW"}
            </span>
          </>
        ) : (
          <>
            <Map className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-foreground font-semibold">{countryInfo?.name ?? "…"}</span>
            <ChevronRight className="h-3 w-3" />
            <span>Map Editor</span>
          </>
        )}
      </div>

      {/* Undo/Redo — left side after breadcrumb */}
      {(!isWorldMode || editor.mode !== "view") && (
        <div className="ml-2 flex items-center gap-0.5">
          <button
            disabled={!editor.historyCanUndo}
            onClick={() => editor.undo()}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={!editor.historyCanRedo}
            onClick={() => editor.redo()}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Save indicator */}
      {editor.isMutating && (
        <span className="ml-2 animate-pulse text-[10px] text-amber-500">Saving…</span>
      )}
      {!editor.isMutating && editor.lastSavedAt && (
        <span className="ml-2 text-[10px] text-emerald-500">Saved</span>
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
            title="Toggle Grid (G)"
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
            title="Center on Country"
          >
            <Crosshair className="h-3.5 w-3.5" />
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
                <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase select-none">
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
                    <span className="font-medium">Import Provinces</span>
                  </button>

                  {/* Simplify All */}
                  {editor.allFeatures.some((f: any) => f.type === "subdivision") && (
                    <button
                      onClick={async () => {
                        setIsSettingsOpen(false);
                        if (!activeCountryId) return;
                        try {
                          const result = await simplifyAll.mutateAsync({
                            countryId: activeCountryId,
                            targetVerticesPerProvince: 100,
                          });
                          alert(
                            `Simplified ${result.updated}/${result.total} regions\n` +
                              `Vertices: ${result.verticesBefore.toLocaleString()} → ${result.verticesAfter.toLocaleString()} (${result.reduction}% reduction)`
                          );
                        } catch (e) {
                          alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                        }
                      }}
                      disabled={simplifyAll.isPending || !activeCountryId}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-50"
                      title="Simplify all regions — reduce vertices while preserving shape"
                    >
                      <Minimize2
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-violet-500",
                          simplifyAll.isPending && "animate-pulse"
                        )}
                      />
                      <span className="font-medium">
                        {simplifyAll.isPending ? "Simplifying..." : "Simplify All Regions"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Bulk delete — shown when multi-select has items */}
      {editor.selectedIds.size > 0 && (
        <button
          onClick={async () => {
            if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
            await editor.bulkDeleteSelected();
          }}
          className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-500/20 dark:text-red-400"
        >
          Delete {editor.selectedIds.size} Selected
        </button>
      )}

      {/* Admin: transport + recalc actions — available when a country is active */}
      {isAdmin && activeCountryId && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={async () => {
              try {
                const result = await generateTransport.mutateAsync({
                  countryId: activeCountryId,
                  routeTypes: ["rail", "highway"],
                  clearExisting: true,
                });
                alert(`Generated ${result.routesCreated} routes (${result.totalLengthKm} km)`);
              } catch (e) {
                alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
              }
            }}
            disabled={generateTransport.isPending}
            className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-500/20 disabled:opacity-50 dark:text-indigo-400"
          >
            <Train className="h-3 w-3" />
            {generateTransport.isPending ? "..." : "Gen Transport"}
          </button>
          <button
            onClick={async () => {
              try {
                await recalculateGeo.mutateAsync({ countryId: activeCountryId });
                alert("Geographic profile recalculated");
              } catch (e) {
                alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
              }
            }}
            disabled={recalculateGeo.isPending}
            className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
          >
            <RefreshCw className={cn("h-3 w-3", recalculateGeo.isPending && "animate-spin")} />
            Recalc
          </button>
        </div>
      )}
    </div>
  );
}
