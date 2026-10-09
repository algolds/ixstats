"use client";

import React, { useState, useMemo } from "react";
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
import { publicArticleUrl } from "~/lib/wiki-os/config";
import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import type { CommonsImage } from "./types";
import { Button } from "~/components/ui/button";

interface MyStashTabProps {
  selectedImageObj: CommonsImage | null;
  onSelectImage: (img: CommonsImage | null) => void;
  onDoubleClickConfirm: () => void;
}

const IMAGE_STALE_MS = 300_000;
/** The most titles one `sisterFileInfo` request takes. */
const MAX_SISTER_TITLES = 50;

function guessMime(title: string): string {
  const ext = title.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "image/png";
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-label-secondary text-footnote flex flex-col items-center gap-3 py-12 text-center">
      <p role="alert">Could not load this stash.</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
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
  const stashesQuery = api.wikios.getStashes.useQuery(undefined);

  // Items in active stash
  const stashItemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: selectedStashId ?? "" },
    { enabled: !!selectedStashId }
  );
  const stashItems = useMemo(() => stashItemsQuery.data?.items ?? [], [stashItemsQuery.data]);

  // `commons:File:X` items resolve through Commons, `iiwiki:File:X` through one IIWiki file info lookup, plain page
  // titles through IxWiki. `File:` is capitalised and is not a wiki prefix; forum items are skipped.
  // ponytail: forum items are not resolvable here yet.
  const { commonsTitles, ixwikiTitles, iiwikiFileTitles } = useMemo(() => {
    const commons: string[] = [];
    const ixwiki: string[] = [];
    const iiwiki: string[] = [];
    for (const { pageTitle } of stashItems) {
      if (pageTitle.startsWith("commons:")) commons.push(pageTitle.replace(/^commons:/, ""));
      else if (pageTitle.startsWith("iiwiki:File:")) iiwiki.push(pageTitle.replace(/^iiwiki:/, ""));
      else if (!/^[a-z]+:/.test(pageTitle)) ixwiki.push(pageTitle);
    }
    return {
      commonsTitles: commons,
      ixwikiTitles: ixwiki,
      iiwikiFileTitles: [...new Set(iiwiki)].slice(0, MAX_SISTER_TITLES),
    };
  }, [stashItems]);

  const commonsQuery = api.commons.getImageInfoByTitles.useQuery(
    { titles: commonsTitles },
    { enabled: commonsTitles.length > 0, staleTime: IMAGE_STALE_MS }
  );
  const pageImageQueries = api.useQueries((t) =>
    ixwikiTitles.map((title) =>
      t.wikios.getPageImages({ title, wiki: "ixwiki" }, { staleTime: IMAGE_STALE_MS })
    )
  );

  const iiwikiQuery = api.wikios.sisterFileInfo.useQuery(
    { wiki: "iiwiki", titles: iiwikiFileTitles },
    { enabled: iiwikiFileTitles.length > 0, staleTime: IMAGE_STALE_MS }
  );

  // Rebuilt each render (the query list is a fresh array every time); at most a stash's worth of images.
  const allStashImages: CommonsImage[] = [];
  const seenUrls = new Set<string>();
  const addImage = (img: Omit<CommonsImage, "pageid">) => {
    if (!img.url || seenUrls.has(img.url)) return;
    seenUrls.add(img.url);
    allStashImages.push({ ...img, pageid: allStashImages.length });
  };
  for (const img of commonsQuery.data ?? []) addImage(img);
  for (const query of pageImageQueries) {
    for (const img of query.data ?? []) {
      addImage({
        title: img.title,
        thumbUrl: img.thumbUrl || img.url,
        url: img.url,
        descriptionUrl: publicArticleUrl(img.title, "ixwiki"),
        width: img.width || 0,
        height: img.height || 0,
        mime: guessMime(img.title),
        description: "",
        artist: "",
        license: "",
      });
    }
  }

  const iiwikiFiles = iiwikiQuery.data?.files;
  for (const title of iiwikiFileTitles) {
    const match = iiwikiFiles?.[title];
    if (!match) continue;
    addImage({
      title: match.title,
      thumbUrl: match.thumbUrl || match.url,
      url: match.url,
      descriptionUrl: publicArticleUrl(match.title, "iiwiki"),
      width: match.width || 0,
      height: match.height || 0,
      mime: match.mime || guessMime(match.title),
      description: "",
      artist: "",
      license: "",
    });
  }

  const isLoadingImages =
    stashItemsQuery.isLoading ||
    commonsQuery.isLoading ||
    pageImageQueries.some((query) => query.isLoading) ||
    iiwikiQuery.isLoading;
  const hasImagesError =
    stashItemsQuery.isError ||
    commonsQuery.isError ||
    pageImageQueries.some((q) => q.isError) ||
    iiwikiQuery.isError;

  const retryImages = () => {
    if (stashItemsQuery.isError) void stashItemsQuery.refetch();
    if (commonsQuery.isError) void commonsQuery.refetch();
    for (const query of [...pageImageQueries, iiwikiQuery]) {
      if (query.isError) void query.refetch();
    }
  };

  const filteredStashes = useMemo(() => {
    const stashes = stashesQuery.data ?? [];
    if (!stashSearchQuery.trim()) return stashes;
    return stashes.filter((s) => s.name.toLowerCase().includes(stashSearchQuery.toLowerCase()));
  }, [stashesQuery.data, stashSearchQuery]);

  const filteredPageImages = stashSearchQuery.trim()
    ? allStashImages.filter((i) => i.title.toLowerCase().includes(stashSearchQuery.toLowerCase()))
    : allStashImages;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search and Navigation */}
      <div className="border-separator bg-surface border-b p-3">
        <div className="relative mb-2">
          <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            aria-label="Search stashes"
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
              onSelectImage(null);
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
            (stashesQuery.isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="text-label-secondary h-6 w-6 animate-spin" />
              </div>
            ) : stashesQuery.isError ? (
              <LoadError onRetry={() => void stashesQuery.refetch()} />
            ) : filteredStashes.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {filteredStashes.map((stash) => (
                  <button
                    key={stash.id}
                    type="button"
                    onClick={() => {
                      setSelectedStashId(stash.id);
                      setSelectedStashName(stash.name);
                      setSelectedStashColor(stash.color);
                      setStashViewMode("images");
                      setStashSearchQuery("");
                    }}
                    className="group border-separator rounded-row bg-surface hover:bg-fill-3 hover:border-separator flex cursor-pointer items-center justify-between border p-3 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 select-none active:scale-[0.98]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Folder className="h-5 w-5 shrink-0" style={{ color: stash.color }} />
                      <span className="block min-w-0">
                        <span className="text-label text-caption block truncate font-semibold">
                          {stash.name}
                        </span>
                        <span className="text-label-secondary text-caption block">
                          {stash.itemCount} items
                        </span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-label-secondary text-footnote py-12 text-center">
                No stashes found.
              </div>
            ))}

          {/* 2. Page images grid */}
          {stashViewMode === "images" &&
            (isLoadingImages ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="text-label-secondary h-6 w-6 animate-spin" />
              </div>
            ) : hasImagesError ? (
              <LoadError onRetry={retryImages} />
            ) : filteredPageImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {filteredPageImages.map((img) => {
                  const isSelected = selectedImageObj?.url === img.url;
                  const cleanTitle = img.title.replace(/^File:/, "").replace(/_/g, " ");

                  return (
                    <button
                      key={img.url}
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
                onSelectImage(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
