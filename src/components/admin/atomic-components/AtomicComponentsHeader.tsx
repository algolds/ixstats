"use client";
// src/components/admin/atomic-components/AtomicComponentsHeader.tsx
// Universal Header & Filter Toolbar for Atomic Simulation Components

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Industry as Factory,
  City as Building2,
  Page as FileText,
  InfoCircle as Info,
  Search,
} from "iconoir-react";
import { COMPLEXITY_LEVELS } from "~/lib/admin/atomic-component-filters";

interface AtomicComponentsHeaderProps {
  domain: "economy" | "government";
  categories: readonly string[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  complexityFilter: string;
  setComplexityFilter: (comp: string) => void;
  onOpenTemplates?: () => void;
}

export function AtomicComponentsHeader({
  domain,
  categories,
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  complexityFilter,
  setComplexityFilter,
  onOpenTemplates,
}: AtomicComponentsHeaderProps) {
  const Icon = domain === "economy" ? Factory : Building2;
  const title = domain === "economy" ? "Economic Components" : "Government Components";
  const subtitle =
    domain === "economy"
      ? "Structural economic building blocks, tax impacts, and market multipliers"
      : "Governance institutions, bureaucratic efficiency, and political structures";
  const sourcePath = domain === "economy" ? "src/lib/economy/data/" : "src/lib/government/data/";

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="border-separator bg-surface rounded-row border p-2.5">
            <Icon className="text-tint h-5 w-5" />
          </div>
          <div>
            <h1 className="text-label text-title-3 md:text-title-2">{title}</h1>
            <p className="text-label-secondary text-footnote">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenTemplates && (
            <Button variant="outline" size="sm" onClick={onOpenTemplates}>
              <FileText className="text-label-secondary mr-1.5 h-3.5 w-3.5" />
              Templates
            </Button>
          )}
        </div>
      </div>

      <p className="border-separator bg-surface text-label-secondary rounded-row text-footnote flex items-start gap-2 border p-3 leading-relaxed">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Read-only. These components are defined in code (<code>{sourcePath}</code>), which the
          Country Builder, the editor and the simulation read directly, so changes ship with a code
          release rather than from this page.
        </span>
      </p>

      {/* Filter Rail */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative max-w-sm min-w-[200px] flex-1">
          <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-footnote">
              All Categories
            </SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category} className="text-footnote">
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={complexityFilter} onValueChange={setComplexityFilter}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="All Complexities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-footnote">
              All Complexities
            </SelectItem>
            {COMPLEXITY_LEVELS.map((level) => (
              <SelectItem key={level} value={level} className="text-footnote">
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
