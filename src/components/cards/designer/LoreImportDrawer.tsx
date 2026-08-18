/**
 * LoreImportDrawer Component
 *
 * Standard Facet Dialog for searching, previewing, and importing lore
 * from IxWiki, IIWiki, WikiOS, and LoreStash into the Card Designer.
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  BookOpen,
  FolderOpen,
  Check,
  Globe,
  Library,
  Tag,
  Coins,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
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
import { parseWikitextToHtml } from "~/lib/wiki/wikitext-parser";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";
import { proxyCardArtwork } from "~/lib/cards";
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
      <DialogContent className="max-w-4xl h-[85vh] max-h-[750px] flex flex-col p-0 gap-0 overflow-hidden border-border bg-background">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">LoreScanner</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Search articles from WikiOS, IIWiki, or your saved Stashes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Source Tabs */}
        <div className="p-3 border-b border-border bg-muted/30">
          <Tabs
            value={source}
            onValueChange={(val) => {
              setSource(val as LoreSource);
              setSelectedItem(null);
            }}
          >
            <TabsList className="grid grid-cols-4 w-full h-9 bg-muted/60 p-1 rounded-lg">
              {(Object.keys(SOURCE_CONFIGS) as LoreSource[]).map((key) => {
                const cfg = SOURCE_CONFIGS[key];
                const Icon = cfg.icon;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium rounded-md"
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
        <div className="flex items-center gap-2 p-3 border-b border-border bg-card/30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${SOURCE_CONFIGS[source].label.toLowerCase()}...`}
              className="pl-9 pr-8 h-9 text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              <SelectTrigger className="w-[180px] h-9 text-xs">
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
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
          {/* Left Column: Search Results List */}
          <div className="md:col-span-5 flex flex-col h-full overflow-y-auto p-2 space-y-1">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Searching {SOURCE_CONFIGS[source].name}...</span>
              </div>
            ) : isSearchError ? (
              <div className="flex flex-col items-center justify-center h-48 text-destructive text-xs text-center p-4">
                <p>Failed to search {SOURCE_CONFIGS[source].name}.</p>
                <p className="text-muted-foreground text-[11px] mt-1">Please try again.</p>
              </div>
            ) : !searchResults?.items || searchResults.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs text-center p-4">
                <BookOpen className="h-6 w-6 mb-2 opacity-30" />
                <p>No results found for &quot;{debouncedQuery}&quot;</p>
                <p className="text-muted-foreground/70 text-[11px] mt-1">Try another keyword.</p>
              </div>
            ) : (
              searchResults.items.map((item, idx) => {
                const isSelected = selectedItem?.id === item.id || selectedItem?.title === item.title;
                const itemImg = (item as any).imageUrl as string | null | undefined;
                return (
                  <button
                    key={`${item.id}-${idx}`}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className={cn(
                      "flex items-start text-left p-2.5 rounded-lg border transition-colors gap-2.5 w-full",
                      isSelected
                        ? "bg-accent border-accent text-accent-foreground shadow-xs"
                        : "border-transparent hover:bg-muted/60 text-foreground"
                    )}
                  >
                    {/* Search Entry Thumbnail */}
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/80">
                      {itemImg ? (
                        <img
                          src={proxyCardArtwork(itemImg)}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <BookOpen className="w-4 h-4 text-muted-foreground/50" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between w-full gap-1.5">
                        <span className="text-xs font-semibold truncate">{item.title}</span>
                        {"stashName" in item && Boolean((item as any).stashName) && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            {(item as any).stashName}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">
                        {item.snippet}
                      </p>
                    </div>
                  </button>
                );
              })

            )}
          </div>

          {/* Right Column: Article Inspector */}
          <div className="md:col-span-7 flex flex-col justify-between h-full overflow-y-auto p-4 space-y-4 bg-muted/10">
            {selectedItem ? (
              <>
                <div className="space-y-3">
                  {/* Title & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-foreground leading-tight">
                        {selectedItem.title}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
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
                      <div className="flex items-center gap-1.5 shrink-0">
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
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border border-border bg-card text-xs">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="truncate">
                          <div className="text-[10px] text-muted-foreground">Category</div>
                          <div className="font-medium text-foreground truncate">
                            {activeMetadata.subcategory}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Coins className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <div className="text-[10px] text-muted-foreground">Catalog Value</div>
                          <div className="font-mono font-medium text-foreground">
                            {activeMetadata.marketValue.toLocaleString()} IxC
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <div className="text-[10px] text-muted-foreground">Artwork</div>
                          <div className="font-medium text-foreground">
                            {activeMetadata.hasImage ? "Wiki Image" : "Procedural"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wiki Image Preview Banner */}
                  {activeMetadata?.imageUrl && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card">
                      <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0 border border-border">
                        <img
                          src={proxyCardArtwork(activeMetadata.imageUrl)}
                          alt={activeMetadata.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <span>Wiki Article Image Detected</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            Auto-Import
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono">
                          {activeMetadata.imageUrl}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Formatted Excerpt Preview */}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Wikitext Excerpt
                      </label>
                      <span className="text-[10px] text-muted-foreground">MediaWiki Parser</span>
                    </div>

                    <div className="p-3.5 rounded-lg border border-border bg-card text-xs text-foreground leading-relaxed max-h-52 overflow-y-auto">
                      {isLoadingMeta && source !== "iiwiki" ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Fetching article wikitext...</span>
                        </div>
                      ) : (
                        <WikiHtmlContent
                          html={parseWikitextToHtml(activeMetadata?.excerpt || selectedItem.snippet)}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApplyImport(false)}
                    className="text-xs text-muted-foreground"
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
                      className="text-xs gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Import to Card
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs text-center p-6">
                <BookOpen className="h-8 w-8 mb-2 opacity-30" />
                <p>Select an article from the list to preview.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
