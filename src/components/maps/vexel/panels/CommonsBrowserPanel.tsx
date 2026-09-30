"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Xmark } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { api } from "~/trpc/react";
import { CHARGE_CATEGORIES } from "~/lib/heraldry";

interface CommonsBrowserPanelProps {
  onClose: () => void;
  onImportSuccess?: () => void;
}

const COMMONS_SUGGESTED_CATEGORIES = [
  { label: "Lions in Heraldry", value: "Lions in heraldry" },
  { label: "Eagles in Heraldry", value: "Eagles in heraldry" },
  { label: "Fleur-de-lis in Heraldry", value: "Fleur-de-lis in heraldry" },
  { label: "Crosses in Heraldry", value: "Crosses in heraldry" },
  { label: "Crowns in Heraldry", value: "Crowns in heraldry" },
  { label: "Stars in Heraldry", value: "Stars in heraldry" },
  { label: "Castles in Heraldry", value: "Castles in heraldry" },
  { label: "Swords in Heraldry", value: "Swords in heraldry" },
];

export default function CommonsBrowserPanel({
  onClose,
  onImportSuccess,
}: CommonsBrowserPanelProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Lions in heraldry");
  const [activeTab, setActiveTab] = useState<"category" | "search">("category");

  // Form states for importing
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importName, setImportName] = useState("");
  const [importCategory, setImportCategory] = useState("ANIMALS");

  const utils = api.useUtils();
  const importMutation = api.heraldry.importCommonsCharge.useMutation({
    onSuccess: () => {
      setImportingId(null);
      // Invalidate charge library queries to refresh list
      utils.heraldry.getChargeLibrary.invalidate();
      onImportSuccess?.();
    },
  });

  // Query Category Files
  const { data: categoryData, isLoading: isCategoryLoading } =
    api.commons.getCategoryFiles.useQuery(
      { category: selectedCategory, limit: 30 },
      { enabled: activeTab === "category" }
    );

  // Query Search Files
  const { data: searchData, isLoading: isSearchLoading } = api.commons.search.useQuery(
    { query: search.toLowerCase().includes(".svg") ? search : `${search} filetype:svg`, limit: 30 },
    { enabled: activeTab === "search" && search.length > 2 }
  );

  const images =
    activeTab === "category" ? (categoryData?.images ?? []) : (searchData?.images ?? []);
  const isLoading = activeTab === "category" ? isCategoryLoading : isSearchLoading;

  const svgImages = images.filter(
    (img: any) => img.title.toLowerCase().endsWith(".svg") || img.mime === "image/svg+xml"
  );

  const getSanitizedTitle = (title: string) => {
    // Strip "File:" prefix and ".svg" extension
    let clean = title.replace(/^File:/i, "").replace(/\.svg$/i, "");
    // Replace hyphens/underscores with spaces
    clean = clean.replace(/[-_]/g, " ");
    return clean.trim();
  };

  const handleStartImport = (img: any) => {
    setImportingId(img.pageid);
    setImportName(getSanitizedTitle(img.title));

    // Auto-map category based on selected Commons category if possible
    if (
      selectedCategory.toLowerCase().includes("lion") ||
      selectedCategory.toLowerCase().includes("animal")
    ) {
      setImportCategory("ANIMALS");
    } else if (
      selectedCategory.toLowerCase().includes("eagle") ||
      selectedCategory.toLowerCase().includes("bird")
    ) {
      setImportCategory("BIRDS");
    } else if (selectedCategory.toLowerCase().includes("crown")) {
      setImportCategory("CROWNS");
    } else if (selectedCategory.toLowerCase().includes("star")) {
      setImportCategory("CELESTIAL");
    } else if (
      selectedCategory.toLowerCase().includes("castle") ||
      selectedCategory.toLowerCase().includes("building")
    ) {
      setImportCategory("BUILDINGS");
    } else if (
      selectedCategory.toLowerCase().includes("sword") ||
      selectedCategory.toLowerCase().includes("weapon")
    ) {
      setImportCategory("WEAPONS");
    } else if (selectedCategory.toLowerCase().includes("cross")) {
      setImportCategory("RELIGIOUS");
    } else {
      setImportCategory("MISCELLANEOUS");
    }
  };

  const handleConfirmImport = (img: any) => {
    importMutation.mutate({
      name: importName,
      category: importCategory as any,
      url: img.url,
      sourceUrl: img.descriptionUrl,
      author: img.artist || "Wikimedia Commons",
      license: img.license || "Public Domain",
    });
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[450px]"
      >
        {/* Panel Header */}
        <SheetHeader className="border-border border-b px-6 py-3 pr-12 text-left">
          <SheetTitle className="text-sm">Wikimedia Commons</SheetTitle>
          <SheetDescription className="text-xs">
            Search and import vector heraldic charges
          </SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="border-border bg-muted/40 flex border-b">
          <button
            onClick={() => setActiveTab("category")}
            className={`flex-1 border-b-2 py-2 text-center text-xs font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
              activeTab === "category"
                ? "border-amber-500 text-amber-500"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 border-b-2 py-2 text-center text-xs font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
              activeTab === "search"
                ? "border-amber-500 text-amber-500"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Search
          </button>
        </div>

        {/* Controls Area */}
        <div className="border-border bg-card border-b p-4">
          {activeTab === "category" ? (
            <div className="space-y-1">
              <Eyebrow className="block">Commons Category</Eyebrow>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border-border bg-muted text-muted-foreground w-full rounded-lg border p-2 text-xs focus:outline-none"
              >
                {COMMONS_SUGGESTED_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <Eyebrow className="block">Search Term</Eyebrow>
              <input
                type="text"
                placeholder="e.g. heraldic lion, crown SVG..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-border bg-muted text-muted-foreground w-full rounded-lg border p-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Results View */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-20 text-xs">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <span>Fetching Wikimedia library...</span>
            </div>
          ) : svgImages.length === 0 ? (
            <div className="text-muted-foreground py-20 text-center text-xs italic">
              {activeTab === "search" && search.length < 3
                ? "Type search query to search Wikimedia Commons..."
                : "No vector SVG files found in this section."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {svgImages.map((img: any) => {
                const isImportingThis = importingId === img.pageid;

                return (
                  <div
                    key={img.pageid}
                    className="group border-border bg-muted/40 relative flex flex-col gap-2 overflow-hidden rounded-lg border p-2"
                  >
                    {/* Thumbnail Image Box */}
                    <div className="bg-card relative flex h-28 items-center justify-center overflow-hidden rounded p-2">
                      <img
                        src={img.thumbUrl}
                        alt={img.title}
                        className="max-h-full max-w-full object-contain brightness-95 transition-[color,background-color,border-color,box-shadow,opacity,transform] group-hover:brightness-100"
                        loading="lazy"
                      />
                      <span className="border-border bg-background/80 absolute right-1 bottom-1 rounded border px-1 py-0.5 font-mono text-xs text-emerald-500">
                        SVG
                      </span>
                    </div>

                    {/* Title / Info */}
                    <div className="space-y-0.5 text-xs">
                      <p className="text-muted-foreground truncate font-medium" title={img.title}>
                        {getSanitizedTitle(img.title)}
                      </p>
                      <p className="text-muted-foreground truncate">
                        License: {img.license || "Unknown"}
                      </p>
                    </div>

                    {/* Action buttons or Inline import form */}
                    {isImportingThis ? (
                      <div className="border-border space-y-1.5 border-t p-1 text-xs">
                        <div>
                          <span className="text-muted-foreground mb-0.5 block font-bold">Name</span>
                          <input
                            type="text"
                            value={importName}
                            onChange={(e) => setImportName(e.target.value)}
                            className="border-border bg-card text-muted-foreground w-full rounded border px-1.5 py-0.5 focus:outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-muted-foreground mb-0.5 block font-bold">
                            Category
                          </span>
                          <select
                            value={importCategory}
                            onChange={(e) => setImportCategory(e.target.value)}
                            className="border-border bg-card text-muted-foreground w-full rounded border px-1 py-0.5 focus:outline-none"
                          >
                            {CHARGE_CATEGORIES.map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-1 pt-1.5">
                          <Button
                            variant="ghost"
                            size="xs"
                            className="flex-1"
                            onClick={() => handleConfirmImport(img)}
                            disabled={importMutation.isPending}
                          >
                            {importMutation.isPending ? "Importing..." : "Confirm"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setImportingId(null)}>
                            <Xmark aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        className="w-full"
                        onClick={() => handleStartImport(img)}
                      >
                        Import to library
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
