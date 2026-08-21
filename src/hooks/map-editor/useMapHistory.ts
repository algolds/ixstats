"use client";

import { useState, useCallback, useRef } from "react";
import type { FeatureType } from "~/types/maps/editor-domain";

export interface EditorAction {
  type: "create" | "delete" | "update";
  featureType: FeatureType;
  featureId: string;
  /** Data needed to undo (previous state for update/delete, or id for create) */
  previousData?: Record<string, unknown>;
  /** Data needed to redo (new state for update/create) */
  newData?: Record<string, unknown>;
  /** For topology-cascaded updates: additional features changed in the same action */
  cascadedUpdates?: Array<{
    featureId: string;
    featureType: FeatureType;
    previousData: Record<string, unknown>;
    newData: Record<string, unknown>;
  }>;
}

export interface EditorHistory {
  actions: EditorAction[];
  position: number; // -1 = at base, 0+ = index of last applied action
}

const MAX_HISTORY_LENGTH = 50;

export function useMapHistory() {
  const [history, setHistory] = useState<EditorHistory>({ actions: [], position: -1 });
  const isUndoingRef = useRef(false);

  const pushAction = useCallback((action: EditorAction) => {
    if (isUndoingRef.current) return;
    setHistory((prev) => {
      // Truncate any redo history beyond current position
      const validActions = prev.actions.slice(0, prev.position + 1);
      const newActions = [...validActions, action].slice(-MAX_HISTORY_LENGTH);
      return {
        actions: newActions,
        position: newActions.length - 1,
      };
    });
  }, []);

  const canUndo = history.position >= 0;
  const canRedo = history.position < history.actions.length - 1;

  const getUndoAction = useCallback((): EditorAction | null => {
    if (history.position < 0) return null;
    return history.actions[history.position] ?? null;
  }, [history]);

  const getRedoAction = useCallback((): EditorAction | null => {
    if (history.position >= history.actions.length - 1) return null;
    return history.actions[history.position + 1] ?? null;
  }, [history]);

  const stepUndo = useCallback(() => {
    setHistory((prev) => ({
      ...prev,
      position: Math.max(-1, prev.position - 1),
    }));
  }, []);

  const stepRedo = useCallback(() => {
    setHistory((prev) => ({
      ...prev,
      position: Math.min(prev.actions.length - 1, prev.position + 1),
    }));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory({ actions: [], position: -1 });
  }, []);

  return {
    history,
    canUndo,
    canRedo,
    pushAction,
    getUndoAction,
    getRedoAction,
    stepUndo,
    stepRedo,
    clearHistory,
    isUndoingRef,
  };
}
