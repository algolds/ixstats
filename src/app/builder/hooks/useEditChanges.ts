import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BuilderState } from "./builderStateTypes";
import {
  getChangedFields,
  pushBounded,
  type FieldChange,
  type TrackedData,
} from "../lib/edit-changes";

/** Quiet period after the country loads before it becomes the baseline (lets derived fields settle). */
const SETTLE_MS = 600;
/** Edits closer together than this undo as a single step (slider drags, typing, derived updates). */
const COALESCE_MS = 500;
const MAX_UNDO_STEPS = 50;
const NO_CHANGES: readonly FieldChange[] = [];

interface UseEditChangesArgs {
  enabled: boolean;
  isLoadingCountry: boolean;
  builderState: BuilderState;
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
}

export interface EditChanges {
  /** Fields that differ from the baseline (the country as opened, or as of the last Save). */
  changes: readonly FieldChange[];
  canUndo: boolean;
  undo: () => void;
  /** Restores the baseline; the discard itself can be undone. */
  discard: () => void;
  /** Runs `persist`, then makes the state it saved the new baseline. */
  save: (persist: () => Promise<void>) => Promise<void>;
}

/**
 * Country editor session: change tracking against the loaded country plus a
 * bounded in-memory undo stack. Snapshots are deep copies because some builder
 * effects mutate nested state objects in place.
 */
export function useEditChanges({
  enabled,
  isLoadingCountry,
  builderState,
  setBuilderState,
}: UseEditChangesArgs): EditChanges {
  const {
    economicInputs,
    governmentComponents,
    taxSystemData,
    governmentStructure,
    economyBuilderState,
  } = builderState;
  const tracked = useMemo<TrackedData>(
    () => ({
      economicInputs,
      governmentComponents,
      taxSystemData,
      governmentStructure,
      economyBuilderState,
    }),
    [economicInputs, governmentComponents, taxSystemData, governmentStructure, economyBuilderState]
  );

  const [baseline, setBaseline] = useState<TrackedData | null>(null);
  const [undoStack, setUndoStack] = useState<TrackedData[]>([]);
  const seenRef = useRef<TrackedData | null>(null);
  const snapshotRef = useRef<TrackedData | null>(null);
  const lastChangeAtRef = useRef(0);

  const isHydrated = enabled && !isLoadingCountry && economicInputs !== null;

  useEffect(() => {
    if (!isHydrated || baseline) return;
    const timer = setTimeout(() => {
      const snapshot = structuredClone(tracked);
      seenRef.current = tracked;
      snapshotRef.current = snapshot;
      setBaseline(snapshot);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isHydrated, baseline, tracked]);

  useEffect(() => {
    if (!baseline || seenRef.current === tracked) return;
    const previous = snapshotRef.current;
    const now = Date.now();
    if (previous && now - lastChangeAtRef.current > COALESCE_MS) {
      setUndoStack((stack) => pushBounded(stack, previous, MAX_UNDO_STEPS));
    }
    lastChangeAtRef.current = now;
    seenRef.current = tracked;
    snapshotRef.current = structuredClone(tracked);
  }, [baseline, tracked]);

  const restore = useCallback(
    (snapshot: TrackedData) => {
      // The restore (and anything derived from it) must not become an undo step itself.
      lastChangeAtRef.current = Date.now();
      setBuilderState((prev) => ({ ...prev, ...structuredClone(snapshot) }));
    },
    [setBuilderState]
  );

  const undo = useCallback(() => {
    const target = undoStack[undoStack.length - 1];
    if (!target) return;
    setUndoStack(undoStack.slice(0, -1));
    restore(target);
  }, [undoStack, restore]);

  const discard = useCallback(() => {
    const current = snapshotRef.current;
    if (!baseline || !current) return;
    setUndoStack((stack) => pushBounded(stack, current, MAX_UNDO_STEPS));
    restore(baseline);
  }, [baseline, restore]);

  const save = useCallback(async (persist: () => Promise<void>) => {
    const saving = snapshotRef.current;
    await persist();
    if (saving) setBaseline(saving);
    setUndoStack([]);
  }, []);

  const changes = useMemo(
    () => (baseline ? getChangedFields(baseline, tracked) : NO_CHANGES),
    [baseline, tracked]
  );

  return { changes, canUndo: undoStack.length > 0, undo, discard, save };
}
