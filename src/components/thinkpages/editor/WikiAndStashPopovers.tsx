"use client";

import { Sparkles, Bookmark, Loader2, Plus } from "lucide-react";
import { FaWikipediaW } from "react-icons/fa";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { EmojiPicker } from "../EmojiPicker";
import { cn } from "~/lib/utils";

export interface WikiAndStashPopoversProps {
  disabled?: boolean;
  isWikiOpen: boolean;
  setIsWikiOpen: (val: boolean) => void;
  wikiInsertMode: "link" | "embed";
  setWikiInsertMode: (mode: "link" | "embed") => void;
  wikiSource: "ixwiki" | "iiwiki";
  setWikiSource: (source: "ixwiki" | "iiwiki") => void;
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
                ? "bg-[#1d4e89]/15 text-[#1d4e89] dark:text-[#3b82f6] ring-1 ring-[#1d4e89]/30"
                : "text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1d4e89] dark:hover:text-[#3b82f6]"
            )}
            title="Insert Wiki Link or Embed"
            aria-label="Insert Wiki Link or Embed"
          >
            <FaWikipediaW className="h-3.5 w-3.5 text-[#1d4e89] dark:text-[#3b82f6]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50 w-80 space-y-3 rounded-2xl border border-black/10 dark:border-border bg-white/95 dark:bg-popover/98 p-3.5 text-foreground shadow-2xl backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        >
          <div className="flex items-center justify-between border-b border-black/5 dark:border-border/60 pb-2.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <FaWikipediaW className="h-3.5 w-3.5 text-[#1d4e89] dark:text-[#3b82f6]" />
              Wiki Link / Embed
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => setWikiInsertMode("link")}
                className={cn(
                  "rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all active:scale-95",
                  wikiInsertMode === "link"
                    ? "bg-[#1d4e89] text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Inline Link
              </button>
              <button
                type="button"
                onClick={() => setWikiInsertMode("embed")}
                className={cn(
                  "rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all active:scale-95",
                  wikiInsertMode === "embed"
                    ? "bg-[#1d4e89] text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Card Embed
              </button>
            </div>
          </div>

          {/* Source Picker */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWikiSource("ixwiki")}
              className={cn(
                "flex-1 rounded-xl border py-1.5 text-center text-xs font-bold transition-all active:scale-[0.98]",
                wikiSource === "ixwiki"
                  ? "border-[#1d4e89] bg-[#1d4e89] text-white shadow-sm"
                  : "border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              IxWiki
            </button>
            <button
              type="button"
              onClick={() => setWikiSource("iiwiki")}
              className={cn(
                "flex-1 rounded-xl border py-1.5 text-center text-xs font-bold transition-all active:scale-[0.98]",
                wikiSource === "iiwiki"
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              IIWiki
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Article Title
            </Label>
            <Input
              value={wikiTarget}
              onChange={(e) => setWikiTarget(e.target.value)}
              placeholder="e.g. Empire of Ixnay"
              className="h-8.5 rounded-xl border-black/10 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.04] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-[#1d4e89]/50"
            />
          </div>

          {wikiInsertMode === "link" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Display Text (Optional)
              </Label>
              <Input
                value={wikiLabel}
                onChange={(e) => setWikiLabel(e.target.value)}
                placeholder="Defaults to article title"
                className="h-8.5 rounded-xl border-black/10 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.04] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-[#1d4e89]/50"
              />
            </div>
          )}

          <Button
            size="sm"
            onClick={insertWikiLink}
            disabled={!wikiTarget.trim()}
            className="w-full h-8.5 rounded-xl bg-[#1d4e89] hover:bg-[#184275] active:scale-[0.98] text-xs font-bold text-white transition-all shadow-md"
          >
            {wikiInsertMode === "embed" ? "Insert Card Embed" : "Insert Wiki Link"}
          </Button>
        </PopoverContent>
      </Popover>

      {/* Stash Assets Popover */}
      <Popover open={isStashesOpen} onOpenChange={setIsStashesOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-7 w-7 rounded-xl p-0 transition-all duration-150 active:scale-95",
              isStashesOpen
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/40"
                : "text-amber-500 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-300"
            )}
            title="Insert Stashed Assets"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={8}
          className="z-50 w-80 space-y-3 rounded-2xl border border-black/10 dark:border-border bg-white/95 dark:bg-popover/98 p-3.5 text-foreground shadow-2xl backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        >
          <div className="flex items-center justify-between border-b border-black/5 dark:border-border/60 pb-2.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              Insert Stash Assets
            </span>
          </div>

          {/* Folder Switcher */}
          {stashes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Select Folder
              </label>
              <div className="thin-scrollbar grid max-h-24 grid-cols-2 gap-1 overflow-y-auto">
                {stashes.map((stash) => (
                  <button
                    key={stash.id}
                    onClick={() => setSelectedStashId(stash.id)}
                    className={cn(
                      "truncate rounded-xl border px-2 py-1 text-left text-[11px] font-medium transition-all active:scale-95",
                      activeStashId === stash.id
                        ? "border-blue-500/40 bg-blue-500/20 text-blue-600 dark:text-blue-300 font-bold shadow-sm"
                        : "border-black/5 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    📁 {stash.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stash items grid */}
          <div className="thin-scrollbar max-h-52 overflow-y-auto pr-1">
            {stashesQuery.isLoading || stashItemsQuery.isLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500 dark:text-blue-400" />
              </div>
            ) : imageItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5">
                {imageItems.map((item) => {
                  const cleanTitle = item.pageTitle.replace(/^commons:/, "");
                  const info = resolvedImages[cleanTitle];
                  const url = info?.url;

                  if (!url) return null;

                  return (
                    <div
                      key={item.id}
                      onClick={() => insertStashedImage(url, cleanTitle)}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/40 transition-all duration-200 hover:border-blue-500 active:scale-95"
                      title={cleanTitle}
                    >
                      <img
                        src={url}
                        alt={cleanTitle}
                        className="h-full w-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Plus className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 font-medium">
                {activeStashId
                  ? "No stashed Commons images in this folder."
                  : "Please create or select a folder."}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Emoji Picker */}
      <div className="mx-0.5 h-4 w-px bg-black/10 dark:bg-white/10" />
      <EmojiPicker
        onSelectEmoji={handleSelectEmoji}
        disabled={disabled}
        onOpenChange={setIsEmojiOpen}
        side="bottom"
      />
    </div>
  );
}
