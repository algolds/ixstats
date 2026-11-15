"use client";

import React, { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { api } from "~/trpc/react";
import { Bookmark, Folder, NavArrowLeft as ChevronLeft, ArrowRight } from "iconoir-react";
import { SearchField } from "~/components/ui/search-field";
import { Button } from "~/components/ui/button";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Skeleton } from "~/components/ui/skeleton";

function StashListSkeleton() {
  return (
    <div className="flex flex-col gap-1 py-2" aria-busy="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader className="border-separator border-b pb-3">
          <SheetTitle className="text-title-3 flex items-center gap-2">
            {selectedStashId ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleBack}
                aria-label="Back to collections"
                className="text-label-secondary hover:text-label mr-1"
              >
                <ChevronLeft aria-hidden className="size-5" />
              </Button>
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
              "Attach stash link"
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-2">
          <SearchField
            placeholder={selectedStashId ? "Search stashed pages..." : "Search collections..."}
            aria-label={selectedStashId ? "Search stashed pages" : "Search collections"}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />

          <div className="max-h-72 scrollbar-thin overflow-y-auto pr-1">
            {selectedStashId ? (
              isLoadingItems ? (
                <StashListSkeleton />
              ) : filteredItems.length === 0 ? (
                <p className="text-footnote text-label-secondary py-8 text-center">
                  {searchQuery.trim() ? "No matching pages found." : "No pages in this collection."}
                </p>
              ) : (
                <FacetList variant="plain">
                  <FacetListSection aria-label="Stashed pages">
                    {filteredItems.map((item) => (
                      <FacetRow
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        title={item.pageTitle}
                        subtitle={<span>/wiki/{item.pageSlug}</span>}
                        trailing={
                          <span className="text-caption text-tint flex items-center gap-1">
                            Attach link <ArrowRight className="size-3.5" aria-hidden="true" />
                          </span>
                        }
                      />
                    ))}
                  </FacetListSection>
                </FacetList>
              )
            ) : isLoadingStashes ? (
              <StashListSkeleton />
            ) : filteredStashes.length === 0 ? (
              <p className="text-footnote text-label-secondary py-8 text-center">
                No stash collections found.
              </p>
            ) : (
              <FacetList variant="plain">
                <FacetListSection aria-label="Stash collections">
                  {filteredStashes.map((stash) => (
                    <FacetRow
                      key={stash.id}
                      onClick={() => handleSelectStash(stash.id)}
                      leading={
                        <Folder
                          className="size-4 shrink-0"
                          style={{ color: stash.color }}
                          aria-hidden="true"
                        />
                      }
                      title={stash.name}
                      subtitle={
                        <span className="tabular-nums">
                          {stash.itemCount} {stash.itemCount === 1 ? "item" : "items"}
                        </span>
                      }
                      accessory="chevron"
                    />
                  ))}
                </FacetListSection>
              </FacetList>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
