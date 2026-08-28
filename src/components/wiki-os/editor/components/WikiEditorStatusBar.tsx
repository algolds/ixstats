"use client";
// src/components/wiki-os/editor/components/WikiEditorStatusBar.tsx
// Bottom status bar for WikiOS editors with cursor position and document stats.

import React from "react";
import type { EditorCursorPos } from "../types";

export interface WikiEditorStatusBarProps {
  cursorPos: EditorCursorPos;
  wordCount: number;
  lineCount: number;
  formatName?: string;
  encoding?: string;
}

export const WikiEditorStatusBar = React.memo(function WikiEditorStatusBar({
  cursorPos,
  wordCount,
  lineCount,
  formatName = "Wikitext",
  encoding = "UTF-8",
}: WikiEditorStatusBarProps) {
  return (
    <div className="wikios-editor-statusbar">
      <span>
        Ln {cursorPos.line}, Col {cursorPos.col}
      </span>
      <span className="wikios-editor-status-sep" />
      <span>{wordCount.toLocaleString()} words</span>
      <span className="wikios-editor-status-sep" />
      <span>{lineCount.toLocaleString()} lines</span>
      <span className="wikios-editor-status-sep" />
      <span>{formatName}</span>
      <span className="wikios-editor-status-sep" />
      <span>{encoding}</span>
    </div>
  );
});
