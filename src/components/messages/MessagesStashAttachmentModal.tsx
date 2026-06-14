"use client";

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import {
  Bookmark,
  Folder,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Input } from "~/components/ui/input";
// eslint-disable-next-line unused-imports/no-unused-imports
import { cn } from "~/lib/utils";

interface MessagesStashAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachItem: (item: { title: string; url: string }) => void;
}

export function MessagesStashAttachmentModal({
  isOpen,
  onClose,
  onAttachItem,
}: MessagesStashAttachmentModalProps) {
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all stashes
  const { data: stashes = [], isLoading: isLoadingStashes } = api.wikios.getStashes.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Fetch items in the selected stash
  const { data: itemsData, isLoading: isLoadingItems } = api.wikios.getStashItems.useQuery(
    { stashId: selectedStashId ?? "" },
    { enabled: isOpen && !!selectedStashId }
  );

  const stashItems = useMemo(() => itemsData?.items ?? [], [itemsData]);

  // Find active stash info
  const activeStash = useMemo(
    () => stashes.find((s) => s.id === selectedStashId),
    [stashes, selectedStashId]
  );

  // Filter lists
  const filteredStashes = useMemo(() => {
    if (!searchQuery.trim()) return stashes;
    return stashes.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stashes, searchQuery]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return stashItems;
    return stashItems.filter((i) => i.pageTitle.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stashItems, searchQuery]);

  const handleSelectStash = (stashId: string) => {
    setSelectedStashId(stashId);
    setSearchQuery("");
  };

  const handleSelectItem = (item: { pageTitle: string; pageSlug: string }) => {
    onAttachItem({
      title: item.pageTitle,
      url: `/wiki/${item.pageSlug}`,
    });
    // Reset state & close
    setSelectedStashId(null);
    setSearchQuery("");
    onClose();
  };

  const handleBack = () => {
    setSelectedStashId(null);
    setSearchQuery("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-slate-900 text-white backdrop-blur-xl sm:max-w-md">
        <DialogHeader className="border-b border-white/5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-200">
            {selectedStashId ? (
              <button
                onClick={handleBack}
                className="mr-1 flex items-center justify-center rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
            ) : (
              <Bookmark className="h-5 w-5 text-indigo-400" />
            )}
            {selectedStashId && activeStash ? (
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: activeStash.color }}
                />
                {activeStash.name}
              </span>
            ) : (
              "Attach Lore Stash Link"
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder={selectedStashId ? "Search stashed pages..." : "Search collections..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {/* List display */}
          <div className="max-h-72 scrollbar-thin overflow-y-auto pr-1">
            {selectedStashId ? (
              isLoadingItems ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                </div>
              ) : filteredItems.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  {searchQuery.trim() ? "No matching pages found." : "No pages in this collection."}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className="group flex w-full items-center justify-between rounded-lg p-2.5 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-200 group-hover:text-white">
                          {item.pageTitle}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">
                          /wiki/{item.pageSlug}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-indigo-400 opacity-0 transition-opacity group-hover:opacity-100">
                        Attach Link <ArrowRight className="h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : isLoadingStashes ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              </div>
            ) : filteredStashes.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                No Lore Stash collections found.
              </p>
            ) : (
              <div className="space-y-1">
                {filteredStashes.map((stash) => (
                  <button
                    key={stash.id}
                    onClick={() => handleSelectStash(stash.id)}
                    className="group flex w-full items-center justify-between rounded-lg p-2.5 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Folder className="h-4 w-4 shrink-0" style={{ color: stash.color }} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-200 group-hover:text-white">
                          {stash.name}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {stash.itemCount} {stash.itemCount === 1 ? "item" : "items"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
