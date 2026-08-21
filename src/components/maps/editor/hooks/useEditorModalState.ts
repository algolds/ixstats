"use client";

import { useState, useCallback } from "react";
import type { EditorFeature } from "~/hooks/useMapEditor";

export interface ContextMenuState {
  feature: EditorFeature | null;
  position: { x: number; y: number } | null;
}

export function useEditorModalState() {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showFloatingImport, setShowFloatingImport] = useState(false);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    feature: null,
    position: null,
  });

  const openContextMenu = useCallback((feature: EditorFeature, screenPos: { x: number; y: number }) => {
    setContextMenu({
      feature,
      position: screenPos,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      feature: null,
      position: null,
    });
  }, []);

  return {
    showWelcomeModal,
    setShowWelcomeModal,
    showShortcuts,
    setShowShortcuts,
    showImportWizard,
    setShowImportWizard,
    showFloatingImport,
    setShowFloatingImport,
    contextMenu,
    setContextMenu,
    openContextMenu,
    closeContextMenu,
  };
}
