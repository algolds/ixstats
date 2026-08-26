/**
 * LoreImportDrawer Component
 *
 * Standard Facet Dialog for searching, previewing, and importing lore
 * from IxWiki, IIWiki, WikiOS, and LoreStash into the Card Designer.
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, OpenBook as BookOpen, Folder as FolderOpen, Check, Globe, BookStack as Library, Label as Tag, Coins, Page as FileText, SystemRestart as Loader2, Xmark as X } from "iconoir-react";
import { cn } from "~/lib/utils";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import type { CardDesignState } from "./types";
import type { LoreCategory } from "~/lib/cards/category-enums";
import type { CardRarity } from "@prisma/client";

interface LoreImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importedData: Partial<CardDesignState>) => void;
  initialSource?: "wikios" | "iiwiki" | "stash";
}

type LoreSource = "wikios" | "iiwiki" | "stash";

const SOURCE_CONFIGS: Record<
  LoreSource,
  { name: string; label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  wikios: {
    name: "WikiOS",
    label: "WikiOS / IxWiki",
    icon: Globe,
  },
  iiwiki: {
    name: "IIWiki",
    label: "IIWiki Lore",
    icon: Library,
  },
  stash: {
    name: "My Stash",
    label: "Saved Stashes",
    icon: FolderOpen,
  },
};

export function LoreImportDrawer({
  isOpen,
  onClose,
  onImport,
  initialSource = "wikios",
}: LoreImportDrawerProps) {
  const [source, setSource] = useState<LoreSource>(
    initialSource === ("ixwiki" as any) ? "wikios" : initialSource
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedStashId, setSelectedStashId] = useState<string | undefined>(undefined);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    title: string;
    pageSlug: string;
    snippet: string;
    stashName?: string;
    imageUrl?: string | null;
  } | null>(null);

  // Sync initial source
  useEffect(() => {
    if (initialSource) {
      // oxlint-disable-next-line
      setSource(initialSource);
    }
  }, [initialSource]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => clearTimeout(handler);
  }, [query]);

  // Query search results via public procedure
  const {
    data: searchResults,
    isLoading: isSearching,
    isError: isSearchError,
  } = api.loreCards.searchLoreArchive.useQuery(
    {
      source,
      query: debouncedQuery,
      stashId: selectedStashId,
    },
    {
      enabled: isOpen,
      staleTime: 15_000,
    }
  );

  // Fetch full metadata when an item is selected
  const { data: metadata, isLoading: isLoadingMeta } = api.loreCards.fetchLoreMetadata.useQuery(
    {
      source,
      pageTitle: selectedItem?.title ?? "",
      stashItemId: source === "stash" ? selectedItem?.id : undefined,
    },
    {
      enabled: Boolean(selectedItem?.title),
      staleTime: 30_000,
    }
  );

  const activeItems = useMemo(() => searchResults?.items || [], [searchResults?.items]);
  const activeMetadata = metadata;

  // Auto-select first result whenever search results change
  useEffect(() => {
    if (activeItems && activeItems.length > 0) {
      // oxlint-disable-next-line
      setSelectedItem((curr) => {
        const exists = curr && activeItems.some((i) => i.title === curr.title || i.id === curr.id);
        return exists ? curr : activeItems[0] || null;
      });
    } else if (!isSearching) {
      setSelectedItem(null);
    }
  }, [activeItems, isSearching]);

  const handleApplyImport = (fullImport: boolean = true) => {
    const targetMeta = activeMetadata || metadata;
    if (!selectedItem && !targetMeta) return;

    const title = targetMeta?.title || selectedItem?.title || "Imported Lore Card";
    const excerpt = targetMeta?.excerpt || targetMeta?.description || selectedItem?.snippet || "";
    const subcategory = targetMeta?.subcategory || selectedItem?.stashName || "Lore Archive";

    const importPayload: Partial<CardDesignState> = {
      title,
      wikiSource: source,
      wikiArticleTitle: title,
      wikiExcerpt: excerpt,
      description: excerpt,
      subcategory,
    };

    if (fullImport && targetMeta) {
      importPayload.category = targetMeta.category as LoreCategory;
      importPayload.rarity = targetMeta.rarity as CardRarity;
      importPayload.marketValue = targetMeta.marketValue;
    }

    if (targetMeta?.imageUrl) {
      importPayload.artworkUrl = targetMeta.imageUrl;
      importPayload.artworkSource = "WIKI_FETCHED";
      importPayload.enableArtwork = true;
    }

    onImport(importPayload);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border bg-background flex h-[85vh] max-h-[750px] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-border bg-card/50 border-b p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary rounded-lg p-2">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">LoreScanner</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Search articles from WikiOS, IIWiki, or your saved Stashes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Source Tabs */}
        <div className="border-border bg-muted/30 border-b p-3">
          <Tabs
            value={source}
            onValueChange={(val) => {
              setSource(val as LoreSource);
              setSelectedItem(null);
            }}
          >
            <TabsList className="bg-muted/60 grid h-9 w-full grid-cols-4 rounded-lg p-1">
              {(Object.keys(SOURCE_CONFIGS) as LoreSource[]).map((key) => {
                const cfg = SOURCE_CONFIGS[key];
                const Icon = cfg.icon;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="flex items-center justify-center gap-1.5 rounded-md text-xs font-medium"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{cfg.name}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="border-border bg-card/30 flex items-center gap-2 border-b p-3">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${SOURCE_CONFIGS[source].label.toLowerCase()}...`}
              className="h-9 pr-8 pl-9 text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Stash Folder Dropdown */}
          {source === "stash" && searchResults?.stashes && searchResults.stashes.length > 0 && (
            <Select
              value={selectedStashId || "all"}
              onValueChange={(v) => setSelectedStashId(v === "all" ? undefined : v)}
            >
              <SelectTrigger className="h-9 w-[180px] text-xs">
                <SelectValue placeholder="All Stashes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stash Folders</SelectItem>
                {searchResults.stashes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Split Body: Left List (40%), Right Inspector (60%) */}
        <div className="divide-border grid min-h-0 flex-1 grid-cols-1 divide-y overflow-hidden md:grid-cols-12 md:divide-x md:divide-y-0">
          {/* Left Column: Search Results List */}
          <div className="flex h-full flex-col space-y-1 overflow-y-auto p-2 md:col-span-5">
            {isSearching ? (
              <div className="text-muted-foreground flex h-48 flex-col items-center justify-center gap-2 text-xs">
                <Loader2 className="text-primary h-5 w-5 animate-spin" />
                <span>Searching {SOURCE_CONFIGS[source].name}...</span>
              </div>
            ) : isSearchError ? (
              <div className="text-destructive flex h-48 flex-col items-center justify-center p-4 text-center text-xs">
                <p>Failed to search {SOURCE_CONFIGS[source].name}.</p>
                <p className="text-muted-foreground mt-1 text-[11px]">Please try again.</p>
              </div>
            ) : !searchResults?.items || searchResults.items.length === 0 ? (
              <div className="text-muted-foreground flex h-48 flex-col items-center justify-center p-4 text-center text-xs">
                <BookOpen className="mb-2 h-6 w-6 opacity-30" />
                <p>No results found for &quot;{debouncedQuery}&quot;</p>
                <p className="text-muted-foreground/70 mt-1 text-[11px]">Try another keyword.</p>
              </div>
            ) : (
              searchResults.items.map((item, idx) => {
                const isSelected =
                  selectedItem?.id === item.id || selectedItem?.title === item.title;
                const itemImg = (item as any).imageUrl as string | null | undefined;
                return (
                  <button
                    key={`${item.id}-${idx}`}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                      isSelected
                        ? "bg-accent border-accent text-accent-foreground shadow-xs"
                        : "hover:bg-muted/60 text-foreground border-transparent"
                    )}
                  >
                    {/* Search Entry Thumbnail */}
                    <div className="bg-muted border-border/80 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                      {itemImg ? (
                        <img
                          src={proxyCardArtwork(itemImg)}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <BookOpen className="text-muted-foreground/50 h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex w-full items-center justify-between gap-1.5">
                        <span className="truncate text-xs font-semibold">{item.title}</span>
                        {"stashName" in item && Boolean((item as any).stashName) && (
                          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                            {(item as any).stashName}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-relaxed">
                        {item.snippet}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Article Inspector */}
          <div className="bg-muted/10 flex h-full flex-col justify-between space-y-4 overflow-y-auto p-4 md:col-span-7">
            {selectedItem ? (
              <>
                <div className="space-y-3">
                  {/* Title & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-foreground text-base leading-tight font-semibold">
                        {selectedItem.title}
                      </h3>
                      <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                        <span>Source: {SOURCE_CONFIGS[source].name}</span>
                        {selectedItem.stashName && (
                          <>
                            <span>•</span>
                            <span>Folder: {selectedItem.stashName}</span>
                          </>
                        )}
                      </p>
                    </div>

                    {activeMetadata && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                          {activeMetadata.rarity}
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-medium">
                          {activeMetadata.category}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Metadata Chips */}
                  {activeMetadata && (
                    <div className="border-border bg-card grid grid-cols-3 gap-2 rounded-lg border p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Tag className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <div className="truncate">
                          <div className="text-muted-foreground text-[10px]">Category</div>
                          <div className="text-foreground truncate font-medium">
                            {activeMetadata.subcategory}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Coins className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <div>
                          <div className="text-muted-foreground text-[10px]">Catalog Value</div>
                          <div className="text-foreground flex items-center gap-1 font-mono font-medium">
                            <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                            {activeMetadata.marketValue.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <div>
                          <div className="text-muted-foreground text-[10px]">Artwork</div>
                          <div className="text-foreground font-medium">
                            {activeMetadata.hasImage ? "Wiki Image" : "Procedural"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wiki Image Preview Banner */}
                  {activeMetadata?.imageUrl && (
                    <div className="border-border bg-card flex items-center gap-3 rounded-lg border p-2.5">
                      <div className="bg-muted border-border relative h-14 w-14 shrink-0 overflow-hidden rounded-md border">
                        <img
                          src={proxyCardArtwork(activeMetadata.imageUrl)}
                          alt={activeMetadata.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                          <span>Wiki Article Image Detected</span>
                          <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                            Auto-Import
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]">
                          {activeMetadata.imageUrl}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Formatted Excerpt Preview */}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-muted-foreground text-xs font-medium">
                        Wikitext Excerpt
                      </label>
                      <span className="text-muted-foreground text-[10px]">MediaWiki Parser</span>
                    </div>

                    <div className="border-border bg-card text-foreground max-h-52 overflow-y-auto rounded-lg border p-3.5 text-xs leading-relaxed">
                      {isLoadingMeta && source !== "iiwiki" ? (
                        <div className="text-muted-foreground flex items-center justify-center gap-2 py-8">
                          <Loader2 className="text-primary h-4 w-4 animate-spin" />
                          <span>Fetching article wikitext...</span>
                        </div>
                      ) : (
                        <WikiHtmlContent
                          html={parseWikitextToHtml(
                            activeMetadata?.excerpt || selectedItem.snippet
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="border-border flex items-center justify-between gap-2 border-t pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApplyImport(false)}
                    className="text-muted-foreground text-xs"
                  >
                    Import Text Only
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApplyImport(true)}
                      className="gap-1.5 text-xs"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Import to Card
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-6 text-center text-xs">
                <BookOpen className="mb-2 h-8 w-8 opacity-30" />
                <p>Select an article from the list to preview.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
