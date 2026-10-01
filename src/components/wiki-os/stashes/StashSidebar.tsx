"use client";
// src/components/wiki-os/stashes/StashSidebar.tsx
// Modern Apple Design collection navigator for the Stash system.
// Features Facet glassmorphism, responsive spring animations, inline rename & color curation.

import { useState } from "react";
import {
  EditPencil as Pencil,
  Trash as Trash2,
  Check,
  Xmark as X,
  SystemRestart as Loader2,
  Folder as FolderIcon,
} from "iconoir-react";
import { cn } from "~/lib/utils";

import { PRESET_COLORS, type StashHeaderItem } from "./types";
import { CreateStashPopover } from "./CreateStashPopover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface StashSidebarProps {
  stashes: StashHeaderItem[];
  activeStashId?: string | null;
  onSelectStash: (id: string) => void;
  onUpdateStash: (params: { id: string; name: string; color: string }) => Promise<void> | void;
  onDeleteStash: (id: string) => Promise<void> | void;
  onCreateStash: (params: { name: string; color: string }) => Promise<void> | void;
  isCreating?: boolean;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function StashSidebar({
  stashes,
  activeStashId,
  onSelectStash,
  onUpdateStash,
  onDeleteStash,
  onCreateStash,
  isCreating = false,
  isUpdating = false,
  isDeleting = false,
}: StashSidebarProps) {
  const [editingStash, setEditingStash] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(PRESET_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleStartEdit = (stash: StashHeaderItem) => {
    setEditingStash(stash.id);
    setEditName(stash.name);
    setEditColor(stash.color);
    setConfirmDelete(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await onUpdateStash({ id, name: editName.trim(), color: editColor });
    setEditingStash(null);
  };

  const handleConfirmDelete = async (id: string) => {
    await onDeleteStash(id);
    setConfirmDelete(null);
  };

  return (
    <aside className="w-full shrink-0 space-y-3 md:w-64 lg:w-72">
      {/* Sidebar Header */}
      <div className="rounded-card border-separator bg-surface-secondary flex items-center justify-between border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-row border-yellow/30 bg-yellow/15 text-yellow flex h-7 w-7 items-center justify-center border">
            <FolderIcon className="h-3.5 w-3.5" />
          </div>
          <span className="text-caption text-label font-semibold">Collections</span>
        </div>
        <span className="border-separator bg-surface text-caption text-label-secondary rounded-full border px-2 py-0.5 font-semibold">
          {stashes.length}
        </span>
      </div>

      {/* Collection List */}
      <div className="space-y-2">
        {stashes.map((s) => {
          const isActive = activeStashId === s.id;
          const isEditing = editingStash === s.id;
          const isDeletingThis = confirmDelete === s.id;

          return (
            <div
              key={s.id}
              className={cn(
                "group rounded-card relative overflow-hidden border transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150",
                isActive ? "bg-tint-fill border-transparent" : "hover:bg-fill-4 border-transparent"
              )}
            >
              {isEditing ? (
                /* Inline Edit State */
                <div className="animate-in fade-in zoom-in-95 rounded-card border-separator bg-surface shadow-floating space-y-2 border p-3 duration-150">
                  <Input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Collection name"
                    autoFocus
                    placeholder="Collection name..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(s.id);
                      if (e.key === "Escape") setEditingStash(null);
                    }}
                  />

                  {/* Preset Colors Swatches */}
                  <div
                    className="flex items-center justify-between gap-1 px-0.5 pt-0.5"
                    role="radiogroup"
                    aria-label="Color Tag"
                  >
                    {PRESET_COLORS.map((c) => (
                      // A colour swatch (data colour), exposed as a radio like CreateStashPopover's.
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={editColor === c}
                        aria-label={c}
                        title={c}
                        onClick={() => setEditColor(c)}
                        className={cn(
                          "relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-[0.98]",
                          editColor === c
                            ? "ring-tint ring-offset-surface ring-2 ring-offset-2"
                            : "opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: c }}
                      >
                        {editColor === c && <Check className="h-2.5 w-2.5 text-white" />}
                      </button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button variant="gray" size="sm" onClick={() => setEditingStash(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(s.id)}
                      disabled={isUpdating || !editName.trim()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                /* Standard Collection Item */
                <div className="flex items-center justify-between p-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStash(s.id);
                    }}
                    aria-current={isActive ? "true" : undefined}
                    className="rounded-control focus-visible:outline-tint flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1 text-left outline-none focus-visible:outline-2"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full transition-transform"
                      style={{ backgroundColor: s.color }}
                    />
                    <span
                      className={cn(
                        "text-caption truncate font-semibold transition-colors",
                        isActive
                          ? "text-label font-semibold"
                          : "text-label-secondary group-hover:text-label"
                      )}
                    >
                      {s.name}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1 pr-1">
                    {/* Item count badge */}
                    <span
                      className={cn(
                        "rounded-control-sm text-caption px-2 py-0.5 font-semibold transition-opacity",
                        isActive ? "bg-surface text-label" : "bg-fill-4 text-label-secondary",
                        "group-focus-within:opacity-0 group-hover:pointer-events-none group-hover:opacity-0"
                      )}
                    >
                      {s.itemCount}
                    </span>

                    {/* Action buttons */}
                    <div className="absolute right-2 flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <Button
                        variant="bordered"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(s);
                        }}
                        className="bg-surface text-label-secondary size-6"
                        title="Edit collection"
                        aria-label="Edit collection"
                      >
                        <Pencil className="size-3" />
                      </Button>

                      {!s.isDefault &&
                        (isDeletingThis ? (
                          <div className="rounded-control border-red/40 bg-surface shadow-card flex items-center gap-1 border p-0.5">
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDelete(s.id);
                              }}
                              disabled={isDeleting}
                              className="size-5"
                              title="Confirm delete"
                              aria-label="Confirm delete"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <Check className="h-2.5 w-2.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(null);
                              }}
                              className="text-label-secondary size-5"
                              title="Cancel"
                              aria-label="Cancel delete"
                            >
                              <X className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="bordered"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(s.id);
                            }}
                            className="bg-surface text-label-secondary hover:border-red/30 hover:bg-red/10 hover:text-red size-6"
                            title="Delete collection"
                            aria-label="Delete collection"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Stash Popover Trigger on Sidebar */}
      <CreateStashPopover
        onCreate={onCreateStash}
        isCreating={isCreating}
        existingNames={stashes.map((s) => s.name)}
        triggerVariant="bordered"
        triggerClassName="w-full justify-center border-dashed text-label-secondary"
      />
    </aside>
  );
}
