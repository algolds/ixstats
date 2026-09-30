"use client";

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import {
  Bookmark,
  Folder,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  SystemRestart as Loader2,
  ArrowRight,
} from "iconoir-react";
import { SearchField } from "~/components/ui/search-field";

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="border-separator border-b pb-3">
          <DialogTitle className="text-title-3 flex items-center gap-2">
            {selectedStashId ? (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back to collections"
                className="text-label-secondary hover:bg-fill-3 hover:text-label rounded-control-sm mr-1 flex items-center justify-center p-1 transition-colors"
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : (
              <Bookmark className="text-tint size-5" aria-hidden="true" />
            )}
            {selectedStashId && activeStash ? (
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
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
          <SearchField
            placeholder={selectedStashId ? "Search stashed pages..." : "Search collections..."}
            aria-label={selectedStashId ? "Search stashed pages" : "Search collections"}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />

          {/* List display */}
          <div className="max-h-72 scrollbar-thin overflow-y-auto pr-1">
            {selectedStashId ? (
              isLoadingItems ? (
                <div className="flex justify-center py-8">
                  <Loader2
                    className="text-label-secondary size-6 animate-spin"
                    aria-label="Loading"
                  />
                </div>
              ) : filteredItems.length === 0 ? (
                <p className="text-footnote text-label-secondary py-8 text-center">
                  {searchQuery.trim() ? "No matching pages found." : "No pages in this collection."}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      type="button"
                      className="group hover:bg-fill-4 rounded-control flex w-full items-center justify-between p-2 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-headline text-label truncate">{item.pageTitle}</p>
                        <p className="text-footnote text-label-secondary mt-0.5 truncate font-mono">
                          /wiki/{item.pageSlug}
                        </p>
                      </div>
                      <span className="text-caption text-tint flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        Attach Link <ArrowRight className="size-3.5" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : isLoadingStashes ? (
              <div className="flex justify-center py-8">
                <Loader2
                  className="text-label-secondary size-6 animate-spin"
                  aria-label="Loading"
                />
              </div>
            ) : filteredStashes.length === 0 ? (
              <p className="text-footnote text-label-secondary py-8 text-center">
                No Lore Stash collections found.
              </p>
            ) : (
              <div className="space-y-1">
                {filteredStashes.map((stash) => (
                  <button
                    key={stash.id}
                    onClick={() => handleSelectStash(stash.id)}
                    type="button"
                    className="group hover:bg-fill-4 rounded-control flex w-full items-center justify-between p-2 text-left transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Folder
                        className="size-4 shrink-0"
                        style={{ color: stash.color }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-headline text-label truncate">{stash.name}</p>
                        <p className="text-footnote text-label-secondary mt-0.5 tabular-nums">
                          {stash.itemCount} {stash.itemCount === 1 ? "item" : "items"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className="text-label-tertiary size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
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
