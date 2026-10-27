import { useCallback } from "react";
import type { EditorFeature } from "../types/editor-state";
import type { MapEditorOverlayReturnState } from "./MapEditorSidebarPanels";

/** Stable select / edit / delete callbacks that forward to the overlay state when it provides them. */
export function useFeatureActionHandlers(state: MapEditorOverlayReturnState) {
  const { handleSelectFeature, handleEditFeature, handleDeleteFeature } = state;
  return {
    onSelectFeature: useCallback(
      (feat: EditorFeature | null) => handleSelectFeature?.(feat),
      [handleSelectFeature]
    ),
    onEditFeature: useCallback(
      (feat: EditorFeature) => handleEditFeature?.(feat),
      [handleEditFeature]
    ),
    onDeleteFeature: useCallback(
      (feat: EditorFeature) => handleDeleteFeature?.(feat),
      [handleDeleteFeature]
    ),
  };
}
