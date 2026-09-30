"use client";
/**
 * EditorModalContext.tsx — Shared context for WikiOS editor modal states,
 * stash panels, settings, and popover toggles. Eliminates prop-drilling
 * between useWikiEditorState → editors → toolbars → modal host.
 */

import React, { createContext, useContext } from "react";
import type { StashEntity, StashItemEntity, WikimediaImageMeta, SaveActionType } from "../types";

// ─── Modal & Panel State ────────────────────────────────────────────────────

export interface EditorModalState {
  // Modal visibility
  showImageSearch: boolean;
  setShowImageSearch: (open: boolean) => void;
  showInfoboxModal: boolean;
  setShowInfoboxModal: (open: boolean) => void;
  showCountryStatsModal: boolean;
  setShowCountryStatsModal: (open: boolean) => void;
  showBusinessStatsModal: boolean;
  setShowBusinessStatsModal: (open: boolean) => void;
  showMapCoordsModal: boolean;
  setShowMapCoordsModal: (open: boolean) => void;

  // Popover panels
  templatesOpen: boolean;
  setTemplatesOpen: (open: boolean) => void;
  stashesOpen: boolean;
  setStashesOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // Editor settings (persisted to localStorage)
  enableAutocomplete: boolean;
  handleToggleAutocomplete: (val: boolean) => void;
  showLineNumbers: boolean;
  handleToggleLineNumbers: (val: boolean) => void;
  enableWordWrap: boolean;
  handleToggleWordWrap: (val: boolean) => void;

  // Save workflow
  summary: string;
  setSummary: (s: string) => void;
  minor: boolean;
  setMinor: (m: boolean) => void;
  saving: boolean;
  showSavePanel: boolean;
  setShowSavePanel: (show: boolean) => void;
  saveDropdownOpen: boolean;
  setSaveDropdownOpen: (open: boolean) => void;
  saveActionType: SaveActionType;
  setSaveActionType: (t: SaveActionType) => void;

  // Stash data (lazy-loaded)
  stashes: StashEntity[];
  activeStashId: string;
  setSelectedStashId: (id: string) => void;
  imageItems: StashItemEntity[];
  imagesMap: Map<string, WikimediaImageMeta>;
}

const EditorModalCtx = createContext<EditorModalState | null>(null);

export function EditorModalProvider({
  value,
  children,
}: {
  value: EditorModalState;
  children: React.ReactNode;
}) {
  return <EditorModalCtx.Provider value={value}>{children}</EditorModalCtx.Provider>;
}

export function useEditorModalContext(): EditorModalState {
  const ctx = useContext(EditorModalCtx);
  if (!ctx) {
    throw new Error("useEditorModalContext must be used within <EditorModalProvider>");
  }
  return ctx;
}
