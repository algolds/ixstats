"use client";

import { useState, useCallback, useRef } from "react";
import type { FeatureType } from "./editor-types";

export interface EditorAction {
  type: "create" | "delete" | "update";
  featureType: FeatureType;
  featureId: string;
  description: string;
  timestamp: number;
  /** Data needed to undo (previous state for update/delete, or id for create) */
  previousData?: Record<string, string | number | boolean | object | null | undefined>;
  /** Data needed to redo (new state for update/create) */
  newData?: Record<string, string | number | boolean | object | null | undefined>;
  /** For topology-cascaded updates: additional features changed in the same action */
  cascadedUpdates?: Array<{
    featureId: string;
    featureType: FeatureType;
    previousData: Record<string, string | number | boolean | object | null | undefined>;
    newData: Record<string, string | number | boolean | object | null | undefined>;
  }>;
}

export type PushableEditorAction = Omit<EditorAction, "timestamp"> & {
  timestamp?: number;
};

export interface EditorHistory {
  actions: EditorAction[];
  position: number; // -1 = at base, 0+ = index of last applied action
}

const MAX_HISTORY_LENGTH = 50;

export function useMapHistory(maxSize: number = MAX_HISTORY_LENGTH) {
  const [history, setHistory] = useState<EditorHistory>({ actions: [], position: -1 });
  const isUndoingRef = useRef(false);

  const pushAction = useCallback(
    (action: PushableEditorAction) => {
      if (isUndoingRef.current) return;
      const fullAction: EditorAction = {
        ...action,
        timestamp: action.timestamp ?? Date.now(),
      };
      setHistory((prev) => {
        // Truncate any redo history beyond current position
        const validActions = prev.actions.slice(0, prev.position + 1);
        const newActions = [...validActions, fullAction].slice(-maxSize);
        return {
          actions: newActions,
          position: newActions.length - 1,
        };
      });
    },
    [maxSize]
  );

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

  const undo = useCallback((): EditorAction | null => {
    if (history.position < 0) return null;
    const action = history.actions[history.position] ?? null;
    setHistory((prev) => ({
      ...prev,
      position: Math.max(-1, prev.position - 1),
    }));
    return action;
  }, [history]);

  const redo = useCallback((): EditorAction | null => {
    if (history.position >= history.actions.length - 1) return null;
    const action = history.actions[history.position + 1] ?? null;
    setHistory((prev) => ({
      ...prev,
      position: Math.min(prev.actions.length - 1, prev.position + 1),
    }));
    return action;
  }, [history]);

  const setPosition = useCallback((pos: number) => {
    setHistory((prev) => ({
      ...prev,
      position: Math.max(-1, Math.min(prev.actions.length - 1, pos)),
    }));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory({ actions: [], position: -1 });
  }, []);

  return {
    history,
    actions: history.actions,
    position: history.position,
    canUndo,
    canRedo,
    pushAction,
    getUndoAction,
    getRedoAction,
    stepUndo,
    stepRedo,
    undo,
    redo,
    setPosition,
    clearHistory,
    isUndoingRef,
  };
}
