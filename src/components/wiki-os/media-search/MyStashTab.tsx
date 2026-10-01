"use client";
// src/components/media-search/MyStashTab.tsx

import React, { useState, useMemo, useEffect } from "react";
import { cn } from "~/lib/utils";
import {
  Search,
  SystemRestart as Loader2,
  Bookmark,
  Folder,
  ZoomIn,
  Xmark as X,
} from "iconoir-react";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import type { CommonsImage } from "./types";
import { Button } from "~/components/ui/button";

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
      <div className="border-separator bg-surface border-b p-3">
        <div className="relative mb-2">
          <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={
              stashViewMode === "stashes" ? "Search collections..." : "Search stash images..."
            }
            value={stashSearchQuery}
            onChange={(e) => setStashSearchQuery(e.target.value)}
            className="text-footnote bg-fill-4 border-separator focus-visible:bg-background focus-visible:ring-ring h-9 pr-8 pl-9 focus-visible:ring-1"
          />
          {stashSearchQuery && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setStashSearchQuery("")}
              title="Clear search"
              aria-label="Clear search"
              className="text-label-secondary absolute top-1/2 right-2 size-6 -translate-y-1/2 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Breadcrumb row */}
        <div className="text-label-secondary border-separator text-footnote flex items-center gap-2 border-t py-2">
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setStashViewMode("stashes");
              setSelectedStashId(null);
              onSelectImage(null as any);
              setStashSearchQuery("");
            }}
            className="text-label-secondary hover:text-label h-auto gap-1 px-0 font-semibold"
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>Stashes</span>
          </Button>
          {selectedStashId && (
            <>
              <span>/</span>
              <span className="text-label flex items-center gap-2 font-semibold">
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
                <Loader2 className="text-label-secondary h-6 w-6 animate-spin" />
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
                    className="group border-separator rounded-row bg-surface hover:bg-fill-3 hover:border-separator flex cursor-pointer items-center justify-between border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 select-none active:scale-[0.98]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Folder className="h-5 w-5 shrink-0" style={{ color: stash.color }} />
                      <div className="min-w-0">
                        <p className="text-label text-caption truncate font-semibold">
                          {stash.name}
                        </p>
                        <p className="text-label-secondary text-caption">{stash.itemCount} items</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-label-secondary text-footnote py-12 text-center">
                No stashes found.
              </div>
            ))}

          {/* 2. Page images grid */}
          {stashViewMode === "images" &&
            (isLoadingStashItems || isLoadingImages ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="text-label-secondary h-6 w-6 animate-spin" />
              </div>
            ) : filteredPageImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {filteredPageImages.map((img) => {
                  const isSelected = selectedImageObj?.pageid === img.pageid;
                  const cleanTitle = (img.title || "").replace(/^File:/, "").replace(/_/g, " ");

                  return (
                    <button
                      key={img.pageid}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectImage(img)}
                      onDoubleClick={onDoubleClickConfirm}
                      className={cn(
                        "group rounded-control bg-surface relative flex cursor-pointer flex-col overflow-hidden border text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 select-none active:scale-[0.98]",
                        isSelected
                          ? "border-tint ring-tint/30 shadow-card ring-2"
                          : "border-separator hover:border-separator"
                      )}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 180px" }}
                    >
                      <TextureOverlay
                        texture="paperGrain"
                        opacity={0.05}
                        className="mix-blend-overlay"
                      />
                      <TextureOverlay texture="dots" opacity={0.03} className="mix-blend-overlay" />
                      <div className="bg-fill-4 relative aspect-[4/3] w-full overflow-hidden">
                        <img
                          src={img.thumbUrl}
                          alt={cleanTitle}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300"
                          onContextMenu={(e) => e.preventDefault()}
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <div className="border-separator shadow-card rounded-full border bg-black/60 p-2 text-white">
                            <ZoomIn className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 p-2 text-left">
                        <span className="text-caption text-label group-hover:text-label truncate">
                          {cleanTitle}
                        </span>
                        <span className="text-footnote text-label-secondary">
                          {img.width > 0 && img.height > 0
                            ? `${img.width}×${img.height}`
                            : "Vector"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-label-secondary text-footnote py-12 text-center">
                No images found in this stash.
              </div>
            ))}
        </div>

        {/* Right Side Detail Panel for Stash view */}
        {selectedImageObj && (
          <div className="border-separator bg-surface w-80 shrink-0 overflow-y-auto border-l">
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
