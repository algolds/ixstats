"use client";
// src/components/wiki-os/stashes/CreateStashPopover.tsx
// Apple Design Popover for creating new Lore Stash collections.
// Anchored directly to the trigger button with spring physics, 8-color swatch picker, live preview, and keyboard shortcuts.

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Check,
  SystemRestart as Loader2,
  Folder as FolderIcon,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

import { PRESET_COLORS } from "./types";

interface CreateStashPopoverProps {
  onCreate: (params: { name: string; color: string }) => Promise<void> | void;
  isCreating?: boolean;
  existingNames?: string[];
  triggerClassName?: string;
  triggerLabel?: string;
  /** Button style of the default trigger. @default "default" */
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  children?: React.ReactNode;
}

export function CreateStashPopover({
  onCreate,
  isCreating = false,
  existingNames = [],
  triggerClassName,
  triggerLabel = "New Collection",
  triggerVariant,
  children,
}: CreateStashPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0] ?? "#f43f5e");
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (!isOpen) {
      // oxlint-disable-next-line
      setName("");
      setError(null);
    }
  }, [isOpen]);

  const handleClose = () => {
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

    setError(null);
    try {
      await onCreate({ name: trimmed, color });
      handleClose();
    } catch {
      setError("Failed to create collection");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : handleClose())}>
      <PopoverTrigger asChild>
        {children ? (
          <div className="inline-block cursor-pointer">{children}</div>
        ) : (
          <Button
            size="sm"
            variant={triggerVariant}
            className={triggerClassName}
            title="Create a new collection"
          >
            <Plus aria-hidden="true" />
            <span>{triggerLabel}</span>
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 space-y-3 p-3 select-none"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {/* Header */}
        <div className="border-separator flex items-center gap-2 border-b pb-2">
          <div
            className="rounded-control-sm flex size-5 items-center justify-center text-white"
            style={{ backgroundColor: color }}
          >
            <FolderIcon className="size-3" aria-hidden="true" />
          </div>
          <h4 className="text-headline text-label">New Collection</h4>
        </div>

        {/* Error message */}
        {error && (
          <p className="rounded-control bg-red/10 text-footnote text-red flex items-center gap-2 p-2">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        {/* Name input */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-subhead text-label-secondary block">Collection Name</span>
            <Input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Treaties, Prime Ministers, Atlas..."
              maxLength={100}
            />
          </label>

          {/* Colour swatch picker */}
          <div className="rounded-row bg-surface-secondary space-y-2 p-3">
            <span className="text-subhead text-label-secondary block">Color Tag</span>
            <div
              className="flex items-center justify-between gap-1"
              role="radiogroup"
              aria-label="Color Tag"
            >
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "duration-fast relative flex size-6 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-[0.98]",
                    color === c
                      ? "ring-tint ring-offset-surface-secondary ring-2 ring-offset-2"
                      : "opacity-85 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                >
                  {color === c && (
                    <Check className="size-3 stroke-[2.5] text-white" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Collection</span>
              )}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
