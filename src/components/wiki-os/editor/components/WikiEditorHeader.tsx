"use client";
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
import { Button } from "~/components/ui/button";

interface WikiEditorHeaderProps {
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
              <span className="mr-2 opacity-30">:</span>
              {title}
            </span>
            {isDirty && (
              <span className="wikios-ve-dirty text-eyebrow text-tint ml-2 opacity-80">
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
            layer="chrome"
            title="Toggle Editing Mode (Source / Canvas)"
            className="text-caption shadow-floating flex items-center gap-2 rounded-full px-3 py-2 select-none"
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

        <Button
          variant="outline"
          size="icon-sm"
          onClick={onCancel}
          title="Cancel"
          aria-label="Cancel"
          className="border-red/25 text-red hover:border-red hover:bg-red/10 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>

        <Popover open={saveDropdownOpen} onOpenChange={setSaveDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={saving}
              title="Save options"
              aria-label="Save options"
              className="border-green/25 text-green hover:border-green hover:bg-green/10 rounded-full"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
            className="text-label w-52 p-1"
          >
            <div className="text-footnote flex flex-col gap-0.5">
              <Button
                variant="ghost"
                onClick={() => {
                  setSaveDropdownOpen(false);
                  setSaveActionType("publish");
                  setShowSavePanel(true);
                }}
                className="text-body text-label h-auto w-full justify-start px-3 py-2 font-normal"
              >
                <Save className="text-green h-3.5 w-3.5" />
                <span>Save and publish</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSaveDropdownOpen(false);
                  handleSaveDraft();
                }}
                className="text-body text-label h-auto w-full justify-start px-3 py-2 font-normal"
              >
                <FileText className="text-tint h-3.5 w-3.5" />
                <span>Save as draft</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSaveDropdownOpen(false);
                  setSaveActionType("session");
                  if (!summary) setSummary("Session save");
                  setShowSavePanel(true);
                }}
                className="text-body text-label h-auto w-full justify-start px-3 py-2 font-normal"
              >
                <Bookmark className="text-yellow h-3.5 w-3.5" />
                <span>Save session</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
