"use client";

import React from "react";
import {
  ArrowLeft,
  Map,
  NavArrowRight as ChevronRight,
  Undo as Undo2,
  Redo as Redo2,
  ViewGrid as Grid3X3,
  Archery as Crosshair,
  Droplet as Droplets,
  ModernTv as MountainIcon,
  HelpCircle,
  Magnet,
  Eye,
  KeyCommand,
  Trash,
} from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { MapEditorInstance } from "../types/editor-state";
import {
  EditorSettingsPopover,
  type RecalculateGeoMutation,
  type SimplifyAllMutation,
  type TransportMutation,
} from "./EditorSettingsPopover";
import { useGeoJsonTransfer } from "./useGeoJsonTransfer";

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

/** 28px icon button that shows a filled background while `active`. */
function HeaderIconButton({
  active,
  className,
  ...props
}: { active?: boolean } & Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", active ? "bg-fill-3 text-label" : "text-label-secondary", className)}
      {...props}
    />
  );
}

function Breadcrumbs({
  isWorldMode,
  showCountry,
  countryName,
  isBorderEdit,
}: {
  isWorldMode: boolean;
  showCountry: boolean;
  countryName: string;
  isBorderEdit: boolean;
}) {
  return (
    <div className="text-label-secondary text-footnote flex items-center gap-2 select-none">
      <Map className="text-blue h-3.5 w-3.5" aria-hidden />
      {isWorldMode ? (
        <>
          <span className="text-label font-semibold">World map</span>
          {showCountry && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-label font-semibold">{countryName}</span>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <Badge variant="outline">{isBorderEdit ? "Border edit" : "View"}</Badge>
        </>
      ) : (
        <>
          <span className="text-label font-semibold">{countryName}</span>
          <ChevronRight className="h-3 w-3" />
          <span>Map editor</span>
        </>
      )}
    </div>
  );
}

const ICON = "h-3.5 w-3.5";

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
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const { exportGeoJSON, importGeoJSON } = useGeoJsonTransfer(editor, countryInfo?.name);

  const { history } = editor;
  const undoAction = history.actions[history.position];
  const redoAction = history.actions[history.position + 1];

  const resolvedCountryName =
    [
      countryInfo?.name,
      editor.countryGeo?.country?.name,
      editor.countryGeo?.displayName,
      activeCountryId && featureIdToDisplayName(activeCountryId),
      countryId && featureIdToDisplayName(countryId),
    ].find(Boolean) || "…";

  return (
    <FacetMaterial
      layer="chrome"
      className="pointer-events-auto flex h-11 shrink-0 items-center gap-2 rounded-none px-3"
    >
      <HeaderIconButton onClick={handleRequestExit} title="Exit Editor (Esc)">
        <ArrowLeft className="h-4 w-4" />
      </HeaderIconButton>

      <Breadcrumbs
        isWorldMode={isWorldMode}
        showCountry={!!activeCountryId}
        countryName={resolvedCountryName}
        isBorderEdit={activeEditorMode === "border_edit"}
      />

      {(!isWorldMode || editor.mode !== "view") && (
        <div className="ml-2 flex items-center gap-0.5">
          <HeaderIconButton
            disabled={!editor.historyCanUndo || editor.isMutating}
            onClick={() => editor.undo()}
            title={
              undoAction ? `Undo: ${undoAction.description} (Ctrl+Z)` : "Nothing to undo (Ctrl+Z)"
            }
            aria-label="Undo"
          >
            <Undo2 className={ICON} />
          </HeaderIconButton>
          <HeaderIconButton
            disabled={!editor.historyCanRedo || editor.isMutating}
            onClick={() => editor.redo()}
            title={
              redoAction
                ? `Redo: ${redoAction.description} (Ctrl+Shift+Z)`
                : "Nothing to redo (Ctrl+Shift+Z)"
            }
            aria-label="Redo"
          >
            <Redo2 className={ICON} />
          </HeaderIconButton>
        </div>
      )}

      <div className="ml-auto" />

      <div className="bg-separator h-4 w-px" />

      <div className="ml-1 flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <HeaderIconButton
            active={showGrid}
            onClick={() => setShowGrid((v) => !v)}
            title="Toggle grid (G)"
            aria-pressed={showGrid}
          >
            <Grid3X3 className={ICON} />
          </HeaderIconButton>
          <HeaderIconButton
            onClick={() => {
              const centroid = editor.countryGeo?.centroid;
              if (centroid) mapRef.current?.flyTo(centroid.lng, centroid.lat, 5);
            }}
            title="Zoom to country"
          >
            <Crosshair className={ICON} />
          </HeaderIconButton>
          <HeaderIconButton
            active={editor.showGaps}
            onClick={() => editor.setShowGaps?.(!editor.showGaps)}
            title={`Highlight gaps & empty regions: ${editor.showGaps ? "On" : "Off"} (H)`}
            aria-pressed={editor.showGaps}
          >
            <Eye className={ICON} />
          </HeaderIconButton>
          <HeaderIconButton
            active={snapEnabled}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title={`Snap: ${snapEnabled ? "On" : "Off"} (tolerance in Settings)`}
            aria-pressed={snapEnabled}
          >
            <Magnet className={ICON} />
          </HeaderIconButton>
        </div>

        <div className="bg-separator h-4 w-px" />

        <div className="flex items-center gap-1">
          {isAdmin && (
            <div className="mr-0.5 flex items-center gap-0.5">
              <HeaderIconButton
                active={editorVisibleLayers.has("rivers")}
                onClick={() => toggleEditorLayer("rivers")}
                title="Rivers"
              >
                <Droplets className={ICON} />
              </HeaderIconButton>
              <HeaderIconButton
                active={editorVisibleLayers.has("altitudes")}
                onClick={() => toggleEditorLayer("altitudes")}
                title="Altitude/Elevation"
              >
                <MountainIcon className={ICON} />
              </HeaderIconButton>
            </div>
          )}

          {onShowShortcuts && (
            <HeaderIconButton
              className="hidden sm:flex"
              onClick={onShowShortcuts}
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <KeyCommand className={ICON} />
            </HeaderIconButton>
          )}

          {onShowHelp && (
            <HeaderIconButton onClick={onShowHelp} title="Map editor guide & onboarding">
              <HelpCircle className={ICON} />
            </HeaderIconButton>
          )}

          <EditorSettingsPopover
            editor={editor}
            isWorldMode={isWorldMode}
            isAdmin={isAdmin}
            activeCountryId={activeCountryId}
            generateTransport={generateTransport}
            recalculateGeo={recalculateGeo}
            simplifyAll={simplifyAll}
            snapEnabled={snapEnabled}
            setSnapEnabled={setSnapEnabled}
            snapTolerance={snapTolerance}
            setSnapTolerance={setSnapTolerance}
            panelsLocked={panelsLocked}
            setPanelsLocked={setPanelsLocked}
            onImportGeoJSON={() => importInputRef.current?.click()}
            onExportGeoJSON={exportGeoJSON}
          />
        </div>
      </div>

      {editor.selectedIds.size > 0 && onDeleteSelection && (
        <Button
          variant="destructive"
          size="xs"
          onClick={onDeleteSelection}
          disabled={editor.isMutating}
          className="ml-1"
          title="Delete selected (Delete)"
        >
          <Trash aria-hidden />
          <span className="hidden sm:inline">Delete {editor.selectedIds.size}</span>
        </Button>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept=".geojson,.json,application/geo+json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importGeoJSON(file);
        }}
      />
    </FacetMaterial>
  );
});
