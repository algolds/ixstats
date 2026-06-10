"use client";

import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import {
  Folder,
  ChevronLeft,
  Search,
  Plus,
  Loader2,
  Bookmark,
  Calendar,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";

interface MessagesStashFolderPanelProps {
  selectedStashId: string | null;
  onSelectStash: (id: string | null) => void;
  selectedStashItemId: string | null;
  onSelectStashItem: (id: string | null) => void;
}

export function MessagesStashFolderPanel({
  selectedStashId,
  onSelectStash,
  selectedStashItemId,
  onSelectStashItem,
}: MessagesStashFolderPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newStashName, setNewStashName] = useState("");
  const [newStashColor, setNewStashColor] = useState("#6366f1"); // default indigo

  // Fetch all stashes
  const { data: stashes = [], isLoading: isLoadingStashes } = api.wikios.getStashes.useQuery();

  // Fetch stash items if one is selected
  const { data: itemsData, isLoading: isLoadingItems } = api.wikios.getStashItems.useQuery(
    { stashId: selectedStashId ?? "" },
    { enabled: !!selectedStashId }
  );

  const stashItems = useMemo(() => itemsData?.items ?? [], [itemsData]);

  // Find currently selected stash
  const currentStash = useMemo(
    () => stashes.find((s) => s.id === selectedStashId),
    [stashes, selectedStashId]
  );

  // Mutation to create a stash
  const createStashMutation = api.wikios.createStash.useMutation({
    onSuccess: () => {
      notify.success("Stash collection created!");
      setIsCreating(false);
      setNewStashName("");
      void utils.wikios.getStashes.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to create stash collection");
    },
  });

  const handleCreateStash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStashName.trim()) return;
    createStashMutation.mutate({
      name: newStashName.trim(),
      color: newStashColor,
    });
  };

  // Filter stashes or items
  const filteredStashes = useMemo(() => {
    if (!searchQuery.trim()) return stashes;
    return stashes.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stashes, searchQuery]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return stashItems;
    return stashItems.filter((i) => i.pageTitle.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stashItems, searchQuery]);

  const colors = [
    { value: "#6366f1", label: "Indigo" },
    { value: "#ef4444", label: "Red" },
    { value: "#f59e0b", label: "Amber" },
    { value: "#10b981", label: "Emerald" },
    { value: "#06b6d4", label: "Cyan" },
    { value: "#ec4899", label: "Pink" },
    { value: "#8b5cf6", label: "Violet" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="relative z-10 shrink-0 space-y-2 border-b border-white/5 bg-emerald-500/10 p-3">
        {selectedStashId && currentStash ? (
          <div className="mb-1 flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 cursor-pointer rounded-lg text-slate-400 hover:text-white"
              onClick={() => {
                onSelectStash(null);
                onSelectStashItem(null);
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="text-foreground flex items-center gap-1.5 truncate text-xs leading-snug font-bold">
                <span
                  className="h-2 w-2 shrink-0 animate-pulse rounded-full"
                  style={{ backgroundColor: currentStash.color }}
                />
                {currentStash.name}
              </h2>
              <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                {stashItems.length} {stashItems.length === 1 ? "item" : "items"}
              </p>
            </div>
          </div>
        ) : null}

        {/* Create collection panel inline */}
        {isCreating && !selectedStashId && (
          <form
            onSubmit={handleCreateStash}
            className="mb-2.5 rounded-xl border border-white/10 bg-slate-900/50 p-3 backdrop-blur-md"
          >
            <div className="mb-2.5">
              <Input
                placeholder="Collection name..."
                value={newStashName}
                onChange={(e) => setNewStashName(e.target.value)}
                className="h-8 border-white/10 bg-slate-950/40 text-xs text-white"
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                Choose Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {colors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewStashColor(c.value)}
                    className={cn(
                      "h-5 w-5 cursor-pointer rounded-full border border-black/20 transition-all hover:scale-110 active:scale-95",
                      newStashColor === c.value &&
                        "ring-2 ring-white ring-offset-1 ring-offset-slate-900"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setIsCreating(false)}
                className="h-7 cursor-pointer text-[10px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!newStashName.trim() || createStashMutation.isPending}
                className="h-7 cursor-pointer bg-indigo-600 text-[10px] text-white hover:bg-indigo-700"
              >
                {createStashMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        )}

        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={selectedStashId ? "Search stashed pages..." : "Search collections..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {!selectedStashId && (
            <Button
              size="icon"
              variant="ghost"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
              onClick={() => setIsCreating(!isCreating)}
              title="Create new stash collection"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {selectedStashId ? (
          isLoadingItems ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-3 py-12 text-center">
              <Bookmark className="mx-auto mb-2 h-8 w-8 text-slate-500/50" />
              <p className="text-muted-foreground text-sm font-medium">
                {searchQuery.trim() ? "No matching stashed pages" : "Empty collection"}
              </p>
              <p className="text-muted-foreground/70 mt-1 text-[11px]">
                {searchQuery.trim()
                  ? "Try a different keyword"
                  : "Stash pages from the Wiki OS or ThinkPages to view them here"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedStashItemId;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectStashItem(item.id)}
                    className={cn(
                      "group w-full rounded-xl border p-3 text-left transition-all duration-200 select-none",
                      isSelected
                        ? "border-indigo-500/40 bg-indigo-600/20 shadow-lg shadow-indigo-950/20"
                        : "border-white/5 bg-white/5 hover:translate-x-0.5 hover:border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="truncate text-xs leading-snug font-semibold text-slate-200 group-hover:text-white">
                        {item.pageTitle}
                      </h4>
                      {item.annotationCount > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">
                          <StickyNote className="h-2.5 w-2.5" />
                          {item.annotationCount}
                        </span>
                      )}
                    </div>
                    {item.note && (
                      <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-slate-400">
                        {item.note.replace(/<[^>]*>/g, "")}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-[9px] font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(item.savedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : isLoadingStashes ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : filteredStashes.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <Folder className="mx-auto mb-2 h-8 w-8 text-slate-500/50" />
            <p className="text-muted-foreground text-sm font-medium">No collections found</p>
            <p className="text-muted-foreground/70 mt-1 text-[11px]">
              Create a new collection folder above
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredStashes.map((stash) => (
              <button
                key={stash.id}
                onClick={() => {
                  onSelectStash(stash.id);
                  setSearchQuery("");
                }}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 p-3.5 text-left transition-all duration-200 hover:translate-x-0.5 hover:border-white/10 hover:bg-white/10"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900/40 shadow-md transition-transform group-hover:scale-105"
                    style={{ borderLeftColor: stash.color, borderLeftWidth: "3px" }}
                  >
                    <Folder className="h-4 w-4" style={{ color: stash.color }} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate text-xs leading-tight font-semibold text-slate-200 group-hover:text-white">
                      {stash.name}
                    </h4>
                    {stash.isDefault && (
                      <span className="mt-0.5 block text-[9px] font-semibold tracking-wider text-indigo-400 uppercase">
                        Default Collection
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-center rounded-md border border-white/5 bg-black/20 px-2 py-1 text-[10px] font-bold text-slate-400 group-hover:text-slate-200">
                  {stash.itemCount}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
