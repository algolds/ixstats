"use client";
// src/app/admin/cards/CommonsFlagImporterAdmin.tsx

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
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
    <FacetCard
      depth={2}
      className="border-border bg-card/70 text-card-foreground space-y-6 rounded-2xl border p-6 shadow-xl backdrop-blur-xl"
    >
      {/* Header */}
      <div className="border-border flex flex-col gap-2 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 backdrop-blur-md">
            <Globe className="h-5 w-5 text-cyan-500" />
          </div>
          <div>
            <h2 className="text-foreground flex items-center gap-2 text-xl font-bold tracking-tight">
              Wikimedia Commons Flag & Image Importer
            </h2>
            <p className="text-muted-foreground text-xs font-medium">
              Parse any Wikimedia Commons Category URL or title, resolve vector/raster flag images,
              and batch-mint them into IxCards.
            </p>
          </div>
        </div>
      </div>

      {/* Category URL/Title Parser Control Panel */}
      <FacetContainer
        depth={1}
        enableRefraction={true}
        className="border-border bg-card/60 space-y-4 rounded-2xl border p-4 shadow-sm backdrop-blur-md"
      >
        <div className="space-y-3">
          <label className="text-foreground block text-xs font-semibold">
            Wikimedia Commons Category URL or Category Title
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleParseCategory();
                }}
                placeholder="https://commons.wikimedia.org/wiki/Category:SVG_flags_of_fictional_countries"
                className="border-border bg-card text-foreground placeholder:text-muted-foreground h-10 rounded-xl pr-3 pl-9 font-mono text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <Button
              onClick={handleParseCategory}
              disabled={commonsQuery.isFetching}
              className="h-10 rounded-xl border border-cyan-500/30 bg-cyan-500/20 px-5 text-xs font-semibold text-cyan-600 shadow-xs transition-all hover:bg-cyan-500/30 active:scale-95 dark:text-cyan-300"
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
            <span className="text-muted-foreground text-[11px] font-medium">Quick Categories:</span>
            <button
              onClick={() => {
                const url =
                  "https://commons.wikimedia.org/wiki/Category:SVG_flags_of_fictional_countries";
                setCategoryInput(url);
                setActiveCategory("Category:SVG_flags_of_fictional_countries");
                setSelectedItemUrls(new Set());
              }}
              className="border-border bg-card/60 text-foreground hover:bg-accent rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all"
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
              className="border-border bg-card/60 text-foreground hover:bg-accent rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all"
            >
              SVG special or fictional flags
            </button>
          </div>
        </div>

        {/* Active Query Status Badge */}
        <div className="border-border flex items-center justify-between border-t pt-3 text-xs">
          <span className="text-muted-foreground font-medium">
            Active Query: <code className="font-mono text-cyan-500">{activeCategory}</code>
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void commonsQuery.refetch()}
            disabled={commonsQuery.isFetching}
            className="text-muted-foreground hover:text-foreground h-7 text-[11px]"
          >
            <RefreshCw
              className={`mr-1 h-3 w-3 ${commonsQuery.isFetching ? "animate-spin" : ""}`}
            />{" "}
            Reload
          </Button>
        </div>

        {/* Card Minting Parameters */}
        <div className="border-border/40 grid grid-cols-1 gap-3 border-t pt-2 sm:grid-cols-2">
          {/* Default Rarity */}
          <div>
            <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
              Target Card Rarity
            </label>
            <select
              value={defaultRarity}
              onChange={(e) => setDefaultRarity(e.target.value as CardRarity)}
              className="border-border/40 bg-background text-foreground h-9 w-full rounded-xl border px-3 text-xs font-medium focus:outline-none"
            >
              <option value="COMMON" className="bg-background text-foreground">
                Common
              </option>
              <option value="UNCOMMON" className="bg-background text-foreground">
                Uncommon
              </option>
              <option value="RARE" className="bg-background text-foreground">
                Rare
              </option>
              <option value="ULTRA_RARE" className="bg-background text-foreground">
                Ultra Rare
              </option>
              <option value="EPIC" className="bg-background text-foreground">
                Epic
              </option>
              <option value="LEGENDARY" className="bg-background text-foreground">
                Legendary
              </option>
            </select>
          </div>

          {/* Season */}
          <div>
            <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
              Target Card Season
            </label>
            <select
              value={season}
              onChange={(e) => setSeason(parseInt(e.target.value, 10))}
              className="border-border/40 bg-background text-foreground h-9 w-full rounded-xl border px-3 text-xs font-medium focus:outline-none"
            >
              <option value={1} className="bg-background text-foreground">
                Season 1
              </option>
              <option value={2} className="bg-background text-foreground">
                Season 2
              </option>
              <option value={3} className="bg-background text-foreground">
                Season 3
              </option>
            </select>
          </div>
        </div>
      </FacetContainer>

      {/* Results Browser */}
      {commonsQuery.isLoading || commonsQuery.isFetching ? (
        <div className="border-border bg-card/40 flex h-52 flex-col items-center justify-center space-y-2 rounded-2xl border backdrop-blur-md">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-500" />
          <p className="text-muted-foreground text-xs font-medium">
            Fetching category members from Wikimedia Commons API...
          </p>
        </div>
      ) : commonsQuery.isError ? (
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center backdrop-blur-md">
          <AlertCircle className="h-8 w-8 text-rose-500" />
          <p className="text-foreground text-sm font-semibold">Failed to fetch Commons Category</p>
          <p className="max-w-md font-mono text-xs text-rose-600 dark:text-rose-300">
            {commonsQuery.error.message}
          </p>
          <Button
            size="sm"
            onClick={() => void commonsQuery.refetch()}
            className="mt-2 h-8 rounded-xl border border-rose-500/30 bg-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-200"
          >
            Retry Category Fetch
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="border-border bg-card/30 flex h-44 flex-col items-center justify-center space-y-2 rounded-2xl border border-dashed backdrop-blur-md">
          <Globe className="text-muted-foreground/40 h-8 w-8" />
          <p className="text-foreground text-sm font-semibold">
            No images found in this Commons category
          </p>
          <p className="text-muted-foreground max-w-md text-center text-xs">
            Make sure the Commons URL or category title is valid and contains image files.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleSelectAll}
                className="border-border bg-card h-8 rounded-xl text-xs font-semibold"
              >
                {selectedItemUrls.size > 0 &&
                unmintedItems.every((i) => selectedItemUrls.has(i.fileUrl)) ? (
                  <>
                    <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-cyan-500" /> Deselect All
                  </>
                ) : (
                  <>
                    <Square className="text-muted-foreground mr-1.5 h-3.5 w-3.5" /> Select Unminted
                    ({unmintedItems.length})
                  </>
                )}
              </Button>
              <span className="text-muted-foreground text-xs font-medium">
                {items.length} total image(s) •{" "}
                <span className="font-bold text-cyan-500">{unmintedItems.length} new</span> •{" "}
                <span className="font-bold text-emerald-500">{mintedCount} already minted</span> (
                {selectedItemUrls.size} selected)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleImportAll}
                disabled={unmintedItems.length === 0 || importMutation.isPending}
                className="border-border bg-card text-foreground hover:bg-accent h-8 rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                Import New ({unmintedItems.length})
              </Button>
              <Button
                size="sm"
                onClick={() => handleImportSelected()}
                disabled={selectedItemUrls.size === 0 || importMutation.isPending}
                className="h-8 rounded-xl border border-cyan-500/30 bg-cyan-500/20 text-xs font-semibold text-cyan-600 shadow-xs transition-all hover:bg-cyan-500/30 active:scale-95 dark:text-cyan-300"
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
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-2.5 backdrop-blur-md transition-all ${
                    isMinted
                      ? "border-border/40 bg-card/30 opacity-55 grayscale hover:opacity-100 hover:grayscale-0"
                      : isSelected
                        ? "border-cyan-500/60 bg-cyan-500/10 shadow-md ring-1 ring-cyan-500/40"
                        : "border-border bg-card/60 hover:bg-accent/60"
                  }`}
                >
                  <div className="relative flex aspect-3/2 w-full items-center justify-center overflow-hidden rounded-lg bg-black/40 p-1">
                    <img
                      src={item.fileUrl}
                      alt={item.cleanTitle}
                      className="max-h-full max-w-full object-contain drop-shadow-sm"
                      loading="lazy"
                    />

                    {/* Already Minted Badge */}
                    {isMinted && (
                      <div className="absolute top-1 left-1 flex items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                        <Check className="h-2.5 w-2.5" /> Minted
                      </div>
                    )}

                    <div className="absolute top-1 right-1">
                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4 fill-cyan-500/20 text-cyan-500" />
                      ) : (
                        <Square className="text-muted-foreground/50 h-4 w-4" />
                      )}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div
                      className="text-foreground truncate text-[11px] font-bold"
                      title={item.cleanTitle}
                    >
                      {item.cleanTitle}
                    </div>
                    <a
                      href={item.descriptionUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground inline-flex items-center gap-0.5 text-[9px] font-semibold hover:text-cyan-500"
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
