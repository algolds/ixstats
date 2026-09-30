"use client";

/**
 * Atomic Filter Bar
 *
 * Search input with real-time filtering, a preset template Select, and a horizontally
 * scrolling row of category Toggles with component count badges.
 */

import React from "react";
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
import { Input } from "~/components/ui/input";
import { Toggle } from "~/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
  const totalCount = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);

  const renderFilter = (
    key: string,
    value: string | null,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    count: number
  ) => (
    <Toggle
      key={key}
      variant="outline"
      size="sm"
      pressed={selectedCategory === value}
      onPressedChange={() => onCategoryChange(value)}
      disabled={disabled}
      className="shrink-0 rounded-full px-3 text-xs max-sm:h-11"
    >
      <Icon aria-hidden="true" className="text-muted-foreground h-3.5 w-3.5" />
      <span className="capitalize">{label}</span>
      <Badge variant="secondary" className="px-1.5 tabular-nums">
        {count}
      </Badge>
    </Toggle>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search and templates */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={disabled}
            className="facet-refraction-none h-10 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {templates && templates.length > 0 && onTemplateSelect && (
          <Select onValueChange={onTemplateSelect} disabled={disabled}>
            <SelectTrigger
              aria-label="Quick templates"
              className="w-full text-xs data-[size=default]:h-10 sm:w-56"
            >
              <FileText aria-hidden="true" className="text-muted-foreground h-3.5 w-3.5" />
              <SelectValue placeholder="Quick templates" />
            </SelectTrigger>
            <SelectContent align="end" className="max-h-64">
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="truncate font-medium">{tpl.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {tpl.components.length} comps
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Category filters */}
      <div
        role="group"
        aria-label="Filter by category"
        onWheel={(e) => {
          if (e.deltaY !== 0 && !e.deltaX) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
        className="flex touch-pan-x items-center gap-1.5 overflow-x-auto pt-0.5 pb-2"
      >
        {renderFilter("__all", null, "All categories", Grid, totalCount)}
        {categories.map((cat) =>
          renderFilter(cat, cat, cat, resolveCategoryIcon(cat, categoryIcons), categoryCounts[cat] ?? 0)
        )}
      </div>
    </div>
  );
});
