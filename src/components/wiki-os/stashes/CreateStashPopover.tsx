// src/components/wiki-os/stashes/CreateStashPopover.tsx
// Apple Design Popover for creating new Lore Stash collections.
// Anchored directly to the trigger button with spring physics, 8-color swatch picker, live preview, and keyboard shortcuts.

"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Xmark as X,
  Check,
  SystemRestart as Loader2,
  Folder as FolderIcon,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { PRESET_COLORS } from "./types";

interface CreateStashPopoverProps {
  onCreate: (params: { name: string; color: string }) => Promise<void> | void;
  isCreating?: boolean;
  existingNames?: string[];
  triggerClassName?: string;
  triggerLabel?: string;
  children?: React.ReactNode;
}

export function CreateStashPopover({
  onCreate,
  isCreating = false,
  existingNames = [],
  triggerClassName,
  triggerLabel = "New Collection",
  children,
}: CreateStashPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0] ?? "#f43f5e");
  const [error, setError] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setName("");
      setError(null);
    }
  }, [isOpen]);

  const handleToggle = () => {
    soundEffects.press();
    setIsOpen((prev) => !prev);
  };

  const handleClose = () => {
    soundEffects.release();
    setIsOpen(false);
    setName("");
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a collection name");
      return;
    }
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" already exists`);
      return;
    }

    soundEffects.press();
    setError(null);
    try {
      await onCreate({ name: trimmed, color });
      handleClose();
    } catch {
      setError("Failed to create collection");
    }
  };

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {/* Popover Trigger */}
      {children ? (
        <div onClick={handleToggle} className="cursor-pointer">
          {children}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all shadow-xs cursor-pointer select-none",
            isOpen && "ring-2 ring-rose-500/40 bg-rose-600",
            triggerClassName
          )}
          title="Create a new collection"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{triggerLabel}</span>
        </button>
      )}

      {/* Invisible Clickaway Layer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 cursor-default"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Solid Opaque Apple Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            style={{ transformOrigin: "top right" }}
            className={cn(
              "absolute right-0 top-full mt-2 w-80 z-50 rounded-2xl p-3.5 space-y-3 text-xs select-none",
              "bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100",
              "border border-black/10 dark:border-white/12 ring-1 ring-black/5 dark:ring-white/5",
              "shadow-[0_20px_50px_rgba(0,0,0,0.22),0_6px_16px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.12)]",
              "overflow-hidden"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/8 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-lg flex items-center justify-center text-white shadow-2xs"
                  style={{ backgroundColor: color }}
                >
                  <FolderIcon className="w-3 h-3" />
                </div>
                <h4 className="font-bold text-sm text-stone-950 dark:text-white tracking-tight">
                  New Collection
                </h4>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="h-6 w-6 flex items-center justify-center rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-zinc-700 active:scale-90 transition-all cursor-pointer"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-[11px] text-rose-700 dark:text-rose-300 font-semibold animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Name Input */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                  Collection Name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Treaties, Prime Ministers, Atlas..."
                  maxLength={100}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/15 bg-stone-50 dark:bg-zinc-900 text-xs text-stone-900 dark:text-white font-medium outline-none focus:border-rose-500 shadow-2xs transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleClose();
                  }}
                />
              </div>

              {/* Color Swatch Picker */}
              <div className="p-2.5 rounded-xl bg-stone-100/90 dark:bg-zinc-800/80 border border-black/5 dark:border-white/8 space-y-2">
                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                  Color Tag
                </span>
                <div className="flex items-center justify-between gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "w-6 h-6 rounded-full transition-transform active:scale-90 cursor-pointer shadow-xs relative flex items-center justify-center",
                        color === c
                          ? "scale-115 ring-2 ring-stone-900 dark:ring-white shadow-md"
                          : "hover:scale-105 opacity-85 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {color === c && <Check className="w-3 h-3 text-white stroke-[2.5]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isCreating}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-40"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Collection</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
