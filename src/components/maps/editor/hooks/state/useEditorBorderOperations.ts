"use client";

import { useState, useCallback } from "react";
import type { BorderEditorActions, BorderEditorState } from "~/hooks/useBorderEditor";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import { api } from "~/trpc/react";

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

  const handleConfirmBorderSave = useCallback(async () => {
    try {
      setIsSubmitting(true);
      await borderActions.submitEdit(true, saveReason);
      setShowConfirmSaveModal(false);
      void utils.geoCore.getWorldMap.invalidate();
      void utils.geoCore.getMapBundle.invalidate();
      refetchValidation();
      setActiveEditorMode("view");
    } catch (err) {
      console.error("Save failed:", err);
      alert(`Save failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [borderActions, saveReason, utils, refetchValidation, setActiveEditorMode]);

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
    async (nameA: string, nameB: string) => {
      try {
        setIsSubmitting(true);
        await borderActions.executeSplit(nameA, nameB);
        setShowSplitDialog(false);
        void utils.geoCore.getWorldMap.invalidate();
        void utils.geoCore.getMapBundle.invalidate();
        refetchValidation();
        setActiveEditorMode("view");
      } catch (err) {
        console.error("Split failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [borderActions, utils, refetchValidation, setActiveEditorMode]
  );

  const handleMergeConfirm = useCallback(
    async (newName: string) => {
      try {
        setIsSubmitting(true);
        await borderActions.executeMerge(newName);
        setShowMergeDialog(false);
        void utils.geoCore.getWorldMap.invalidate();
        void utils.geoCore.getMapBundle.invalidate();
        refetchValidation();
        setActiveEditorMode("view");
      } catch (err) {
        console.error("Merge failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [borderActions, utils, refetchValidation, setActiveEditorMode]
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
