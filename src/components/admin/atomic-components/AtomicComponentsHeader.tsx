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
          <div className="border-border/40 bg-card/40 rounded-xl border p-2.5 backdrop-blur-md">
            <Icon className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-foreground text-lg font-bold tracking-tight md:text-xl">{title}</h1>
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenTemplates && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenTemplates}
              className="h-8 rounded-xl px-3 text-xs transition-transform active:scale-[0.98]"
            >
              <FileText className="text-muted-foreground mr-1.5 h-3.5 w-3.5" />
              Templates
            </Button>
          )}
        </div>
      </div>

      <p className="border-border/30 bg-card/25 text-muted-foreground flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed">
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
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-border/30 bg-background/50 focus:border-border/60 h-8 rounded-xl pl-8 text-xs backdrop-blur-md"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="border-border/30 bg-background/50 h-8 w-44 rounded-xl text-xs backdrop-blur-md">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Categories
            </SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category} className="text-xs">
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={complexityFilter} onValueChange={setComplexityFilter}>
          <SelectTrigger className="border-border/30 bg-background/50 h-8 w-40 rounded-xl text-xs backdrop-blur-md">
            <SelectValue placeholder="All Complexities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Complexities
            </SelectItem>
            {COMPLEXITY_LEVELS.map((level) => (
              <SelectItem key={level} value={level} className="text-xs">
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
