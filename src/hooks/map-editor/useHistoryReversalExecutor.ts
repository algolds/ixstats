"use client";

/**
 * useHistoryReversalExecutor — applies editor history actions against the server.
 *
 * Updates are *partial* patches (only the recorded keys are sent), so undoing a
 * move never renames a city or clears its capital flag. Re-created features get
 * new ids; an alias map keeps later history entries pointing at the live id.
 */

import { useCallback, useRef } from "react";
import type { FeatureType } from "./editor-types";
import { createFeatureOps } from "./feature-ops";
import { useFeatureMutations } from "./feature-mutations";
import type { EditorAction, HistoryData } from "./useMapHistory";

interface UseHistoryReversalExecutorProps {
  countryId?: string;
  invalidateAllMapData: () => void;
  debouncedRefetch: () => void;
}

export function useHistoryReversalExecutor({ countryId }: UseHistoryReversalExecutorProps) {
  const mutations = useFeatureMutations();

  // Recorded id → live id, for features re-created by undo/redo.
  const aliasRef = useRef(new Map<string, string>());

  const resolveId = useCallback((id: string): string => {
    let current = id;
    const seen = new Set<string>();
    while (aliasRef.current.has(current) && !seen.has(current)) {
      seen.add(current);
      current = aliasRef.current.get(current)!;
    }
    return current;
  }, []);

  const recordAlias = useCallback((recordedId: string, liveId: string | undefined) => {
    if (liveId && liveId !== recordedId) aliasRef.current.set(recordedId, liveId);
  }, []);

  const featureOps = (cid: string) => createFeatureOps(mutations, cid, resolveId);

  const deleteFeatureById = async (featureType: FeatureType, recordedId: string) => {
    if (!countryId) return;
    await featureOps(countryId)[featureType]?.remove(resolveId(recordedId));
  };

  /** Creates a feature from a snapshot and returns its new id. */
  const recreateFeature = async (
    featureType: FeatureType,
    data: HistoryData
  ): Promise<string | undefined> => {
    if (!countryId) return undefined;
    return featureOps(countryId)[featureType]?.create(data);
  };

  /** Applies a partial snapshot to an existing feature (only the keys present are sent). */
  const restoreFeatureData = async (
    featureType: FeatureType,
    recordedId: string,
    data: HistoryData,
    cascaded?: EditorAction["cascadedUpdates"],
    side: "previousData" | "newData" = "previousData"
  ) => {
    if (!countryId) return;
    await featureOps(countryId)[featureType]?.restore(resolveId(recordedId), data, cascaded, side);
  };

  /** Undo (inverse) or redo (forward) one action; batches undo in reverse order. */
  const applyAction = async (
    action: EditorAction,
    direction: "inverse" | "forward"
  ): Promise<void> => {
    if (action.type === "batch") {
      const subActions = action.subActions ?? [];
      for (const sub of direction === "inverse" ? [...subActions].reverse() : subActions) {
        await applyAction(sub, direction);
      }
      return;
    }

    const inverse = direction === "inverse";
    const restoreData = inverse ? action.previousData : action.newData;
    // Undoing a create / redoing a delete removes the feature; the other two kinds re-create it.
    if (action.type === (inverse ? "create" : "delete")) {
      await deleteFeatureById(action.featureType, action.featureId);
    } else if (action.type === (inverse ? "delete" : "create") && restoreData) {
      recordAlias(action.featureId, await recreateFeature(action.featureType, restoreData));
    } else if (action.type === "update" && restoreData) {
      await restoreFeatureData(
        action.featureType,
        action.featureId,
        restoreData,
        action.cascadedUpdates,
        inverse ? "previousData" : "newData"
      );
    }
  };

  return {
    resolveId,
    deleteFeatureById,
    recreateFeature,
    restoreFeatureData,
    applyInverseAction: (action: EditorAction) => applyAction(action, "inverse"),
    applyForwardAction: (action: EditorAction) => applyAction(action, "forward"),
  };
}
