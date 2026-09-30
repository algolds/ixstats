"use client";
// src/components/admin/atomic-components/AtomicComponentsHeader.tsx
// Universal Header & Filter Toolbar for Atomic Simulation Components

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
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
  Plus,
  Page as FileText,
  Network,
  Search,
} from "iconoir-react";

interface AtomicComponentsHeaderProps {
  domain: "economy" | "government";
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  complexityFilter: string;
  setComplexityFilter: (comp: string) => void;
  showActiveOnly: boolean;
  setShowActiveOnly: (active: boolean) => void;
  onOpenAddDialog: () => void;
  onOpenTemplates?: () => void;
  onOpenSynergyMatrix: () => void;
}

export function AtomicComponentsHeader({
  domain,
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  complexityFilter,
  setComplexityFilter,
  showActiveOnly,
  setShowActiveOnly,
  onOpenAddDialog,
  onOpenTemplates,
  onOpenSynergyMatrix,
}: AtomicComponentsHeaderProps) {
  const Icon = domain === "economy" ? Factory : Building2;
  const title = domain === "economy" ? "Economic Components" : "Government Components";
  const subtitle =
    domain === "economy"
      ? "Manage structural economic building blocks, tax impacts, and market multipliers"
      : "Manage governance institutions, bureaucratic efficiency, and political structures";

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
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSynergyMatrix}
            className="h-8 rounded-xl px-3 text-xs transition-transform active:scale-[0.98]"
          >
            <Network className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
            Synergy Matrix
          </Button>
          <Button
            size="sm"
            onClick={onOpenAddDialog}
            className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Component
          </Button>
        </div>
      </div>

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
            <SelectItem value="infrastructure" className="text-xs">
              Infrastructure
            </SelectItem>
            <SelectItem value="industry" className="text-xs">
              Industry & Commerce
            </SelectItem>
            <SelectItem value="finance" className="text-xs">
              Finance & Banking
            </SelectItem>
            <SelectItem value="agriculture" className="text-xs">
              Agriculture & Resources
            </SelectItem>
            <SelectItem value="administration" className="text-xs">
              Administration
            </SelectItem>
            <SelectItem value="welfare" className="text-xs">
              Welfare & Social
            </SelectItem>
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
            <SelectItem value="basic" className="text-xs">
              Basic (Tier 1)
            </SelectItem>
            <SelectItem value="intermediate" className="text-xs">
              Intermediate (Tier 2)
            </SelectItem>
            <SelectItem value="advanced" className="text-xs">
              Advanced (Tier 3)
            </SelectItem>
            <SelectItem value="expert" className="text-xs">
              Expert (Tier 4)
            </SelectItem>
          </SelectContent>
        </Select>

        <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 px-2 text-xs select-none">
          <Checkbox
            id="active-only"
            checked={showActiveOnly}
            onCheckedChange={(checked) => setShowActiveOnly(!!checked)}
            className="h-3.5 w-3.5"
          />
          <span>Active only</span>
        </label>
      </div>
    </div>
  );
}
