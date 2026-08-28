import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  OpenBook as BookOpen,
  NavArrowDown as ChevronDown,
  EditPencil as Pencil,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
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
      {activePopoverCat && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => setActivePopoverCat(null)}
        />
      )}

      {/* LoreScanner Master Action Trigger */}
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenLoreImport}
        className="border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary flex h-10 w-full items-center justify-between rounded-xl px-3.5 text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-2">
          <Search className="text-primary h-4 w-4" />
          <span>Scan & Import Lore Archive</span>
        </div>
        <div className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
          <span>LoreScanner</span>
          <BookOpen className="text-primary h-3.5 w-3.5" />
        </div>
      </Button>

      {/* Card Title & Article Title */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-muted-foreground mb-1 block text-xs font-medium">Card Title</label>
          <Input
            value={state.title}
            onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Archivist of the Dawn"
            className="h-8 text-xs font-semibold"
          />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs font-medium">
            Article / Page Title
          </label>
          <Input
            value={state.wikiArticleTitle}
            onChange={(e) => onChange((p) => ({ ...p, wikiArticleTitle: e.target.value }))}
            placeholder="e.g. Great Archives of Ogma"
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>

      {/* Category Selector Grid */}
      <div>
        <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
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
              <div key={cat} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!isSelected) {
                      const defaultSub = subcats[0]?.label || getCategoryLabel(cat);
                      onChange((p) => ({ ...p, category: cat, subcategory: defaultSub }));
                      setActivePopoverCat(cat);
                    } else {
                      setActivePopoverCat((prev) => (prev === cat ? null : cat));
                    }
                  }}
                  className={cn(
                    "z-10 flex w-full cursor-pointer items-center justify-between gap-1 rounded-xl border p-2 text-left text-xs font-medium transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary ring-primary/40 font-semibold shadow-xs ring-1"
                      : "border-border bg-card hover:bg-muted text-foreground"
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

                {/* Subcategory Popover */}
                {isPopoverOpen && subcats.length > 0 && (
                  <motion.div
                    key={`popover-${cat}`}
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className={cn(
                      "border-border bg-popover/95 text-popover-foreground absolute top-full z-40 mt-1.5 w-64 space-y-2.5 rounded-2xl border p-3 shadow-xl backdrop-blur-md sm:w-72",
                      isRightEdge ? "right-0" : "left-0"
                    )}
                  >
                    <div className="border-border/60 flex items-center justify-between border-b pb-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <CategoryIcon
                          category={cat}
                          treatment="seal"
                          size="xs"
                          color={theme?.accentColor}
                        />
                        <span className="truncate text-xs font-bold">
                          {getCategoryLabel(cat)} Subcategories
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCustomSubInput((s) => !s);
                        }}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted flex cursor-pointer items-center gap-1 rounded-md p-1 text-[10.5px] transition-colors"
                      >
                        <Pencil className="text-primary h-3 w-3" />
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
                        className="h-8 text-xs font-medium"
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
                                "flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1 text-left text-xs font-medium shadow-2xs transition-all",
                                isSubSelected
                                  ? "bg-primary text-primary-foreground border-primary ring-primary/40 scale-[1.02] font-semibold ring-1"
                                  : "border-border/80 bg-card hover:bg-muted text-foreground hover:border-border"
                              )}
                            >
                              <img
                                src={sub.iconPath}
                                alt={sub.label}
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0 object-contain",
                                  isSubSelected
                                    ? "invert filter dark:filter-none"
                                    : "opacity-75 invert filter dark:filter-none"
                                )}
                              />
                              <span className="truncate">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Season Selector */}
      <div className="flex items-center justify-between">
        <label className="text-muted-foreground text-xs font-medium">Card Season</label>
        <div className="flex items-center gap-1.5">
          {showSeasonDropdown ? (
            <select
              value={state.season || 1}
              onChange={(e) => {
                onChange((p) => ({ ...p, season: Number(e.target.value) || 1 }));
                setShowSeasonDropdown(false);
              }}
              className="border-primary bg-background text-foreground focus:ring-primary h-7 w-auto cursor-pointer rounded-lg border px-2 py-0.5 text-xs font-semibold focus:ring-1"
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
                    "h-6 rounded-md px-2 text-xs font-semibold transition-all",
                    (state.season || 1) === s
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted/70 text-muted-foreground hover:text-foreground"
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
