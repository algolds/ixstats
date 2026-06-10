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
  Sparkles,
  Train,
  RefreshCw,
} from "lucide-react";
import { cn } from "~/lib/utils";

interface EditorHeaderProps {
  countryInfo: { name: string } | null | undefined;
  activeEditorMode: "view" | "forge" | "border_edit";
  isWorldMode: boolean;
  activeCountryId: string | null;
  editor: any;
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  mapRef: React.RefObject<any>;
  isAdmin: boolean;
  editorVisibleLayers: Set<string>;
  toggleEditorLayer: (layer: string) => void;
  forgeMode: boolean;
  setForgeMode: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveEditorMode: React.Dispatch<React.SetStateAction<"view" | "forge" | "border_edit">>;
  generateTransport: any;
  recalculateGeo: any;
  simplifyAll: any;
  handleRequestExit: () => void;
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
  forgeMode,
  setForgeMode,
  setActiveEditorMode,
  generateTransport,
  recalculateGeo,
  simplifyAll,
  handleRequestExit,
}: EditorHeaderProps) {
  const isForgeActive = isWorldMode ? activeEditorMode === "forge" : forgeMode;

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
              {activeEditorMode === "border_edit"
                ? "BORDER EDIT"
                : activeEditorMode === "forge"
                  ? "FORGE"
                  : "VIEW"}
            </span>
          </>
        ) : (
          <>
            <Map className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-foreground font-semibold">{countryInfo?.name ?? "…"}</span>
            <ChevronRight className="h-3 w-3" />
            <span>{forgeMode ? "Forge Mode" : "Map Editor"}</span>
          </>
        )}
      </div>

      {/* Undo/Redo — left side after breadcrumb */}
      {(!isWorldMode || activeEditorMode === "forge") && (
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
      {(!isWorldMode || activeEditorMode === "forge") && editor.isMutating && (
        <span className="ml-2 animate-pulse text-[10px] text-amber-500">Saving…</span>
      )}
      {(!isWorldMode || activeEditorMode === "forge") &&
        !editor.isMutating &&
        editor.lastSavedAt && <span className="ml-2 text-[10px] text-emerald-500">Saved</span>}

      <div className="ml-auto" />

      <div className="bg-border h-4 w-px" />

      {/* Map controls in header — grid, center */}
      <div className="ml-1 flex items-center gap-0.5">
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

      {/* Simplify All Regions — available to all users with regions */}
      {editor.allFeatures.some((f: any) => f.type === "subdivision") && (
        <div className="mr-1">
          <button
            onClick={async () => {
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
            className="flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-500/20 disabled:opacity-50 dark:text-violet-400"
            title="Simplify all regions — reduce vertices while preserving shape"
          >
            <Minimize2 className={cn("h-3 w-3", simplifyAll.isPending && "animate-pulse")} />
            {simplifyAll.isPending ? "Simplifying..." : "Simplify All"}
          </button>
        </div>
      )}

      {/* Admin: Forge Mode toggle + actions */}
      {isAdmin && (
        <div
          className={cn(
            editor.allFeatures.some((f: any) => f.type === "subdivision") ? "" : "ml-auto",
            "flex items-center gap-1.5"
          )}
        >
          {/* Rivers/elevation icons */}
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

          <div className="bg-border mx-0.5 h-4 w-px" />

          <button
            onClick={() => {
              if (isWorldMode) {
                if (activeEditorMode === "forge") {
                  setActiveEditorMode("view");
                  editor.setMode("view");
                } else {
                  setActiveEditorMode("forge");
                }
              } else {
                setForgeMode((v) => !v);
              }
            }}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              isForgeActive
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title={
              isWorldMode
                ? "Toggle Forge Mode (editing features)"
                : "Toggle Forge Mode (admin superpowers)"
            }
          >
            <Sparkles className="h-3 w-3" />
            Forge
          </button>
          {isForgeActive && activeCountryId && (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
