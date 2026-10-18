"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { focusedElement } from "~/lib/utils/focus";

/**
 * Keeps focus in a list when an action removes the row it was taken from. Once that row has gone, and the focused
 * button with it, focus moves to the next row's action (each row marks its first action `data-row-action`), or to
 * `fallback` when it was the last row. Focus the admin moved elsewhere stays put. A layout effect, so it runs before
 * an enclosing sheet's focus trap catches the lost focus. Returns `acted(rowId)`, to call as a row's action starts.
 */
export function useRowFocusRescue(
  rowIds: readonly string[],
  list: RefObject<HTMLElement | null>,
  fallback: RefObject<HTMLElement | null>
): (rowId: string) => void {
  const acted = useRef<{ rowId: string; index: number } | null>(null);
  useLayoutEffect(() => {
    const row = acted.current;
    if (!row || rowIds.includes(row.rowId)) return;
    acted.current = null;
    if (focusedElement()) return;
    const next = list.current?.querySelectorAll<HTMLElement>("[data-row-action]")[row.index];
    (next ?? fallback.current)?.focus();
  });
  return (rowId) => {
    acted.current = { rowId, index: rowIds.indexOf(rowId) };
  };
}
