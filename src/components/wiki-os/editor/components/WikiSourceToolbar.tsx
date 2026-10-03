"use client";
// Top bar and Wikitext formatting toolbar for WikiOS Source Editor (CodeMirror).

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
  Quote,
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
  EyeClosed,
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
import { Button } from "~/components/ui/button";

interface WikiSourceToolbarProps {
  title: string;
  isDirty: boolean;
  repulsionProgress: number;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  onSwitchToVisual?: () => void;
  onCancel: () => void;
  handleSaveDraft: () => void;

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
        saving={modal.saving}
        saveDropdownOpen={modal.saveDropdownOpen}
        setSaveDropdownOpen={modal.setSaveDropdownOpen}
        setSaveActionType={modal.setSaveActionType}
        setShowSavePanel={modal.setShowSavePanel}
        summary={modal.summary}
        setSummary={modal.setSummary}
        extraActions={
          <Button
            variant={showPreview ? "secondary" : "outline"}
            size="icon-sm"
            aria-pressed={showPreview}
            className="rounded-full"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? "Hide preview" : "Show preview"}
            aria-label="Preview"
          >
            {showPreview ? <EyeClosed className="size-4" /> : <Eye className="size-4" />}
          </Button>
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
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-label-secondary gap-1 px-2">
                <span className="text-caption font-semibold">Heading</span>
                <ChevronDown className="size-3 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="text-label w-44 p-1">
              <div className="text-footnote flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertAtLine("= ", " =")}
                  className="text-label text-title-3 w-full justify-start px-2"
                >
                  <Hash className="text-tint h-3.5 w-3.5" />
                  <span>Heading 1</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertAtLine("== ", " ==")}
                  className="text-label text-headline w-full justify-start px-2"
                >
                  <Hash className="text-indigo h-3.5 w-3.5" />
                  <span>Heading 2</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertAtLine("=== ", " ===")}
                  className="text-label text-caption w-full justify-start px-2"
                >
                  <Hash className="text-yellow h-3.5 w-3.5" />
                  <span>Heading 3</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertAtLine("==== ", " ====")}
                  className="text-label text-footnote w-full justify-start px-2 opacity-80"
                >
                  <Hash className="text-green h-3.5 w-3.5" />
                  <span>Heading 4</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertAtLine("===== ", " =====")}
                  className="text-label text-footnote w-full justify-start px-2 opacity-60"
                >
                  <Hash className="text-label-secondary h-3.5 w-3.5" />
                  <span>Heading 5</span>
                </Button>
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
            triggerClassName="gap-1 px-2"
            align="start"
            triggerContent={
              <>
                <Puzzle className="text-tint h-3.5 w-3.5 shrink-0" />
                <span className="text-caption font-semibold">Templates</span>
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
    <Button
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-pressed={active}
      className={cn(!active && "text-label-secondary")}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <Icon className="size-3.5 shrink-0" />
    </Button>
  );
}
