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
  Plus,
  SystemRestart as Loader2,
  Folder as FolderIcon,
} from "iconoir-react";
import { cn } from "~/lib/utils";

import { PRESET_COLORS, type StashHeaderItem } from "./types";
import { CreateStashPopover } from "./CreateStashPopover";

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
      <div className="space-y-1.5">
        {stashes.map((s) => {
          const isActive = activeStashId === s.id;
          const isEditing = editingStash === s.id;
          const isDeletingThis = confirmDelete === s.id;

          return (
            <div
              key={s.id}
              className={cn(
                "group rounded-card relative overflow-hidden border transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150",
                isActive
                  ? "border-separator bg-surface shadow-card ring-separator ring-1"
                  : "hover:border-separator hover:bg-surface-secondary border-transparent"
              )}
            >
              {isEditing ? (
                /* Inline Edit State */
                <div className="animate-in fade-in zoom-in-95 rounded-card border-separator bg-surface shadow-floating space-y-2.5 border p-3 duration-150">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-row border-separator bg-surface text-footnote text-label placeholder:text-label-tertiary focus:border-tint w-full border px-2.5 py-1.5 transition-colors outline-none"
                    autoFocus
                    placeholder="Collection name..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(s.id);
                      if (e.key === "Escape") setEditingStash(null);
                    }}
                  />

                  {/* Preset Colors Swatches */}
                  <div className="flex items-center justify-between gap-1 px-0.5 pt-0.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={cn(
                          "relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-[0.98]",
                          editColor === c
                            ? "scale-115 ring-2 ring-white/80"
                            : "opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: c }}
                      >
                        {editColor === c && <Check className="h-2.5 w-2.5 text-white" />}
                      </button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingStash(null)}
                      className="rounded-row text-caption text-label-secondary hover:bg-fill-4 hover:text-label cursor-pointer px-2.5 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(s.id)}
                      disabled={isUpdating || !editName.trim()}
                      className="rounded-row bg-tint text-caption text-on-tint hover:bg-tint-hover cursor-pointer px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98] disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Collection Item */
                <div className="flex items-center justify-between p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStash(s.id);
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-2 py-1 text-left"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full transition-transform"
                      style={{
                        backgroundColor: s.color,
                        boxShadow: isActive ? `0 0 10px ${s.color}80` : undefined,
                      }}
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
                        "rounded-control-sm text-caption px-1.5 py-0.5 font-semibold transition-opacity",
                        isActive ? "bg-surface text-label" : "bg-fill-4 text-label-secondary",
                        "group-hover:pointer-events-none group-hover:opacity-0"
                      )}
                    >
                      {s.itemCount}
                    </span>

                    {/* Action buttons */}
                    <div className="absolute right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(s);
                        }}
                        className="rounded-control border-separator bg-surface text-label-secondary hover:bg-fill-3 hover:text-label flex h-6 w-6 cursor-pointer items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                        title="Edit collection"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>

                      {!s.isDefault &&
                        (isDeletingThis ? (
                          <div className="rounded-control border-red/40 bg-surface shadow-card flex items-center gap-1 border p-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDelete(s.id);
                              }}
                              disabled={isDeleting}
                              className="rounded-control-sm bg-red text-on-red hover:bg-red flex h-5 w-5 cursor-pointer items-center justify-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                              title="Confirm delete"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <Check className="h-2.5 w-2.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(null);
                              }}
                              className="rounded-control-sm text-label-secondary hover:bg-fill-4 hover:text-label flex h-5 w-5 cursor-pointer items-center justify-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                              title="Cancel"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(s.id);
                            }}
                            className="rounded-control border-separator bg-surface text-label-secondary hover:border-red/30 hover:bg-red/10 hover:text-red flex h-6 w-6 cursor-pointer items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                            title="Delete collection"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
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
        triggerClassName="w-full justify-center"
      >
        <button
          type="button"
          className="rounded-card border-separator text-caption text-label-secondary hover:border-yellow/40 hover:bg-yellow/5 hover:text-yellow flex w-full cursor-pointer items-center justify-center gap-2 border border-dashed px-3 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Collection</span>
        </button>
      </CreateStashPopover>
    </aside>
  );
}
