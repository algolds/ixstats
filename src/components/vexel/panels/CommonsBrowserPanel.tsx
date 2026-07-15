"use client";

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
    <div className="animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-[450px] flex-col overflow-hidden border-l border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-2xl duration-250">
      {/* Panel Header */}
      <header className="flex h-14 items-center justify-between border-b border-white/10 px-6">
        <div>
          <h2 className="text-sm font-bold tracking-wider text-amber-500">Wikimedia Commons</h2>
          <p className="text-[10px] text-zinc-500">Search and import vector heraldic charges</p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
        >
          ✕ Close
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-zinc-900/30">
        <button
          onClick={() => setActiveTab("category")}
          className={`flex-1 border-b-2 py-2 text-center text-xs font-semibold transition-all ${
            activeTab === "category"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 border-b-2 py-2 text-center text-xs font-semibold transition-all ${
            activeTab === "search"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Search
        </button>
      </div>

      {/* Controls Area */}
      <div className="border-b border-white/5 bg-zinc-950 p-4">
        {activeTab === "category" ? (
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">
              Commons Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-xs text-zinc-300 focus:outline-none"
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
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Search Term</label>
            <input
              type="text"
              placeholder="e.g. heraldic lion, crown SVG..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-xs text-zinc-300 focus:border-amber-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Results View */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-xs text-zinc-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <span>Fetching Wikimedia library...</span>
          </div>
        ) : svgImages.length === 0 ? (
          <div className="py-20 text-center text-xs text-zinc-500 italic">
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
                  className="group relative flex flex-col gap-2 overflow-hidden rounded-lg border border-white/5 bg-zinc-900/30 p-2"
                >
                  {/* Thumbnail Image Box */}
                  <div className="relative flex h-28 items-center justify-center overflow-hidden rounded bg-zinc-950 p-2">
                    <img
                      src={img.thumbUrl}
                      alt={img.title}
                      className="max-h-full max-w-full object-contain brightness-95 transition-all group-hover:brightness-100"
                      loading="lazy"
                    />
                    <span className="absolute right-1 bottom-1 rounded border border-emerald-400/20 bg-black/60 px-1 py-0.5 font-mono text-[8px] text-emerald-400">
                      SVG
                    </span>
                  </div>

                  {/* Title / Info */}
                  <div className="space-y-0.5 text-[10px]">
                    <p className="truncate font-medium text-zinc-300" title={img.title}>
                      {getSanitizedTitle(img.title)}
                    </p>
                    <p className="truncate text-zinc-500">License: {img.license || "Unknown"}</p>
                  </div>

                  {/* Action buttons or Inline import form */}
                  {isImportingThis ? (
                    <div className="space-y-1.5 border-t border-white/5 p-1 text-[10px]">
                      <div>
                        <span className="mb-0.5 block font-bold text-zinc-500">Name</span>
                        <input
                          type="text"
                          value={importName}
                          onChange={(e) => setImportName(e.target.value)}
                          className="w-full rounded border border-white/10 bg-zinc-950 px-1.5 py-0.5 text-zinc-300 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="mb-0.5 block font-bold text-zinc-500">Category</span>
                        <select
                          value={importCategory}
                          onChange={(e) => setImportCategory(e.target.value)}
                          className="w-full rounded border border-white/10 bg-zinc-950 px-1 py-0.5 text-zinc-400 focus:outline-none"
                        >
                          {CHARGE_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-1 pt-1.5">
                        <button
                          onClick={() => handleConfirmImport(img)}
                          disabled={importMutation.isPending}
                          className="flex-1 rounded bg-amber-500 py-1 text-center font-bold text-zinc-950 hover:bg-amber-600"
                        >
                          {importMutation.isPending ? "Importing..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setImportingId(null)}
                          className="rounded bg-zinc-800 px-2 text-center text-zinc-300 hover:bg-zinc-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartImport(img)}
                      className="w-full rounded border border-white/5 bg-zinc-800 py-1 text-center text-[10px] font-semibold text-zinc-300 transition-all hover:border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-400"
                    >
                      📥 Import to Library
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
