// src/components/wiki-os/editor/components/WikiSourceToolbar.tsx
// Top bar and Wikitext formatting toolbar for WikiOS Source Editor (CodeMirror).

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
  MediaImage as ImageIcon,
  Puzzle,
  Page as FileText,
  Code,
  Minus,
  Undo as Undo2,
  Redo as Redo2,
  Table,
  NavArrowDown as ChevronDown,
  Eye,
  EyeClosed as EyeOff,
  Hashtag as Hash,
  OpenNewWindow as ExternalLink,
  Code as FileCode,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { useEditorModalContext } from "../context/EditorModalContext";
import { WikiEditorHeader } from "./WikiEditorHeader";
import { StashDropdown } from "./shared/StashDropdown";
import { TemplateDropdown } from "./shared/TemplateDropdown";
import { SettingsDropdown } from "./shared/SettingsDropdown";
import type { SaveActionType } from "../types";

export interface WikiSourceToolbarProps {
  title: string;
  isDirty: boolean;
  repulsionProgress: number;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  onSwitchToVisual?: () => void;
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

  handleUndo: () => void;
  handleRedo: () => void;
  wrapSelection: (before: string, after: string) => void;
  insertAtCursor: (text: string) => void;
  insertAtLine: (before: string, after: string) => void;

  handleInsertStashedImage: (filename: string) => void;
}

export function WikiSourceToolbar({
  title,
  isDirty,
  repulsionProgress,
  showPreview,
  setShowPreview,
  onSwitchToVisual,
  onCancel,
  handleSaveDraft,
  saving,
  saveDropdownOpen,
  setSaveDropdownOpen,
  setSaveActionType,
  setShowSavePanel,
  summary,
  setSummary,
  handleUndo,
  handleRedo,
  wrapSelection,
  insertAtCursor,
  insertAtLine,
  handleInsertStashedImage,
}: WikiSourceToolbarProps) {
  const modal = useEditorModalContext();
  return (
    <>
      <WikiEditorHeader
        title={title}
        mode="source"
        isDirty={isDirty}
        repulsionProgress={repulsionProgress}
        onSwitchMode={onSwitchToVisual}
        onCancel={onCancel}
        handleSaveDraft={handleSaveDraft}
        saving={saving}
        saveDropdownOpen={saveDropdownOpen}
        setSaveDropdownOpen={setSaveDropdownOpen}
        setSaveActionType={setSaveActionType}
        setShowSavePanel={setShowSavePanel}
        summary={summary}
        setSummary={setSummary}
        extraActions={
          <button
            className={`wikios-editor-btn-preview ${showPreview ? "wikios-editor-btn-active" : ""}`}
            onClick={() => setShowPreview(!showPreview)}
            type="button"
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />

      {/* Formatting toolbar */}
      <div className="wikios-editor-format-bar">
        {/* Undo/Redo */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={Undo2} title="Undo (Ctrl+Z)" onClick={handleUndo} />
          <FmtBtn icon={Redo2} title="Redo (Ctrl+Y)" onClick={handleRedo} />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Text formatting */}
        <div className="wikios-editor-format-group">
          <FmtBtn
            icon={Bold}
            title="Bold ('''text''')"
            onClick={() => wrapSelection("'''", "'''")}
          />
          <FmtBtn
            icon={Italic}
            title="Italic (''text'')"
            onClick={() => wrapSelection("''", "''")}
          />
          <FmtBtn
            icon={Strikethrough}
            title="Strikethrough (<s>text</s>)"
            onClick={() => wrapSelection("<s>", "</s>")}
          />
          <FmtBtn
            icon={Underline}
            title="Underline (<u>text</u>)"
            onClick={() => wrapSelection("<u>", "</u>")}
          />
          <FmtBtn
            icon={Code}
            title="Inline code (<code>text</code>)"
            onClick={() => wrapSelection("<code>", "</code>")}
          />
          <FmtBtn
            icon={Superscript}
            title="Superscript (<sup>text</sup>)"
            onClick={() => wrapSelection("<sup>", "</sup>")}
          />
          <FmtBtn
            icon={Subscript}
            title="Subscript (<sub>text</sub>)"
            onClick={() => wrapSelection("<sub>", "</sub>")}
          />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Headings */}
        <div className="wikios-editor-format-group">
          <Popover>
            <PopoverTrigger className="wikios-editor-format-btn wikios-editor-format-select">
              <span className="text-[11px] font-semibold tracking-tight">Heading</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="glass-none z-[10001] w-44 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-1 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex flex-col gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => insertAtLine("= ", " =")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-base font-bold hover:bg-[var(--wikios-border)]"
                >
                  <Hash className="h-3.5 w-3.5 text-blue-400" />
                  <span>Heading 1</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertAtLine("== ", " ==")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-[var(--wikios-border)]"
                >
                  <Hash className="h-3.5 w-3.5 text-purple-400" />
                  <span>Heading 2</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertAtLine("=== ", " ===")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium hover:bg-[var(--wikios-border)]"
                >
                  <Hash className="h-3.5 w-3.5 text-amber-400" />
                  <span>Heading 3</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertAtLine("==== ", " ====")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs opacity-80 hover:bg-[var(--wikios-border)]"
                >
                  <Hash className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Heading 4</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertAtLine("===== ", " =====")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] opacity-60 hover:bg-[var(--wikios-border)]"
                >
                  <Hash className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Heading 5</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Lists & Quotes */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={List} title="Bullet list (* item)" onClick={() => insertAtLine("* ", "")} />
          <FmtBtn
            icon={ListOrdered}
            title="Numbered list (# item)"
            onClick={() => insertAtLine("# ", "")}
          />
          <FmtBtn
            icon={Quote}
            title="Blockquote (<blockquote>)"
            onClick={() => wrapSelection("<blockquote>\n", "\n</blockquote>")}
          />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Links & Media */}
        <div className="wikios-editor-format-group">
          <FmtBtn
            icon={Link2}
            title="Internal link ([[Page|Label]])"
            onClick={() => wrapSelection("[[", "]]")}
          />
          <FmtBtn
            icon={ExternalLink}
            title="External link ([URL Label])"
            onClick={() => wrapSelection("[", "]")}
          />
          <FmtBtn
            icon={ImageIcon}
            title="Insert Image (Search Commons / Wiki)"
            onClick={() => modal.setShowImageSearch(true)}
          />

          {/* Stashed Images Popover */}
          <StashDropdown onInsertImage={(filename) => handleInsertStashedImage(filename)} />

          <FmtBtn
            icon={FileCode}
            title="Reference (<ref>text</ref>)"
            onClick={() => wrapSelection("<ref>", "</ref>")}
          />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Templates & Advanced */}
        <div className="wikios-editor-format-group">
          <TemplateDropdown
            triggerClassName="wikios-editor-format-btn wikios-editor-format-select"
            align="start"
            triggerContent={
              <>
                <Puzzle className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                <span className="text-[11px] font-semibold tracking-tight">Templates</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
              </>
            }
          />

          <FmtBtn
            icon={Table}
            title="Table template"
            onClick={() =>
              insertAtCursor(
                `{| class="wikitable"\n|+ Table Caption\n! Header 1 !! Header 2 !! Header 3\n|-\n| Row 1, Cell 1 || Row 1, Cell 2 || Row 1, Cell 3\n|-\n| Row 2, Cell 1 || Row 2, Cell 2 || Row 2, Cell 3\n|}`
              )
            }
          />
          <FmtBtn
            icon={Minus}
            title="Horizontal rule (----)"
            onClick={() => insertAtCursor("\n----\n")}
          />
          <FmtBtn
            icon={FileText}
            title="Signature (~~~~)"
            onClick={() => insertAtCursor(" ~~~~")}
          />
        </div>

        {/* Far right: Editor View Settings */}
        <div className="ml-auto flex items-center">
          <SettingsDropdown showLineNumbersOption showWordWrapOption />
        </div>
      </div>
    </>
  );
}

function FmtBtn({
  icon: Icon,
  title,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("wikios-editor-format-btn", active && "wikios-editor-format-btn-active")}
      onClick={onClick}
      title={title}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}
