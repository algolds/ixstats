// src/components/media-search/MyStashTab.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { cn } from "~/lib/utils";
import { Search, Loader2, Bookmark, Folder } from "lucide-react";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { CommonsDetailPanel } from "~/components/mediawiki/commons/CommonsDetailPanel";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { ZoomIn } from "lucide-react";
import type { CommonsImage } from "./types";

interface MyStashTabProps {
  selectedImageObj: CommonsImage | null;
  onSelectImage: (img: CommonsImage) => void;
  onDoubleClickConfirm: () => void;
}

export function MyStashTab({
  selectedImageObj,
  onSelectImage,
  onDoubleClickConfirm,
}: MyStashTabProps) {
  const [stashViewMode, setStashViewMode] = useState<"stashes" | "images">("stashes");
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const [selectedStashName, setSelectedStashName] = useState<string | null>(null);
  const [selectedStashColor, setSelectedStashColor] = useState<string | null>(null);
  const [stashSearchQuery, setStashSearchQuery] = useState("");

  // Stashes list
  const { data: stashes = [], isLoading: isLoadingStashes } =
    api.wikios.getStashes.useQuery(undefined);

  // Items in active stash
  const { data: stashItemsData, isLoading: isLoadingStashItems } =
    api.wikios.getStashItems.useQuery(
      { stashId: selectedStashId ?? "" },
      { enabled: !!selectedStashId }
    );
  const stashItems = useMemo(() => stashItemsData?.items ?? [], [stashItemsData]);

  const utils = api.useUtils();
  const [allStashImages, setAllStashImages] = useState<any[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  // Fetch images for all pages in the stash in parallel
  useEffect(() => {
    if (!selectedStashId || stashItems.length === 0) {
      setAllStashImages([]);
      return;
    }

    let isMounted = true;
    const fetchAllImages = async () => {
      setIsLoadingImages(true);
      try {
        const promises = stashItems.map(async (item, idx) => {
          try {
            const images = await utils.client.wiki.getPageImages.query({
              title: item.pageTitle,
            });
            if (!isMounted) return [];
            return (images ?? []).map((img, imgIdx) => ({
              pageid: idx * 1000 + imgIdx + 5000000,
              title: img.name,
              thumbUrl: img.url,
              url: img.url,
              descriptionUrl: img.pageUrl || "",
              width: img.width || 0,
              height: img.height || 0,
              mime: img.mime || "image/png",
              description: `From stashed page: ${item.pageTitle}`,
              artist: "Wiki Contributor",
              license: "CC BY-SA 3.0",
            }));
          } catch (e) {
            console.error("Failed to fetch page images for:", item.pageTitle, e);
            return [];
          }
        });

        const results = await Promise.all(promises);
        if (isMounted) {
          const flat = results.flat();
          // Deduplicate by URL
          const seen = new Set();
          const unique = flat.filter((img) => {
            if (seen.has(img.url)) return false;
            seen.add(img.url);
            return true;
          });
          setAllStashImages(unique);
        }
      } catch (err) {
        console.error("Error loading stash images:", err);
      } finally {
        if (isMounted) {
          setIsLoadingImages(false);
        }
      }
    };

    void fetchAllImages();

    return () => {
      isMounted = false;
    };
  }, [selectedStashId, stashItems, utils]);

  const filteredStashes = useMemo(() => {
    if (!stashSearchQuery.trim()) return stashes;
    return stashes.filter((s) => s.name.toLowerCase().includes(stashSearchQuery.toLowerCase()));
  }, [stashes, stashSearchQuery]);

  const filteredPageImages = useMemo(() => {
    if (!stashSearchQuery.trim()) return allStashImages;
    return allStashImages.filter((i) =>
      i.title.toLowerCase().includes(stashSearchQuery.toLowerCase())
    );
  }, [allStashImages, stashSearchQuery]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search and Navigation */}
      <div className="border-border/10 border-b p-3 bg-card/5">
        <div className="relative mb-2">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder={
              stashViewMode === "stashes"
                ? "Search collections..."
                : "Search stash images..."
            }
            value={stashSearchQuery}
            onChange={(e) => setStashSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Breadcrumb row */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1.5 border-t border-border/5">
          <button
            onClick={() => {
              setStashViewMode("stashes");
              setSelectedStashId(null);
              onSelectImage(null as any);
              setStashSearchQuery("");
            }}
            className="hover:text-foreground font-semibold transition-colors flex items-center gap-1"
          >
            <Bookmark className="h-3.5 w-3.5" />
            Stashes
          </button>
          {selectedStashId && (
            <>
              <span>/</span>
              <span className="text-foreground font-semibold flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: selectedStashColor || "#3b82f6" }}
                />
                {selectedStashName}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main List Grid */}
        <div className="flex-1 overflow-y-auto p-4 min-w-0 flex flex-col">
          {/* 1. Stashes folder grid */}
          {stashViewMode === "stashes" && (
            isLoadingStashes ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              </div>
            ) : filteredStashes.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {filteredStashes.map((stash) => (
                  <div
                    key={stash.id}
                    onClick={() => {
                      setSelectedStashId(stash.id);
                      setSelectedStashName(stash.name);
                      setSelectedStashColor(stash.color);
                      setStashViewMode("images");
                      setStashSearchQuery("");
                    }}
                    className="group cursor-pointer rounded-lg border border-border/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 p-3 flex items-center justify-between transition-all"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Folder className="h-5 w-5 shrink-0" style={{ color: stash.color }} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">
                          {stash.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {stash.itemCount} items
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-12">
                No stashes found.
              </div>
            )
          )}

          {/* 2. Page images grid */}
          {stashViewMode === "images" && (
            (isLoadingStashItems || isLoadingImages) ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              </div>
            ) : filteredPageImages.length > 0 ? (
              <div className="wikios-commons-grid">
                {filteredPageImages.map((img) => {
                  const isSelected = selectedImageObj?.pageid === img.pageid;
                  const cleanTitle = img.title.replace(/^File:/, "").replace(/_/g, " ");

                  return (
                    <button
                      key={img.pageid}
                      onClick={() => onSelectImage(img)}
                      onDoubleClick={onDoubleClickConfirm}
                      className={cn(
                        "wikios-commons-card relative overflow-hidden",
                        isSelected && "wikios-commons-card--selected"
                      )}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 180px" }}
                    >
                      <TextureOverlay texture="paperGrain" opacity={0.05} className="mix-blend-overlay" />
                      <TextureOverlay texture="dots" opacity={0.03} className="mix-blend-overlay" />
                      <div className="wikios-commons-card-thumb">
                        <img
                          src={img.thumbUrl}
                          alt={cleanTitle}
                          loading="lazy"
                          onContextMenu={(e) => e.preventDefault()}
                        />
                        <div className="wikios-commons-card-overlay">
                          <ZoomIn className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="wikios-commons-card-info text-left">
                        <span className="wikios-commons-card-title">{cleanTitle}</span>
                        <span className="wikios-commons-card-meta">
                          {img.width}×{img.height}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-12">
                No images found in this stash.
              </div>
            )
          )}
        </div>

        {/* Right Side Detail Panel for Stash view */}
        {selectedImageObj && (
          <div className="w-80 border-l border-border/10 shrink-0 overflow-y-auto bg-slate-100/30 dark:bg-zinc-950/20 backdrop-blur-md">
            <CommonsDetailPanel
              image={selectedImageObj}
              onClose={() => {
                onSelectImage(null as any);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
