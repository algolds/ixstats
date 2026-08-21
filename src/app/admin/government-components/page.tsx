// src/app/admin/government-components/page.tsx
// Admin interface for managing government components and synergy relationships

"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/auth";
import { Card } from "~/components/ui/card";
import { useGovernmentComponentsAdmin } from "~/hooks/admin/useGovernmentComponentsAdmin";
import { GovernmentComponentsHeader } from "~/components/admin/government-components/GovernmentComponentsHeader";
import { GovernmentComponentStats } from "~/components/admin/government-components/GovernmentComponentStats";
import { GovernmentComponentCard } from "~/components/admin/government-components/GovernmentComponentCard";
import { GovernmentComponentFormDialog } from "~/components/admin/government-components/GovernmentComponentFormDialog";
import { GovernmentSynergyDialog } from "~/components/admin/government-components/GovernmentSynergyDialog";

export default function GovernmentComponentsPage() {
  usePageTitle({ title: "Government Components Admin" });

  const { user, isLoaded } = useUser();
  const admin = useGovernmentComponentsAdmin();

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
        <GovernmentComponentsHeader
          searchTerm={admin.searchTerm}
          setSearchTerm={admin.setSearchTerm}
          categoryFilter={admin.categoryFilter}
          setCategoryFilter={admin.setCategoryFilter}
          complexityFilter={admin.complexityFilter}
          setComplexityFilter={admin.setComplexityFilter}
          showActiveOnly={admin.showActiveOnly}
          setShowActiveOnly={admin.setShowActiveOnly}
          onOpenAddDialog={() => admin.setIsAddDialogOpen(true)}
          onOpenSynergyMatrix={() => admin.setIsSynergyMatrixOpen(true)}
        />

        {/* Statistics */}
        <GovernmentComponentStats stats={admin.stats as any} />

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
            {admin.filteredComponents.map((component: any) => (
              <GovernmentComponentCard
                key={component.id}
                component={component}
                onEdit={() => admin.handleEdit(component)}
                onDelete={() =>
                  admin.handleDelete(component.type || component.id, component.name)
                }
              />
            ))}
          </div>
        )}

        {/* Editor Dialog */}
        {(admin.isAddDialogOpen || admin.editingComponent) && (
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
        )}

        {/* Synergy Matrix Modal */}
        {admin.isSynergyMatrixOpen && (
          <GovernmentSynergyDialog
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
