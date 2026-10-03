"use client";

/**
 * Keeps in-progress placements and drawings (the only work a reload can lose, since every
 * submitted edit is saved immediately) safe across reloads: the draft is mirrored to
 * localStorage per country (debounced) and offered back the next time the editor opens.
 * Every storage access is guarded; the editor works normally without it.
 */

import { useEffect, useRef } from "react";
import type { EditorDraft } from "~/hooks/useMapEditor";
import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";

const KEY_PREFIX = "ixstats:map-editor-draft:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readDraft(key: string): EditorDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditorDraft;
    if (!parsed || typeof parsed.mode !== "string" || !parsed.mode.startsWith("add-")) return null;
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: EditorDraft | null) {
  try {
    if (draft) window.localStorage.setItem(key, JSON.stringify(draft));
    else window.localStorage.removeItem(key);
  } catch {
    // Storage full / blocked — drafts are best-effort.
  }
}

const DRAFT_LABELS: Partial<Record<EditorDraft["mode"], string>> = {
  "add-city": "a city",
  "add-poi": "a point of interest",
  "add-peak": "a peak",
  "add-subdivision": "a region",
  "add-lake": "a lake",
  "add-river": "a river",
  "add-route": "a route",
};

interface DraftCapableEditor {
  draft: EditorDraft | null;
  restoreDraft: (d: EditorDraft) => void;
  mode: string;
}

export function useEditorDraft(
  editor: DraftCapableEditor,
  countryId: string | null | undefined,
  ready: boolean
) {
  const key = countryId ? `${KEY_PREFIX}${countryId}` : null;
  const offeredRef = useRef<string | null>(null);
  const restoringRef = useRef(false);

  // Offer the saved draft once per country, after the editor has loaded.
  useEffect(() => {
    if (!key || !ready || offeredRef.current === key) return;
    offeredRef.current = key;
    const saved = readDraft(key);
    if (!saved) return;
    restoringRef.current = true;
    const what = DRAFT_LABELS[saved.mode] ?? "a feature";
    void confirmEditorAction({
      title: "Restore unsaved work?",
      description: `You were adding ${what} ${new Date(saved.savedAt).toLocaleString()} and did not save it.`,
      confirmLabel: "Restore",
      cancelLabel: "Discard",
    }).then((ok) => {
      restoringRef.current = false;
      if (ok) editor.restoreDraft(saved);
      else writeDraft(key, null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  // Mirror the live draft (debounced); clear it once the work is saved or cancelled.
  const draft = editor.draft;
  useEffect(() => {
    if (!key || restoringRef.current || offeredRef.current !== key) return;
    const timer = setTimeout(() => writeDraft(key, draft), draft ? 400 : 0);
    return () => clearTimeout(timer);
  }, [key, draft]);
}
