/**
 * DesignerControlRack Component
 *
 * Multi-section interactive control rack for the 3D Card Designer.
 * Uses standard Facet design tokens, theme compliance, and clean accessible controls.
 */

"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { BookStack as Library, Crown as Gem, OpenBook as BookOpen, Search, Coins, FloppyDisk as Save, Send, NavArrowDown as ChevronDown, Trash as Trash2, Folder as FolderOpen, MediaImage as ImageIcon, Palette, Settings, EditPencil as Pencil } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { CategoryIcon } from "~/components/cards/icons";
import { LoreCategory, BROWSABLE_CATEGORIES } from "~/lib/cards/category-enums";
import { getCategoryLabel, getCategoryTheme } from "~/lib/cards/category-theme";
import { getCategorySubcategories } from "~/lib/cards/subcategory-registry";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import type { CardRarity } from "@prisma/client";

import { type CardDesignState, type CardDesignPreset, RARITY_BASE_VALUES } from "./types";

interface DesignerControlRackProps {
  state: CardDesignState;
  onChange: (updater: (prev: CardDesignState) => CardDesignState) => void;
  onOpenIconBrowser: (target: "emblem" | "watermark") => void;
  onOpenLoreImport: () => void;
  onPublish: () => void;
  isPublishing: boolean;
  presets: CardDesignPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: CardDesignPreset) => void;
  onDeletePreset: (id: string) => void;
}

const ALL_RARITIES: (CardRarity | string)[] = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "ULTRA_RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
  "DIVINE",
];

const COLOR_PRESETS = [
  {
    id: "auto",
    label: "Auto (Category Accent)",
    value: "",
    bgClass: "bg-gradient-to-tr from-amber-500 via-cyan-400 to-rose-500",
  },
  { id: "gold", label: "Imperial Gold", value: "#f59e0b", bgClass: "bg-amber-500" },
  { id: "cyan", label: "Electric Cyan", value: "#06b6d4", bgClass: "bg-cyan-500" },
  { id: "crimson", label: "Crimson Red", value: "#ef4444", bgClass: "bg-rose-500" },
  { id: "emerald", label: "Emerald Green", value: "#10b981", bgClass: "bg-emerald-500" },
  { id: "purple", label: "Amethyst Purple", value: "#a855f7", bgClass: "bg-purple-500" },
  { id: "pink", label: "Rose Pink", value: "#f43f5e", bgClass: "bg-pink-500" },
  { id: "silver", label: "Platinum Silver", value: "#cbd5e1", bgClass: "bg-slate-300" },
  { id: "white", label: "Solar White", value: "#ffffff", bgClass: "bg-white" },
  { id: "dark", label: "Obsidian Dark", value: "#1e293b", bgClass: "bg-slate-800" },
];

export const DesignerControlRack = React.memo<DesignerControlRackProps>(
  ({
    state,
    onChange,
    onOpenIconBrowser,
    onOpenLoreImport,
    onPublish,
    isPublishing,
    presets,
    onSavePreset,
    onLoadPreset,
    onDeletePreset,
  }) => {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
      identity: true,
      loreAndContent: true,
      materials: true,
      economy: false,
      presets: false,
    });

    const [presetNameInput, setPresetNameInput] = useState("");

    const toggleSection = (key: string) => {
      setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleRarityChange = (rarity: CardRarity | string) => {
      onChange((prev) => ({
        ...prev,
        rarity,
        marketValue: prev.useAutoValuation
          ? (RARITY_BASE_VALUES[rarity] ?? prev.marketValue)
          : prev.marketValue,
      }));
    };

    const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);
    const [showCustomSubInput, setShowCustomSubInput] = useState(false);
    const [activePopoverCat, setActivePopoverCat] = useState<LoreCategory | null>(null);

    return (
      <div className="flex flex-col space-y-4">
        {/* Transparent Click-Outside Overlay for Popover */}
        {activePopoverCat && (
          <div
            className="fixed inset-0 z-30 bg-transparent"
            onClick={() => setActivePopoverCat(null)}
          />
        )}

        {/* Section 1: Overview & Basic Info */}
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => toggleSection("identity")}
            className="text-foreground hover:bg-muted/40 flex w-full items-center justify-between p-4 text-sm font-semibold transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="text-primary h-4 w-4" />
              <span>Overview & Basic Info</span>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                openSections.identity && "rotate-180"
              )}
            />
          </button>

          {openSections.identity && (
            <div className="border-border space-y-4 border-t p-4 pt-0">
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
                  <label className="text-muted-foreground mb-1 block text-xs font-medium">
                    Card Title
                  </label>
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

              {/* Category Selector Grid with Anchored Dropdown directly under active button */}
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

                        {/* Subcategory Popover anchored directly under this specific selected button */}
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
                            {/* Popover Header */}
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
                                title="Toggle Custom Subcategory Name"
                              >
                                <Pencil className="text-primary h-3 w-3" />
                                <span>{showCustomSubInput ? "Presets" : "Edit"}</span>
                              </button>
                            </div>

                            {/* Subcategory Chips or Custom Name Input */}
                            {showCustomSubInput ? (
                              <Input
                                value={state.subcategory || ""}
                                onChange={(e) =>
                                  onChange((p) => ({ ...p, subcategory: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    setActivePopoverCat(null);
                                  }
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
                                        setActivePopoverCat(null); // Auto-close after selection!
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

              {/* Compact Season Selector */}
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
                      <option value={1}>Season 1 (Current)</option>
                      <option value={2}>Season 2</option>
                      <option value={3}>Season 3</option>
                      <option value={4}>Season 4</option>
                      <option value={5}>Season 5</option>
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSeasonDropdown((s) => !s)}
                      className="border-border/70 bg-muted/40 hover:bg-muted text-foreground inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors select-none"
                      title="Click to change season"
                    >
                      <span>Season {state.season || 1}</span>
                      <span className="text-muted-foreground font-mono text-[10px] font-normal tracking-wider uppercase">
                        Synced
                      </span>
                      <Settings className="text-muted-foreground hover:text-foreground ml-0.5 h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Rarity Tier Selector */}
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
                  Rarity Tier
                </label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {ALL_RARITIES.map((r) => {
                    const isSelected = state.rarity === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRarityChange(r)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-center text-xs font-semibold tracking-wider uppercase transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "border-border bg-card hover:bg-muted text-foreground"
                        )}
                      >
                        {r.replace("_", " ")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card Description / Wikitext Excerpt */}
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  Card Description / Wikitext Excerpt
                </label>
                <Textarea
                  value={state.description || state.wikiExcerpt || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange((p) => ({ ...p, description: val, wikiExcerpt: val }));
                  }}
                  placeholder="'''Bold''', ''Italics'', [[Link|Alias]]..."
                  rows={3}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Appearance & Artwork */}
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => toggleSection("materials")}
            className="text-foreground hover:bg-muted/40 flex w-full items-center justify-between p-4 text-sm font-semibold transition-colors"
          >
            <div className="flex items-center gap-2">
              <Gem className="text-primary h-4 w-4" />
              <span>Appearance & Artwork</span>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                openSections.materials && "rotate-180"
              )}
            />
          </button>

          {openSections.materials && (
            <div className="border-border space-y-4 border-t p-4 pt-0">
              {/* Visual Artwork & Media Sourcing Subsection */}
              <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-3 pt-3">
                <div className="flex items-center justify-between">
                  <div className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                    <ImageIcon className="text-primary h-4 w-4" />
                    <span>Card Artwork & Media</span>
                  </div>
                  {state.artworkUrl && (
                    <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-[11px]">
                      <input
                        type="checkbox"
                        checked={state.enableArtwork}
                        onChange={(e) =>
                          onChange((p) => ({ ...p, enableArtwork: e.target.checked }))
                        }
                        className="accent-primary h-3.5 w-3.5 rounded-md"
                      />
                      <span>Show on Card</span>
                    </label>
                  )}
                </div>

                {state.artworkUrl ? (
                  <div className="border-border bg-card flex items-center justify-between rounded-lg border p-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="bg-muted border-border flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                        <img
                          src={proxyCardArtwork(state.artworkUrl)}
                          alt="Artwork"
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-foreground truncate text-xs font-semibold">
                          {state.artworkSource === "WIKI_FETCHED"
                            ? "Wiki Article Artwork"
                            : "Custom Artwork"}
                        </div>
                        <div className="text-muted-foreground truncate font-mono text-[10px]">
                          {state.artworkUrl}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onChange((p) => ({ ...p, artworkUrl: null, enableArtwork: false }))
                      }
                      className="text-muted-foreground hover:text-destructive h-6 shrink-0 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <div>
                    <label className="text-muted-foreground mb-1 block text-xs font-medium">
                      Direct Image URL (or search via Lore Import)
                    </label>
                    <Input
                      value={state.artworkUrl || ""}
                      onChange={(e) =>
                        onChange((p) => ({
                          ...p,
                          artworkUrl: e.target.value || null,
                          enableArtwork: Boolean(e.target.value),
                          artworkSource: "FLAG",
                        }))
                      }
                      placeholder="https://..."
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                )}

                {state.artworkUrl && state.enableArtwork && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-muted-foreground shrink-0 text-xs font-medium">
                      Artwork Opacity:
                    </span>
                    <input
                      type="range"
                      min="0.10"
                      max="1.0"
                      step="0.05"
                      value={state.artworkOpacity ?? 0.85}
                      onChange={(e) =>
                        onChange((p) => ({ ...p, artworkOpacity: Number(e.target.value) }))
                      }
                      className="bg-muted accent-primary h-1 flex-1 rounded-lg"
                    />
                    <span className="text-foreground w-8 text-right font-mono text-xs">
                      {Math.round((state.artworkOpacity ?? 0.85) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Game-Icons & Vector Sigils Sub-Panel */}
              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                {/* Center Emblem */}
                <div className="border-border bg-muted/20 space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-semibold">Primary Icon</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenIconBrowser("emblem")}
                      className="h-6 gap-1 px-2 text-[10px]"
                    >
                      <Library className="text-primary h-3 w-3" />
                      4,100+ Icons
                    </Button>
                  </div>

                  {state.emblemIcon ? (
                    <div className="border-border bg-card flex items-center justify-between rounded-lg border p-1.5">
                      <div className="flex items-center gap-2">
                        <div className="bg-muted border-border flex h-6 w-6 items-center justify-center rounded border p-0.5">
                          <img
                            src={state.emblemIcon.path}
                            alt={state.emblemIcon.name}
                            className="h-full w-full object-contain invert filter dark:filter-none"
                          />
                        </div>
                        <span className="max-w-[90px] truncate text-xs font-medium">
                          {state.emblemIcon.name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange((p) => ({ ...p, emblemIcon: null }))}
                        className="text-muted-foreground hover:text-destructive h-5 px-1 text-[10px]"
                      >
                        Reset
                      </Button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-[11px] italic">
                      Default {getCategoryLabel(state.category)} Sigil
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-muted-foreground shrink-0 text-[11px]">Scale:</span>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.05"
                      value={state.emblemScale}
                      onChange={(e) =>
                        onChange((p) => ({ ...p, emblemScale: Number(e.target.value) }))
                      }
                      className="bg-muted accent-primary h-1 flex-1 rounded-lg"
                    />
                    <span className="text-foreground w-7 text-right font-mono text-[11px]">
                      {state.emblemScale.toFixed(2)}x
                    </span>
                  </div>

                  {/* Center Emblem Color Swatches */}
                  <div className="border-border/40 space-y-1.5 border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-[11px] font-semibold">
                        Emblem Color
                      </span>
                      <span className="text-primary font-mono text-[10px]">
                        {state.emblemColor ? state.emblemColor.toUpperCase() : "Auto"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {COLOR_PRESETS.map((preset) => {
                        const isActive = (state.emblemColor || "") === preset.value;
                        return (
                          <button
                            key={`emblem-${preset.id}`}
                            type="button"
                            title={preset.label}
                            onClick={() => onChange((p) => ({ ...p, emblemColor: preset.value }))}
                            className={cn(
                              "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all",
                              preset.bgClass,
                              isActive
                                ? "ring-primary ring-offset-background scale-110 border-white shadow-xs ring-2 ring-offset-2"
                                : "border-border/60 opacity-80 hover:scale-105 hover:opacity-100"
                            )}
                          />
                        );
                      })}
                      <label
                        className="border-border bg-card relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-all hover:scale-105"
                        title="Custom Hex Color"
                      >
                        <input
                          type="color"
                          value={state.emblemColor || "#f59e0b"}
                          onChange={(e) => onChange((p) => ({ ...p, emblemColor: e.target.value }))}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                        <Palette className="text-muted-foreground h-3 w-3" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Background Watermark Icon */}
                <div className="border-border bg-muted/20 space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-semibold">
                      Background Pattern / Icon
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenIconBrowser("watermark")}
                      className="h-6 gap-1 px-2 text-[10px]"
                    >
                      <Library className="text-primary h-3 w-3" />
                      Open
                    </Button>
                  </div>

                  {state.watermarkIcon ? (
                    <div className="border-border bg-card flex items-center justify-between rounded-lg border p-1.5">
                      <div className="flex items-center gap-2">
                        <div className="bg-muted border-border flex h-6 w-6 items-center justify-center rounded border p-0.5">
                          <img
                            src={state.watermarkIcon.path}
                            alt={state.watermarkIcon.name}
                            className="h-full w-full object-contain invert filter dark:filter-none"
                          />
                        </div>
                        <span className="max-w-[90px] truncate text-xs font-medium">
                          {state.watermarkIcon.name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange((p) => ({ ...p, watermarkIcon: null }))}
                        className="text-muted-foreground hover:text-destructive h-5 px-1 text-[10px]"
                      >
                        Reset
                      </Button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-[11px] italic">
                      Default {getCategoryLabel(state.category)} Watermark
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-muted-foreground shrink-0 text-[11px]">Opacity:</span>
                    <input
                      type="range"
                      min="0.05"
                      max="0.70"
                      step="0.05"
                      value={state.watermarkOpacity}
                      onChange={(e) =>
                        onChange((p) => ({ ...p, watermarkOpacity: Number(e.target.value) }))
                      }
                      className="bg-muted accent-primary h-1 flex-1 rounded-lg"
                    />
                    <span className="text-foreground w-7 text-right font-mono text-[11px]">
                      {Math.round(state.watermarkOpacity * 100)}%
                    </span>
                  </div>

                  {/* Watermark Color Swatches */}
                  <div className="border-border/40 space-y-1.5 border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-[11px] font-semibold">
                        Watermark Color
                      </span>
                      <span className="text-primary font-mono text-[10px]">
                        {state.watermarkColor ? state.watermarkColor.toUpperCase() : "Auto"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {COLOR_PRESETS.map((preset) => {
                        const isActive = (state.watermarkColor || "") === preset.value;
                        return (
                          <button
                            key={`watermark-${preset.id}`}
                            type="button"
                            title={preset.label}
                            onClick={() =>
                              onChange((p) => ({ ...p, watermarkColor: preset.value }))
                            }
                            className={cn(
                              "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all",
                              preset.bgClass,
                              isActive
                                ? "ring-primary ring-offset-background scale-110 border-white shadow-xs ring-2 ring-offset-2"
                                : "border-border/60 opacity-80 hover:scale-105 hover:opacity-100"
                            )}
                          />
                        );
                      })}
                      <label
                        className="border-border bg-card relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-all hover:scale-105"
                        title="Custom Hex Color"
                      >
                        <input
                          type="color"
                          value={state.watermarkColor || "#f59e0b"}
                          onChange={(e) =>
                            onChange((p) => ({ ...p, watermarkColor: e.target.value }))
                          }
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                        <Palette className="text-muted-foreground h-3 w-3" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Hue Override */}
              <div className="border-border flex items-center justify-between border-t pt-1">
                <div>
                  <span className="text-foreground block text-xs font-medium">
                    Custom Hue Override
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    Overrides base material gradient hue
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={state.accentColorOverride || "#6366f1"}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, accentColorOverride: e.target.value }))
                    }
                    className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent"
                  />
                  {state.accentColorOverride && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange((p) => ({ ...p, accentColorOverride: "" }))}
                      className="text-muted-foreground h-6 px-1.5 text-xs"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/*
                Category Accent Tinting Toggle (Hidden for S1 default UI)
                Reserved for future seasons, expansions, or un-tinted classic TCG variants.
                Assumed ON by default (enableCategoryTint: true).

              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                <div>
                  <div className="text-xs font-semibold text-foreground">Category Accent Tinting</div>
                  <div className="text-[11px] text-muted-foreground">
                    Blend {state.category} theme into specular highlights & border glows
                  </div>
                </div>
                <Button
                  variant={state.enableCategoryTint !== false ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange((p) => ({ ...p, enableCategoryTint: p.enableCategoryTint === false }))}
                  className="h-7 text-xs font-semibold px-3"
                >
                  {state.enableCategoryTint !== false ? "ON" : "OFF"}
                </Button>
              </div>
              */}

              {/*
                Card Back Layout Style Selector (Hidden for S1 default UI)
                Reserved for future seasons, expansion sets, or promo variants ("lattice", "zodiac", "runes").
                Defaults to "lattice" grid.

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Card Back Layout Style
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "lattice", label: "Icon Lattice Grid" },
                    { id: "zodiac", label: "Zodiac Ring Crest" },
                    { id: "runes", label: "Rune Pillar Columns" },
                  ].map((v) => {
                    const isSelected = (state.cardBackVariant || "lattice") === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() =>
                          onChange((p) => ({
                            ...p,
                            cardBackVariant: v.id as "lattice" | "zodiac" | "runes",
                          }))
                        }
                        className={cn(
                          "p-2 rounded-lg text-xs font-medium border text-center transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "border-border bg-card hover:bg-muted text-foreground"
                        )}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              */}

              {/*
                Holographic Specular Foil & Particle Density Sliders (Hidden for S1 default UI)
                Reserved for future seasons, ultra-rare foil variants, or special event cards.
                Defaults: holographicIntensity: 0.85, particleDensity: 0.5, foilSheen: true.

              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Holographic Specular Foil:</span>
                    <span className="font-mono text-foreground">
                      {Math.round((state.holographicIntensity ?? 0.85) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.holographicIntensity ?? 0.85}
                    onChange={(e) =>
                      onChange((p) => ({
                        ...p,
                        holographicIntensity: Number(e.target.value),
                      }))
                    }
                    className="w-full h-1 bg-muted rounded-lg accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Particle Density:</span>
                    <span className="font-mono text-foreground">
                      {Math.round((state.particleDensity ?? 0.8) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.particleDensity ?? 0.8}
                    onChange={(e) =>
                      onChange((p) => ({
                        ...p,
                        particleDensity: Number(e.target.value),
                      }))
                    }
                    className="w-full h-1 bg-muted rounded-lg accent-primary"
                  />
                </div>
              </div>
              */}
            </div>
          )}
        </div>

        {/* Section 4: Economy & Print Supply */}
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => toggleSection("economy")}
            className="text-foreground hover:bg-muted/40 flex w-full items-center justify-between p-4 text-sm font-semibold transition-colors"
          >
            <div className="flex items-center gap-2">
              <Coins className="text-primary h-4 w-4" />
              <span>Economy & Print Supply</span>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                openSections.economy && "rotate-180"
              )}
            />
          </button>

          {openSections.economy && (
            <div className="border-border space-y-3 border-t p-4 pt-0">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  Market Value (IxCredits)
                </label>
                <Input
                  type="number"
                  value={state.marketValue}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      marketValue: Number(e.target.value) || 0,
                      useAutoValuation: false,
                    }))
                  }
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-foreground block text-xs font-medium">
                    Limited Supply Print Run
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    Cap total prints in circulation
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={state.isLimitedSupply}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      isLimitedSupply: e.target.checked,
                      totalSupply: e.target.checked ? p.totalSupply || 100 : null,
                    }))
                  }
                  className="accent-primary h-4 w-4 rounded-md"
                />
              </div>

              {state.isLimitedSupply && (
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-medium">
                    Total Supply Cap
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={state.totalSupply ?? 100}
                    onChange={(e) =>
                      onChange((p) => ({
                        ...p,
                        totalSupply: Number(e.target.value) || 1,
                      }))
                    }
                    className="h-8 font-mono text-xs"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 5: Design Presets */}
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => toggleSection("presets")}
            className="text-foreground hover:bg-muted/40 flex w-full items-center justify-between p-4 text-sm font-semibold transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="text-primary h-4 w-4" />
              <span>Saved Design Presets</span>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                openSections.presets && "rotate-180"
              )}
            />
          </button>

          {openSections.presets && (
            <div className="border-border space-y-3 border-t p-4 pt-0">
              {/* Save New Preset */}
              <div className="flex gap-2">
                <Input
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder="Preset Name..."
                  className="h-8 text-xs"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!presetNameInput.trim()}
                  onClick={() => {
                    onSavePreset(presetNameInput.trim());
                    setPresetNameInput("");
                  }}
                  className="h-8 shrink-0 gap-1 text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>

              {/* Preset List */}
              {presets.length > 0 ? (
                <div className="max-h-40 space-y-1.5 overflow-y-auto pt-1">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="border-border bg-muted/20 hover:bg-muted/50 flex items-center justify-between rounded-lg border p-2 transition-colors"
                    >
                      <span className="text-foreground truncate text-xs font-medium">
                        {preset.name}
                      </span>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onLoadPreset(preset)}
                          className="text-primary h-6 px-2 text-[10px]"
                        >
                          Load
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeletePreset(preset.id)}
                          className="text-muted-foreground hover:text-destructive h-6 px-1.5 text-[10px]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground py-1 text-xs italic">
                  No saved presets yet. Type a name and save your layout!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 6: Publish to Database (Sticky Action Bar) */}
        <div className="pt-2">
          <Button
            variant="default"
            size="lg"
            onClick={onPublish}
            disabled={isPublishing || !state.title.trim()}
            className="h-11 w-full gap-2 text-sm font-bold shadow-lg"
          >
            <Send className="h-4 w-4" />
            {isPublishing ? "Publishing Card to Database..." : "Publish Designed Card to Database"}
          </Button>
        </div>
      </div>
    );
  }
);

DesignerControlRack.displayName = "DesignerControlRack";
