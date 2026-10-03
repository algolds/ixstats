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
import { Card } from "~/components/ui/card";

interface AtomicComponentManagerProps {
  domain: "economy" | "government";
}

export function AtomicComponentManager({ domain }: AtomicComponentManagerProps) {
  const catalog = useAtomicComponentCatalog(domain);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  if (catalog.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="rounded-card h-36 w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="rounded-row h-24" />
          <Skeleton className="rounded-row h-24" />
          <Skeleton className="rounded-row h-24" />
          <Skeleton className="rounded-row h-24" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="rounded-row h-56" />
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
        <Card className="p-12 text-center">
          <p className="text-label-secondary text-body">
            No {label} components match the current filters.
          </p>
        </Card>
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
