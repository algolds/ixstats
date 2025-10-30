"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { Loader2, Check, Search } from "lucide-react";
import { useInView } from "react-intersection-observer";

interface WikiImageSearchProps {
  onImageSelect: (imageUrl: string) => void;
  selectedImage: string | null;
  setSelectedImage: (imageUrl: string | null) => void;
}

export function WikiImageSearch({
  onImageSelect,
  selectedImage,
  setSelectedImage,
}: WikiImageSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [wikiSource, setWikiSource] = useState<"ixwiki" | "iiwiki">("ixwiki");
  const { ref: bottomRef, inView } = useInView();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.thinkpages.searchWiki.useInfiniteQuery(
      { query: activeQuery, wiki: wikiSource, limit: 30 },
      {
        enabled: !!activeQuery,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.info("Please enter a search query.");
      return;
    }
    setActiveQuery(searchQuery);
  };

  const handleWikiChange = (value: string) => {
    if (value === "ixwiki" || value === "iiwiki") {
      setWikiSource(value);
    }
  };

  // Infinite scroll - load more when scrolling to bottom
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages into single array
  const allImages = data?.pages.flatMap((page) => page.images) || [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 p-4">
        <Select value={wikiSource} onValueChange={handleWikiChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a wiki" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ixwiki">ixwiki</SelectItem>
            <SelectItem value="iiwiki">iiwiki (Limited access)</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search for a file..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isLoading || !searchQuery.trim()}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Search
        </Button>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-4 overflow-y-auto p-4">
        {isLoading ? (
          <div className="col-span-3 flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : allImages.length > 0 ? (
          <>
            {allImages.map((file: any, index: number) => (
              <div
                key={`${file.path}-${index}`}
                className={cn(
                  "group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                  selectedImage === file.path
                    ? "border-blue-500"
                    : "border-transparent hover:border-blue-400"
                )}
                onClick={() => setSelectedImage(file.path)}
              >
                <img
                  src={file.url || file.path}
                  alt={file.name}
                  className="h-32 w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-2 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {file.name?.replace("File:", "")}
                </div>
                {selectedImage === file.path && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/50">
                    <Check className="h-8 w-8 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Load More Trigger */}
            {hasNextPage && (
              <div ref={bottomRef} className="col-span-3 flex justify-center py-4">
                {isFetchingNextPage ? (
                  <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                ) : (
                  <Button variant="outline" onClick={() => fetchNextPage()}>
                    Load More Images
                  </Button>
                )}
              </div>
            )}
          </>
        ) : activeQuery ? (
          <div className="text-muted-foreground col-span-3 p-8 text-center">
            No files found. Try a different search query.
          </div>
        ) : (
          <div className="text-muted-foreground col-span-3 p-8 text-center">
            Enter a search query to find images.
          </div>
        )}
      </div>
    </div>
  );
}
