// src/components/media-search/WebPhotosTab.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "~/lib/utils";
import { Search, Loader2, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

interface WebPhotosTabProps {
  selectedImage: string | null;
  onSelectImage: (url: string) => void;
  onDoubleClickConfirm: () => void;
}

export function WebPhotosTab({
  selectedImage,
  onSelectImage,
  onDoubleClickConfirm,
}: WebPhotosTabProps) {
  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [debouncedUnsplashQuery, setDebouncedUnsplashQuery] = useState("");
  const [unsplashPage, setUnsplashPage] = useState(1);

  // Debounce unsplash search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUnsplashQuery(unsplashQuery);
      setUnsplashPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [unsplashQuery]);

  const { data: unsplashImages = [], isLoading: isLoadingUnsplash } =
    api.thinkpages.searchUnsplashImages.useQuery(
      { query: debouncedUnsplashQuery, per_page: 9, page: unsplashPage },
      {
        enabled: !!debouncedUnsplashQuery,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      }
    );

  const fetchNextUnsplashPage = useCallback(() => setUnsplashPage((prev) => prev + 1), []);
  const fetchPrevUnsplashPage = useCallback(() => setUnsplashPage((prev) => Math.max(1, prev - 1)), []);
  const hasNextUnsplashPage = unsplashImages && unsplashImages.length >= 9;
  const hasPrevUnsplashPage = unsplashPage > 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border/10 flex items-center gap-2 border-b p-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search public photos (e.g. 'castle', 'mountains', 'city')..."
            value={unsplashQuery}
            onChange={(e) => setUnsplashQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingUnsplash ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : unsplashImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {unsplashImages.map((image: any, index: number) => (
              <div
                key={`unsplash-${image.id}-${index}`}
                className={cn(
                  "group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all aspect-video bg-black/20",
                  selectedImage === image.url
                    ? "border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                    : "border-transparent hover:border-blue-400"
                )}
                onClick={() => onSelectImage(image.url)}
                onDoubleClick={onDoubleClickConfirm}
              >
                <img
                  src={image.url}
                  alt={image.description || "Unsplash Photo"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 flex flex-col justify-end p-2 text-[10px] text-white">
                  <span className="font-semibold truncate">by {image.photographer}</span>
                </div>
                {selectedImage === image.url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                    <Check className="h-8 w-8 text-white filter drop-shadow-md" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground py-12">
            {debouncedUnsplashQuery ? "No photos found." : "Enter a search term above."}
          </div>
        )}

        {unsplashImages.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-border/10">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPrevUnsplashPage}
              disabled={!hasPrevUnsplashPage}
              className="h-7 text-xs"
            >
              <ChevronLeft className="h-3 w-3 mr-1" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">Page {unsplashPage}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNextUnsplashPage}
              disabled={!hasNextUnsplashPage}
              className="h-7 text-xs"
            >
              Next <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
