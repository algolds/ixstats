"use client";

import React, { useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { BatchActionsBar, type EditableField } from "~/components/maps/editor/BatchActionsBar";
import { EditorDialogs } from "./EditorDialogs";
import { EditorContextMenuWrapper } from "./EditorContextMenuWrapper";
import { PropertiesPanelContent } from "./PropertiesPanelContent";
import { LayerPanel } from "~/components/maps/editor/LayerPanel";
import type { MapEditorOverlayReturnState } from "./MapEditorSidebarPanels";
import type { EditorContextMenuData, EditorFeature } from "../types/editor-state";

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
  const { editor, importer } = state;

  const handleSelectFeature = useCallback((feat: EditorFeature | null) => {
    state.handleSelectFeature?.(feat);
  }, [state.handleSelectFeature]);

  const handleEditFeature = useCallback((feat: EditorFeature) => {
    state.handleEditFeature?.(feat);
  }, [state.handleEditFeature]);

  const handleDeleteFeature = useCallback((feat: EditorFeature) => {
    state.handleDeleteFeature?.(feat);
  }, [state.handleDeleteFeature]);

  const subdivisionCount = useMemo(
    () =>
      editor.allFeatures.filter(
        (f) => editor.selectedIds.has(f.id) && f.type === "subdivision"
      ).length,
    [editor.allFeatures, editor.selectedIds]
  );

  const handleBatchDelete = useCallback(async () => {
    const count = editor.selectedIds.size;
    try {
      await editor.bulkDeleteSelected();
      toast.success(`Deleted ${count} features`);
    } catch {
      toast.error("Failed to delete selected features");
    }
  }, [editor]);

  const handleBulkEdit = useCallback(async (field: EditableField, value: string | number) => {
    const result = await editor.bulkEditSelected(field, value);
    if (result.failCount > 0) {
      toast.error(
        `Bulk edit: ${result.successCount} updated, ${result.failCount} failed.`
      );
    } else if (result.successCount > 0) {
      toast.success(`Updated ${result.successCount} features`);
    }
    return result;
  }, [editor]);

  const renderRightPanelContent = () => (
    <PropertiesPanelContent
      {...state}
      brushTargetId={brushTargetId}
      setBrushTargetId={setBrushTargetId}
    />
  );

  return (
    <>
      {/* Mobile sheets */}
      {editor.mode !== "view" && editor.mode !== "import-provinces" && (
        <div className="sm:hidden">
          <MobileEditorSheet
            onClose={() => editor.resetForm()}
            title="Properties"
            isEditMode={editor.mode.startsWith("add-") || editor.mode.startsWith("edit-")}
            featureListContent={
              <LayerPanel
                minimal
                features={editor.allFeatures}
                selectedFeature={editor.selectedFeature}
                onSelectFeature={handleSelectFeature}
                onEditFeature={handleEditFeature}
                onDeleteFeature={handleDeleteFeature}
                isLoading={editor.featuresLoading}
                selectedIds={editor.selectedIds}
                onToggleSelect={editor.toggleSelectId}
              />
            }
          >
            {renderRightPanelContent()}
          </MobileEditorSheet>
        </div>
      )}

      {/* Batch Actions Bar */}
      {editor.selectedIds.size > 1 && (
        <BatchActionsBar
          selectedCount={editor.selectedIds.size}
          subdivisionCount={subdivisionCount}
          onBatchDelete={handleBatchDelete}
          onDeselectAll={editor.clearMultiSelect}
          onBulkEdit={handleBulkEdit}
          isMutating={editor.isMutating}
        />
      )}

      {/* Context Menu */}
      <EditorContextMenuWrapper
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        editor={editor}
      />

      {/* Keyboard Shortcut Sheet */}
      {showShortcuts && <KeyboardShortcutSheet onClose={() => setShowShortcuts(false)} />}

      {/* Province Import Wizard Floating Panel */}
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

      {/* Editor Dialogs */}
      <EditorDialogs {...state} onExit={onExit} />

      {/* Onboarding Welcome Modal */}
      <MapEditorWelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
    </>
  );
});
