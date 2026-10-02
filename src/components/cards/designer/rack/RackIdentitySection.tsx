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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SegmentedControl } from "~/components/ui/segmented-control";

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
        className="border-tint/30 bg-tint-fill text-tint flex w-full items-center justify-between px-4"
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
        <label className="text-label-secondary text-footnote mb-2 block font-medium">
          Lore Category & Subcategory
        </label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
                  <Button
                    variant={isSelected ? "secondary" : "outline"}
                    aria-pressed={isSelected}
                    className={cn(
                      "rounded-row text-footnote h-auto w-full justify-between gap-1 p-2 text-left font-medium",
                      isSelected ? "border-tint border" : "bg-surface text-label"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
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
                  </Button>
                </PopoverTrigger>

                {/* Subcategory Popover */}
                {subcats.length > 0 && (
                  <PopoverContent
                    align={isRightEdge ? "end" : "start"}
                    className="w-64 space-y-2 p-3 sm:w-72"
                  >
                    <div className="border-separator flex items-center justify-between border-b pb-2">
                      <div className="flex min-w-0 items-center gap-2">
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

                      <Button
                        variant="ghost"
                        size="sm"
                        aria-pressed={showCustomSubInput}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCustomSubInput((s) => !s);
                        }}
                        className="text-label-secondary hover:text-label text-footnote h-auto gap-1 p-1"
                      >
                        <Pencil className="text-tint h-3 w-3" />
                        <span>{showCustomSubInput ? "Presets" : "Edit"}</span>
                      </Button>
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
                      <div className="flex max-h-44 flex-wrap items-center gap-2 overflow-y-auto pr-0.5">
                        {subcats.map((sub) => {
                          const isSubSelected = state.subcategory === sub.label;
                          return (
                            <Button
                              variant={isSubSelected ? "default" : "outline"}
                              size="sm"
                              aria-pressed={isSubSelected}
                              key={sub.id}
                              onClick={() => {
                                onChange((p) => ({ ...p, subcategory: sub.label }));
                                setActivePopoverCat(null);
                              }}
                              className={cn(
                                "rounded-row text-footnote justify-start",
                                isSubSelected ? "border-tint border" : "bg-surface text-label"
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
                            </Button>
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
        <div className="flex items-center gap-2">
          {showSeasonDropdown ? (
            <Select
              value={String(state.season || 1)}
              onValueChange={(v) => {
                onChange((p) => ({ ...p, season: Number(v) || 1 }));
                setShowSeasonDropdown(false);
              }}
            >
              <SelectTrigger size="sm" aria-label="Card season">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    Season {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <SegmentedControl
              size="sm"
              aria-label="Card season"
              value={String(state.season || 1)}
              onValueChange={(v) => onChange((p) => ({ ...p, season: Number(v) }))}
              options={[1, 2, 3, 4].map((s) => ({ value: String(s), label: `S${s}` }))}
            />
          )}
        </div>
      </div>
    </div>
  );
});
