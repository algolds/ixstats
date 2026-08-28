"use client";
// src/components/wiki-os/stashes/CreateStashPopover.tsx
// Apple Design Popover for creating new Lore Stash collections.
// Anchored directly to the trigger button with spring physics, 8-color swatch picker, live preview, and keyboard shortcuts.

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
      // oxlint-disable-next-line
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
            "flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all select-none hover:bg-rose-600 active:scale-95",
            isOpen && "bg-rose-600 ring-2 ring-rose-500/40",
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
              "absolute top-full right-0 z-50 mt-2 w-80 space-y-3 rounded-2xl p-3.5 text-xs select-none",
              "bg-white text-stone-900 dark:bg-zinc-900 dark:text-stone-100",
              "border border-black/10 ring-1 ring-black/5 dark:border-white/12 dark:ring-white/5",
              "shadow-[0_20px_50px_rgba(0,0,0,0.22),0_6px_16px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.12)]",
              "overflow-hidden"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-black/8 pb-2 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-lg text-white shadow-2xs"
                  style={{ backgroundColor: color }}
                >
                  <FolderIcon className="h-3 w-3" />
                </div>
                <h4 className="text-sm font-bold tracking-tight text-stone-950 dark:text-white">
                  New Collection
                </h4>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-all hover:bg-stone-200 hover:text-stone-900 active:scale-90 dark:bg-zinc-800 dark:text-stone-400 dark:hover:bg-zinc-700 dark:hover:text-white"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="animate-in fade-in flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-50 p-2 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Name Input */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
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
                  className="w-full rounded-xl border border-black/10 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-900 shadow-2xs transition-colors outline-none focus:border-rose-500 dark:border-white/15 dark:bg-zinc-900 dark:text-white"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleClose();
                  }}
                />
              </div>

              {/* Color Swatch Picker */}
              <div className="space-y-2 rounded-xl border border-black/5 bg-stone-100/90 p-2.5 dark:border-white/8 dark:bg-zinc-800/80">
                <span className="block text-[10px] font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
                  Color Tag
                </span>
                <div className="flex items-center justify-between gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full shadow-xs transition-transform active:scale-90",
                        color === c
                          ? "scale-115 shadow-md ring-2 ring-stone-900 dark:ring-white"
                          : "opacity-85 hover:scale-105 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {color === c && <Check className="h-3 w-3 stroke-[2.5] text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-500 transition-all hover:bg-black/5 hover:text-stone-900 active:scale-95 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isCreating}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-rose-600 active:scale-95 disabled:opacity-40"
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
