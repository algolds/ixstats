"use client";
// Settings popover for Stash collections.
// Features opaque elevated surface, zero-bleed depth shadow, crisp typography, and fluid spring physics.

import { useState, useEffect } from "react";
import {
  EditPencil as Pencil,
  Trash as Trash2,
  Check,
  Download,
  ShareIos,
  Page as FileJson,
  NavArrowDown,
  SystemRestart as Loader2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

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

  // Sync renameValue with stash prop
  useEffect(() => {
    // oxlint-disable-next-line
    setRenameValue(stash.name);
  }, [stash.name]);

  const handleClose = () => {
    setIsOpen(false);
    setIsRenaming(false);
  };

  const handleSaveRename = async () => {
    if (!renameValue.trim() || renameValue.trim() === stash.name) {
      setIsRenaming(false);
      return;
    }
    await onUpdateStash({
      id: stash.id,
      name: renameValue.trim(),
      color: stash.color,
    });
    setIsRenaming(false);
  };

  const handleColorChange = async (color: string) => {
    await onUpdateStash({
      id: stash.id,
      name: stash.name,
      color,
    });
  };

  const handleShareLink = async () => {
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
    await onDeleteStash(stash.id);
    setShowDeleteConfirm(false);
    setIsOpen(false);
  };

  return (
    <>
      <Popover
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsOpen(true);
            setIsRenaming(false);
          } else handleClose();
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm" title="Collection settings & actions">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: stash.color }}
              aria-hidden="true"
            />
            <span>Settings</span>
            <NavArrowDown
              aria-hidden="true"
              className={cn("duration-fast transition-transform", isOpen && "rotate-180")}
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-76 space-y-2 p-2 select-none">
          {/* Header: swatch + title */}
          <div className="border-separator flex min-w-0 items-center gap-2 border-b px-2 pt-1 pb-2">
            <span
              className="size-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: stash.color }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h4 className="text-headline text-label truncate">{stash.name}</h4>
              <p className="text-footnote text-label-secondary tabular-nums">
                {stash.itemCount} saved item{stash.itemCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {/* Colour */}
          <div className="rounded-row bg-surface-secondary space-y-2 p-3">
            <span className="text-subhead text-label-secondary block">Theme color</span>
            <div
              className="flex items-center justify-between gap-1"
              role="radiogroup"
              aria-label="Theme color"
            >
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={stash.color === c}
                  aria-label={c}
                  onClick={() => handleColorChange(c)}
                  className={cn(
                    "duration-fast relative flex size-6 cursor-pointer items-center justify-center rounded-full",
                    stash.color === c
                      ? "ring-tint ring-offset-surface-secondary ring-2 ring-offset-2"
                      : "opacity-85 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                >
                  {stash.color === c && (
                    <Check className="size-3 stroke-[2.5] text-white" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-0.5">
            {isRenaming ? (
              <div className="rounded-row bg-surface-secondary space-y-2 p-2">
                <Input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  aria-label="Collection name"
                  placeholder="Collection name..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveRename();
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setIsRenaming(false);
                    }
                  }}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsRenaming(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveRename}
                    disabled={isUpdating || !renameValue.trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setIsRenaming(true)} className={ROW}>
                <span className={ICON}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                </span>
                <span>Rename collection</span>
              </Button>
            )}

            <Button variant="ghost" onClick={handleShareLink} className={ROW}>
              <span className={ICON}>
                <ShareIos className="size-3.5" aria-hidden="true" />
              </span>
              <span>Copy share link</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                onExportMarkdown();
                setIsOpen(false);
              }}
              className={ROW}
            >
              <span className={ICON}>
                <Download className="size-3.5" aria-hidden="true" />
              </span>
              <span>Export as Markdown (.md)</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                onExportJson();
                setIsOpen(false);
              }}
              className={ROW}
            >
              <span className={ICON}>
                <FileJson className="size-3.5" aria-hidden="true" />
              </span>
              <span>Export as JSON (.json)</span>
            </Button>
          </div>

          {/* Destructive: delete (confirmed in an AlertDialog) */}
          {!stash.isDefault && (
            <div className="border-separator border-t pt-1">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsOpen(false);
                  setShowDeleteConfirm(true);
                }}
                className={cn(ROW, "text-red hover:bg-red/10")}
              >
                <span className="rounded-control-sm bg-red/10 text-red flex size-6 shrink-0 items-center justify-center">
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </span>
                <span>Delete collection</span>
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete collection</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{stash.name}</strong> and all its saved references?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Confirm delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** A command row in the settings popover (a ghost `Button`). */
const ROW = "text-body text-label h-auto w-full justify-start px-2 py-2 font-normal";
const ICON =
  "flex size-6 shrink-0 items-center justify-center rounded-control-sm bg-fill-3 text-label-secondary";
