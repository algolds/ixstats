"use client";

import React from "react";
import { MobileEditorSheet } from "~/components/maps/editor/MobileEditorSheet";
import { BatchActionsBar } from "~/components/maps/editor/BatchActionsBar";
import { KeyboardShortcutSheet } from "~/components/maps/editor/KeyboardShortcutSheet";
import {
  FloatingImportPanel,
  ProvinceImportWizard,
} from "~/components/maps/editor/province-importer";
import { EditorDialogs } from "./EditorDialogs";
import { MapEditorWelcomeModal } from "./MapEditorWelcomeModal";
import { EditorContextMenuWrapper } from "./EditorContextMenuWrapper";
import { PropertiesPanelContent } from "./PropertiesPanelContent";
import { FeatureList } from "~/components/maps/editor/FeatureList";

interface MapEditorAuxiliaryOverlaysProps {
  state: any;
  onExit: () => void;
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;
  contextMenu: any;
  setContextMenu: any;
  brushTargetId: string | null;
  setBrushTargetId: (id: string | null) => void;
}

export function MapEditorAuxiliaryOverlays({
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

  const handleSelectFeature = (feat: any) => {
    state.handleSelectFeature?.(feat);
  };
  const handleEditFeature = (feat: any) => {
    state.handleEditFeature?.(feat);
  };
  const handleDeleteFeature = (feat: any) => {
    state.handleDeleteFeature?.(feat);
  };

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
              <FeatureList
                features={editor.allFeatures}
                selectedFeature={editor.selectedFeature}
                onSelectFeature={handleSelectFeature}
                onEditFeature={handleEditFeature}
                onDeleteFeature={handleDeleteFeature}
                isLoading={editor.featuresLoading}
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
          subdivisionCount={
            editor.allFeatures.filter(
              (f: any) => editor.selectedIds.has(f.id) && f.type === "subdivision"
            ).length
          }
          onBatchDelete={async () => {
            if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
            await editor.bulkDeleteSelected();
          }}
          onDeselectAll={editor.clearMultiSelect}
          onBulkEdit={async (field, value) => {
            const result = await editor.bulkEditSelected(field, value);
            if (result.failCount > 0) {
              alert(
                `Bulk edit: ${result.successCount} updated, ${result.failCount} failed. Check console for details.`
              );
            }
            return result;
          }}
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
}
