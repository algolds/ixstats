"use client";

/**
 * Atomic Filter Bar
 *
 * Search input with real-time filtering, embedded preset template dropdown,
 * and horizontal category filter pills with component count badges.
 */

import React, { useState } from "react";
import {
  Search,
  Xmark as X,
  Page as FileText,
  ViewGrid as Grid,
  Crown,
  Building,
  StatsReport as BarChart3,
  Cpu,
  Group as Users,
  Globe,
  LightBulb as Lightbulb,
  Leaf,
  Coins,
  Shield,
  Bank as Landmark,
  Industry as Factory,
  ShieldAlert,
  ShieldCheck,
  Palette,
  ModernTv,
  ScaleFrameEnlarge as Scale,
  Strategy,
  Key,
  Sparks,
  Flash as Zap,
  GraduationCap,
  Heart,
  Label as Tag,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import type { AtomicTemplate } from "./types";

export const DEFAULT_CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Government categories (exact strings from ATOMIC_COMPONENTS)
  administration: Building,
  crisis: ShieldAlert,
  cultural: Palette,
  culture: Palette,
  diplomacy: Globe,
  economic: BarChart3,
  environment: Leaf,
  general: Grid,
  governance: Crown,
  innovation: Lightbulb,
  legal: Scale,
  legitimacy: ShieldCheck,
  planning: Strategy,
  process: Cpu,
  security: Shield,
  social: Users,
  technology: ModernTv,

  // Government categories (exact strings from COMPONENT_CATEGORIES)
  "power distribution": Crown,
  "decision process": Cpu,
  "legitimacy sources": ShieldCheck,
  institutions: Landmark,
  "control mechanisms": Key,
  "administrative efficiency": Building,
  "social policy": Users,
  "international relations": Globe,
  "innovation & development": Lightbulb,
  "crisis management": ShieldAlert,

  // Economic categories (exact strings from COMPONENT_CATEGORIES & types)
  "economic model": BarChart3,
  "sector focus": Factory,
  "labor system": Users,
  "trade policy": Globe,
  "resource management": Leaf,
  "monetary policy": Coins,
  "fiscal policy": Landmark,

  // Tax categories (exact strings from ATOMIC_TAX_COMPONENTS)
  "collection methods": Coins,
  "revenue strategies": BarChart3,
  "compliance systems": ShieldCheck,
  "incentive structures": Sparks,

  // Common variations and aliases
  defense: Shield,
  military: Shield,
  judiciary: Scale,
  justice: Scale,
  law: Scale,
  courts: Scale,
  health: Heart,
  healthcare: Heart,
  education: GraduationCap,
  energy: Zap,
  finance: Landmark,
  financial: Landmark,
  taxes: Coins,
  tax: Coins,
  taxation: Coins,
  infrastructure: Building,
  welfare: Users,
  digital: ModernTv,
  foreign: Globe,
};

/**
 * Resolves an icon for any category string.
 * Supports caller overrides, exact matching, punctuation-tolerant lookup,
 * semantic keyword heuristic, and guaranteed contextual fallback.
 */
export function resolveCategoryIcon(
  category: string,
  customIcons?: Record<string, React.ComponentType<{ className?: string }>>
): React.ComponentType<{ className?: string }> {
  if (customIcons?.[category]) return customIcons[category];

  const lower = category.toLowerCase().trim();
  if (customIcons?.[lower]) return customIcons[lower];

  // Exact match
  if (DEFAULT_CATEGORY_ICONS[lower]) return DEFAULT_CATEGORY_ICONS[lower];

  // Normalized punctuation
  const cleanKey = lower.replace(/[^a-z0-9\s]/g, "").trim();
  if (DEFAULT_CATEGORY_ICONS[cleanKey]) return DEFAULT_CATEGORY_ICONS[cleanKey];

  // Semantic keyword heuristics
  if (lower.includes("tax") || lower.includes("coin") || lower.includes("currenc") || lower.includes("monet")) return Coins;
  if (lower.includes("econ") || lower.includes("financ") || lower.includes("fiscal") || lower.includes("revenu")) return BarChart3;
  if (lower.includes("gov") || lower.includes("crown") || lower.includes("power")) return Crown;
  if (lower.includes("admin") || lower.includes("bureau") || lower.includes("infrastruct")) return Building;
  if (lower.includes("crisis") || lower.includes("emergenc") || lower.includes("alert") || lower.includes("disast")) return ShieldAlert;
  if (lower.includes("secur") || lower.includes("defen") || lower.includes("milit")) return Shield;
  if (lower.includes("legal") || lower.includes("law") || lower.includes("justic") || lower.includes("judic") || lower.includes("court")) return Scale;
  if (lower.includes("legitim") || lower.includes("complian") || lower.includes("verif")) return ShieldCheck;
  if (lower.includes("control") || lower.includes("key") || lower.includes("lock")) return Key;
  if (lower.includes("social") || lower.includes("labor") || lower.includes("worker") || lower.includes("peopl") || lower.includes("welfar")) return Users;
  if (lower.includes("diplo") || lower.includes("relat") || lower.includes("foreign") || lower.includes("globe") || lower.includes("trade")) return Globe;
  if (lower.includes("innov") || lower.includes("develop") || lower.includes("research") || lower.includes("scienc")) return Lightbulb;
  if (lower.includes("tech") || lower.includes("digit") || lower.includes("cyber") || lower.includes("comput")) return ModernTv;
  if (lower.includes("cultur") || lower.includes("art") || lower.includes("herit")) return Palette;
  if (lower.includes("plan") || lower.includes("strat") || lower.includes("goal") || lower.includes("target")) return Strategy;
  if (lower.includes("resourc") || lower.includes("environ") || lower.includes("ecolog") || lower.includes("green")) return Leaf;
  if (lower.includes("sector") || lower.includes("indust") || lower.includes("manufact")) return Factory;
  if (lower.includes("process") || lower.includes("system") || lower.includes("decis")) return Cpu;
  if (lower.includes("health") || lower.includes("medic")) return Heart;
  if (lower.includes("educat") || lower.includes("school")) return GraduationCap;
  if (lower.includes("incent") || lower.includes("bonus") || lower.includes("spark")) return Sparks;
  if (lower.includes("institut") || lower.includes("bank")) return Landmark;

  // Ultimate fallback guarantees no pill renders without an icon
  return Tag;
}

export interface AtomicFilterBarProps<TType extends string = string> {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  categoryCounts?: Record<string, number>;
  categoryIcons?: Record<string, React.ComponentType<{ className?: string }>>;
  templates?: AtomicTemplate<TType>[];
  onTemplateSelect?: (templateId: string) => void;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export const AtomicFilterBar = React.memo(function AtomicFilterBar<TType extends string = string>({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  categoryCounts = {},
  categoryIcons = {},
  templates,
  onTemplateSelect,
  searchPlaceholder = "Search components...",
  disabled = false,
}: AtomicFilterBarProps<TType>) {
  const [isFocused, setIsFocused] = useState(false);

  const totalCount = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Top Search & Template Bar — Unified Inline Capsule */}
      <div
        className={cn(
          "group relative flex w-full items-center rounded-xl border bg-card/60 shadow-xs backdrop-blur-md transition-all duration-150",
          isFocused
            ? "border-primary/60 ring-1 ring-primary/20 shadow-xs"
            : "border-border/50 hover:border-border/80 hover:bg-card/80"
        )}
      >
        <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          className="h-10 w-full min-w-0 bg-transparent px-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50"
        />
        {searchQuery && (
          <Button
            size="sm"
            variant="ghost"
            className="mr-1.5 h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-foreground active:scale-[0.92]"
            onClick={() => onSearchChange("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Inline Templates Selector */}
        {templates && templates.length > 0 && onTemplateSelect && (
          <>
            <div className="h-5 w-px shrink-0 bg-border/50" />
            <div className="shrink-0 pr-1.5 pl-1">
              <Select onValueChange={onTemplateSelect} disabled={disabled}>
                <SelectTrigger className="h-7 gap-1.5 border-none bg-transparent px-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground active:scale-[0.97] focus:ring-0 shadow-none">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Quick Templates..." />
                </SelectTrigger>
                <SelectContent align="end" className="max-h-64">
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span className="font-medium truncate">{tpl.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {tpl.components.length} comps
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Category Pills Row */}
      <div
        onWheel={(e) => {
          if (e.deltaY !== 0 && !e.deltaX) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
        className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-0.5 scrollbar-thin scrollbar-thumb-border/40 hover:scrollbar-thumb-border/70 scrollbar-track-transparent scroll-smooth touch-pan-x"
      >
        <button
          type="button"
          onClick={() => onCategoryChange(null)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all select-none active:scale-[0.96]",
            selectedCategory === null
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border/50 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground"
          )}
        >
          <Grid className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span>All Categories</span>
          <Badge
            variant="secondary"
            className={cn(
              "px-1 py-0 text-[10px] leading-tight font-semibold border-none",
              selectedCategory === null ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {totalCount}
          </Badge>
        </button>

        {categories.map((cat) => {
          const count = categoryCounts[cat] ?? 0;
          const isSelected = selectedCategory === cat;
          const Icon = resolveCategoryIcon(cat, categoryIcons);

          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all select-none active:scale-[0.96]",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/50 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="capitalize">{cat}</span>
              <Badge
                variant="secondary"
                className={cn(
                  "px-1 py-0 text-[10px] leading-tight font-semibold border-none",
                  isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
});
