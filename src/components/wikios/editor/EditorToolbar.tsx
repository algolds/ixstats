// src/components/wikios/editor/EditorToolbar.tsx
// Formatting toolbar for the WikiOS WYSIWYG editor.

"use client";

import { useState, useCallback } from "react";

interface EditorToolbarProps {
  onSave: (summary: string, minor: boolean) => void;
  onCancel: () => void;
  onSwitchToSource: () => void;
  title: string;
}

export function EditorToolbar({ onSave, onCancel, onSwitchToSource, title }: EditorToolbarProps) {
  const [summary, setSummary] = useState("");
  const [minor, setMinor] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);

  const handleSave = useCallback(() => {
    onSave(summary, minor);
  }, [onSave, summary, minor]);

  return (
    <div className="wikios-toolbar">
      {/* Formatting buttons */}
      <div className="wikios-toolbar-group">
        <ToolbarButton label="B" title="Bold (Ctrl+B)" style={{ fontWeight: 700 }} />
        <ToolbarButton label="I" title="Italic (Ctrl+I)" style={{ fontStyle: "italic" }} />
        <ToolbarButton label="Link" title="Insert link (Ctrl+K)" />
        <span className="wikios-toolbar-sep" />
        <ToolbarButton label="H2" title="Heading 2" />
        <ToolbarButton label="H3" title="Heading 3" />
        <span className="wikios-toolbar-sep" />
        <ToolbarButton label="UL" title="Bullet list" />
        <ToolbarButton label="OL" title="Numbered list" />
        <ToolbarButton label="BQ" title="Blockquote" />
      </div>

      {/* Editor mode toggle */}
      <div className="wikios-toolbar-right">
        <button
          className="wikios-toolbar-mode-btn"
          onClick={onSwitchToSource}
          title="Switch to source editor"
        >
          Source
        </button>

        {!showSavePanel ? (
          <div className="wikios-toolbar-actions">
            <button className="wikios-toolbar-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="wikios-toolbar-save"
              onClick={() => setShowSavePanel(true)}
            >
              Save...
            </button>
          </div>
        ) : (
          <div className="wikios-save-panel glass-hierarchy-child">
            <div className="wikios-save-panel-header">
              Save changes to <strong>{title}</strong>
            </div>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Edit summary (describe your changes)"
              className="wikios-save-summary-input"
              autoFocus
            />
            <div className="wikios-save-options">
              <label className="wikios-save-minor">
                <input
                  type="checkbox"
                  checked={minor}
                  onChange={(e) => setMinor(e.target.checked)}
                />
                <span>Minor edit</span>
              </label>
              <div className="wikios-save-buttons">
                <button
                  className="wikios-toolbar-cancel"
                  onClick={() => setShowSavePanel(false)}
                >
                  Back
                </button>
                <button className="wikios-toolbar-save" onClick={handleSave}>
                  Publish changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar button primitive
// ---------------------------------------------------------------------------

function ToolbarButton({
  label,
  title,
  style,
}: {
  label: string;
  title: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <button
      className="wikios-toolbar-btn"
      title={title}
      style={style}
      type="button"
    >
      {label}
    </button>
  );
}
