"use client";

import { useRef, type RefObject } from "react";
import { useAttachPrefill } from "~/components/action-links/useAttachPrefill";
import type { GlassPlateEditorRef } from "~/components/shared/editor";

/** Real inserts one prefill makes: a first into an editor with no selection yet may do nothing, a second settles it. */
export const PREFILL_MAX_INSERTS = 2;

/**
 * Puts the action named by `?attach=` into the board editor. The editor loads on demand and an insert into one with no
 * selection yet does nothing, so the token counts as in only when the editor reports it: its last `onChange` text
 * (`plainRef`) holds the token verbatim, or has changed since an insert (the editor may normalise what it takes).
 * Until then each frame selects the end and inserts again, at most `PREFILL_MAX_INSERTS` times.
 */
export function useBoardPrefill(
  editorRef: RefObject<GlassPlateEditorRef | null>,
  plainRef: RefObject<string>,
  insertText: (text: string) => void
): void {
  const attempt = useRef({ inserts: 0, before: "" });
  useAttachPrefill((token) => {
    if (!editorRef.current) return false;
    const text = plainRef.current;
    if (text.includes(token)) return true;
    const made = attempt.current;
    if (made.inserts > 0 && text !== made.before) return true;
    if (made.inserts >= PREFILL_MAX_INSERTS) return false;
    if (made.inserts === 0) made.before = text;
    made.inserts += 1;
    insertText(token);
    return false;
  });
}
