"use client";
// src/app/admin/diplomatic-scenarios/DiplomaticScenariosPanel.tsx
// Admin interface for managing diplomatic scenarios - dynamic scenario templates with player choices

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useDiplomaticScenariosAdmin } from "~/hooks/admin/useDiplomaticScenariosAdmin";
import { DiplomaticScenariosHeader } from "~/components/admin/diplomatic-scenarios/DiplomaticScenariosHeader";
import { DiplomaticScenarioBulkActions } from "~/components/admin/diplomatic-scenarios/DiplomaticScenarioBulkActions";
import { DiplomaticScenarioCard } from "~/components/admin/diplomatic-scenarios/DiplomaticScenarioCard";
import { DiplomaticScenarioFormDialog } from "~/components/admin/diplomatic-scenarios/DiplomaticScenarioFormDialog";
import { DiplomaticScenariosAnalyticsTab } from "./_components/DiplomaticScenariosAnalyticsTab";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Shield, StatsReport as BarChart3 } from "iconoir-react";
import { AdminHeader } from "../_components/AdminHeader";

export function DiplomaticScenariosPanel() {
  usePageTitle({ title: "Admin - Diplomatic Scenarios" });
  const [activeMainTab, setActiveMainTab] = useState("catalog");
  const admin = useDiplomaticScenariosAdmin();

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Shield}
        title="Diplomatic Scenarios"
        description="Author and calibrate dynamic diplomatic crisis decision scenarios, requirements, and branching resolution trees."
      />

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList className="bg-card/40 border-border/40 flex w-full max-w-xs justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
            <TabsTrigger
              value="catalog"
              className="flex flex-1 items-center justify-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
            >
              <Shield className="h-4 w-4 text-purple-400" />
              Scenarios
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex flex-1 items-center justify-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
            >
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analytics" className="mt-6 focus-visible:outline-none">
          <DiplomaticScenariosAnalyticsTab />
        </TabsContent>

        <TabsContent value="catalog" className="mt-6 space-y-6 focus-visible:outline-none">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : admin.filteredScenarios.length === 0 ? (
            <div className="border-border/30 bg-card/25 rounded-2xl border p-12 text-center backdrop-blur-md">
              <p className="text-muted-foreground text-xs">
                No scenarios found matching your filters
              </p>
            </div>
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
        </TabsContent>
      </Tabs>

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
  );
}

export default DiplomaticScenariosPanel;
