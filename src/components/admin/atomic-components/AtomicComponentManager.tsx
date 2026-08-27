// src/components/admin/atomic-components/AtomicComponentManager.tsx
// Unified orchestrator for Atomic Simulation Components (Economic & Government CMS)
"use client";

import { useEconomicComponentsAdmin } from "~/hooks/admin/useEconomicComponentsAdmin";
import { useGovernmentComponentsAdmin } from "~/hooks/admin/useGovernmentComponentsAdmin";
import { AtomicComponentsHeader } from "./AtomicComponentsHeader";
import { AtomicComponentStats } from "./AtomicComponentStats";
import { AtomicComponentCard } from "./AtomicComponentCard";
import { EconomicComponentFormDialog } from "~/components/admin/economic-components/EconomicComponentFormDialog";
import { GovernmentComponentFormDialog } from "~/components/admin/government-components/GovernmentComponentFormDialog";
import { EconomicSynergyDialog } from "~/components/admin/economic-components/EconomicSynergyDialog";
import { GovernmentSynergyDialog } from "~/components/admin/government-components/GovernmentSynergyDialog";
import { EconomicTemplateDialog } from "~/components/admin/economic-components/EconomicTemplateDialog";
import { Skeleton } from "~/components/ui/skeleton";

interface AtomicComponentManagerProps {
  domain: "economy" | "government";
}

export function AtomicComponentManager({ domain }: AtomicComponentManagerProps) {
  if (domain === "economy") {
    return <EconomicManager />;
  }
  return <GovernmentManager />;
}

function EconomicManager() {
  const admin = useEconomicComponentsAdmin();

  if (admin.isLoading) {
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

  const components = admin.filteredComponents || [];
  const activeCount = components.filter((c: any) => c.isActive).length;
  const categories = new Set(components.map((c: any) => c.category)).size;

  return (
    <div className="space-y-6">
      <AtomicComponentsHeader
        domain="economy"
        searchTerm={admin.searchTerm}
        setSearchTerm={admin.setSearchTerm}
        categoryFilter={admin.categoryFilter}
        setCategoryFilter={admin.setCategoryFilter}
        complexityFilter={admin.complexityFilter}
        setComplexityFilter={admin.setComplexityFilter}
        showActiveOnly={admin.showActiveOnly}
        setShowActiveOnly={admin.setShowActiveOnly}
        onOpenAddDialog={() => {
          admin.resetForm();
          admin.setIsAddDialogOpen(true);
        }}
        onOpenTemplates={() => admin.setIsTemplateManagerOpen(true)}
        onOpenSynergyMatrix={() => admin.setIsSynergyMatrixOpen(true)}
      />

      <AtomicComponentStats
        domain="economy"
        totalCount={components.length}
        activeCount={activeCount}
        synergyCount={admin.stats?.totalSynergies || 0}
        categoryCount={categories}
      />

      {components.length === 0 ? (
        <div className="border-border/40 bg-card/20 rounded-2xl border p-12 text-center backdrop-blur-md">
          <p className="text-muted-foreground text-sm">
            No economic components found matching current filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {components.map((component: any) => (
            <AtomicComponentCard
              key={component.id}
              component={component}
              domain="economy"
              onEdit={() => admin.handleEdit(component)}
              onDelete={() => admin.handleDelete(component.id, component.name)}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <EconomicComponentFormDialog
        isOpen={admin.isAddDialogOpen || !!admin.editingComponent}
        isEditing={!!admin.editingComponent}
        formData={admin.formData}
        setFormData={admin.setFormData}
        activeTab={admin.activeTab}
        setActiveTab={admin.setActiveTab}
        onClose={admin.handleCloseEditor}
        onSave={admin.editingComponent ? admin.handleUpdate : admin.handleCreate}
        isPending={admin.isPending}
      />

      {/* Synergy Matrix Dialog */}
      <EconomicSynergyDialog
        isOpen={admin.isSynergyMatrixOpen}
        onClose={() => admin.setIsSynergyMatrixOpen(false)}
        components={admin.components}
        onCreateSynergy={(data) => admin.createSynergyMutation.mutate(data)}
      />

      {/* Template Dialog */}
      <EconomicTemplateDialog
        isOpen={admin.isTemplateManagerOpen}
        onClose={() => admin.setIsTemplateManagerOpen(false)}
        templates={admin.templates}
      />
    </div>
  );
}

function GovernmentManager() {
  const admin = useGovernmentComponentsAdmin();

  if (admin.isLoading) {
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

  const components = admin.filteredComponents || [];
  const activeCount = components.filter((c: any) => c.isActive).length;
  const categories = new Set(components.map((c: any) => c.category)).size;

  return (
    <div className="space-y-6">
      <AtomicComponentsHeader
        domain="government"
        searchTerm={admin.searchTerm}
        setSearchTerm={admin.setSearchTerm}
        categoryFilter={admin.categoryFilter}
        setCategoryFilter={admin.setCategoryFilter}
        complexityFilter={admin.complexityFilter}
        setComplexityFilter={admin.setComplexityFilter}
        showActiveOnly={admin.showActiveOnly}
        setShowActiveOnly={admin.setShowActiveOnly}
        onOpenAddDialog={() => {
          admin.resetForm();
          admin.setIsAddDialogOpen(true);
        }}
        onOpenSynergyMatrix={() => admin.setIsSynergyMatrixOpen(true)}
      />

      <AtomicComponentStats
        domain="government"
        totalCount={components.length}
        activeCount={activeCount}
        synergyCount={admin.stats?.summary?.totalUsage || 0}
        categoryCount={categories}
      />

      {components.length === 0 ? (
        <div className="border-border/40 bg-card/20 rounded-2xl border p-12 text-center backdrop-blur-md">
          <p className="text-muted-foreground text-sm">
            No government components found matching current filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {components.map((component: any) => (
            <AtomicComponentCard
              key={component.id}
              component={component}
              domain="government"
              onEdit={() => admin.handleEdit(component)}
              onDelete={() => admin.handleDelete(component.id, component.name)}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <GovernmentComponentFormDialog
        isOpen={admin.isAddDialogOpen || !!admin.editingComponent}
        isEditing={!!admin.editingComponent}
        formData={admin.formData}
        setFormData={admin.setFormData}
        activeTab={admin.activeTab}
        setActiveTab={admin.setActiveTab}
        onClose={admin.handleCloseEditor}
        onSave={admin.editingComponent ? admin.handleUpdate : admin.handleCreate}
        isPending={admin.isPending}
      />

      {/* Synergy Matrix Dialog */}
      <GovernmentSynergyDialog
        isOpen={admin.isSynergyMatrixOpen}
        onClose={() => admin.setIsSynergyMatrixOpen(false)}
        components={admin.components}
        onCreateSynergy={(data) => admin.createSynergyMutation.mutate(data)}
      />
    </div>
  );
}

export default AtomicComponentManager;
