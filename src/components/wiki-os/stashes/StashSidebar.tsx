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
import { soundEffects } from "~/lib/sound/cuelume";
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
    soundEffects.press();
    setEditingStash(stash.id);
    setEditName(stash.name);
    setEditColor(stash.color);
    setConfirmDelete(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    soundEffects.press();
    await onUpdateStash({ id, name: editName.trim(), color: editColor });
    setEditingStash(null);
  };

  const handleConfirmDelete = async (id: string) => {
    soundEffects.release();
    await onDeleteStash(id);
    setConfirmDelete(null);
  };

  return (
    <aside className="w-full shrink-0 space-y-3 md:w-64 lg:w-72">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 px-3 py-2 shadow-xs backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-400">
            <FolderIcon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold tracking-tight text-[var(--wikios-text)]">
            Collections
          </span>
        </div>
        <span className="rounded-full border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--wikios-text-dim)]">
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
                "group relative overflow-hidden rounded-2xl border transition-all duration-150",
                isActive
                  ? "border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 shadow-sm ring-1 ring-[var(--wikios-border)]"
                  : "border-transparent hover:border-[var(--wikios-border)]/60 hover:bg-[var(--wikios-surface)]/50"
              )}
            >
              {isEditing ? (
                /* Inline Edit State */
                <div className="animate-in fade-in zoom-in-95 space-y-2.5 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] p-3 shadow-lg duration-150">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-2.5 py-1.5 text-xs text-[var(--wikios-text)] transition-colors outline-none placeholder:text-[var(--wikios-text-dim)] focus:border-[var(--wikios-accent)]"
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
                          "relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full shadow-2xs transition-transform active:scale-90",
                          editColor === c
                            ? "scale-115 ring-2 ring-white/80"
                            : "opacity-80 hover:scale-105 hover:opacity-100"
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
                      className="cursor-pointer rounded-xl px-2.5 py-1 text-[11px] font-semibold text-[var(--wikios-text-muted)] transition-all hover:bg-white/5 hover:text-[var(--wikios-text)] active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(s.id)}
                      disabled={isUpdating || !editName.trim()}
                      className="cursor-pointer rounded-xl bg-[var(--wikios-accent)] px-3 py-1 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-[var(--wikios-accent-hover)] active:scale-95 disabled:opacity-40"
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
                      soundEffects.press();
                      onSelectStash(s.id);
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-2 py-1 text-left"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full shadow-2xs transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: s.color,
                        boxShadow: isActive ? `0 0 10px ${s.color}80` : undefined,
                      }}
                    />
                    <span
                      className={cn(
                        "truncate text-xs font-semibold transition-colors",
                        isActive
                          ? "font-bold text-[var(--wikios-text)]"
                          : "text-[var(--wikios-text-muted)] group-hover:text-[var(--wikios-text)]"
                      )}
                    >
                      {s.name}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1 pr-1">
                    {/* Item count badge */}
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-opacity",
                        isActive
                          ? "bg-[var(--wikios-card-bg)] text-[var(--wikios-text)]"
                          : "bg-white/5 text-[var(--wikios-text-dim)]",
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
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] text-[var(--wikios-text-dim)] shadow-xs transition-all hover:bg-[var(--wikios-border)] hover:text-[var(--wikios-text)] active:scale-95"
                        title="Edit collection"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>

                      {!s.isDefault &&
                        (isDeletingThis ? (
                          <div className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-[var(--wikios-surface)] p-0.5 shadow-md">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDelete(s.id);
                              }}
                              disabled={isDeleting}
                              className="flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-rose-500 text-white transition-all hover:bg-rose-600 active:scale-90"
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
                              className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[var(--wikios-text-dim)] transition-all hover:bg-white/10 hover:text-[var(--wikios-text)] active:scale-90"
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
                            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] text-[var(--wikios-text-dim)] shadow-xs transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95"
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
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--wikios-border)] px-3 py-2 text-xs font-semibold text-[var(--wikios-text-muted)] shadow-2xs transition-all select-none hover:border-rose-500 hover:bg-rose-500/5 hover:text-rose-400 active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Collection</span>
        </button>
      </CreateStashPopover>
    </aside>
  );
}
