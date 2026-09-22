"use client";
// src/components/media-search/MyStashTab.tsx

import React, { useState, useMemo, useEffect } from "react";
import { cn } from "~/lib/utils";
import { Search, SystemRestart as Loader2, Bookmark, Folder, ZoomIn, Xmark as X } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import { TextureOverlay } from "~/components/ui/texture-overlay";
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
      // oxlint-disable-next-line
      setAllStashImages([]);
      return;
    }

    let isMounted = true;
    const fetchAllImages = async () => {
      setIsLoadingImages(true);
      try {
        const promises = stashItems.map(async (item, idx) => {
          try {
            const images = await utils.wikios.getPageImages.fetch({
              title: item.pageTitle,
            });
            if (!isMounted) return [];
            return (images ?? []).map(
              (
                img: {
                  title?: string;
                  thumbUrl?: string;
                  url?: string;
                  width?: number;
                  height?: number;
                },
                imgIdx: number
              ) => {
                const ext = (img.title || "").split(".").pop()?.toLowerCase() ?? "";
                const guessedMime =
                  ext === "svg"
                    ? "image/svg+xml"
                    : ext === "png"
                      ? "image/png"
                      : ext === "jpg" || ext === "jpeg"
                        ? "image/jpeg"
                        : "image/png";
                return {
                  pageid: idx * 1000 + imgIdx + 5000000,
                  title: img.title || "",
                  thumbUrl: img.thumbUrl || img.url || "",
                  url: img.url || "",
                  descriptionUrl: img.url || "",
                  width: img.width || 0,
                  height: img.height || 0,
                  mime: guessedMime,
                  description: `From stashed page: ${item.pageTitle}`,
                  artist: "Wiki Contributor",
                  license: "CC BY-SA 3.0",
                };
              }
            );
          } catch (e) {
            console.error("Failed to fetch page images for:", item.pageTitle, e);
            return [];
          }
        });

        const results = await Promise.all(promises);
        if (isMounted) {
          const flat = results.flat();
          // Deduplicate by URL
          const seen = new Set<string>();
          const unique = flat.filter((img: { url: string }) => {
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
      (i.title || "").toLowerCase().includes(stashSearchQuery.toLowerCase())
    );
  }, [allStashImages, stashSearchQuery]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search and Navigation */}
      <div className="border-border/10 bg-card/5 border-b p-3">
        <div className="relative mb-2">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={
              stashViewMode === "stashes" ? "Search collections..." : "Search stash images..."
            }
            value={stashSearchQuery}
            onChange={(e) => setStashSearchQuery(e.target.value)}
            className="h-9 pl-9 pr-8 text-xs bg-muted/30 border-border/50 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring"
          />
          {stashSearchQuery && (
            <button
              type="button"
              onClick={() => setStashSearchQuery("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-[0.95] cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Breadcrumb row */}
        <div className="text-muted-foreground border-border/5 flex items-center gap-1.5 border-t py-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setStashViewMode("stashes");
              setSelectedStashId(null);
              onSelectImage(null as any);
              setStashSearchQuery("");
            }}
            className="hover:text-foreground flex items-center gap-1 font-semibold transition-colors active:scale-[0.97] cursor-pointer"
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>Stashes</span>
          </button>
          {selectedStashId && (
            <>
              <span>/</span>
              <span className="text-foreground flex items-center gap-1.5 font-semibold">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedStashColor || "var(--color-info)" }}
                />
                {selectedStashName}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main List Grid */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
          {/* 1. Stashes folder grid */}
          {stashViewMode === "stashes" &&
            (isLoadingStashes ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                    className="group border border-border/40 flex cursor-pointer items-center justify-between rounded-xl bg-card p-3 transition-all duration-150 hover:bg-muted/40 hover:border-border/70 active:scale-[0.98] shadow-2xs select-none"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Folder className="h-5 w-5 shrink-0" style={{ color: stash.color }} />
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-xs font-bold">{stash.name}</p>
                        <p className="text-muted-foreground text-[10px] font-medium">
                          {stash.itemCount} items
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-12 text-center text-xs">
                No stashes found.
              </div>
            ))}

          {/* 2. Page images grid */}
          {stashViewMode === "images" &&
            (isLoadingStashItems || isLoadingImages ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPageImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredPageImages.map((img) => {
                  const isSelected = selectedImageObj?.pageid === img.pageid;
                  const cleanTitle = (img.title || "").replace(/^File:/, "").replace(/_/g, " ");

                  return (
                    <button
                      key={img.pageid}
                      type="button"
                      onClick={() => onSelectImage(img)}
                      onDoubleClick={onDoubleClickConfirm}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-lg border bg-card text-left select-none transition-all duration-200 active:scale-[0.98] cursor-pointer",
                        isSelected
                          ? "border-primary ring-2 ring-primary/30 shadow-sm"
                          : "border-border/50 hover:border-border hover:shadow-xs"
                      )}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 180px" }}
                    >
                      <TextureOverlay
                        texture="paperGrain"
                        opacity={0.05}
                        className="mix-blend-overlay"
                      />
                      <TextureOverlay texture="dots" opacity={0.03} className="mix-blend-overlay" />
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/20">
                        <img
                          src={img.thumbUrl}
                          alt={cleanTitle}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onContextMenu={(e) => e.preventDefault()}
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
                          <div className="rounded-full border border-white/20 bg-black/60 p-1.5 text-white shadow-md">
                            <ZoomIn className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 p-2 text-left">
                        <span className="truncate text-[11px] font-medium text-foreground/90 group-hover:text-foreground">
                          {cleanTitle}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {img.width > 0 && img.height > 0 ? `${img.width}×${img.height}` : "Vector"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground py-12 text-center text-xs">
                No images found in this stash.
              </div>
            ))}
        </div>

        {/* Right Side Detail Panel for Stash view */}
        {selectedImageObj && (
          <div className="border-border/40 w-80 shrink-0 overflow-y-auto border-l bg-card/40 backdrop-blur-md">
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
