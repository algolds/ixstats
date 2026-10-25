"use client";

import { useEffect, type RefObject } from "react";

/** The editable surface of WikiOS's editors: the canvas, the source editor, or a plain text area. */
const EDITABLE = '[contenteditable="true"], textarea';
/** After this the editor is taken as never coming (a failed load); nothing is focused. */
const GIVE_UP_MS = 10_000;

/** Whether focus already sits in an editable surface inside the frame (the author, or the editor itself, put it). */
function focusedInside(frame: HTMLElement): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLElement && frame.contains(active) && active.closest(EDITABLE) !== null
  );
}

/**
 * Focus moves into the editor when it opens in the lore writer (each `openKey`): WikiOS's editors load their page
 * first, so this waits for the editable surface to appear in `frame`, then focuses it once, unless focus is already in
 * it. It gives up after ten seconds.
 */
export function useFocusEditor(frame: RefObject<HTMLElement | null>, openKey: string): void {
  useEffect(() => {
    const root = frame.current;
    if (!root || !openKey) return;
    const focusEditor = (): boolean => {
      const editable = root.querySelector<HTMLElement>(EDITABLE);
      if (!editable) return false;
      if (!focusedInside(root)) editable.focus({ preventScroll: true });
      return true;
    };
    if (focusEditor()) return;
    const observer = new MutationObserver(() => {
      if (focusEditor()) stop();
    });
    const timer = window.setTimeout(() => stop(), GIVE_UP_MS);
    function stop() {
      observer.disconnect();
      window.clearTimeout(timer);
    }
    observer.observe(root, { childList: true, subtree: true });
    return stop;
  }, [frame, openKey]);
}
