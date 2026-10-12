"use client";

import { useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { buildBorderDraft } from "~/lib/maps/border-draft";
import type { BorderEditorState } from "./useBorderEditor";

const AUTOSAVE_MS = 30_000;

/** The draft to store for the session, or null before a feature is loaded. */
function draftOf(s: BorderEditorState) {
  if (!s.sessionId || !s.featureId || !s.geometry) return null;
  const sessionData = buildBorderDraft({
    featureId: s.featureId,
    geometry: s.geometry,
    dirtyNeighbors: s.dirtyNeighbors,
    savedAt: Date.now(),
  });
  return { sessionId: s.sessionId, sessionData };
}

/**
 * Saves the border draft (outline and moved neighbours, never the undo history) after 30 s
 * without a change while the edit is dirty, and on demand through `save`.
 */
export function useBorderAutosave(state: BorderEditorState) {
  const { mutate, mutateAsync } = api.geoEditor.saveBorderEditDraft.useMutation();
  // The timer reads the latest state without restarting on every render
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (!state.isDirty || !state.sessionId || !state.geometry) return;
    const timer = setTimeout(() => {
      const draft = draftOf(latest.current);
      if (draft) mutate(draft);
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [state.isDirty, state.sessionId, state.geometry, mutate]);

  const save = useCallback(async () => {
    const draft = draftOf(latest.current);
    if (draft) await mutateAsync(draft);
  }, [mutateAsync]);

  return { save };
}
