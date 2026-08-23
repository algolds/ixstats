// src/app/admin/diplomatic-scenarios/page.tsx
// Admin interface for managing diplomatic scenarios - dynamic scenario templates with player choices

"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/auth";
import { Card } from "~/components/ui/card";
import { useDiplomaticScenariosAdmin } from "~/hooks/admin/useDiplomaticScenariosAdmin";
import { DiplomaticScenariosHeader } from "~/components/admin/diplomatic-scenarios/DiplomaticScenariosHeader";
import { DiplomaticScenarioBulkActions } from "~/components/admin/diplomatic-scenarios/DiplomaticScenarioBulkActions";
import { DiplomaticScenarioCard } from "~/components/admin/diplomatic-scenarios/DiplomaticScenarioCard";
import { DiplomaticScenarioFormDialog } from "~/components/admin/diplomatic-scenarios/DiplomaticScenarioFormDialog";

export default function DiplomaticScenariosPage() {
  usePageTitle({ title: "Diplomatic Scenarios Admin" });

  const { user, isLoaded } = useUser();
  const admin = useDiplomaticScenariosAdmin();

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
        <DiplomaticScenariosHeader
          typeFilter={admin.typeFilter}
          setTypeFilter={admin.setTypeFilter}
          relationshipFilter={admin.relationshipFilter}
          setRelationshipFilter={admin.setRelationshipFilter}
          difficultyFilter={admin.difficultyFilter}
          setDifficultyFilter={admin.setDifficultyFilter}
          timeFrameFilter={admin.timeFrameFilter}
          setTimeFrameFilter={admin.setTimeFrameFilter}
          searchQuery={admin.searchQuery}
          setSearchQuery={admin.setSearchQuery}
          showInactive={admin.showInactive}
          setShowInactive={admin.setShowInactive}
          onOpenAddDialog={() => admin.setIsAddDialogOpen(true)}
        />

        {/* Bulk Actions */}
        <DiplomaticScenarioBulkActions
          selectedCount={admin.selectedIds.size}
          totalCount={admin.filteredScenarios.length}
          onSelectAll={admin.handleSelectAll}
          onBulkActivate={admin.handleBulkActivate}
          onBulkDeactivate={admin.handleBulkDeactivate}
        />

        {/* Scenarios Grid */}
        {admin.isLoading ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[--intel-gold]"></div>
            <p className="text-muted-foreground">Loading scenarios...</p>
          </div>
        ) : admin.filteredScenarios.length === 0 ? (
          <Card className="facet-card-parent p-12 text-center">
            <p className="text-[--intel-silver]">No scenarios found matching your filters</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {admin.filteredScenarios.map((scenario: any) => (
              <DiplomaticScenarioCard
                key={scenario.id}
                scenario={scenario}
                isSelected={admin.selectedIds.has(scenario.id)}
                onToggleSelect={() => admin.handleToggleSelect(scenario.id)}
                onEdit={() => admin.handleEdit(scenario)}
                onClone={() => admin.handleClone(scenario)}
                onDelete={() => admin.handleDelete(scenario.id, scenario.title)}
              />
            ))}
          </div>
        )}

        {/* Editor Dialog */}
        {(admin.isAddDialogOpen || admin.editingScenario) && (
          <DiplomaticScenarioFormDialog
            isOpen={admin.isAddDialogOpen || !!admin.editingScenario}
            isEditing={!!admin.editingScenario}
            formData={admin.formData}
            setFormData={admin.setFormData}
            responseOptions={admin.responseOptions}
            setResponseOptions={admin.setResponseOptions}
            activeTab={admin.activeTab}
            setActiveTab={admin.setActiveTab}
            choiceFormData={admin.choiceFormData}
            setChoiceFormData={admin.setChoiceFormData}
            editingChoiceIndex={admin.editingChoiceIndex}
            countries={admin.countries}
            onAddChoice={admin.handleAddChoice}
            onEditChoice={admin.handleEditChoice}
            onSaveChoice={admin.handleSaveChoice}
            onDeleteChoice={admin.handleDeleteChoice}
            onCancelChoiceEdit={admin.handleCancelChoiceEdit}
            onClose={admin.handleCloseDialog}
            onSave={admin.editingScenario ? admin.handleUpdate : admin.handleCreate}
            isPending={admin.isPending}
          />
        )}
      </div>
    </div>
  );
}
