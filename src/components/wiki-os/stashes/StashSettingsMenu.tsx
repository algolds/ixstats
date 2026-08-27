// src/components/wiki-os/stashes/StashSettingsMenu.tsx
// Apple Design Settings & Management Popover for Stash collections.
// Features opaque elevated surface, zero-bleed depth shadow, crisp typography, and fluid spring physics.

"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  EditPencil as Pencil,
  Trash as Trash2,
  Check,
  Xmark as X,
  Download,
  ShareIos,
  Page as FileJson,
  NavArrowDown,
  SystemRestart as Loader2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { PRESET_COLORS, type StashHeaderItem } from "./types";

interface StashSettingsMenuProps {
  stash: StashHeaderItem;
  onUpdateStash: (params: { id: string; name: string; color: string }) => Promise<void> | void;
  onDeleteStash: (id: string) => Promise<void> | void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function StashSettingsMenu({
  stash,
  onUpdateStash,
  onDeleteStash,
  onExportMarkdown,
  onExportJson,
  isUpdating = false,
  isDeleting = false,
}: StashSettingsMenuProps) {
  const notify = useNotify();
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(stash.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Sync renameValue with stash prop
  useEffect(() => {
    // oxlint-disable-next-line
    setRenameValue(stash.name);
  }, [stash.name]);

  const handleToggle = () => {
    soundEffects.press();
    setIsOpen((prev) => !prev);
    setIsRenaming(false);
    setShowDeleteConfirm(false);
  };

  const handleClose = () => {
    soundEffects.release();
    setIsOpen(false);
    setIsRenaming(false);
    setShowDeleteConfirm(false);
  };

  const handleSaveRename = async () => {
    if (!renameValue.trim() || renameValue.trim() === stash.name) {
      setIsRenaming(false);
      return;
    }
    soundEffects.press();
    await onUpdateStash({
      id: stash.id,
      name: renameValue.trim(),
      color: stash.color,
    });
    setIsRenaming(false);
  };

  const handleColorChange = async (color: string) => {
    soundEffects.press();
    await onUpdateStash({
      id: stash.id,
      name: stash.name,
      color,
    });
  };

  const handleShareLink = async () => {
    soundEffects.press();
    try {
      const url = `${window.location.origin}${window.location.pathname}?stash=${encodeURIComponent(stash.id)}`;
      await navigator.clipboard.writeText(url);
      notify.success("Collection link copied to clipboard");
      setIsOpen(false);
    } catch {
      notify.error("Failed to copy link");
    }
  };

  const handleDelete = async () => {
    soundEffects.release();
    await onDeleteStash(stash.id);
    setShowDeleteConfirm(false);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button - Apple Toolbar Segment */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all select-none",
          "focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:outline-hidden",
          isOpen
            ? "scale-102 border border-[var(--wikios-border)] bg-[var(--wikios-surface)] text-[var(--wikios-text)] shadow-md ring-1 ring-white/10"
            : "border border-[var(--wikios-border)] bg-white/8 text-[var(--wikios-text)] shadow-xs hover:bg-white/12 hover:shadow-sm active:scale-96"
        )}
        title="Collection Settings & Actions"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full shadow-xs transition-transform"
          style={{
            backgroundColor: stash.color,
            boxShadow: `0 0 8px ${stash.color}80`,
          }}
        />
        <span>Settings</span>
        <NavArrowDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--wikios-text-dim)] transition-transform duration-200 ease-out",
            isOpen && "rotate-180 text-[var(--wikios-text)]"
          )}
        />
      </button>

      {/* Invisible Clickaway Overlay (No jarring muddy full-screen dark wash) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 cursor-default"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Solid Opaque Elevated Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            style={{ transformOrigin: "top right" }}
            className={cn(
              "absolute top-full right-0 z-50 mt-2 w-76 space-y-2.5 rounded-2xl p-3 text-xs select-none",
              "bg-white text-stone-900 dark:bg-zinc-900 dark:text-stone-100",
              "border border-black/10 ring-1 ring-black/5 dark:border-white/12 dark:ring-white/5",
              "shadow-[0_20px_50px_rgba(0,0,0,0.22),0_6px_16px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.12)]",
              "overflow-hidden"
            )}
          >
            {/* Header Lockup: Swatch + Title + Close */}
            <div className="flex items-center justify-between gap-2 border-b border-black/8 px-1 pb-2 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full shadow-xs"
                  style={{
                    backgroundColor: stash.color,
                    boxShadow: `0 0 10px ${stash.color}90`,
                  }}
                />
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold tracking-tight text-stone-950 dark:text-white">
                    {stash.name}
                  </h4>
                  <p className="text-[10.5px] font-medium text-stone-500 dark:text-stone-400">
                    {stash.itemCount} saved item{stash.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-all hover:bg-stone-200 hover:text-stone-900 active:scale-90 dark:bg-zinc-800 dark:text-stone-400 dark:hover:bg-zinc-700 dark:hover:text-white"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Section 1: Color Palette Selector */}
            <div className="space-y-2 rounded-xl border border-black/5 bg-stone-100/90 p-2.5 dark:border-white/8 dark:bg-zinc-800/80">
              <span className="block text-[10px] font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
                Theme Color
              </span>
              <div className="flex items-center justify-between gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorChange(c)}
                    className={cn(
                      "relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full shadow-xs transition-transform active:scale-90",
                      stash.color === c
                        ? "scale-115 shadow-md ring-2 ring-stone-900 dark:ring-white"
                        : "opacity-85 hover:scale-105 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {stash.color === c && <Check className="h-3 w-3 stroke-[2.5] text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 2: Management & Actions */}
            <div className="space-y-0.5">
              {/* Rename Action */}
              {isRenaming ? (
                <div className="animate-in fade-in space-y-2 rounded-xl border border-rose-500/40 bg-stone-50 p-2 duration-150 dark:bg-zinc-800">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-900 shadow-2xs outline-none focus:border-rose-500 dark:border-white/15 dark:bg-zinc-900 dark:text-white"
                    autoFocus
                    placeholder="Collection name..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename();
                      if (e.key === "Escape") setIsRenaming(false);
                    }}
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsRenaming(false)}
                      className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold text-stone-500 transition-all hover:bg-black/5 hover:text-stone-900 active:scale-95 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRename}
                      disabled={isUpdating || !renameValue.trim()}
                      className="cursor-pointer rounded-lg bg-rose-500 px-3 py-1 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-rose-600 active:scale-95 disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRenaming(true)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold text-stone-700 transition-all hover:bg-stone-100 hover:text-stone-950 active:scale-[0.98] dark:text-stone-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/5 bg-stone-100 text-stone-500 dark:border-white/10 dark:bg-zinc-800 dark:text-stone-400">
                    <Pencil className="h-3.5 w-3.5" />
                  </div>
                  <span>Rename Collection</span>
                </button>
              )}

              {/* Share Link */}
              <button
                type="button"
                onClick={handleShareLink}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold text-stone-700 transition-all hover:bg-stone-100 hover:text-stone-950 active:scale-[0.98] dark:text-stone-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/5 bg-stone-100 text-stone-500 dark:border-white/10 dark:bg-zinc-800 dark:text-stone-400">
                  <ShareIos className="h-3.5 w-3.5" />
                </div>
                <span>Copy Share Link</span>
              </button>

              {/* Export Markdown */}
              <button
                type="button"
                onClick={() => {
                  onExportMarkdown();
                  setIsOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold text-stone-700 transition-all hover:bg-stone-100 hover:text-stone-950 active:scale-[0.98] dark:text-stone-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/5 bg-stone-100 text-stone-500 dark:border-white/10 dark:bg-zinc-800 dark:text-stone-400">
                  <Download className="h-3.5 w-3.5" />
                </div>
                <span>Export as Markdown (.md)</span>
              </button>

              {/* Export JSON */}
              <button
                type="button"
                onClick={() => {
                  onExportJson();
                  setIsOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold text-stone-700 transition-all hover:bg-stone-100 hover:text-stone-950 active:scale-[0.98] dark:text-stone-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/5 bg-stone-100 text-stone-500 dark:border-white/10 dark:bg-zinc-800 dark:text-stone-400">
                  <FileJson className="h-3.5 w-3.5" />
                </div>
                <span>Export as JSON (.json)</span>
              </button>
            </div>

            {/* Section 3: Destructive Delete */}
            {!stash.isDefault && (
              <div className="border-t border-black/8 pt-1 dark:border-white/10">
                {showDeleteConfirm ? (
                  <div className="animate-in fade-in space-y-2 rounded-xl border border-rose-500/30 bg-rose-50 p-2.5 duration-150 dark:bg-rose-950/40">
                    <p className="text-[11px] leading-tight font-medium text-rose-700 dark:text-rose-300">
                      Delete <strong>{stash.name}</strong> and all its saved references?
                    </p>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="cursor-pointer rounded-lg px-2.5 py-1 text-[10.5px] font-semibold text-stone-500 transition-all hover:bg-black/5 hover:text-stone-900 active:scale-95 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex cursor-pointer items-center gap-1 rounded-lg bg-rose-500 px-3 py-1 text-[10.5px] font-bold text-white shadow-xs transition-all hover:bg-rose-600 active:scale-95"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold text-rose-600 transition-all hover:bg-rose-50 active:scale-[0.98] dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </div>
                    <span>Delete Collection</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
