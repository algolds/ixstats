"use client";

import { useState, useCallback } from "react";
import { notifyFromStore } from "~/hooks/useNotify";
import type { BorderEditorActions, BorderEditorState } from "~/hooks/useBorderEditor";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import { api } from "~/trpc/react";
import { invalidateMapViews, notifyFailure } from "./geo-invalidation";

interface UseEditorBorderOperationsProps {
  borderActions: BorderEditorActions;
  borderState: BorderEditorState;
  mapSelectedCountry: SelectedCountry | null;
  setActiveEditorMode: (mode: "view" | "border_edit") => void;
  refetchValidation: () => void;
}

export function useEditorBorderOperations({
  borderActions,
  borderState,
  mapSelectedCountry,
  setActiveEditorMode,
  refetchValidation,
}: UseEditorBorderOperationsProps) {
  const [displayName, setDisplayName] = useState("");
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [saveReason, setSaveReason] = useState("");

  const utils = api.useUtils();

  const handleExitBorderEdit = useCallback(() => {
    borderActions.reset();
    setActiveEditorMode("view");
  }, [borderActions, setActiveEditorMode]);

  /** Runs a border operation; on success closes its dialog, refreshes the map and returns to view. */
  const runBorderOperation = useCallback(
    async (
      operation: () => Promise<unknown>,
      closeDialog: () => void,
      onError: (err: unknown) => void
    ) => {
      try {
        setIsSubmitting(true);
        await operation();
        closeDialog();
        invalidateMapViews(utils);
        refetchValidation();
        setActiveEditorMode("view");
      } catch (err) {
        onError(err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [utils, refetchValidation, setActiveEditorMode]
  );

  const handleConfirmBorderSave = useCallback(
    () =>
      runBorderOperation(
        () => borderActions.submitEdit(true, saveReason),
        () => setShowConfirmSaveModal(false),
        (err) => {
          console.error("Save failed:", err);
          notifyFromStore(
            notifyFailure(
              "Border save failed",
              err instanceof Error ? err.message : "Unknown error"
            )
          );
        }
      ),
    [runBorderOperation, borderActions, saveReason]
  );

  const enterBorderEdit = useCallback(
    (initialMode?: "select" | "vertex_edit" | "split" | "merge" | "trace" | "brush") => {
      if (!mapSelectedCountry?.featureId) return;
      borderActions.loadFeature(mapSelectedCountry.featureId);
      setActiveEditorMode("border_edit");
      if (initialMode) {
        borderActions.setMode(initialMode);
      }
    },
    [mapSelectedCountry, borderActions, setActiveEditorMode]
  );

  const handleSplitConfirm = useCallback(
    (nameA: string, nameB: string) =>
      runBorderOperation(
        () => borderActions.executeSplit(nameA, nameB),
        () => setShowSplitDialog(false),
        (err) => console.error("Split failed:", err)
      ),
    [runBorderOperation, borderActions]
  );

  const handleMergeConfirm = useCallback(
    (newName: string) =>
      runBorderOperation(
        () => borderActions.executeMerge(newName),
        () => setShowMergeDialog(false),
        (err) => console.error("Merge failed:", err)
      ),
    [runBorderOperation, borderActions]
  );

  const handleBorderToolbarSubmit = useCallback(() => {
    if (borderState.mode === "split" && borderState.splitLine.length >= 2) {
      setShowSplitDialog(true);
    } else if (borderState.mode === "merge" && borderState.mergeTargets.length > 0) {
      setShowMergeDialog(true);
    } else {
      setShowConfirmSaveModal(true);
      setSaveReason("");
    }
  }, [borderState.mode, borderState.splitLine, borderState.mergeTargets]);

  return {
    displayName,
    setDisplayName,
    showSplitDialog,
    setShowSplitDialog,
    showMergeDialog,
    setShowMergeDialog,
    isSubmitting,
    setIsSubmitting,
    showConfirmSaveModal,
    setShowConfirmSaveModal,
    saveReason,
    setSaveReason,
    handleExitBorderEdit,
    handleConfirmBorderSave,
    enterBorderEdit,
    handleSplitConfirm,
    handleMergeConfirm,
    handleBorderToolbarSubmit,
  };
}
