// src/app/admin/economic-components/page.tsx
// Admin interface for managing economic components and synergy relationships

"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/auth";
import { Card } from "~/components/ui/card";
import { useEconomicComponentsAdmin } from "~/hooks/admin/useEconomicComponentsAdmin";
import { EconomicComponentsHeader } from "~/components/admin/economic-components/EconomicComponentsHeader";
import { EconomicComponentStats } from "~/components/admin/economic-components/EconomicComponentStats";
import { EconomicComponentCard } from "~/components/admin/economic-components/EconomicComponentCard";
import { EconomicComponentFormDialog } from "~/components/admin/economic-components/EconomicComponentFormDialog";
import { EconomicSynergyDialog } from "~/components/admin/economic-components/EconomicSynergyDialog";
import { EconomicTemplateDialog } from "~/components/admin/economic-components/EconomicTemplateDialog";

export default function EconomicComponentsPage() {
  usePageTitle({ title: "Economic Components Admin" });

  const { user, isLoaded } = useUser();
  const admin = useEconomicComponentsAdmin();

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[--intel-gold]"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <SignInButton mode="modal" />
      </div>
    );
  }

  const allowedRoles = new Set(["admin", "owner", "staff"]);
  const isSystemOwnerUser = !!user && isSystemOwner(user.id);
  const hasAdminRole =
    typeof user?.publicMetadata?.role === "string" && allowedRoles.has(user.publicMetadata.role);

  if (!isSystemOwnerUser && !hasAdminRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="border-border bg-card rounded-lg border p-8 text-center shadow-lg">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <EconomicComponentsHeader
          searchTerm={admin.searchTerm}
          setSearchTerm={admin.setSearchTerm}
          categoryFilter={admin.categoryFilter}
          setCategoryFilter={admin.setCategoryFilter}
          complexityFilter={admin.complexityFilter}
          setComplexityFilter={admin.setComplexityFilter}
          showActiveOnly={admin.showActiveOnly}
          setShowActiveOnly={admin.setShowActiveOnly}
          onOpenAddDialog={() => admin.setIsAddDialogOpen(true)}
          onOpenTemplates={() => admin.setIsTemplateManagerOpen(true)}
          onOpenSynergyMatrix={() => admin.setIsSynergyMatrixOpen(true)}
        />

        {/* Statistics */}
        <EconomicComponentStats stats={admin.stats} />

        {/* Components Grid */}
        {admin.isLoading ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[--intel-gold]"></div>
            <p className="text-muted-foreground">Loading components...</p>
          </div>
        ) : admin.filteredComponents.length === 0 ? (
          <Card className="glass-card-parent p-12 text-center">
            <p className="text-[--intel-silver]">No components found matching your filters</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {admin.filteredComponents.map((component) => (
              <EconomicComponentCard
                key={component.id}
                component={component}
                onEdit={() => admin.handleEdit(component)}
                onDelete={() =>
                  admin.handleDelete((component as any).type || component.id, component.name)
                }
              />
            ))}
          </div>
        )}

        {/* Editor Dialog */}
        {(admin.isAddDialogOpen || admin.editingComponent) && (
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
        )}

        {/* Template Manager Modal */}
        {admin.isTemplateManagerOpen && (
          <EconomicTemplateDialog
            isOpen={admin.isTemplateManagerOpen}
            templates={admin.templates}
            onClose={() => admin.setIsTemplateManagerOpen(false)}
          />
        )}

        {/* Synergy Matrix Modal */}
        {admin.isSynergyMatrixOpen && (
          <EconomicSynergyDialog
            isOpen={admin.isSynergyMatrixOpen}
            components={admin.components || []}
            onClose={() => admin.setIsSynergyMatrixOpen(false)}
            onCreateSynergy={(data) => admin.createSynergyMutation.mutate(data)}
          />
        )}
      </div>
    </div>
  );
}
