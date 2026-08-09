"use client";

import { Sparkles, Bookmark, Loader2, Plus, Globe } from "lucide-react";
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
              "h-7 rounded-lg px-2 text-xs font-semibold transition-all duration-200",
              isWikiOpen
                ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                : "text-slate-400 hover:bg-white/10 hover:text-white"
            )}
            title="Insert Wiki Link or Embed"
          >
            <Globe className="mr-1 h-3.5 w-3.5 text-purple-400" />
            Wiki
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50 w-80 space-y-3 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Globe className="h-3.5 w-3.5 text-purple-400" />
              Wiki Link / Embed
            </span>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => setWikiInsertMode("link")}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-bold transition-all",
                  wikiInsertMode === "link"
                    ? "bg-purple-600 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Inline Link
              </button>
              <button
                type="button"
                onClick={() => setWikiInsertMode("embed")}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-bold transition-all",
                  wikiInsertMode === "embed"
                    ? "bg-purple-600 text-white"
                    : "text-slate-400 hover:text-white"
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
                "flex-1 rounded-lg border py-1 text-center text-xs font-semibold transition-all",
                wikiSource === "ixwiki"
                  ? "border-purple-500/50 bg-purple-500/20 text-purple-300"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
              )}
            >
              IxWiki
            </button>
            <button
              type="button"
              onClick={() => setWikiSource("iiwiki")}
              className={cn(
                "flex-1 rounded-lg border py-1 text-center text-xs font-semibold transition-all",
                wikiSource === "iiwiki"
                  ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
              )}
            >
              IIWiki
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Article Title
            </Label>
            <Input
              value={wikiTarget}
              onChange={(e) => setWikiTarget(e.target.value)}
              placeholder="e.g. Empire of Ixnay"
              className="h-8 border-white/10 bg-black/40 text-xs text-white placeholder:text-slate-500"
            />
          </div>

          {wikiInsertMode === "link" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Display Text (Optional)
              </Label>
              <Input
                value={wikiLabel}
                onChange={(e) => setWikiLabel(e.target.value)}
                placeholder="Defaults to article title"
                className="h-8 border-white/10 bg-black/40 text-xs text-white placeholder:text-slate-500"
              />
            </div>
          )}

          <Button
            size="sm"
            onClick={insertWikiLink}
            disabled={!wikiTarget.trim()}
            className="w-full bg-purple-600 text-xs font-bold text-white hover:bg-purple-500"
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
              "h-7 w-7 rounded-full p-0 transition-all duration-200",
              isStashesOpen
                ? "bg-amber-500/30 text-amber-300 ring-1 ring-amber-500/40"
                : "text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
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
          className="z-50 w-80 space-y-3 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Insert Stash Assets
            </span>
          </div>

          {/* Folder Switcher */}
          {stashes.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Select Folder
              </label>
              <div className="thin-scrollbar grid max-h-24 grid-cols-2 gap-1 overflow-y-auto">
                {stashes.map((stash) => (
                  <button
                    key={stash.id}
                    onClick={() => setSelectedStashId(stash.id)}
                    className={cn(
                      "truncate rounded-md border px-2 py-1 text-left text-[11px] transition-colors",
                      activeStashId === stash.id
                        ? "border-blue-500/40 bg-blue-500/20 text-blue-300 font-bold"
                        : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
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
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
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
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-black/40 transition-all duration-200 hover:border-blue-500"
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
              <div className="py-6 text-center text-xs text-slate-500">
                {activeStashId
                  ? "No stashed Commons images in this folder."
                  : "Please create or select a folder."}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Emoji Picker */}
      <div className="mx-0.5 h-4 w-px bg-white/10" />
      <EmojiPicker
        onSelectEmoji={handleSelectEmoji}
        disabled={disabled}
        onOpenChange={setIsEmojiOpen}
        side="bottom"
      />
    </div>
  );
}
