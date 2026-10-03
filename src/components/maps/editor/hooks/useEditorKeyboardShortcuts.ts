"use client";

import { useEffect, useRef } from "react";
import type { useMapEditor } from "~/hooks/useMapEditor";
import type { useBorderEditor } from "~/hooks/useBorderEditor";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import type { EditorMode } from "~/hooks/map-editor/editor-types";
import { isEditorConfirmOpen } from "~/components/maps/editor/components/EditorConfirmDialog";
import { isKeyboardInputTarget } from "~/components/maps/editor/hooks/drag-utils";
import type { useEditorSelectionState, useEditorToolState } from "./state";

export interface EditorKeyState {
  editor: ReturnType<typeof useMapEditor>;
  importer: ReturnType<typeof useProvinceImporter>;
  handleSubmit: () => void;
  handleRequestExit: () => void;
  activeEditorMode: "view" | "border_edit";
  borderActions: ReturnType<typeof useBorderEditor>[1];
  handleExitBorderEdit: () => void;
  contextMenu: ReturnType<typeof useEditorSelectionState>["contextMenu"];
  setContextMenu: ReturnType<typeof useEditorSelectionState>["setContextMenu"];
  requestDeleteSelection: () => Promise<void>;
  toggleAllPanels: () => void;
  setShowGrid: ReturnType<typeof useEditorToolState>["setShowGrid"];
  setShowShortcuts: ReturnType<typeof useEditorToolState>["setShowShortcuts"];
  showShortcuts: boolean;
  toolsDisabled: boolean;
  vertexEditDirty: boolean;
}

type StateRef = { readonly current: EditorKeyState };

const BORDER_TOOL_KEYS = {
  v: "select",
  p: "vertex_edit",
  x: "split",
  m: "merge",
  t: "trace",
  b: "brush",
} as const;

// Drawing tools remove their own last vertex on Ctrl+Z (edit-subdivision is handled separately).
const LOCAL_UNDO_MODES = new Set<EditorMode>(["add-subdivision", "add-lake"]);

const QUICK_MODES: Partial<Record<string, EditorMode>> = {
  i: "import-provinces",
  "1": "add-city",
  "2": "add-subdivision",
  "3": "add-poi",
  "4": "add-route",
};

function handleEscape(k: EditorKeyState) {
  const ed = k.editor;
  if (ed.mode === "import-provinces") {
    k.importer.reset();
    ed.setMode("view");
  } else if (ed.mode === "edit-route") {
    ed.cancelRouteEdit();
  } else if (ed.mode !== "view") {
    ed.resetForm();
    ed.clearRouteWaypoints();
    ed.setMode("view");
  } else if (ed.selectedIds.size > 0) {
    ed.clearMultiSelect();
  } else if (ed.selectedFeature) {
    ed.resetForm();
  } else {
    k.handleRequestExit();
  }
}

/** A confirmation dialog or a focused popover/menu/dialog owns the keyboard (Esc closes it, not the tool). */
function isKeyboardOwnedElsewhere(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing || isEditorConfirmOpen()) return true;
  const focused = document.activeElement as HTMLElement | null;
  return !!focused?.closest?.(
    '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]'
  );
}

function handleBorderEditKey(e: KeyboardEvent, k: EditorKeyState, key: string, mod: boolean) {
  if (mod && (key === "z" || key === "y")) {
    e.preventDefault();
    if (key === "y" || e.shiftKey) k.borderActions.redo();
    else k.borderActions.undo();
    return;
  }
  const borderTool =
    !mod && !e.altKey ? BORDER_TOOL_KEYS[key as keyof typeof BORDER_TOOL_KEYS] : undefined;
  if (borderTool) {
    e.preventDefault();
    k.borderActions.setMode(borderTool);
  } else if (e.key === "Escape") {
    e.preventDefault();
    k.handleExitBorderEdit();
  }
}

function handleUndoRedoKey(e: KeyboardEvent, ref: StateRef, key: string) {
  const k = ref.current;
  const ed = k.editor;
  const isRedo = key === "y" || e.shiftKey;
  // An unsaved region reshape: Ctrl+Z must not undo an older server edit underneath it.
  if (ed.mode === "edit-subdivision" && k.vertexEditDirty) return;
  // Region/lake drawing removes its last vertex on Ctrl+Z; only fall through to the
  // editor undo when the drawing tool did not claim the key (nothing drawn yet).
  if (!isRedo && LOCAL_UNDO_MODES.has(ed.mode)) {
    window.setTimeout(() => {
      if (!e.defaultPrevented) void ref.current.editor.undo();
    }, 0);
    return;
  }
  e.preventDefault();
  if (isRedo) void ed.redo();
  else if (ed.mode === "add-route" && ed.routeWaypoints.length > 0) ed.undoLastWaypoint();
  else if (ed.mode === "add-river" && ed.riverPath.length > 0) ed.undoLastRiverPoint();
  else if (ed.mode === "split-subdivision" && ed.splitLine.length > 0) ed.undoLastSplitPoint();
  else void ed.undo();
}

/** Ctrl/Cmd + A / D / J. Returns true when the key was consumed. */
function handleSelectionKey(e: KeyboardEvent, ed: EditorKeyState["editor"], key: string) {
  if (key !== "a" && key !== "d" && key !== "j") return false;
  e.preventDefault();
  if (key === "a") ed.selectAll();
  else if (key === "d") ed.clearMultiSelect();
  else if (ed.selectedFeature) void ed.duplicateFeature(ed.selectedFeature);
  return true;
}

function handleEnterKey(e: KeyboardEvent, ed: EditorKeyState["editor"]) {
  if (ed.mode === "add-route" && ed.routeWaypoints.length >= 2) {
    e.preventDefault();
    void ed.finishRoute().catch(() => undefined);
  } else if (ed.mode === "split-subdivision" && ed.selectedFeature && ed.splitLine.length >= 2) {
    e.preventDefault();
    void ed.executeSplitSubdivision(ed.selectedFeature.id);
  }
}

function handleDeleteKey(e: KeyboardEvent, k: EditorKeyState) {
  const ed = k.editor;
  // In drawing/reshaping modes these keys remove the last/hovered vertex instead.
  if (ed.mode !== "view" && !ed.mode.startsWith("edit-")) return;
  if (ed.mode === "edit-subdivision" || ed.mode === "edit-route") return;
  if (ed.selectedIds.size > 0 || ed.selectedFeature) {
    e.preventDefault();
    void k.requestDeleteSelection();
  }
}

/** Escape: close menu, then cancel drawing, clear selection, leave the tool, exit. */
function handleEscapeKey(e: KeyboardEvent, ref: StateRef) {
  if (ref.current.contextMenu) {
    ref.current.setContextMenu(null);
    return;
  }
  // Tool-local handlers (cancel a drag, clear an in-progress polygon) run on the
  // same event; let them go first and only act if none of them claimed it.
  window.setTimeout(() => {
    if (!e.defaultPrevented) handleEscape(ref.current);
  }, 0);
}

/** View toggles and quick tool letters/digits. */
function handleQuickKey(e: KeyboardEvent, k: EditorKeyState, key: string) {
  const ed = k.editor;
  const viewActions: Partial<Record<string, () => void>> = {
    "?": () => k.setShowShortcuts(true),
    g: () => k.setShowGrid((v) => !v),
    f: k.toggleAllPanels,
    h: () => ed.setShowGaps(!ed.showGaps),
  };
  const viewAction = viewActions[key];
  if (viewAction) {
    e.preventDefault();
    viewAction();
    return;
  }
  const mode = k.toolsDisabled ? undefined : QUICK_MODES[key];
  if (mode) {
    e.preventDefault();
    ed.setMode(mode);
  }
}

function handleEditKey(e: KeyboardEvent, ref: StateRef, key: string, mod: boolean) {
  const k = ref.current;
  if (mod && (key === "z" || key === "y")) {
    handleUndoRedoKey(e, ref, key);
    return;
  }
  if (mod && handleSelectionKey(e, k.editor, key)) return;
  if (e.key === "Enter" && !mod) {
    handleEnterKey(e, k.editor);
  } else if (e.key === "Delete" || e.key === "Backspace") {
    handleDeleteKey(e, k);
  } else if (e.key === "Escape") {
    handleEscapeKey(e, ref);
  } else if (!mod && !e.altKey) {
    handleQuickKey(e, k, key);
  }
}

function handleKeyDown(e: KeyboardEvent, ref: StateRef) {
  if (isKeyboardOwnedElsewhere(e)) return;
  const k = ref.current;
  const inInput = isKeyboardInputTarget(e.target) || isKeyboardInputTarget(document.activeElement);
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (k.showShortcuts) {
    if (e.key === "Escape" || e.key === "?") {
      e.preventDefault();
      k.setShowShortcuts(false);
    }
  } else if (k.activeEditorMode === "border_edit") {
    if (!inInput) handleBorderEditKey(e, k, key, mod);
  } else if (mod && key === "s") {
    // Save works inside form fields too.
    e.preventDefault();
    if (k.editor.mode.startsWith("add-") || k.editor.mode.startsWith("edit-")) k.handleSubmit();
  } else if (!inInput) {
    handleEditKey(e, ref, key, mod);
  }
}

/**
 * One window listener, registered once; it reads the latest state through a ref.
 * Tool letters (V M C P K T Y R J U) are routed by the plugin provider; this
 * handler owns undo/redo, selection, delete, save, escape, view toggles and the
 * world editor's border-edit tools.
 */
export function useEditorKeyboardShortcuts(state: EditorKeyState) {
  const stateRef = useRef(state);
  // oxlint-disable-next-line -- latest-value ref read by the stable key listener
  stateRef.current = state;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDown(e, stateRef);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
