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
  Puzzle,
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
  Bookmark,
  Sparks as Sparkles,
  Map as MapIcon,
  Settings,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { AppleSwitch } from "~/components/ui/apple-switch";
import { WikiEditorHeader } from "./WikiEditorHeader";
import { StashImageCard } from "./StashImageCard";
import type {
  StashEntity,
  StashItemEntity,
  WikimediaImageMeta,
  SaveActionType,
} from "../types";

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
  setShowImageSearch: (open: boolean) => void;
  setShowInfoboxModal: (open: boolean) => void;
  setShowCountryStatsModal: (open: boolean) => void;
  setShowBusinessStatsModal: (open: boolean) => void;
  setShowMapCoordsModal: (open: boolean) => void;
  stashesOpen: boolean;
  setStashesOpen: (open: boolean) => void;
  templatesOpen: boolean;
  setTemplatesOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  enableAutocomplete: boolean;
  handleToggleAutocomplete: (val: boolean) => void;
  stashes: StashEntity[];
  activeStashId: string;
  setSelectedStashId: (id: string) => void;
  imageItems: StashItemEntity[];
  imagesMap: Map<string, WikimediaImageMeta>;
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
  setShowImageSearch,
  setShowInfoboxModal,
  setShowCountryStatsModal,
  setShowBusinessStatsModal,
  setShowMapCoordsModal,
  stashesOpen,
  setStashesOpen,
  templatesOpen,
  setTemplatesOpen,
  settingsOpen,
  setSettingsOpen,
  enableAutocomplete,
  handleToggleAutocomplete,
  stashes,
  activeStashId,
  setSelectedStashId,
  imageItems,
  imagesMap,
  handleInsertStashedImage,
}: WikiVisualToolbarProps) {
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
          <VEBtn icon={<Undo2 className="h-3.5 w-3.5" />} title="Undo (Ctrl+Z)" onClick={() => exec("undo")} />
          <VEBtn icon={<Redo2 className="h-3.5 w-3.5" />} title="Redo (Ctrl+Y)" onClick={() => exec("redo")} />
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
          <VEBtn icon={<Type className="h-3.5 w-3.5" />} title="Normal paragraph" onClick={setParagraph} />
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
          <VEBtn icon={<Indent className="h-3.5 w-3.5" />} title="Indent" onClick={() => exec("indent")} />
          <VEBtn icon={<Outdent className="h-3.5 w-3.5" />} title="Outdent" onClick={() => exec("outdent")} />
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
          <VEBtn icon={<Link2 className="h-3.5 w-3.5" />} title="Insert link (Ctrl+K)" onClick={insertLink} />
          <VEBtn icon={<Unlink className="h-3.5 w-3.5" />} title="Remove link" onClick={removeLink} />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Insert objects */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            title="Insert image"
            onClick={() => {
              saveSelection();
              setShowImageSearch(true);
            }}
          />

          <Popover open={stashesOpen} onOpenChange={setStashesOpen}>
            <PopoverTrigger
              className="wikios-editor-format-btn"
              title="Stashed Images"
              onClick={saveSelection}
            >
              <Bookmark className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] flex w-80 flex-col gap-2 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-3 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--wikios-border)] pb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--wikios-text-muted)]">
                  <Bookmark className="h-3.5 w-3.5 text-amber-400" />
                  <span>Stash Explorer</span>
                </span>
                {stashes.length > 1 && (
                  <select
                    value={activeStashId}
                    onChange={(e) => setSelectedStashId(e.target.value)}
                    className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 outline-none"
                  >
                    {stashes.map((s) => (
                      <option key={s.id} value={s.id} className="bg-zinc-900 text-white">
                        {s.name} ({s.itemCount})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {imageItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-400">
                  <ImageIcon className="mb-2 h-6 w-6 opacity-40" />
                  <div className="text-xs">No media files in this stash</div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    Stash Commons images from the repository to quickly insert them here.
                  </div>
                </div>
              ) : (
                <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto p-1">
                  {imageItems.map((item: any) => {
                    const cleanTitle = item.pageTitle.replace(/^commons:/, "");
                    const filename = cleanTitle.replace(/^File:/, "");
                    const imgInfo = imagesMap.get(item.pageTitle);
                    return (
                      <StashImageCard
                        key={item.id}
                        imgInfo={imgInfo}
                        cleanTitle={cleanTitle}
                        filename={filename}
                        onInsert={() => {
                          setStashesOpen(false);
                          restoreSelection();
                          handleInsertStashedImage(filename);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <VEBtn icon={<Table className="h-3.5 w-3.5" />} title="Insert table" onClick={insertTable} />

          {/* Templates dropdown */}
          <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <PopoverTrigger
              className="wikios-editor-format-btn"
              title="Insert Template"
              onClick={saveSelection}
            >
              <Puzzle className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] w-56 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-1 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex flex-col gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    restoreSelection();
                    setShowInfoboxModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <Puzzle className="h-3.5 w-3.5 text-blue-400" />
                  <span>Infobox Country</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    restoreSelection();
                    setShowCountryStatsModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Country Stats</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    restoreSelection();
                    setShowBusinessStatsModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                  <span>Business Stats</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    restoreSelection();
                    setShowMapCoordsModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <MapIcon className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Map Coords &amp; Embeds</span>
                </button>
                <div className="my-0.5 border-t border-[var(--wikios-border)]" />
              </div>
            </PopoverContent>
          </Popover>
          <VEBtn icon={<Minus className="h-3.5 w-3.5" />} title="Horizontal rule" onClick={insertHR} />
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
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger className="wikios-editor-format-btn" title="Editor Settings">
              <Settings className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] w-56 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-2 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex flex-col gap-2.5 p-1 text-xs">
                <div className="mb-1 border-b border-[var(--wikios-border)] pb-1.5 font-semibold text-[var(--wikios-text-dim)]">
                  Editor Settings
                </div>

                {/* Autocomplete */}
                <div className="flex items-center justify-between select-none">
                  <span className="font-medium">Autocomplete</span>
                  <AppleSwitch
                    checked={enableAutocomplete}
                    onCheckedChange={handleToggleAutocomplete}
                    size="sm"
                    tone="neutral"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
