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

type CategoryIcon = React.ComponentType<{ className?: string }>;

/** Exact category names (government, economic, tax and common aliases) per icon. */
const ICON_CATEGORIES: Array<[CategoryIcon, string[]]> = [
  [Building, ["administration", "administrative efficiency", "infrastructure"]],
  [ShieldAlert, ["crisis", "crisis management"]],
  [Palette, ["cultural", "culture"]],
  [Globe, ["diplomacy", "international relations", "trade policy", "foreign"]],
  [BarChart3, ["economic", "economic model", "revenue strategies"]],
  [Leaf, ["environment", "resource management"]],
  [Grid, ["general"]],
  [Crown, ["governance", "power distribution"]],
  [Lightbulb, ["innovation", "innovation & development"]],
  [Scale, ["legal", "judiciary", "justice", "law", "courts"]],
  [ShieldCheck, ["legitimacy", "legitimacy sources", "compliance systems"]],
  [Strategy, ["planning"]],
  [Cpu, ["process", "decision process"]],
  [Shield, ["security", "defense", "military"]],
  [Users, ["social", "social policy", "labor system", "welfare"]],
  [ModernTv, ["technology", "digital"]],
  [Landmark, ["institutions", "fiscal policy", "finance", "financial"]],
  [Key, ["control mechanisms"]],
  [Factory, ["sector focus"]],
  [Coins, ["monetary policy", "collection methods", "taxes", "tax", "taxation"]],
  [Sparks, ["incentive structures"]],
  [Heart, ["health", "healthcare"]],
  [GraduationCap, ["education"]],
  [Zap, ["energy"]],
];

const DEFAULT_CATEGORY_ICONS: Record<string, CategoryIcon> = Object.fromEntries(
  ICON_CATEGORIES.flatMap(([icon, names]) => names.map((name) => [name, icon]))
);

/** Fallback by substring, first match wins. */
const KEYWORD_ICONS: Array<[CategoryIcon, string[]]> = [
  [Coins, ["tax", "coin", "currenc", "monet"]],
  [BarChart3, ["econ", "financ", "fiscal", "revenu"]],
  [Crown, ["gov", "crown", "power"]],
  [Building, ["admin", "bureau", "infrastruct"]],
  [ShieldAlert, ["crisis", "emergenc", "alert", "disast"]],
  [Shield, ["secur", "defen", "milit"]],
  [Scale, ["legal", "law", "justic", "judic", "court"]],
  [ShieldCheck, ["legitim", "complian", "verif"]],
  [Key, ["control", "key", "lock"]],
  [Users, ["social", "labor", "worker", "peopl", "welfar"]],
  [Globe, ["diplo", "relat", "foreign", "globe", "trade"]],
  [Lightbulb, ["innov", "develop", "research", "scienc"]],
  [ModernTv, ["tech", "digit", "cyber", "comput"]],
  [Palette, ["cultur", "art", "herit"]],
  [Strategy, ["plan", "strat", "goal", "target"]],
  [Leaf, ["resourc", "environ", "ecolog", "green"]],
  [Factory, ["sector", "indust", "manufact"]],
  [Cpu, ["process", "system", "decis"]],
  [Heart, ["health", "medic"]],
  [GraduationCap, ["educat", "school"]],
  [Sparks, ["incent", "bonus", "spark"]],
  [Landmark, ["institut", "bank"]],
];

/**
 * Resolves an icon for any category string: caller overrides, exact name, punctuation-tolerant
 * name, then a keyword heuristic, with a guaranteed fallback so no pill renders without an icon.
 */
function resolveCategoryIcon(
  category: string,
  customIcons?: Record<string, CategoryIcon>
): CategoryIcon {
  const lower = category.toLowerCase().trim();
  return (
    customIcons?.[category] ??
    customIcons?.[lower] ??
    DEFAULT_CATEGORY_ICONS[lower] ??
    DEFAULT_CATEGORY_ICONS[lower.replace(/[^a-z0-9\s]/g, "").trim()] ??
    KEYWORD_ICONS.find(([, keywords]) => keywords.some((k) => lower.includes(k)))?.[0] ??
    Tag
  );
}

interface AtomicFilterBarProps<TType extends string = string> {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  categoryCounts?: Record<string, number>;
  categoryIcons?: Record<string, CategoryIcon>;
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
    Icon: CategoryIcon,
    count: number
  ) => (
    <Toggle
      key={key}
      variant="outline"
      size="sm"
      pressed={selectedCategory === value}
      onPressedChange={() => onCategoryChange(value)}
      disabled={disabled}
      className="text-footnote shrink-0 rounded-full px-3 max-sm:h-11"
    >
      <Icon aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
      <span className="capitalize">{label}</span>
      <Badge variant="default" className="px-2 tabular-nums">
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
            className="text-label-secondary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={disabled}
            className="h-10 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <Button
              size="icon"
              variant="ghost"
              className="text-label-secondary hover:text-label absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2"
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
              className="text-footnote w-full data-[size=default]:h-10 sm:w-56"
            >
              <FileText aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
              <SelectValue placeholder="Quick templates" />
            </SelectTrigger>
            <SelectContent align="end" className="max-h-64">
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id} className="text-footnote">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="truncate font-medium">{tpl.name}</span>
                    <span className="text-label-secondary text-footnote shrink-0 tabular-nums">
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
        className="flex touch-pan-x items-center gap-2 overflow-x-auto pt-0.5 pb-2"
      >
        {renderFilter("__all", null, "All categories", Grid, totalCount)}
        {categories.map((cat) =>
          renderFilter(
            cat,
            cat,
            cat,
            resolveCategoryIcon(cat, categoryIcons),
            categoryCounts[cat] ?? 0
          )
        )}
      </div>
    </div>
  );
});
