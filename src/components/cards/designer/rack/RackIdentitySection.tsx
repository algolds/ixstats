import React, { useState } from "react";
import {
  Search,
  OpenBook as BookOpen,
  NavArrowDown as ChevronDown,
  EditPencil as Pencil,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { CategoryIcon } from "~/components/cards/icons";
import { LoreCategory, BROWSABLE_CATEGORIES } from "~/lib/cards/category-enums";
import { getCategoryLabel, getCategoryTheme } from "~/lib/cards/category-theme";
import { getCategorySubcategories } from "~/lib/cards/subcategory-registry";
import type { CardDesignState } from "../types";

interface RackIdentitySectionProps {
  state: CardDesignState;
  onChange: (updater: (prev: CardDesignState) => CardDesignState) => void;
  onOpenLoreImport: () => void;
}

export const RackIdentitySection = React.memo(function RackIdentitySection({
  state,
  onChange,
  onOpenLoreImport,
}: RackIdentitySectionProps) {
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);
  const [showCustomSubInput, setShowCustomSubInput] = useState(false);
  const [activePopoverCat, setActivePopoverCat] = useState<LoreCategory | null>(null);

  return (
    <div className="space-y-4">
      {/* LoreScanner Master Action Trigger */}
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenLoreImport}
        className="border-tint/30 bg-tint-fill text-tint flex w-full items-center justify-between px-3.5"
      >
        <div className="flex items-center gap-2">
          <Search className="text-tint h-4 w-4" />
          <span>Scan & Import Lore Archive</span>
        </div>
        <div className="text-label-secondary text-footnote flex items-center gap-1">
          <span>LoreScanner</span>
          <BookOpen className="text-tint h-3.5 w-3.5" />
        </div>
      </Button>

      {/* Card Title & Article Title */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-label-secondary text-footnote mb-1 block font-medium">
            Card Title
          </label>
          <Input
            value={state.title}
            onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Archivist of the Dawn"
            className="text-footnote h-8 font-semibold"
          />
        </div>
        <div>
          <label className="text-label-secondary text-footnote mb-1 block font-medium">
            Article / Page Title
          </label>
          <Input
            value={state.wikiArticleTitle}
            onChange={(e) => onChange((p) => ({ ...p, wikiArticleTitle: e.target.value }))}
            placeholder="e.g. Great Archives of Ogma"
            className="text-footnote h-8 font-mono"
          />
        </div>
      </div>

      {/* Category Selector Grid */}
      <div>
        <label className="text-label-secondary text-footnote mb-1.5 block font-medium">
          Lore Category & Subcategory
        </label>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {BROWSABLE_CATEGORIES.map((cat: LoreCategory, index: number) => {
            const isSelected = state.category === cat;
            const isPopoverOpen = activePopoverCat === cat;
            const theme = getCategoryTheme(cat);
            const subcats = getCategorySubcategories(cat);
            const isRightEdge = (index + 1) % 3 === 0 || (index + 1) % 4 === 0;

            return (
              <Popover
                key={cat}
                open={isPopoverOpen}
                onOpenChange={(open) => {
                  if (!open) {
                    setActivePopoverCat((prev) => (prev === cat ? null : prev));
                    return;
                  }
                  if (!isSelected) {
                    const defaultSub = subcats[0]?.label || getCategoryLabel(cat);
                    onChange((p) => ({ ...p, category: cat, subcategory: defaultSub }));
                  }
                  setActivePopoverCat(cat);
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "focus-visible:outline-tint rounded-row text-footnote duration-fast flex w-full cursor-pointer items-center justify-between gap-1 border p-2 text-left font-medium transition-colors focus-visible:outline-2",
                      isSelected
                        ? "bg-tint-fill text-tint border-tint"
                        : "border-separator bg-surface hover:bg-fill-3 text-label"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <CategoryIcon
                        category={cat}
                        treatment="seal"
                        size="xs"
                        color={theme?.accentColor}
                      />
                      <span className="truncate">{getCategoryLabel(cat)}</span>
                    </div>
                    {isSelected && (
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 opacity-80 transition-transform",
                          isPopoverOpen && "rotate-180"
                        )}
                      />
                    )}
                  </button>
                </PopoverTrigger>

                {/* Subcategory Popover */}
                {subcats.length > 0 && (
                  <PopoverContent
                    align={isRightEdge ? "end" : "start"}
                    className="w-64 space-y-2.5 p-3 sm:w-72"
                  >
                    <div className="border-separator flex items-center justify-between border-b pb-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <CategoryIcon
                          category={cat}
                          treatment="seal"
                          size="xs"
                          color={theme?.accentColor}
                        />
                        <span className="text-footnote truncate font-semibold">
                          {getCategoryLabel(cat)} Subcategories
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCustomSubInput((s) => !s);
                        }}
                        className="text-label-secondary hover:text-label hover:bg-fill-3 rounded-control-sm text-footnote flex cursor-pointer items-center gap-1 p-1 transition-colors"
                      >
                        <Pencil className="text-tint h-3 w-3" />
                        <span>{showCustomSubInput ? "Presets" : "Edit"}</span>
                      </button>
                    </div>

                    {showCustomSubInput ? (
                      <Input
                        value={state.subcategory || ""}
                        onChange={(e) => onChange((p) => ({ ...p, subcategory: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setActivePopoverCat(null);
                        }}
                        placeholder="Type custom subcategory name..."
                        className="text-footnote h-8 font-medium"
                      />
                    ) : (
                      <div className="flex max-h-44 flex-wrap items-center gap-1.5 overflow-y-auto pr-0.5">
                        {subcats.map((sub) => {
                          const isSubSelected = state.subcategory === sub.label;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                onChange((p) => ({ ...p, subcategory: sub.label }));
                                setActivePopoverCat(null);
                              }}
                              className={cn(
                                "rounded-row text-footnote duration-fast flex cursor-pointer items-center gap-1.5 border px-2.5 py-1 text-left font-medium transition-colors",
                                isSubSelected
                                  ? "bg-tint text-on-tint border-tint"
                                  : "border-separator bg-surface hover:bg-fill-3 text-label"
                              )}
                            >
                              <img
                                src={sub.iconPath}
                                alt={sub.label}
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0 object-contain",
                                  isSubSelected ? "invert filter" : "opacity-75 invert filter"
                                )}
                              />
                              <span className="truncate">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </PopoverContent>
                )}
              </Popover>
            );
          })}
        </div>
      </div>

      {/* Season Selector */}
      <div className="flex items-center justify-between">
        <label className="text-label-secondary text-footnote font-medium">Card Season</label>
        <div className="flex items-center gap-1.5">
          {showSeasonDropdown ? (
            <select
              value={state.season || 1}
              onChange={(e) => {
                onChange((p) => ({ ...p, season: Number(e.target.value) || 1 }));
                setShowSeasonDropdown(false);
              }}
              className="border-separator bg-fill-3 text-label focus-visible:outline-tint rounded-control-sm text-footnote h-7 w-auto cursor-pointer border px-2 font-medium focus-visible:outline-2"
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <option key={s} value={s}>
                  Season {s}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange((p) => ({ ...p, season: s }))}
                  className={cn(
                    "text-footnote rounded-control-sm duration-fast h-7 cursor-pointer px-2 font-medium tabular-nums transition-colors",
                    (state.season || 1) === s
                      ? "bg-tint text-on-tint"
                      : "bg-fill-3 text-label-secondary hover:text-label"
                  )}
                >
                  S{s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
