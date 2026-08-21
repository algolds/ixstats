// src/components/wiki-os/editor/components/WikiEditorSavePanel.tsx
// Unified save bar containing summary input, minor checkbox, and publish/session button.

"use client";

import React from "react";
import { Loader2 } from "lucide-react";

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
        <input
          type="checkbox"
          checked={minor}
          onChange={(e) => setMinor(e.target.checked)}
        />
        Minor
      </label>
      <button
        className="flex h-8 items-center justify-center rounded-lg bg-[var(--wikios-accent)] px-3 text-xs font-semibold text-white transition-all hover:bg-[var(--wikios-accent-hover)] active:scale-95 disabled:scale-100 disabled:opacity-50"
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
