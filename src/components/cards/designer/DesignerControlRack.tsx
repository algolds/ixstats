/**
 * DesignerControlRack Component
 *
 * Multi-section interactive control rack for the 3D Card Designer.
 * Uses standard Facet design tokens, theme compliance, and clean accessible controls.
 */

"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Library,
  Gem,
  BookOpen,
  Search,
  Coins,
  Save,
  Send,
  ChevronDown,
  Trash2,
  FolderOpen,
  Image as ImageIcon,
  Palette,
  Settings,
  Pencil,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { CategoryIcon } from "~/components/cards/icons";
import {
  LoreCategory,
  BROWSABLE_CATEGORIES,
  getCategoryLabel,
  getCategoryTheme,
  getCategorySubcategories,
} from "~/lib/cards";
import { proxyCardArtwork } from "~/lib/cards";
import type { CardRarity } from "@prisma/client";

import {
  type CardDesignState,
  type CardDesignPreset,
  RARITY_BASE_VALUES,
} from "./types";

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
  { id: "auto", label: "Auto (Category Accent)", value: "", bgClass: "bg-gradient-to-tr from-amber-500 via-cyan-400 to-rose-500" },
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
        marketValue: prev.useAutoValuation ? RARITY_BASE_VALUES[rarity] ?? prev.marketValue : prev.marketValue,
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
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("identity")}
            className="flex items-center justify-between w-full p-4 font-semibold text-sm text-foreground hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>Overview & Basic Info</span>
            </div>
            <ChevronDown
              className={cn("w-4 h-4 text-muted-foreground transition-transform", openSections.identity && "rotate-180")}
            />
          </button>

          {openSections.identity && (
            <div className="p-4 pt-0 space-y-4 border-t border-border">
              {/* LoreScanner Master Action Trigger */}
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenLoreImport}
                className="w-full h-10 px-3.5 flex items-center justify-between text-xs font-semibold border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl shadow-xs transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  <span>Scan & Import Lore Archive</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                  <span>LoreScanner</span>
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                </div>
              </Button>

              {/* Card Title & Article Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Card Title</label>
                  <Input
                    value={state.title}
                    onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Archivist of the Dawn"
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Article / Page Title</label>
                  <Input
                    value={state.wikiArticleTitle}
                    onChange={(e) => onChange((p) => ({ ...p, wikiArticleTitle: e.target.value }))}
                    placeholder="e.g. Great Archives of Ogma"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Category Selector Grid with Anchored Dropdown directly under active button */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Lore Category & Subcategory
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
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
                            "flex items-center justify-between gap-1 p-2 rounded-xl text-xs font-medium border transition-all text-left cursor-pointer w-full z-10",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold ring-1 ring-primary/40"
                              : "border-border bg-card hover:bg-muted text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CategoryIcon category={cat} treatment="seal" size="xs" color={theme?.accentColor} />
                            <span className="truncate">{getCategoryLabel(cat)}</span>
                          </div>
                          {isSelected && (
                            <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 opacity-80 transition-transform", isPopoverOpen && "rotate-180")} />
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
                              "absolute top-full mt-1.5 z-40 w-64 sm:w-72 rounded-2xl border border-border bg-popover/95 backdrop-blur-md shadow-xl p-3 space-y-2.5 text-popover-foreground",
                              isRightEdge ? "right-0" : "left-0"
                            )}
                          >
                            {/* Popover Header */}
                            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CategoryIcon category={cat} treatment="seal" size="xs" color={theme?.accentColor} />
                                <span className="text-xs font-bold truncate">
                                  {getCategoryLabel(cat)} Subcategories
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowCustomSubInput((s) => !s);
                                }}
                                className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1 rounded-md hover:bg-muted"
                                title="Toggle Custom Subcategory Name"
                              >
                                <Pencil className="w-3 h-3 text-primary" />
                                <span>{showCustomSubInput ? "Presets" : "Edit"}</span>
                              </button>
                            </div>

                            {/* Subcategory Chips or Custom Name Input */}
                            {showCustomSubInput ? (
                              <Input
                                value={state.subcategory || ""}
                                onChange={(e) => onChange((p) => ({ ...p, subcategory: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    setActivePopoverCat(null);
                                  }
                                }}
                                placeholder="Type custom subcategory name..."
                                className="h-8 text-xs font-medium"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap max-h-44 overflow-y-auto pr-0.5">
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
                                        "px-2.5 py-1 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs text-left",
                                        isSubSelected
                                          ? "bg-primary text-primary-foreground border-primary font-semibold ring-1 ring-primary/40 scale-[1.02]"
                                          : "border-border/80 bg-card hover:bg-muted text-foreground hover:border-border"
                                      )}
                                    >
                                      <img
                                        src={sub.iconPath}
                                        alt={sub.label}
                                        className={cn(
                                          "w-3.5 h-3.5 object-contain shrink-0",
                                          isSubSelected
                                            ? "filter invert dark:filter-none"
                                            : "filter invert dark:filter-none opacity-75"
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
                <label className="text-xs font-medium text-muted-foreground">Card Season</label>

                <div className="flex items-center gap-1.5">
                  {showSeasonDropdown ? (
                    <select
                      value={state.season || 1}
                      onChange={(e) => {
                        onChange((p) => ({ ...p, season: Number(e.target.value) || 1 }));
                        setShowSeasonDropdown(false);
                      }}
                      className="w-auto h-7 px-2 py-0.5 rounded-lg border border-primary bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border/70 bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer select-none"
                      title="Click to change season"
                    >
                      <span>Season {state.season || 1}</span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-normal">Synced</span>
                      <Settings className="w-3 h-3 text-muted-foreground hover:text-foreground ml-0.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Rarity Tier Selector */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rarity Tier</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {ALL_RARITIES.map((r) => {
                    const isSelected = state.rarity === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRarityChange(r)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center uppercase tracking-wider",
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                  className="text-xs font-mono leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Appearance & Artwork */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("materials")}
            className="flex items-center justify-between w-full p-4 font-semibold text-sm text-foreground hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Gem className="w-4 h-4 text-primary" />
              <span>Appearance & Artwork</span>
            </div>
            <ChevronDown
              className={cn("w-4 h-4 text-muted-foreground transition-transform", openSections.materials && "rotate-180")}
            />
          </button>

          {openSections.materials && (
            <div className="p-4 pt-0 space-y-4 border-t border-border">
              {/* Visual Artwork & Media Sourcing Subsection */}
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    <span>Card Artwork & Media</span>
                  </div>
                  {state.artworkUrl && (
                    <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.enableArtwork}
                        onChange={(e) => onChange((p) => ({ ...p, enableArtwork: e.target.checked }))}
                        className="w-3.5 h-3.5 rounded-md accent-primary"
                      />
                      <span>Show on Card</span>
                    </label>
                  )}
                </div>

                {state.artworkUrl ? (
                  <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex items-center justify-center border border-border shrink-0">
                        <img
                          src={proxyCardArtwork(state.artworkUrl)}
                          alt="Artwork"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {state.artworkSource === "WIKI_FETCHED" ? "Wiki Article Artwork" : "Custom Artwork"}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate font-mono">
                          {state.artworkUrl}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange((p) => ({ ...p, artworkUrl: null, enableArtwork: false }))}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                )}

                {state.artworkUrl && state.enableArtwork && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs text-muted-foreground shrink-0 font-medium">Artwork Opacity:</span>
                    <input
                      type="range"
                      min="0.10"
                      max="1.0"
                      step="0.05"
                      value={state.artworkOpacity ?? 0.85}
                      onChange={(e) => onChange((p) => ({ ...p, artworkOpacity: Number(e.target.value) }))}
                      className="flex-1 h-1 bg-muted rounded-lg accent-primary"
                    />
                    <span className="text-xs font-mono text-foreground w-8 text-right">
                      {Math.round((state.artworkOpacity ?? 0.85) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Game-Icons & Vector Sigils Sub-Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Center Emblem */}
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Primary Icon</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenIconBrowser("emblem")}
                      className="h-6 text-[10px] gap-1 px-2"
                    >
                      <Library className="w-3 h-3 text-primary" />
                      4,100+ Icons
                    </Button>
                  </div>

                  {state.emblemIcon ? (
                    <div className="flex items-center justify-between p-1.5 rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-muted p-0.5 flex items-center justify-center border border-border">
                          <img
                            src={state.emblemIcon.path}
                            alt={state.emblemIcon.name}
                            className="w-full h-full object-contain filter invert dark:filter-none"
                          />
                        </div>
                        <span className="text-xs font-medium truncate max-w-[90px]">{state.emblemIcon.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange((p) => ({ ...p, emblemIcon: null }))}
                        className="h-5 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        Reset
                      </Button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic">
                      Default {getCategoryLabel(state.category)} Sigil
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground shrink-0">Scale:</span>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.05"
                      value={state.emblemScale}
                      onChange={(e) => onChange((p) => ({ ...p, emblemScale: Number(e.target.value) }))}
                      className="flex-1 h-1 bg-muted rounded-lg accent-primary"
                    />
                    <span className="text-[11px] font-mono text-foreground w-7 text-right">
                      {state.emblemScale.toFixed(2)}x
                    </span>
                  </div>

                  {/* Center Emblem Color Swatches */}
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-foreground">Emblem Color</span>
                      <span className="text-[10px] font-mono text-primary">
                        {state.emblemColor ? state.emblemColor.toUpperCase() : "Auto"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map((preset) => {
                        const isActive = (state.emblemColor || "") === preset.value;
                        return (
                          <button
                            key={`emblem-${preset.id}`}
                            type="button"
                            title={preset.label}
                            onClick={() => onChange((p) => ({ ...p, emblemColor: preset.value }))}
                            className={cn(
                              "w-5 h-5 rounded-full border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                              preset.bgClass,
                              isActive
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 border-white shadow-xs"
                                : "border-border/60 hover:scale-105 opacity-80 hover:opacity-100"
                            )}
                          />
                        );
                      })}
                      <label
                        className="relative w-5 h-5 rounded-full border border-border bg-card cursor-pointer hover:scale-105 transition-all flex items-center justify-center shrink-0 overflow-hidden"
                        title="Custom Hex Color"
                      >
                        <input
                          type="color"
                          value={state.emblemColor || "#f59e0b"}
                          onChange={(e) => onChange((p) => ({ ...p, emblemColor: e.target.value }))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Palette className="w-3 h-3 text-muted-foreground" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Background Watermark Icon */}
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Background Pattern / Icon</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenIconBrowser("watermark")}
                      className="h-6 text-[10px] gap-1 px-2"
                    >
                      <Library className="w-3 h-3 text-primary" />
                      Open 
                    </Button>
                  </div>

                  {state.watermarkIcon ? (
                    <div className="flex items-center justify-between p-1.5 rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-muted p-0.5 flex items-center justify-center border border-border">
                          <img
                            src={state.watermarkIcon.path}
                            alt={state.watermarkIcon.name}
                            className="w-full h-full object-contain filter invert dark:filter-none"
                          />
                        </div>
                        <span className="text-xs font-medium truncate max-w-[90px]">{state.watermarkIcon.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange((p) => ({ ...p, watermarkIcon: null }))}
                        className="h-5 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        Reset
                      </Button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic">
                      Default {getCategoryLabel(state.category)} Watermark
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground shrink-0">Opacity:</span>
                    <input
                      type="range"
                      min="0.05"
                      max="0.70"
                      step="0.05"
                      value={state.watermarkOpacity}
                      onChange={(e) => onChange((p) => ({ ...p, watermarkOpacity: Number(e.target.value) }))}
                      className="flex-1 h-1 bg-muted rounded-lg accent-primary"
                    />
                    <span className="text-[11px] font-mono text-foreground w-7 text-right">
                      {Math.round(state.watermarkOpacity * 100)}%
                    </span>
                  </div>

                  {/* Watermark Color Swatches */}
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-foreground">Watermark Color</span>
                      <span className="text-[10px] font-mono text-primary">
                        {state.watermarkColor ? state.watermarkColor.toUpperCase() : "Auto"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map((preset) => {
                        const isActive = (state.watermarkColor || "") === preset.value;
                        return (
                          <button
                            key={`watermark-${preset.id}`}
                            type="button"
                            title={preset.label}
                            onClick={() => onChange((p) => ({ ...p, watermarkColor: preset.value }))}
                            className={cn(
                              "w-5 h-5 rounded-full border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                              preset.bgClass,
                              isActive
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 border-white shadow-xs"
                                : "border-border/60 hover:scale-105 opacity-80 hover:opacity-100"
                            )}
                          />
                        );
                      })}
                      <label
                        className="relative w-5 h-5 rounded-full border border-border bg-card cursor-pointer hover:scale-105 transition-all flex items-center justify-center shrink-0 overflow-hidden"
                        title="Custom Hex Color"
                      >
                        <input
                          type="color"
                          value={state.watermarkColor || "#f59e0b"}
                          onChange={(e) => onChange((p) => ({ ...p, watermarkColor: e.target.value }))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Palette className="w-3 h-3 text-muted-foreground" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Hue Override */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <div>
                  <span className="text-xs font-medium text-foreground block">Custom Hue Override</span>
                  <span className="text-[10px] text-muted-foreground">Overrides base material gradient hue</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={state.accentColorOverride || "#6366f1"}
                    onChange={(e) => onChange((p) => ({ ...p, accentColorOverride: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  {state.accentColorOverride && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange((p) => ({ ...p, accentColorOverride: "" }))}
                      className="h-6 px-1.5 text-xs text-muted-foreground"
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
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("economy")}
            className="flex items-center justify-between w-full p-4 font-semibold text-sm text-foreground hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              <span>Economy & Print Supply</span>
            </div>
            <ChevronDown
              className={cn("w-4 h-4 text-muted-foreground transition-transform", openSections.economy && "rotate-180")}
            />
          </button>

          {openSections.economy && (
            <div className="p-4 pt-0 space-y-3 border-t border-border">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Market Value (IxCredits)</label>
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
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-medium text-foreground block">Limited Supply Print Run</span>
                  <span className="text-[10px] text-muted-foreground">Cap total prints in circulation</span>
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
                  className="w-4 h-4 rounded-md accent-primary"
                />
              </div>

              {state.isLimitedSupply && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Total Supply Cap</label>
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
                    className="h-8 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 5: Design Presets */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("presets")}
            className="flex items-center justify-between w-full p-4 font-semibold text-sm text-foreground hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              <span>Saved Design Presets</span>
            </div>
            <ChevronDown
              className={cn("w-4 h-4 text-muted-foreground transition-transform", openSections.presets && "rotate-180")}
            />
          </button>

          {openSections.presets && (
            <div className="p-4 pt-0 space-y-3 border-t border-border">
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
                  className="h-8 text-xs gap-1 shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </Button>
              </div>

              {/* Preset List */}
              {presets.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-xs font-medium text-foreground truncate">{preset.name}</span>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onLoadPreset(preset)}
                          className="h-6 px-2 text-[10px] text-primary"
                        >
                          Load
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeletePreset(preset.id)}
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic py-1">
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
            className="w-full h-11 gap-2 text-sm font-bold shadow-lg"
          >
            <Send className="w-4 h-4" />
            {isPublishing ? "Publishing Card to Database..." : "Publish Designed Card to Database"}
          </Button>
        </div>
      </div>
    );
  }
);

DesignerControlRack.displayName = "DesignerControlRack";
