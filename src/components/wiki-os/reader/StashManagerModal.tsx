"use client";
// src/components/wiki-os/reader/StashManagerModal.tsx
// Quick modal for managing multi-stash assignments on an article page.

import { useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Plus,
  WarningCircle as AlertCircle,
  SystemRestart as Loader2,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";

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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm gap-4 p-5">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-headline flex items-center gap-2">
            <Bookmark className="text-tint size-4" aria-hidden="true" />
            Save to Lore Stash
          </DialogTitle>
          <DialogDescription>
            Choose which stashes to save <strong>{pageTitle.replace(/_/g, " ")}</strong> to:
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {stashesQuery.isLoading && (
            <div className="text-footnote text-label-secondary flex items-center gap-2 p-3">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading stashes...
            </div>
          )}

          {allStashes.length > 0 && (
            <FacetListSection variant="plain" aria-label="Stashes">
              {allStashes.map((s) => (
                <FacetRow
                  key={s.id}
                  onClick={() => onToggle(s.id)}
                  selected={activeIds.has(s.id)}
                  selectionStyle="tint"
                  accessory="check"
                  itemClassName="rounded-control overflow-hidden"
                  leading={
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: s.color }}
                      aria-hidden="true"
                    />
                  }
                  title={<span className="block truncate font-normal">{s.name}</span>}
                  trailing={`${s.itemCount} pages`}
                />
              ))}
            </FacetListSection>
          )}

          {/* Create new stash */}
          {showCreate ? (
            <div className="rounded-row bg-surface-secondary space-y-3 p-3">
              <Input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Characters, Geography, Timeline..."
                autoFocus
                maxLength={100}
                aria-label="New stash name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setShowCreate(false);
                  }
                }}
              />
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Stash colour">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={newColor === c}
                    aria-label={c}
                    onClick={() => setNewColor(c)}
                    className={cn(
                      "duration-fast size-6 rounded-full transition-transform",
                      newColor === c
                        ? "ring-tint ring-offset-surface-secondary scale-110 ring-2 ring-offset-2"
                        : ""
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
              {error && (
                <p className="text-footnote text-red flex items-center gap-1">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" /> {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setShowCreate(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : null}
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setShowCreate(true)}
              className="text-body w-full justify-start px-3 font-normal"
            >
              <Plus className="size-4" aria-hidden="true" />
              Create new stash
              <span className="text-footnote text-label-secondary ml-auto tabular-nums">
                {allStashes.length}/25
              </span>
            </Button>
          )}
        </div>

        <Button asChild variant="ghost" size="sm" className="justify-start">
          <Link href={withBasePath("/stashes")} onClick={onClose}>
            <ChevronRight aria-hidden="true" />
            Go to My Stashes
          </Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
