// src/components/wiki-os/editor/components/WikiEditorHeader.tsx
// Top titlebar with Dynamic Island mode switcher and Save/Cancel actions.

"use client";

import React from "react";
import { motion } from "motion/react";
import {
  FileText,
  Save,
  Bookmark,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { CANVAS_VERSION } from "~/lib/buildVersion";
import {
  DynamicIslandEffects,
  DYNAMIC_ISLAND_STYLE,
  DYNAMIC_ISLAND_BORDER_CLASS,
} from "~/app/builder/components/glass";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { AppleSwitch } from "~/components/ui/apple-switch";

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
            <FileText size={16} className="text-[var(--wikios-accent)]" />
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
              <span className="wikios-ve-dirty ml-1.5 text-[10px] font-semibold text-[var(--wikios-accent)] uppercase opacity-80">
                Unsaved
              </span>
            )}
          </>
        )}
      </div>

      {/* Center: Dynamic Island mode switcher */}
      <div className={isVisual ? "pointer-events-auto flex shrink-0 items-center justify-center" : "wikios-editor-titlebar-center"}>
        <motion.div
          layout
          className={cn(
            "dynamic-island-shell group flex items-center gap-2 px-3 py-1.5 text-xs font-semibold select-none",
            DYNAMIC_ISLAND_BORDER_CLASS
          )}
          animate={
            !isVisual
              ? {
                  y: -repulsionProgress * 40,
                  scale: 1 - repulsionProgress * 0.1,
                  gap: 10 - repulsionProgress * 2,
                  opacity: 1 - repulsionProgress,
                  pointerEvents: repulsionProgress > 0.5 ? "none" : "auto",
                  boxShadow:
                    repulsionProgress > 0 && repulsionProgress < 0.8
                      ? `0 0 ${(1 - repulsionProgress) * 12}px rgba(59, 130, 246, ${(1 - repulsionProgress) * 0.4})`
                      : "none",
                }
              : undefined
          }
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 30,
            mass: 1,
          }}
          style={DYNAMIC_ISLAND_STYLE}
          title="Toggle Editing Mode (Source / Canvas)"
        >
          <DynamicIslandEffects glowOpacity={isVisual ? 0.5 : 0} showGlow={isVisual} showShimmer={isVisual} />
          <span
            style={{
              color: !isVisual ? "var(--wikios-text)" : "var(--wikios-text-dim)",
              opacity: 1 - repulsionProgress * 0.25,
            }}
            className="relative z-10 transition-colors duration-150"
          >
            Source
          </span>
          <div className="relative z-10">
            <AppleSwitch
              checked={isVisual}
              onCheckedChange={(checked) => {
                if ((checked && !isVisual) || (!checked && isVisual)) {
                  onSwitchMode?.();
                }
              }}
              size="sm"
              tone="accent"
            />
          </div>
          <span
            style={{
              color: isVisual ? "var(--wikios-text)" : "var(--wikios-text-dim)",
              opacity: 1 - repulsionProgress * 0.25,
            }}
            className="relative z-10 transition-colors duration-150"
          >
            Canvas
          </span>
        </motion.div>
      </div>

      <div className={isVisual ? "wikios-ve-titlebar-actions" : "wikios-editor-titlebar-actions"}>
        {extraActions}

        <button
          className="wikios-editor-btn-cancel"
          onClick={onCancel}
          type="button"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>

        <Popover open={saveDropdownOpen} onOpenChange={setSaveDropdownOpen}>
          <PopoverTrigger
            className="wikios-editor-btn-save"
            disabled={saving}
            title="Save options"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="glass-none z-[10001] w-52 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-1 text-[var(--wikios-text)] shadow-2xl"
          >
            <div className="flex flex-col gap-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSaveDropdownOpen(false);
                  setSaveActionType("publish");
                  setShowSavePanel(true);
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
              >
                <Save className="h-3.5 w-3.5 text-emerald-400" />
                <span>Save and Publish</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveDropdownOpen(false);
                  handleSaveDraft();
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
              >
                <FileText className="h-3.5 w-3.5 text-blue-400" />
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
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
              >
                <Bookmark className="h-3.5 w-3.5 text-amber-400" />
                <span>Save Session</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
