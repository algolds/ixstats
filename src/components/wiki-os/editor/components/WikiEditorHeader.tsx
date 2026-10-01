"use client";
// src/components/wiki-os/editor/components/WikiEditorHeader.tsx
// Top titlebar with the mode switcher (a thin-material pill) and Save/Cancel actions.

import React from "react";
import { motion } from "motion/react";
import {
  Page as FileText,
  FloppyDisk as Save,
  Bookmark,
  Xmark as X,
  SystemRestart as Loader2,
} from "iconoir-react";
import { CANVAS_VERSION } from "~/lib/buildVersion";
import { FacetMaterial } from "~/components/ui/facet";
import { springSmooth } from "~/lib/design/motion";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";

export interface WikiEditorHeaderProps {
  title: string;
  mode: "visual" | "source";
  wordCount?: number;
  isDirty: boolean;
  repulsionProgress: number;
  onSwitchMode?: () => void;
  onCancel: () => void;
  handleSaveDraft: () => void;
  saving: boolean;
  saveDropdownOpen: boolean;
  setSaveDropdownOpen: (open: boolean) => void;
  setSaveActionType: (t: "publish" | "session") => void;
  setShowSavePanel: (show: boolean) => void;
  summary: string;
  setSummary: (s: string) => void;
  extraActions?: React.ReactNode;
}

export function WikiEditorHeader({
  title,
  mode,
  wordCount,
  isDirty,
  repulsionProgress,
  onSwitchMode,
  onCancel,
  handleSaveDraft,
  saving,
  saveDropdownOpen,
  setSaveDropdownOpen,
  setSaveActionType,
  setShowSavePanel,
  summary,
  setSummary,
  extraActions,
}: WikiEditorHeaderProps) {
  const isVisual = mode === "visual";

  return (
    <div className={isVisual ? "wikios-ve-titlebar" : "wikios-editor-titlebar"}>
      <div className={isVisual ? "wikios-ve-titlebar-left" : "wikios-editor-titlebar-left"}>
        {isVisual ? (
          <>
            <FileText className="text-tint h-4 w-4" />
            <span className="wikios-ve-title-text">{title}</span>
            <span className="wikios-ve-badge">Canvas v{CANVAS_VERSION}</span>
            {wordCount !== undefined && (
              <span className="wikios-ve-wordcount">{wordCount} words</span>
            )}
            {isDirty && <span className="wikios-ve-dirty-dot" title="Unsaved changes" />}
          </>
        ) : (
          <>
            <span className="wikios-editor-titlebar-name">
              <span className="mr-1 font-medium opacity-50">Editing</span>
              <span className="mr-1.5 opacity-30">:</span>
              {title}
            </span>
            {isDirty && (
              <span className="wikios-ve-dirty text-eyebrow text-tint ml-1.5 opacity-80">
                Unsaved
              </span>
            )}
          </>
        )}
      </div>

      {/* Center: mode switcher */}
      <div
        className={
          isVisual
            ? "pointer-events-auto flex shrink-0 items-center justify-center"
            : "wikios-editor-titlebar-center"
        }
      >
        <motion.div
          animate={
            !isVisual
              ? {
                  y: -repulsionProgress * 40,
                  opacity: 1 - repulsionProgress,
                  pointerEvents: repulsionProgress > 0.5 ? "none" : "auto",
                }
              : undefined
          }
          transition={springSmooth}
        >
          <FacetMaterial
            material="thin"
            title="Toggle Editing Mode (Source / Canvas)"
            className="text-caption shadow-floating flex items-center gap-2 rounded-full px-3 py-1.5 select-none"
          >
            <span className={isVisual ? "text-label-secondary" : "text-label"}>Source</span>
            <Switch
              checked={isVisual}
              onCheckedChange={(checked) => {
                if ((checked && !isVisual) || (!checked && isVisual)) {
                  onSwitchMode?.();
                }
              }}
              aria-label="Canvas editor"
            />
            <span className={isVisual ? "text-label" : "text-label-secondary"}>Canvas</span>
          </FacetMaterial>
        </motion.div>
      </div>

      <div className={isVisual ? "wikios-ve-titlebar-actions" : "wikios-editor-titlebar-actions"}>
        {extraActions}

        <button
          className="wikios-editor-btn-cancel duration-fast transition-transform active:scale-[0.98]"
          onClick={onCancel}
          type="button"
          title="Cancel"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>

        <Popover open={saveDropdownOpen} onOpenChange={setSaveDropdownOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="wikios-editor-btn-save duration-fast transition-transform active:scale-[0.98]"
              disabled={saving}
              title="Save options"
              aria-label="Save options"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
            className="text-label w-52 p-1"
          >
            <div className="text-footnote flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setSaveDropdownOpen(false);
                  setSaveActionType("publish");
                  setShowSavePanel(true);
                }}
                className="rounded-control text-body duration-fast hover:bg-fill-3 flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors"
              >
                <Save className="text-green h-3.5 w-3.5" />
                <span>Save and Publish</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveDropdownOpen(false);
                  handleSaveDraft();
                }}
                className="rounded-control text-body duration-fast hover:bg-fill-3 flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors"
              >
                <FileText className="text-tint h-3.5 w-3.5" />
                <span>Save as Draft</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveDropdownOpen(false);
                  setSaveActionType("session");
                  if (!summary) setSummary("Session save");
                  setShowSavePanel(true);
                }}
                className="rounded-control text-body duration-fast hover:bg-fill-3 flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors"
              >
                <Bookmark className="text-yellow h-3.5 w-3.5" />
                <span>Save Session</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
