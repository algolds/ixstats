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
          "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500/50",
          isOpen
            ? "bg-[var(--wikios-surface)] text-[var(--wikios-text)] border border-[var(--wikios-border)] shadow-md scale-102 ring-1 ring-white/10"
            : "text-[var(--wikios-text)] bg-white/8 hover:bg-white/12 border border-[var(--wikios-border)] shadow-xs hover:shadow-sm active:scale-96"
        )}
        title="Collection Settings & Actions"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs transition-transform"
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
              "absolute right-0 top-full mt-2 w-76 z-50 rounded-2xl p-3 space-y-2.5 text-xs select-none",
              "bg-white dark:bg-[#18181b] text-stone-900 dark:text-stone-100",
              "border border-black/10 dark:border-white/12 ring-1 ring-black/5 dark:ring-white/5",
              "shadow-[0_20px_50px_rgba(0,0,0,0.22),0_6px_16px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.12)]",
              "overflow-hidden"
            )}
          >
            {/* Header Lockup: Swatch + Title + Close */}
            <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b border-black/8 dark:border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                  style={{
                    backgroundColor: stash.color,
                    boxShadow: `0 0 10px ${stash.color}90`,
                  }}
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-stone-950 dark:text-white truncate tracking-tight">
                    {stash.name}
                  </h4>
                  <p className="text-[10.5px] text-stone-500 dark:text-stone-400 font-medium">
                    {stash.itemCount} saved item{stash.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="h-6 w-6 flex items-center justify-center rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-zinc-700 active:scale-90 transition-all cursor-pointer"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Section 1: Color Palette Selector */}
            <div className="p-2.5 rounded-xl bg-stone-100/90 dark:bg-zinc-800/80 border border-black/5 dark:border-white/8 space-y-2">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                Theme Color
              </span>
              <div className="flex items-center justify-between gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorChange(c)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform active:scale-90 cursor-pointer shadow-xs relative flex items-center justify-center",
                      stash.color === c
                        ? "scale-115 ring-2 ring-stone-900 dark:ring-white shadow-md"
                        : "hover:scale-105 opacity-85 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {stash.color === c && <Check className="w-3 h-3 text-white stroke-[2.5]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 2: Management & Actions */}
            <div className="space-y-0.5">
              {/* Rename Action */}
              {isRenaming ? (
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-rose-500/40 space-y-2 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs text-stone-900 dark:text-white font-semibold outline-none focus:border-rose-500 shadow-2xs"
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
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRename}
                      disabled={isUpdating || !renameValue.trim()}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all cursor-pointer shadow-xs disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRenaming(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all cursor-pointer text-left font-semibold"
                >
                  <div className="h-6 w-6 rounded-lg bg-stone-100 dark:bg-zinc-800 border border-black/5 dark:border-white/10 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0">
                    <Pencil className="h-3.5 w-3.5" />
                  </div>
                  <span>Rename Collection</span>
                </button>
              )}

              {/* Share Link */}
              <button
                type="button"
                onClick={handleShareLink}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all cursor-pointer text-left font-semibold"
              >
                <div className="h-6 w-6 rounded-lg bg-stone-100 dark:bg-zinc-800 border border-black/5 dark:border-white/10 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0">
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
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all cursor-pointer text-left font-semibold"
              >
                <div className="h-6 w-6 rounded-lg bg-stone-100 dark:bg-zinc-800 border border-black/5 dark:border-white/10 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0">
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
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all cursor-pointer text-left font-semibold"
              >
                <div className="h-6 w-6 rounded-lg bg-stone-100 dark:bg-zinc-800 border border-black/5 dark:border-white/10 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0">
                  <FileJson className="h-3.5 w-3.5" />
                </div>
                <span>Export as JSON (.json)</span>
              </button>
            </div>

            {/* Section 3: Destructive Delete */}
            {!stash.isDefault && (
              <div className="pt-1 border-t border-black/8 dark:border-white/10">
                {showDeleteConfirm ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 space-y-2 animate-in fade-in duration-150">
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium leading-tight">
                      Delete <strong>{stash.name}</strong> and all its saved references?
                    </p>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="px-3 py-1 rounded-lg text-[10.5px] font-bold text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-[0.98] transition-all cursor-pointer text-left font-semibold"
                  >
                    <div className="h-6 w-6 rounded-lg bg-rose-100 dark:bg-rose-950/50 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
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
