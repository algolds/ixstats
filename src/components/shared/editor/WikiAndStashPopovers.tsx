"use client";
// src/components/shared/editor/WikiAndStashPopovers.tsx
// Search and insertion popovers for MediaWiki articles and Lore Stash assets.

import { Sparks as Sparkles, Bookmark, SystemRestart as Loader2, Plus } from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { EmojiPicker } from "~/components/thinkpages/EmojiPicker";
import { cn } from "~/lib/utils";

export interface WikiAndStashPopoversProps {
  disabled?: boolean;
  isWikiOpen: boolean;
  setIsWikiOpen: (val: boolean) => void;
  wikiInsertMode: "link" | "embed";
  setWikiInsertMode: (mode: "link" | "embed") => void;
  wikiSource: "ixwiki" | "iiwiki" | "althistory";
  setWikiSource: (source: "ixwiki" | "iiwiki" | "althistory") => void;
  wikiTarget: string;
  setWikiTarget: (target: string) => void;
  wikiLabel: string;
  setWikiLabel: (label: string) => void;
  wikiSearchResults: any[];
  isSearchingWiki: boolean;
  wikiIntroQuery: any;
  wikiImagesQuery: any;
  selectedWikiImageUrl: string;
  setSelectedWikiImageUrl: (url: string) => void;
  insertWikiLink: () => void;

  isStashesOpen: boolean;
  setIsStashesOpen: (val: boolean) => void;
  stashes: any[];
  activeStashId: string;
  setSelectedStashId: (id: string) => void;
  stashesQuery: any;
  stashItemsQuery: any;
  imageItems: any[];
  resolvedImages: Record<string, any>;
  insertStashedImage: (url: string, title: string) => void;

  handleSelectEmoji: (emoji: string) => void;
  setIsEmojiOpen: (val: boolean) => void;
}

export function WikiAndStashPopovers({
  disabled,
  isWikiOpen,
  setIsWikiOpen,
  wikiInsertMode,
  setWikiInsertMode,
  wikiSource,
  setWikiSource,
  wikiTarget,
  setWikiTarget,
  wikiLabel,
  setWikiLabel,
  wikiSearchResults,
  isSearchingWiki,
  wikiIntroQuery,
  wikiImagesQuery,
  selectedWikiImageUrl,
  setSelectedWikiImageUrl,
  insertWikiLink,
  isStashesOpen,
  setIsStashesOpen,
  stashes,
  activeStashId,
  setSelectedStashId,
  stashesQuery,
  stashItemsQuery,
  imageItems,
  resolvedImages,
  insertStashedImage,
  handleSelectEmoji,
  setIsEmojiOpen,
}: WikiAndStashPopoversProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Wiki Popover */}
      <Popover open={isWikiOpen} onOpenChange={setIsWikiOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-7 w-7 rounded-xl p-0 transition-all duration-150 active:scale-95",
              isWikiOpen
                ? "bg-wiki/15 text-wiki ring-wiki/30 ring-1 dark:text-blue-400"
                : "text-muted-foreground hover:bg-muted hover:text-wiki dark:hover:text-blue-400"
            )}
            title="Insert Wiki Link or Embed"
            aria-label="Insert Wiki Link or Embed"
          >
            <WikiOSLogomark className="text-wiki h-3.5 w-3.5 dark:text-blue-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="dark:border-border dark:bg-popover/95 z-[200000] w-80 rounded-2xl border border-neutral-200/80 bg-white/95 p-3 shadow-2xl backdrop-blur-xl"
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-semibold text-purple-400">Wiki Integration</span>
              <div className="flex rounded-md bg-neutral-100 p-0.5 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setWikiInsertMode("link")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-semibold transition-all",
                    wikiInsertMode === "link"
                      ? "bg-white text-purple-600 shadow-xs dark:bg-purple-600 dark:text-white"
                      : "text-neutral-500 hover:text-neutral-800 dark:text-slate-400"
                  )}
                >
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => setWikiInsertMode("embed")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-semibold transition-all",
                    wikiInsertMode === "embed"
                      ? "bg-white text-purple-600 shadow-xs dark:bg-purple-600 dark:text-white"
                      : "text-neutral-500 hover:text-neutral-800 dark:text-slate-400"
                  )}
                >
                  Embed Card
                </button>
              </div>
            </div>

            {/* Source selector */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setWikiSource("ixwiki")}
                className={cn(
                  "flex-1 rounded-lg border py-1 text-center text-[10px] font-medium transition-all",
                  wikiSource === "ixwiki"
                    ? "border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-300"
                    : "border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-white/5 dark:text-slate-400 dark:hover:bg-white/5"
                )}
              >
                IxWiki
              </button>
              <button
                type="button"
                onClick={() => setWikiSource("iiwiki")}
                className={cn(
                  "flex-1 rounded-lg border py-1 text-center text-[10px] font-medium transition-all",
                  wikiSource === "iiwiki"
                    ? "border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-300"
                    : "border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-white/5 dark:text-slate-400 dark:hover:bg-white/5"
                )}
              >
                IIWiki
              </button>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-neutral-500 dark:text-slate-400">
                Article Title or Search
              </Label>
              <Input
                value={wikiTarget}
                onChange={(e) => setWikiTarget(e.target.value)}
                placeholder="Search articles..."
                className="h-7 text-xs"
              />
              {isSearchingWiki && (
                <div className="flex items-center gap-1.5 py-1 text-[10px] text-neutral-400">
                  <Loader2 className="h-3 w-3 animate-spin text-purple-500" /> Searching wiki...
                </div>
              )}
              {wikiSearchResults.length > 0 && (
                <div className="max-h-24 overflow-y-auto rounded-lg border border-neutral-200/60 bg-neutral-50/50 p-1 dark:border-white/5 dark:bg-white/5">
                  {wikiSearchResults.map((res: any) => (
                    <button
                      key={res.title}
                      type="button"
                      onClick={() => setWikiTarget(res.title)}
                      className="w-full truncate rounded px-1.5 py-1 text-left text-[11px] hover:bg-neutral-200/50 dark:hover:bg-white/10"
                    >
                      {res.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {wikiInsertMode === "link" && (
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-neutral-500 dark:text-slate-400">
                  Link Text (Optional)
                </Label>
                <Input
                  value={wikiLabel}
                  onChange={(e) => setWikiLabel(e.target.value)}
                  placeholder={wikiTarget || "Defaults to article title"}
                  className="h-7 text-xs"
                />
              </div>
            )}

            {wikiInsertMode === "embed" && (
              <div className="space-y-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-2">
                <div className="flex items-center gap-1 text-[10px] font-medium text-purple-400">
                  <Sparkles className="h-3 w-3" /> Live Embed Preview
                </div>
                {wikiIntroQuery.isLoading ? (
                  <div className="py-2 text-center text-[10px] text-neutral-400">
                    Loading article preview...
                  </div>
                ) : wikiIntroQuery.data ? (
                  <div className="space-y-1.5">
                    <p className="line-clamp-2 text-[10px] text-neutral-600 dark:text-slate-300">
                      {wikiIntroQuery.data.extract || "No intro text available."}
                    </p>
                    {wikiImagesQuery.data?.images && wikiImagesQuery.data.images.length > 0 && (
                      <div className="flex gap-1 overflow-x-auto py-1">
                        {wikiImagesQuery.data.images.slice(0, 4).map((img: string) => (
                          <img
                            key={img}
                            src={img}
                            alt=""
                            onClick={() =>
                              setSelectedWikiImageUrl(img === selectedWikiImageUrl ? "" : img)
                            }
                            className={cn(
                              "h-10 w-10 cursor-pointer rounded border object-cover transition-all",
                              selectedWikiImageUrl === img
                                ? "border-purple-500 ring-2 ring-purple-500/50"
                                : "border-transparent opacity-60 hover:opacity-100"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-neutral-400">Type an exact title to preview.</p>
                )}
              </div>
            )}

            <Button
              size="sm"
              onClick={insertWikiLink}
              disabled={!wikiTarget.trim()}
              className="h-7 w-full bg-purple-600 text-xs font-semibold text-white hover:bg-purple-500"
            >
              <Plus className="mr-1 h-3 w-3" /> Insert{" "}
              {wikiInsertMode === "embed" ? "Embed Card" : "Link"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Lore Stash Popover */}
      <Popover open={isStashesOpen} onOpenChange={setIsStashesOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-7 w-7 rounded-xl p-0 transition-all duration-150 active:scale-95",
              isStashesOpen
                ? "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30"
                : "text-muted-foreground hover:bg-muted hover:text-amber-500"
            )}
            title="Attach Lore Stash Media"
            aria-label="Attach Lore Stash Media"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="dark:border-border dark:bg-popover/95 z-[200000] w-80 rounded-2xl border border-neutral-200/80 bg-white/95 p-3 shadow-2xl backdrop-blur-xl"
        >
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="flex items-center gap-1.5 font-semibold text-amber-500">
                <Bookmark className="h-3.5 w-3.5" /> Lore Stash Explorer
              </span>
              {stashes.length > 1 && (
                <select
                  value={activeStashId}
                  onChange={(e) => setSelectedStashId(e.target.value)}
                  className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
                >
                  {stashes.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.itemCount})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {stashesQuery.isLoading || stashItemsQuery.isLoading ? (
              <div className="flex items-center justify-center py-6 text-neutral-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-amber-500" />
                <span>Loading stash media...</span>
              </div>
            ) : imageItems.length === 0 ? (
              <div className="py-6 text-center text-neutral-400 dark:text-zinc-500">
                <p className="font-medium">No images in this stash.</p>
                <p className="mt-1 text-[10px]">Stash commons images from the repository first.</p>
              </div>
            ) : (
              <div className="thin-scrollbar grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto p-0.5">
                {imageItems.map((item: any) => {
                  const cleanTitle = item.pageTitle.replace(/^commons:/, "");
                  const imgInfo = resolvedImages[item.pageTitle];
                  const thumb = imgInfo?.thumbUrl || imgInfo?.url;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (thumb) {
                          insertStashedImage(thumb, cleanTitle);
                          setIsStashesOpen(false);
                        }
                      }}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-neutral-200/50 bg-neutral-100 dark:border-white/5 dark:bg-white/5"
                      title={cleanTitle}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={cleanTitle}
                          className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent p-1 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {cleanTitle}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Emoji Picker Integration */}
      <EmojiPicker
        onSelectEmoji={(emoji) => handleSelectEmoji(emoji)}
        onOpenChange={(open) => setIsEmojiOpen(open)}
        disabled={disabled}
      />
    </div>
  );
}
