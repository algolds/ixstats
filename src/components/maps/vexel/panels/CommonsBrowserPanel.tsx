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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { useState } from "react";
import { api } from "~/trpc/react";
import { CHARGE_CATEGORIES } from "~/lib/heraldry";

interface CommonsBrowserPanelProps {
  onClose: () => void;
  onImportSuccess?: () => void;
}

const COMMONS_SUGGESTED_CATEGORIES = [
  "Lions",
  "Eagles",
  "Fleur-de-lis",
  "Crosses",
  "Crowns",
  "Stars",
  "Castles",
  "Swords",
].map((name) => ({ label: `${name} in heraldry`, value: `${name} in heraldry` }));

/** First matching keyword group picks the charge category for a Commons category. */
const CHARGE_CATEGORY_KEYWORDS: [keywords: string[], category: string][] = [
  [["lion", "animal"], "ANIMALS"],
  [["eagle", "bird"], "BIRDS"],
  [["crown"], "CROWNS"],
  [["star"], "CELESTIAL"],
  [["castle", "building"], "BUILDINGS"],
  [["sword", "weapon"], "WEAPONS"],
  [["cross"], "RELIGIOUS"],
];

const guessChargeCategory = (commonsCategory: string) => {
  const lower = commonsCategory.toLowerCase();
  return (
    CHARGE_CATEGORY_KEYWORDS.find(([words]) => words.some((w) => lower.includes(w)))?.[1] ??
    "MISCELLANEOUS"
  );
};

/** "File:Lion-rampant_gules.svg" → "Lion rampant gules" */
const getSanitizedTitle = (title: string) =>
  title
    .replace(/^File:/i, "")
    .replace(/\.svg$/i, "")
    .replace(/[-_]/g, " ")
    .trim();

export default function CommonsBrowserPanel({
  onClose,
  onImportSuccess,
}: CommonsBrowserPanelProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Lions in heraldry");
  const [activeTab, setActiveTab] = useState<"category" | "search">("category");

  const [importingId, setImportingId] = useState<number | null>(null);
  const [importName, setImportName] = useState("");
  const [importCategory, setImportCategory] = useState("ANIMALS");

  const utils = api.useUtils();
  const importMutation = api.heraldry.importCommonsCharge.useMutation({
    onSuccess: () => {
      setImportingId(null);
      utils.heraldry.getChargeLibrary.invalidate();
      onImportSuccess?.();
    },
  });

  const { data: categoryData, isLoading: isCategoryLoading } =
    api.commons.getCategoryFiles.useQuery(
      { category: selectedCategory, limit: 30 },
      { enabled: activeTab === "category" }
    );

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

  const handleStartImport = (img: any) => {
    setImportingId(img.pageid);
    setImportName(getSanitizedTitle(img.title));
    setImportCategory(guessChargeCategory(selectedCategory));
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
        <SheetHeader className="border-separator border-b px-6 py-3 pr-12 text-left">
          <SheetTitle className="text-body">Wikimedia Commons</SheetTitle>
          <SheetDescription className="text-footnote">
            Search and import vector heraldic charges
          </SheetDescription>
        </SheetHeader>

        <div className="border-separator border-b px-4 py-2">
          <SegmentedControl
            aria-label="Browse Commons by"
            asTabs
            fullWidth
            size="sm"
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            options={[
              { value: "category", label: "Categories" },
              { value: "search", label: "Search" },
            ]}
          />
        </div>

        <div className="border-separator bg-surface border-b p-4">
          {activeTab === "category" ? (
            <div className="space-y-1">
              <Eyebrow id="commons-category-label" className="block">
                Commons category
              </Eyebrow>
              <OptionSelect
                aria-labelledby="commons-category-label"
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                options={COMMONS_SUGGESTED_CATEGORIES}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Eyebrow className="block">Search term</Eyebrow>
              <SearchField
                aria-label="Search term"
                placeholder="e.g. heraldic lion, crown SVG..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
              />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-label-secondary text-footnote flex flex-col items-center justify-center gap-3 py-20">
              <div className="border-tint h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
              <span>Fetching Wikimedia library...</span>
            </div>
          ) : svgImages.length === 0 ? (
            <div className="text-label-secondary text-footnote py-20 text-center italic">
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
                    className="group border-separator bg-fill-3 rounded-control relative flex flex-col gap-2 overflow-hidden border p-2"
                  >
                    <div className="bg-surface rounded-control-sm relative flex h-28 items-center justify-center overflow-hidden p-2">
                      <img
                        src={img.thumbUrl}
                        alt={img.title}
                        className="max-h-full max-w-full object-contain brightness-95 transition-[color,background-color,border-color,box-shadow,opacity,transform] group-hover:brightness-100"
                        loading="lazy"
                      />
                      <Badge variant="success" className="absolute right-1 bottom-1">
                        SVG
                      </Badge>
                    </div>

                    <div className="text-footnote space-y-0.5">
                      <p className="text-label-secondary truncate font-medium" title={img.title}>
                        {getSanitizedTitle(img.title)}
                      </p>
                      <p className="text-label-secondary truncate">
                        License: {img.license || "Unknown"}
                      </p>
                    </div>

                    {isImportingThis ? (
                      <div className="border-separator text-footnote space-y-2 border-t p-1">
                        <div>
                          <span className="text-label-secondary mb-0.5 block font-semibold">
                            Name
                          </span>
                          <Input
                            type="text"
                            aria-label="Name"
                            value={importName}
                            onChange={(e) => setImportName(e.target.value)}
                            className="text-footnote h-(--control-height-sm) px-2"
                          />
                        </div>
                        <div>
                          <span className="text-label-secondary mb-0.5 block font-semibold">
                            Category
                          </span>
                          <OptionSelect
                            aria-label="Category"
                            size="sm"
                            value={importCategory}
                            onValueChange={setImportCategory}
                            options={CHARGE_CATEGORIES}
                          />
                        </div>
                        <div className="flex gap-1 pt-2">
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
