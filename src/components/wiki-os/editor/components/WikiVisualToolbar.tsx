// src/components/wiki-os/editor/components/WikiVisualToolbar.tsx
// Top bar and full formatting toolbar for WikiOS Visual Editor.

"use client";

import React from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  ArrowUp as Superscript,
  ArrowDown as Subscript,
  List,
  NumberedListLeft as ListOrdered,
  QuoteSolid as Quote,
  Link as Link2,
  LinkSlash as Unlink,
  MediaImage as ImageIcon,
  Code,
  Minus,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo as Undo2,
  Redo as Redo2,
  Erase as RemoveFormatting,
  Table,
  ArrowRight as Indent,
  ArrowLeft as Outdent,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { useEditorModalContext } from "../context/EditorModalContext";
import { StashDropdown } from "./shared/StashDropdown";
import { TemplateDropdown } from "./shared/TemplateDropdown";
import { SettingsDropdown } from "./shared/SettingsDropdown";
import { WikiEditorHeader } from "./WikiEditorHeader";
import type { SaveActionType } from "../types";

export interface WikiVisualToolbarProps {
  title: string;
  wordCount: number;
  isDirty: boolean;
  repulsionProgress: number;
  onSwitchToSource?: () => void;
  onCancel: () => void;
  onSave: () => void;
  handleSaveDraft: () => void;
  saving: boolean;
  saveDropdownOpen: boolean;
  setSaveDropdownOpen: (open: boolean) => void;
  saveActionType: SaveActionType;
  setSaveActionType: (t: SaveActionType) => void;
  setShowSavePanel: (show: boolean) => void;
  summary: string;
  setSummary: (s: string) => void;
  activeFormats: Set<string>;
  exec: (cmd: string, val?: string) => void;
  setHeading: (level: number) => void;
  setParagraph: () => void;
  insertLink: () => void;
  removeLink: () => void;
  insertHR: () => void;
  insertTable: () => void;
  insertRef: () => void;
  clearFormatting: () => void;
  insertHtmlAtCursor: (html: string) => void;
  saveSelection: () => void;
  restoreSelection: () => void;
  handleInsertStashedImage: (filename: string) => void;
}

export function WikiVisualToolbar({
  title,
  wordCount,
  isDirty,
  repulsionProgress,
  onSwitchToSource,
  onCancel,
  handleSaveDraft,
  saving,
  saveDropdownOpen,
  setSaveDropdownOpen,
  setSaveActionType,
  setShowSavePanel,
  summary,
  setSummary,
  activeFormats,
  exec,
  setHeading,
  setParagraph,
  insertLink,
  removeLink,
  insertHR,
  insertTable,
  insertRef,
  clearFormatting,
  insertHtmlAtCursor,
  saveSelection,
  restoreSelection,
  handleInsertStashedImage,
}: WikiVisualToolbarProps) {
  const modal = useEditorModalContext();
  return (
    <>
      <WikiEditorHeader
        title={title}
        mode="visual"
        wordCount={wordCount}
        isDirty={isDirty}
        repulsionProgress={repulsionProgress}
        onSwitchMode={onSwitchToSource}
        onCancel={onCancel}
        handleSaveDraft={handleSaveDraft}
        saving={saving}
        saveDropdownOpen={saveDropdownOpen}
        setSaveDropdownOpen={setSaveDropdownOpen}
        setSaveActionType={setSaveActionType}
        setShowSavePanel={setShowSavePanel}
        summary={summary}
        setSummary={setSummary}
      />

      {/* ─── Full Formatting Toolbar ─── */}
      <div className="wikios-ve-toolbar">
        {/* Undo / Redo */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<Undo2 className="h-3.5 w-3.5" />}
            title="Undo (Ctrl+Z)"
            onClick={() => exec("undo")}
          />
          <VEBtn
            icon={<Redo2 className="h-3.5 w-3.5" />}
            title="Redo (Ctrl+Y)"
            onClick={() => exec("redo")}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Text formatting */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<Bold className="h-3.5 w-3.5" />}
            title="Bold (Ctrl+B)"
            active={activeFormats.has("bold")}
            onClick={() => exec("bold")}
          />
          <VEBtn
            icon={<Italic className="h-3.5 w-3.5" />}
            title="Italic (Ctrl+I)"
            active={activeFormats.has("italic")}
            onClick={() => exec("italic")}
          />
          <VEBtn
            icon={<Underline className="h-3.5 w-3.5" />}
            title="Underline (Ctrl+U)"
            active={activeFormats.has("underline")}
            onClick={() => exec("underline")}
          />
          <VEBtn
            icon={<Strikethrough className="h-3.5 w-3.5" />}
            title="Strikethrough (Ctrl+Shift+X)"
            active={activeFormats.has("strikethrough")}
            onClick={() => exec("strikeThrough")}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Script / code */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<Superscript className="h-3.5 w-3.5" />}
            title="Superscript"
            active={activeFormats.has("superscript")}
            onClick={() => exec("superscript")}
          />
          <VEBtn
            icon={<Subscript className="h-3.5 w-3.5" />}
            title="Subscript"
            active={activeFormats.has("subscript")}
            onClick={() => exec("subscript")}
          />
          <VEBtn
            icon={<Code className="h-3.5 w-3.5" />}
            title="Inline code"
            onClick={() => insertHtmlAtCursor("<code>code</code>")}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Block formatting */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<Type className="h-3.5 w-3.5" />}
            title="Normal paragraph"
            onClick={setParagraph}
          />
          <VEBtn
            icon={<span className="wikios-ve-heading-label">H2</span>}
            title="Section heading"
            onClick={() => setHeading(2)}
          />
          <VEBtn
            icon={<span className="wikios-ve-heading-label">H3</span>}
            title="Subsection"
            onClick={() => setHeading(3)}
          />
          <VEBtn
            icon={<span className="wikios-ve-heading-label">H4</span>}
            title="Sub-subsection"
            onClick={() => setHeading(4)}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Lists & structure */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<List className="h-3.5 w-3.5" />}
            title="Bullet list"
            active={activeFormats.has("ul")}
            onClick={() => exec("insertUnorderedList")}
          />
          <VEBtn
            icon={<ListOrdered className="h-3.5 w-3.5" />}
            title="Numbered list"
            active={activeFormats.has("ol")}
            onClick={() => exec("insertOrderedList")}
          />
          <VEBtn
            icon={<Quote className="h-3.5 w-3.5" />}
            title="Blockquote"
            onClick={() => exec("formatBlock", "blockquote")}
          />
          <VEBtn
            icon={<Indent className="h-3.5 w-3.5" />}
            title="Indent"
            onClick={() => exec("indent")}
          />
          <VEBtn
            icon={<Outdent className="h-3.5 w-3.5" />}
            title="Outdent"
            onClick={() => exec("outdent")}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Alignment */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<AlignLeft className="h-3.5 w-3.5" />}
            title="Align left"
            onClick={() => exec("justifyLeft")}
          />
          <VEBtn
            icon={<AlignCenter className="h-3.5 w-3.5" />}
            title="Align center"
            onClick={() => exec("justifyCenter")}
          />
          <VEBtn
            icon={<AlignRight className="h-3.5 w-3.5" />}
            title="Align right"
            onClick={() => exec("justifyRight")}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Links */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<Link2 className="h-3.5 w-3.5" />}
            title="Insert link (Ctrl+K)"
            onClick={insertLink}
          />
          <VEBtn
            icon={<Unlink className="h-3.5 w-3.5" />}
            title="Remove link"
            onClick={removeLink}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Insert objects */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            title="Insert image"
            onClick={() => {
              saveSelection();
              modal.setShowImageSearch(true);
            }}
          />

          <StashDropdown
            onInsertImage={(filename) => {
              restoreSelection();
              handleInsertStashedImage(filename);
            }}
            onBeforeOpen={saveSelection}
          />

          <VEBtn
            icon={<Table className="h-3.5 w-3.5" />}
            title="Insert table"
            onClick={insertTable}
          />

          {/* Templates dropdown */}
          <TemplateDropdown onSelect={restoreSelection} onBeforeOpen={saveSelection} />
          <VEBtn
            icon={<Minus className="h-3.5 w-3.5" />}
            title="Horizontal rule"
            onClick={insertHR}
          />
          <VEBtn
            icon={
              <span className="wikios-ve-heading-label" style={{ fontSize: 9 }}>
                ref
              </span>
            }
            title="Insert reference"
            onClick={insertRef}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Clear */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<RemoveFormatting className="h-3.5 w-3.5" />}
            title="Clear formatting"
            onClick={clearFormatting}
          />
        </div>

        {/* Far right: Editor Settings */}
        <div className="ml-auto flex items-center">
          <SettingsDropdown />
        </div>
      </div>
    </>
  );
}

function VEBtn({
  icon,
  title,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn("wikios-ve-toolbar-btn", active && "wikios-ve-toolbar-btn-active")}
      title={title}
    >
      {icon}
    </button>
  );
}
