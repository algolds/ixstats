"use client";

import { useState, useCallback, useEffect } from "react";

export type LocalActionType =
  | "issue_response"
  | "policy_created"
  | "meeting_scheduled"
  | "embassy_established"
  | "alliance_created"
  | "foreign_policy"
  | "deployment"
  | "budget_update";

export interface LocalAction {
  id: string;
  type: LocalActionType;
  data: Record<string, any>;
  timestamp: number;
  countryId: string;
}

interface UseLocalActionsReturn {
  actions: LocalAction[];
  saveAction: (type: LocalActionType, data: Record<string, any>) => string;
  getActions: (type?: LocalActionType) => LocalAction[];
  removeAction: (id: string) => void;
  clearActions: (type?: LocalActionType) => void;
}

function getStorageKey(countryId: string): string {
  return `ixstats_local_actions_${countryId}`;
}

function loadActions(countryId: string): LocalAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(countryId));
    if (!raw) return [];
    return JSON.parse(raw) as LocalAction[];
  } catch {
    return [];
  }
}

function persistActions(countryId: string, actions: LocalAction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(countryId), JSON.stringify(actions));
  } catch {
    console.warn("[useLocalActions] Failed to persist actions to localStorage");
  }
}

function generateId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function useLocalActions(countryId: string): UseLocalActionsReturn {
  const [actions, setActions] = useState<LocalAction[]>(() => loadActions(countryId));

  // Re-load if countryId changes
  useEffect(() => {
    setActions(loadActions(countryId));
  }, [countryId]);

  const saveAction = useCallback(
    (type: LocalActionType, data: Record<string, any>): string => {
      const id = generateId();
      const action: LocalAction = {
        id,
        type,
        data,
        timestamp: Date.now(),
        countryId,
      };
      setActions((prev) => {
        const next = [...prev, action];
        persistActions(countryId, next);
        return next;
      });
      return id;
    },
    [countryId]
  );

  const getActions = useCallback(
    (type?: LocalActionType): LocalAction[] => {
      if (!type) return actions;
      return actions.filter((a) => a.type === type);
    },
    [actions]
  );

  const removeAction = useCallback(
    (id: string) => {
      setActions((prev) => {
        const next = prev.filter((a) => a.id !== id);
        persistActions(countryId, next);
        return next;
      });
    },
    [countryId]
  );

  const clearActions = useCallback(
    (type?: LocalActionType) => {
      setActions((prev) => {
        const next = type ? prev.filter((a) => a.type !== type) : [];
        persistActions(countryId, next);
        return next;
      });
    },
    [countryId]
  );

  return { actions, saveAction, getActions, removeAction, clearActions };
}
