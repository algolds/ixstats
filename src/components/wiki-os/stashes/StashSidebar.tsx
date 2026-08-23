// src/components/wiki-os/stashes/StashSidebar.tsx
// Modern Apple Design collection navigator for the Stash system.
// Features Facet glassmorphism, responsive spring animations, inline rename & color curation.

"use client";

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
    <aside className="w-full md:w-64 lg:w-72 shrink-0 space-y-3">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-[var(--wikios-card-bg)]/60 border border-[var(--wikios-border)] shadow-xs backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
            <FolderIcon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold text-[var(--wikios-text)] tracking-tight">Collections</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--wikios-surface)] border border-[var(--wikios-border)] text-[var(--wikios-text-dim)]">
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
                "group relative rounded-2xl border transition-all duration-150 overflow-hidden",
                isActive
                  ? "border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 shadow-sm ring-1 ring-[var(--wikios-border)]"
                  : "border-transparent hover:border-[var(--wikios-border)]/60 hover:bg-[var(--wikios-surface)]/50"
              )}
            >
              {isEditing ? (
                /* Inline Edit State */
                <div className="p-3 space-y-2.5 bg-[var(--wikios-card-bg)] border border-[var(--wikios-border)] rounded-2xl shadow-lg animate-in fade-in zoom-in-95 duration-150">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] text-xs text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] outline-none focus:border-[var(--wikios-accent)] transition-colors"
                    autoFocus
                    placeholder="Collection name..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(s.id);
                      if (e.key === "Escape") setEditingStash(null);
                    }}
                  />

                  {/* Preset Colors Swatches */}
                  <div className="flex items-center justify-between gap-1 pt-0.5 px-0.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={cn(
                          "w-5 h-5 rounded-full transition-transform active:scale-90 cursor-pointer shadow-2xs relative flex items-center justify-center",
                          editColor === c ? "scale-115 ring-2 ring-white/80" : "hover:scale-105 opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: c }}
                      >
                        {editColor === c && <Check className="w-2.5 h-2.5 text-white" />}
                      </button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingStash(null)}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(s.id)}
                      disabled={isUpdating || !editName.trim()}
                      className="px-3 py-1 rounded-xl text-[11px] font-bold text-white bg-[var(--wikios-accent)] hover:bg-[var(--wikios-accent-hover)] active:scale-95 transition-all cursor-pointer shadow-xs disabled:opacity-40"
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
                    className="flex items-center gap-2.5 min-w-0 flex-1 px-2 py-1 text-left cursor-pointer"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-2xs transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: s.color,
                        boxShadow: isActive ? `0 0 10px ${s.color}80` : undefined,
                      }}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold truncate transition-colors",
                        isActive
                          ? "text-[var(--wikios-text)] font-bold"
                          : "text-[var(--wikios-text-muted)] group-hover:text-[var(--wikios-text)]"
                      )}
                    >
                      {s.name}
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0 pr-1">
                    {/* Item count badge */}
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-opacity",
                        isActive
                          ? "bg-[var(--wikios-card-bg)] text-[var(--wikios-text)]"
                          : "bg-white/5 text-[var(--wikios-text-dim)]",
                        "group-hover:opacity-0 group-hover:pointer-events-none"
                      )}
                    >
                      {s.itemCount}
                    </span>

                    {/* Action buttons */}
                    <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(s);
                        }}
                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-[var(--wikios-surface)] border border-[var(--wikios-border)] text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-95 transition-all cursor-pointer shadow-xs"
                        title="Edit collection"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>

                      {!s.isDefault && (
                        isDeletingThis ? (
                          <div className="flex items-center gap-1 bg-[var(--wikios-surface)] border border-rose-500/40 rounded-lg p-0.5 shadow-md">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDelete(s.id);
                              }}
                              disabled={isDeleting}
                              className="h-5 w-5 flex items-center justify-center rounded bg-rose-500 text-white hover:bg-rose-600 active:scale-90 transition-all cursor-pointer"
                              title="Confirm delete"
                            >
                              {isDeleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(null);
                              }}
                              className="h-5 w-5 flex items-center justify-center rounded text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
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
                            className="h-6 w-6 flex items-center justify-center rounded-lg bg-[var(--wikios-surface)] border border-[var(--wikios-border)] text-[var(--wikios-text-dim)] hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer shadow-xs"
                            title="Delete collection"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )
                      )}
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
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-2xl border border-dashed border-[var(--wikios-border)] hover:border-rose-500 text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-rose-400 hover:bg-rose-500/5 active:scale-[0.98] transition-all cursor-pointer shadow-2xs select-none"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Collection</span>
        </button>
      </CreateStashPopover>
    </aside>
  );
}
