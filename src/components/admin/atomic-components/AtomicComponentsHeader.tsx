"use client";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ValueSelect } from "~/components/ui/value-select";
import { Page as FileText, InfoCircle as Info, Search } from "iconoir-react";
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
  const title = domain === "economy" ? "Economic Components" : "Government Components";
  const subtitle =
    domain === "economy"
      ? "Economic building blocks, tax impacts and market multipliers."
      : "Governance institutions, bureaucratic efficiency and political structures.";
  const sourcePath = domain === "economy" ? "src/lib/economy/data/" : "src/lib/government/data/";

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          onOpenTemplates && (
            <Button variant="outline" size="sm" onClick={onOpenTemplates}>
              <FileText />
              Templates
            </Button>
          )
        }
      />

      <p className="border-separator bg-surface text-label-secondary rounded-row text-footnote flex items-start gap-2 border p-3 leading-relaxed">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Read-only. These components are defined in code (<code>{sourcePath}</code>), which the
          Country Builder, the editor and the simulation read directly, so changes ship with a code
          release rather than from this page.
        </span>
      </p>

      {/* Filter Rail */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm min-w-[200px] flex-1">
          <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search components"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
          />
        </div>

        <ValueSelect
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          options={[
            ["all", "All categories"],
            ...categories.map((category) => [category, category] as const),
          ]}
          size="sm"
          className="w-44"
          placeholder="All categories"
          itemClassName="text-footnote"
        />

        <ValueSelect
          value={complexityFilter}
          onValueChange={setComplexityFilter}
          options={[
            ["all", "All complexities"],
            ...COMPLEXITY_LEVELS.map((level) => [level, level] as const),
          ]}
          size="sm"
          className="w-40"
          placeholder="All complexities"
          itemClassName="text-footnote"
        />
      </div>
    </div>
  );
}
