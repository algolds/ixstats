"use client";
// src/components/wiki-os/editor/components/WikiEditorSavePanel.tsx
// Unified save bar containing summary input, minor checkbox, and publish/session button.

import React from "react";
import { SystemRestart as Loader2 } from "iconoir-react";

export interface WikiEditorSavePanelProps {
  showSavePanel: boolean;
  summary: string;
  setSummary: (val: string) => void;
  minor: boolean;
  setMinor: (val: boolean) => void;
  saving: boolean;
  saveActionType: "publish" | "session";
  onSave: () => void;
}

export function WikiEditorSavePanel({
  showSavePanel,
  summary,
  setSummary,
  minor,
  setMinor,
  saving,
  saveActionType,
  onSave,
}: WikiEditorSavePanelProps) {
  if (!showSavePanel) return null;

  return (
    <div className="wikios-ve-save-bar">
      <input
        type="text"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Describe your changes..."
        className="wikios-ve-save-input"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
        }}
      />
      <label className="wikios-ve-save-minor">
        <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} />
        Minor
      </label>
      <button
        className="rounded-control bg-tint text-caption text-on-tint hover:bg-tint-hover flex h-8 items-center justify-center px-3 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98] disabled:scale-100 disabled:opacity-50"
        onClick={onSave}
        type="button"
        disabled={saving}
      >
        {saving ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Saving...
          </>
        ) : saveActionType === "publish" ? (
          "Save & Publish"
        ) : (
          "Save Session"
        )}
      </button>
    </div>
  );
}
