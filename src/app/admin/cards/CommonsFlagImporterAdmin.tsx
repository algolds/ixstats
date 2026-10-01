"use client";
// src/app/admin/cards/CommonsFlagImporterAdmin.tsx

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Globe,
  Download,
  SystemRestart as Loader2,
  CheckCircle as CheckCircle2,
  Search,
  OpenNewWindow as ExternalLink,
  CheckSquare,
  Square,
  ArrowRight,
  WarningCircle as AlertCircle,
  Refresh as RefreshCw,
  Check,
} from "iconoir-react";
import type { CardRarity } from "@prisma/client";
import { fieldStyles } from "~/components/ui/input";
import { cn } from "~/lib/utils";

function cleanCategoryTitle(input: string): string {
  let cleaned = input.trim();
  if (cleaned.includes("/wiki/")) {
    cleaned = cleaned.split("/wiki/").pop() || cleaned;
  }
  cleaned = decodeURIComponent(cleaned).replace(/\s+/g, "_");
  if (!cleaned.toLowerCase().startsWith("category:")) {
    cleaned = `Category:${cleaned}`;
  }
  return cleaned;
}

export function CommonsFlagImporterAdmin() {
  const notify = useNotify();

  const [categoryInput, setCategoryInput] = useState<string>(
    "https://commons.wikimedia.org/wiki/Category:SVG_flags_of_fictional_countries"
  );
  const [activeCategory, setActiveCategory] = useState<string>(
    "Category:SVG_flags_of_fictional_countries"
  );
  const [defaultRarity, setDefaultRarity] = useState<CardRarity>("COMMON");
  const [season, setSeason] = useState<number>(1);
  const [selectedItemUrls, setSelectedItemUrls] = useState<Set<string>>(new Set());

  const utils = api.useUtils();

  // Query category members via tRPC
  const commonsQuery = api.cards.fetchCommonsCategoryMembers.useQuery(
    { category: activeCategory, limit: 100 },
    { enabled: Boolean(activeCategory), refetchOnWindowFocus: false }
  );

  // Mutation to import
  const importMutation = api.cards.importCommonsFlags.useMutation({
    onSuccess: (data) => {
      notify.success("Flags Imported", data.message || `Imported ${data.imported} flag(s).`);
      setSelectedItemUrls(new Set());
      void commonsQuery.refetch();
      void utils.cards.getNSCards.invalidate();
      void utils.cards.getMyCards.invalidate();
    },
    onError: (err) => {
      notify.error("Import Error", err.message);
    },
  });

  const items = commonsQuery.data?.items ?? [];
  const unmintedItems = items.filter((i) => !i.isAlreadyImported);
  const mintedCount = items.filter((i) => i.isAlreadyImported).length;

  const handleParseCategory = () => {
    if (!categoryInput.trim()) {
      notify.error("Category Required", "Please enter a Wikimedia Commons category URL or title.");
      return;
    }
    const cleaned = cleanCategoryTitle(categoryInput);
    setActiveCategory(cleaned);
    setSelectedItemUrls(new Set());
  };

  const handleToggleSelectAll = () => {
    // If all unminted items are already selected, clear selection; else select all unminted items
    const unmintedUrls = unmintedItems.map((i) => i.fileUrl);
    const allUnmintedSelected =
      unmintedUrls.length > 0 && unmintedUrls.every((url) => selectedItemUrls.has(url));

    if (allUnmintedSelected) {
      setSelectedItemUrls(new Set());
    } else {
      setSelectedItemUrls(new Set(unmintedUrls));
    }
  };

  const handleToggleItem = (url: string) => {
    const next = new Set(selectedItemUrls);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    setSelectedItemUrls(next);
  };

  const handleImportSelected = (
    itemsToImport = items.filter((i) => selectedItemUrls.has(i.fileUrl))
  ) => {
    if (itemsToImport.length === 0) {
      notify.info("No Flags Selected", "Select at least one unminted flag image to import.");
      return;
    }

    importMutation.mutate({
      items: itemsToImport.map((i) => ({
        cleanTitle: i.cleanTitle,
        fileUrl: i.fileUrl,
        category: i.category,
        descriptionUrl: i.descriptionUrl,
      })),
      defaultRarity,
      season,
    });
  };

  const handleImportAll = () => {
    if (unmintedItems.length === 0) {
      notify.info("All Flags Minted", "All flag images in this category are already minted.");
      return;
    }
    handleImportSelected(unmintedItems);
  };

  return (
    <FacetCard className="space-y-6 p-6">
      {/* Header */}
      <div className="border-separator flex flex-col gap-2 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-row border-teal/30 bg-teal/10 border p-2.5">
            <Globe className="text-teal h-5 w-5" />
          </div>
          <div>
            <h2 className="text-label text-title-2 flex items-center gap-2">
              Wikimedia Commons Flag & Image Importer
            </h2>
            <p className="text-label-secondary text-caption">
              Parse any Wikimedia Commons Category URL or title, resolve vector/raster flag images,
              and batch-mint them into IxCards.
            </p>
          </div>
        </div>
      </div>

      {/* Category URL/Title Parser Control Panel */}
      <FacetCard className="space-y-4 p-4">
        <div className="space-y-3">
          <label className="text-label text-caption block">
            Wikimedia Commons Category URL or Category Title
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleParseCategory();
                }}
                placeholder="https://commons.wikimedia.org/wiki/Category:SVG_flags_of_fictional_countries"
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) pr-3 pl-9 font-mono"
              />
            </div>
            <Button
              variant="tinted"
              onClick={handleParseCategory}
              disabled={commonsQuery.isFetching}
              className="h-10"
            >
              {commonsQuery.isFetching ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Parsing...
                </>
              ) : (
                <>
                  Parse Category <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {/* Quick Preset Shortcuts */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-label-secondary text-caption">Quick Categories:</span>
            <button
              onClick={() => {
                const url =
                  "https://commons.wikimedia.org/wiki/Category:SVG_flags_of_fictional_countries";
                setCategoryInput(url);
                setActiveCategory("Category:SVG_flags_of_fictional_countries");
                setSelectedItemUrls(new Set());
              }}
              className="border-separator bg-surface text-label hover:bg-fill-4 rounded-control text-caption border px-2.5 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              SVG flags of fictional countries
            </button>
            <button
              onClick={() => {
                const url =
                  "https://commons.wikimedia.org/wiki/Category:SVG_special_or_fictional_flags";
                setCategoryInput(url);
                setActiveCategory("Category:SVG_special_or_fictional_flags");
                setSelectedItemUrls(new Set());
              }}
              className="border-separator bg-surface text-label hover:bg-fill-4 rounded-control text-caption border px-2.5 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              SVG special or fictional flags
            </button>
          </div>
        </div>

        {/* Active Query Status Badge */}
        <div className="border-separator text-footnote flex items-center justify-between border-t pt-3">
          <span className="text-label-secondary font-medium">
            Active Query: <code className="text-teal tabular-nums">{activeCategory}</code>
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void commonsQuery.refetch()}
            disabled={commonsQuery.isFetching}
          >
            <RefreshCw
              className={`mr-1 h-3 w-3 ${commonsQuery.isFetching ? "animate-spin" : ""}`}
            />{" "}
            Reload
          </Button>
        </div>

        {/* Card Minting Parameters */}
        <div className="border-separator grid grid-cols-1 gap-3 border-t pt-2 sm:grid-cols-2">
          {/* Default Rarity */}
          <div>
            <label className="text-label-secondary text-caption mb-1 block">
              Target Card Rarity
            </label>
            <select
              value={defaultRarity}
              onChange={(e) => setDefaultRarity(e.target.value as CardRarity)}
              className={cn(
                fieldStyles,
                "rounded-control-sm text-footnote h-(--control-height-sm) w-full cursor-pointer px-2.5"
              )}
            >
              <option value="COMMON">Common</option>
              <option value="UNCOMMON">Uncommon</option>
              <option value="RARE">Rare</option>
              <option value="ULTRA_RARE">Ultra Rare</option>
              <option value="EPIC">Epic</option>
              <option value="LEGENDARY">Legendary</option>
            </select>
          </div>

          {/* Season */}
          <div>
            <label className="text-label-secondary text-caption mb-1 block">
              Target Card Season
            </label>
            <select
              value={season}
              onChange={(e) => setSeason(parseInt(e.target.value, 10))}
              className={cn(
                fieldStyles,
                "rounded-control-sm text-footnote h-(--control-height-sm) w-full cursor-pointer px-2.5"
              )}
            >
              <option value={1}>Season 1</option>
              <option value={2}>Season 2</option>
              <option value={3}>Season 3</option>
            </select>
          </div>
        </div>
      </FacetCard>

      {/* Results Browser */}
      {commonsQuery.isLoading || commonsQuery.isFetching ? (
        <div className="border-separator rounded-row flex h-52 flex-col items-center justify-center space-y-2 border">
          <Loader2 className="text-teal h-7 w-7 animate-spin" />
          <p className="text-label-secondary text-caption">
            Fetching category members from Wikimedia Commons API...
          </p>
        </div>
      ) : commonsQuery.isError ? (
        <div className="rounded-card border-red/30 bg-red/10 flex flex-col items-center justify-center space-y-2 border p-6 text-center">
          <AlertCircle className="text-red h-8 w-8" />
          <p className="text-label text-headline">Failed to fetch Commons Category</p>
          <p className="text-footnote text-red max-w-md font-mono">{commonsQuery.error.message}</p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void commonsQuery.refetch()}
            className="mt-2"
          >
            Retry Category Fetch
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="border-separator rounded-row flex h-44 flex-col items-center justify-center space-y-2 border border-dashed">
          <Globe className="text-label-tertiary h-8 w-8" />
          <p className="text-label text-headline">No images found in this Commons category</p>
          <p className="text-label-secondary text-footnote max-w-md text-center">
            Make sure the Commons URL or category title is valid and contains image files.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleToggleSelectAll}>
                {selectedItemUrls.size > 0 &&
                unmintedItems.every((i) => selectedItemUrls.has(i.fileUrl)) ? (
                  <>
                    <CheckSquare className="text-teal mr-1.5 h-3.5 w-3.5" /> Deselect All
                  </>
                ) : (
                  <>
                    <Square className="text-label-secondary mr-1.5 h-3.5 w-3.5" /> Select Unminted (
                    {unmintedItems.length})
                  </>
                )}
              </Button>
              <span className="text-label-secondary text-caption">
                {items.length} total image(s) •{" "}
                <span className="text-teal font-semibold">{unmintedItems.length} new</span> •{" "}
                <span className="text-green font-semibold">{mintedCount} already minted</span> (
                {selectedItemUrls.size} selected)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleImportAll}
                disabled={unmintedItems.length === 0 || importMutation.isPending}
                className="disabled:opacity-50"
              >
                Import New ({unmintedItems.length})
              </Button>
              <Button
                variant="tinted"
                size="sm"
                onClick={() => handleImportSelected()}
                disabled={selectedItemUrls.size === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Minting Cards...
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Mint Selected Flags (
                    {selectedItemUrls.size})
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Flag Image Grid */}
          <div className="grid max-h-[520px] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => {
              const isSelected = selectedItemUrls.has(item.fileUrl);
              const isMinted = item.isAlreadyImported;

              return (
                <div
                  key={item.fileUrl}
                  onClick={() => handleToggleItem(item.fileUrl)}
                  className={`group rounded-row relative flex cursor-pointer flex-col justify-between border p-2.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
                    isMinted
                      ? "border-separator bg-surface opacity-55 grayscale hover:opacity-100 hover:grayscale-0"
                      : isSelected
                        ? "border-teal/60 bg-teal/10 ring-teal/40 ring-1"
                        : "border-separator bg-surface hover:bg-fill-4"
                  }`}
                >
                  <div className="rounded-control relative flex aspect-3/2 w-full items-center justify-center overflow-hidden bg-black/40 p-1">
                    <img
                      src={item.fileUrl}
                      alt={item.cleanTitle}
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                    />

                    {/* Already Minted Badge */}
                    {isMinted && (
                      <div className="rounded-control-sm bg-green/90 text-caption text-label absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5">
                        <Check className="h-2.5 w-2.5" /> Minted
                      </div>
                    )}

                    <div className="absolute top-1 right-1">
                      {isSelected ? (
                        <CheckCircle2 className="fill-teal/20 text-teal h-4 w-4" />
                      ) : (
                        <Square className="text-label-tertiary h-4 w-4" />
                      )}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="text-label text-caption truncate" title={item.cleanTitle}>
                      {item.cleanTitle}
                    </div>
                    <a
                      href={item.descriptionUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-label-secondary text-caption hover:text-teal inline-flex items-center gap-0.5"
                    >
                      Wikimedia <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </FacetCard>
  );
}
