"use client";
// src/components/wiki-os/reader/StashManagerModal.tsx
// Quick modal for managing multi-stash assignments on an article page.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bookmark,
  Xmark as X,
  Check,
  Plus,
  WarningCircle as AlertCircle,
  SystemRestart as Loader2,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";

const PRESET_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
];

interface StashManagerModalProps {
  pageTitle: string;
  stashedIn: Array<{ id: string; color: string; name: string }>;
  onClose: () => void;
  onToggle: (stashId: string) => void;
}

export function StashManagerModal({
  pageTitle,
  stashedIn,
  onClose,
  onToggle,
}: StashManagerModalProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);
  }, []);

  const utils = api.useUtils();
  const stashesQuery = api.wikios.getStashes.useQuery(undefined, { staleTime: 5000 });
  const createMutation = api.wikios.createStash.useMutation({
    onSuccess: () => {
      utils.wikios.getStashes.invalidate();
      stashesQuery.refetch();
      setNewName("");
      setNewColor("#3b82f6");
      setShowCreate(false);
      setError(null);
    },
    onError: (err) => setError(err.message ?? "Failed to create stash"),
  });

  const allStashes = stashesQuery.data ?? [];
  const activeIds = new Set(stashedIn.map((s) => s.id));

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (allStashes.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`A stash named "${trimmed}" already exists`);
      return;
    }
    setError(null);
    createMutation.mutate({ name: trimmed, color: newColor });
  };

  if (!mounted) return null;

  return createPortal(
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div className="wikios-quick-modal wikios-stash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <Bookmark className="h-4 w-4" />
            <span>Save to Lore Stash</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close" type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="wikios-stash-modal-subtitle">
          Choose which stashes to save <strong>{pageTitle.replace(/_/g, " ")}</strong> to:
        </p>

        <div className="wikios-quick-modal-body">
          {stashesQuery.isLoading && (
            <div className="wikios-quick-modal-loading">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading stashes...
            </div>
          )}

          {allStashes.map((s) => {
            const active = activeIds.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(s.id)}
                className={cn(
                  "wikios-stash-manager-row",
                  active && "wikios-stash-manager-row-active"
                )}
              >
                <span className="wikios-stash-manager-color" style={{ background: s.color }} />
                <span className="wikios-stash-manager-name">{s.name}</span>
                <span className="wikios-stash-manager-count">{s.itemCount} pages</span>
                <span
                  className={cn(
                    "wikios-stash-manager-toggle",
                    active && "wikios-stash-manager-toggle-active"
                  )}
                >
                  {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}

          {/* Create new stash */}
          {showCreate ? (
            <div className="wikios-stash-create-form">
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Characters, Geography, Timeline..."
                className="wikios-stash-create-input"
                autoFocus
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setShowCreate(false);
                }}
              />
              <div className="wikios-stash-create-colors">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={cn(
                      "wikios-stash-preset-color",
                      newColor === c && "wikios-stash-preset-active"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
              {error && (
                <div className="wikios-stash-error">
                  <AlertCircle className="mr-1 inline h-3 w-3" /> {error}
                </div>
              )}
              <div className="wikios-stash-create-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setError(null);
                  }}
                  className="wikios-stash-create-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="wikios-stash-create-save"
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {createMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="wikios-stash-manager-add"
            >
              <Plus className="h-3.5 w-3.5" />
              Create new stash
              <span className="wikios-stash-manager-hint">{allStashes.length}/25</span>
            </button>
          )}
        </div>

        <Link
          href={withBasePath("/stashes")}
          className="wikios-quick-modal-fullpage"
          onClick={onClose}
        >
          <ChevronRight className="h-3 w-3" />
          Go to My Stashes
        </Link>
      </div>
    </div>,
    document.body
  );
}
