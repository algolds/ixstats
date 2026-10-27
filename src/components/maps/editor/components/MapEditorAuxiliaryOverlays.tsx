"use client";

import { FacetMaterial } from "~/components/ui/facet";
import { Button } from "~/components/ui/button";
import React, { useMemo, useCallback, useState } from "react";
import { List } from "iconoir-react";
import dynamic from "next/dynamic";
import { useNotify } from "~/hooks/useNotify";
import { useIsMobile } from "~/hooks/useIsMobile";
import { BatchActionsBar, type EditableField } from "~/components/maps/editor/BatchActionsBar";
import { EditorDialogs } from "./EditorDialogs";
import { useFeatureActionHandlers } from "./useFeatureActionHandlers";
import { EditorContextMenuWrapper } from "./EditorContextMenuWrapper";
import { PropertiesPanelContent } from "./PropertiesPanelContent";
import { LayerPanel } from "~/components/maps/editor/LayerPanel";
import type { MapEditorOverlayReturnState } from "./MapEditorSidebarPanels";
import type { EditorContextMenuData } from "../types/editor-state";

const MobileEditorSheet = dynamic(
  () => import("~/components/maps/editor/MobileEditorSheet").then((m) => m.MobileEditorSheet),
  { ssr: false }
);

const KeyboardShortcutSheet = dynamic(
  () =>
    import("~/components/maps/editor/KeyboardShortcutSheet").then((m) => m.KeyboardShortcutSheet),
  { ssr: false }
);

const FloatingImportPanel = dynamic(
  () => import("~/components/maps/editor/province-importer").then((m) => m.FloatingImportPanel),
  { ssr: false }
);

const ProvinceImportWizard = dynamic(
  () => import("~/components/maps/editor/province-importer").then((m) => m.ProvinceImportWizard),
  { ssr: false }
);

const MapEditorWelcomeModal = dynamic(
  () => import("./MapEditorWelcomeModal").then((m) => m.MapEditorWelcomeModal),
  { ssr: false }
);

interface MapEditorAuxiliaryOverlaysProps {
  state: MapEditorOverlayReturnState;
  onExit: () => void;
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;
  contextMenu: EditorContextMenuData | null;
  setContextMenu: React.Dispatch<React.SetStateAction<EditorContextMenuData | null>>;
  brushTargetId: string | null;
  setBrushTargetId: (id: string | null) => void;
}

export const MapEditorAuxiliaryOverlays = React.memo(function MapEditorAuxiliaryOverlays({
  state,
  onExit,
  showWelcomeModal,
  setShowWelcomeModal,
  showShortcuts,
  setShowShortcuts,
  contextMenu,
  setContextMenu,
  brushTargetId,
  setBrushTargetId,
}: MapEditorAuxiliaryOverlaysProps) {
  const notify = useNotify();
  const { editor, importer } = state;

  const {
    onSelectFeature: handleSelectFeature,
    onEditFeature: handleEditFeature,
    onDeleteFeature: handleDeleteFeature,
  } = useFeatureActionHandlers(state);

  const subdivisionCount = useMemo(
    () =>
      editor.allFeatures.filter((f) => editor.selectedIds.has(f.id) && f.type === "subdivision")
        .length,
    [editor.allFeatures, editor.selectedIds]
  );

  const isMobile = useIsMobile();
  const [mobileListOpen, setMobileListOpen] = useState(false);

  // On phones the sheet covers most of the map, so placement/drawing tools only open it
  // once there is something to fill in (a placed point, a closed shape, a drawn route).
  const mobileSheetForTool =
    editor.mode.startsWith("edit-") ||
    (editor.mode.startsWith("add-") &&
      (!!editor.pendingCoordinates ||
        !!editor.pendingGeometry ||
        (editor.mode === "add-route" && editor.routeWaypoints.length >= 2)));
  const showMobileSheet =
    isMobile && (mobileSheetForTool || (mobileListOpen && editor.mode === "view"));

  const handleBatchDelete = useCallback(() => {
    void state.requestDeleteSelection();
  }, [state]);

  const handleBulkEdit = useCallback(
    async (field: EditableField, value: string | number) => {
      const result = await editor.bulkEditSelected(field, value);
      if (result.failCount > 0) {
        notify.error(`Bulk edit: ${result.successCount} updated, ${result.failCount} failed.`);
      } else if (result.successCount > 0) {
        notify.success(`Updated ${result.successCount} features`);
      }
      return result;
    },
    [editor, notify]
  );

  const renderRightPanelContent = () => (
    <PropertiesPanelContent
      {...state}
      brushTargetId={brushTargetId}
      setBrushTargetId={setBrushTargetId}
    />
  );

  return (
    <>
      {/* Mobile sheet — mounted only on phones so desktop never renders a hidden second
          copy of the properties panel and feature list. */}
      {isMobile && editor.mode === "view" && !mobileListOpen && editor.allFeatures.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto absolute right-3 bottom-20 z-20 rounded-full sm:hidden"
          type="button"
          onClick={() => setMobileListOpen(true)}
        >
          <List className="h-4 w-4" />
          Features
        </Button>
      )}

      {showMobileSheet && (
        <div className="sm:hidden">
          <MobileEditorSheet
            key={mobileSheetForTool ? "tool" : "list"}
            onClose={() => {
              setMobileListOpen(false);
              if (mobileSheetForTool) {
                const wasEditing = editor.mode.startsWith("edit-");
                editor.resetForm();
                if (wasEditing) editor.setMode("view");
              }
            }}
            title="Properties"
            isEditMode={mobileSheetForTool}
            featureListContent={
              <LayerPanel
                minimal
                features={editor.allFeatures}
                selectedFeature={editor.selectedFeature}
                onSelectFeature={handleSelectFeature}
                onEditFeature={handleEditFeature}
                onDeleteFeature={handleDeleteFeature}
                selectedIds={editor.selectedIds}
                onToggleSelect={editor.toggleSelectId}
              />
            }
          >
            {renderRightPanelContent()}
          </MobileEditorSheet>
        </div>
      )}

      {editor.selectedIds.size > 1 && (
        <div className="pointer-events-auto absolute bottom-10 left-1/2 z-30 max-w-[calc(100vw-2rem)] -translate-x-1/2">
          <FacetMaterial layer="chrome" className="rounded-row overflow-hidden">
            <BatchActionsBar
              selectedCount={editor.selectedIds.size}
              subdivisionCount={subdivisionCount}
              onBatchDelete={handleBatchDelete}
              onDeselectAll={editor.clearMultiSelect}
              onBulkEdit={handleBulkEdit}
              isMutating={editor.isMutating}
            />
          </FacetMaterial>
        </div>
      )}

      <EditorContextMenuWrapper
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        editor={editor}
        onDeleteFeature={handleDeleteFeature}
        onZoomToFeature={state.zoomToFeature}
      />

      {showShortcuts && <KeyboardShortcutSheet onClose={() => setShowShortcuts(false)} />}

      {editor.mode === "import-provinces" && (
        <FloatingImportPanel
          onClose={() => {
            importer.reset();
            editor.setMode("view");
          }}
        >
          <ProvinceImportWizard
            importer={importer}
            onComplete={() => {
              editor.setMode("view");
              editor.refetchFeatures();
              importer.reset();
            }}
            onCancel={() => {
              importer.reset();
              editor.setMode("view");
            }}
          />
        </FloatingImportPanel>
      )}

      <EditorDialogs {...state} onExit={onExit} />

      <MapEditorWelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
    </>
  );
});
