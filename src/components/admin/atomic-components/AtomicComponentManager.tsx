"use client";
// src/components/admin/atomic-components/AtomicComponentManager.tsx
// Read-only catalog of the atomic government and economic components. The components are
// defined in code (~/lib/government/data, ~/lib/economy/data), which the builder, editor and
// calculations read directly, so this page browses them rather than editing them.

import { useState } from "react";
import { useAtomicComponentCatalog } from "~/hooks/admin/useAtomicComponentCatalog";
import { AtomicComponentsHeader } from "./AtomicComponentsHeader";
import { AtomicComponentStats } from "./AtomicComponentStats";
import { AtomicComponentCard } from "./AtomicComponentCard";
import { EconomicTemplateDialog } from "~/components/admin/economic-components/EconomicTemplateDialog";
import { Skeleton } from "~/components/ui/skeleton";

interface AtomicComponentManagerProps {
  domain: "economy" | "government";
}

export function AtomicComponentManager({ domain }: AtomicComponentManagerProps) {
  const catalog = useAtomicComponentCatalog(domain);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  if (catalog.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const label = domain === "economy" ? "economic" : "government";

  return (
    <div className="space-y-6">
      <AtomicComponentsHeader
        domain={domain}
        categories={catalog.categories}
        searchTerm={catalog.searchTerm}
        setSearchTerm={catalog.setSearchTerm}
        categoryFilter={catalog.categoryFilter}
        setCategoryFilter={catalog.setCategoryFilter}
        complexityFilter={catalog.complexityFilter}
        setComplexityFilter={catalog.setComplexityFilter}
        onOpenTemplates={domain === "economy" ? () => setIsTemplateDialogOpen(true) : undefined}
      />

      <AtomicComponentStats
        totalCount={catalog.components.length}
        adoptionCount={catalog.adoptionCount}
        synergyCount={catalog.synergyCount}
        categoryCount={catalog.categories.length}
      />

      {catalog.filteredComponents.length === 0 ? (
        <div className="border-border/40 bg-card/20 rounded-2xl border p-12 text-center backdrop-blur-md">
          <p className="text-muted-foreground text-sm">
            No {label} components match the current filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalog.filteredComponents.map((component) => (
            <AtomicComponentCard key={component.type} component={component} domain={domain} />
          ))}
        </div>
      )}

      {domain === "economy" && (
        <EconomicTemplateDialog
          isOpen={isTemplateDialogOpen}
          onClose={() => setIsTemplateDialogOpen(false)}
          templates={catalog.templates}
        />
      )}
    </div>
  );
}

export default AtomicComponentManager;
