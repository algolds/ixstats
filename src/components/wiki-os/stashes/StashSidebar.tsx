// src/components/wiki-os/stashes/StashSidebar.tsx
// Collections sidebar for browsing and managing Lore Stashes.

"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X, Plus, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { PRESET_COLORS, type StashHeaderItem } from "./types";

interface StashSidebarProps {
  stashes: StashHeaderItem[];
  activeStashId?: string | null;
  onSelectStash: (id: string) => void;
  onUpdateStash: (params: { id: string; name: string; color: string }) => Promise<void> | void;
  onDeleteStash: (id: string) => Promise<void> | void;
  onOpenCreate: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function StashSidebar({
  stashes,
  activeStashId,
  onSelectStash,
  onUpdateStash,
  onDeleteStash,
  onOpenCreate,
  isUpdating = false,
  isDeleting = false,
}: StashSidebarProps) {
  const [editingStash, setEditingStash] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleStartEdit = (s: StashHeaderItem) => {
    setEditingStash(s.id);
    setEditName(s.name);
    setEditColor(s.color);
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
    <div className="wikios-stashes-sidebar w-full shrink-0 md:w-60">
      <div className="wikios-stashes-sidebar-label">Your Stashes</div>
      {stashes.map((s) => (
        <div key={s.id} className="wikios-stash-sidebar-item-wrapper">
          {editingStash === s.id ? (
            <div className="wikios-stash-edit-inline">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="wikios-stash-edit-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit(s.id);
                  if (e.key === "Escape") setEditingStash(null);
                }}
              />
              <div className="wikios-stash-edit-colors">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className={cn(
                      "wikios-stash-preset-color",
                      editColor === c && "wikios-stash-preset-active"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="wikios-stash-edit-actions">
                <button
                  type="button"
                  onClick={() => handleSaveEdit(s.id)}
                  className="wikios-stash-btn-primary-sm"
                  disabled={isUpdating || !editName.trim()}
                >
                  {isUpdating ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStash(null)}
                  className="wikios-stash-btn-secondary-sm"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSelectStash(s.id)}
              className={cn(
                "wikios-stash-sidebar-item",
                activeStashId === s.id && "wikios-stash-sidebar-active"
              )}
            >
              <span className="wikios-stash-sidebar-color" style={{ background: s.color }} />
              <span className="wikios-stash-sidebar-name">{s.name}</span>
              <span className="wikios-stash-sidebar-count">{s.itemCount}</span>
            </button>
          )}

          {editingStash !== s.id && (
            <div className="wikios-stash-sidebar-actions">
              <button
                type="button"
                onClick={() => handleStartEdit(s)}
                className="wikios-stash-sidebar-action"
                title="Edit"
              >
                <Pencil size={11} />
              </button>
              {!s.isDefault &&
                (confirmDelete === s.id ? (
                  <div className="wikios-stash-confirm-delete">
                    <button
                      type="button"
                      onClick={() => handleConfirmDelete(s.id)}
                      className="wikios-stash-confirm-yes"
                      title="Confirm"
                      disabled={isDeleting}
                    >
                      {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="wikios-stash-confirm-no"
                      title="Cancel"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(s.id)}
                    className="wikios-stash-sidebar-action wikios-stash-sidebar-delete"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}

      <button type="button" onClick={onOpenCreate} className="wikios-stash-sidebar-add">
        <Plus size={12} /> New stash
      </button>
    </div>
  );
}
