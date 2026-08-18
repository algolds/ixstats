// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/app/admin/military-equipment/page.tsx
// Admin interface for managing military equipment catalog - unified tabbed interface
// Thin orchestrator composing hooks (useEquipmentCatalog, useManufacturerManagement,
// useEquipmentAnalytics) and tab components under components/admin/equipment/.

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Plus, ArrowLeft, Rocket, Factory, BarChart3, Target } from "lucide-react";

import { useEquipmentCatalog } from "~/hooks/useEquipmentCatalog";
import { useManufacturerManagement } from "~/hooks/useManufacturerManagement";
import { useEquipmentAnalytics } from "~/hooks/useEquipmentAnalytics";

import { CatalogTab } from "~/components/admin/equipment/CatalogTab";
import { ManufacturersTab } from "~/components/admin/equipment/ManufacturersTab";
import { AnalyticsTab } from "~/components/admin/equipment/AnalyticsTab";
import { SmallArmsTab } from "~/components/admin/equipment/SmallArmsTab";
import { EquipmentFormDialog } from "~/components/admin/equipment/EquipmentFormDialog";
import { ManufacturerFormDialog } from "~/components/admin/equipment/ManufacturerFormDialog";

export default function MilitaryEquipmentPage() {
  usePageTitle({ title: "Military Equipment Admin" });

  const { user, isLoaded } = useUser();

  // Main tab state
  const [activeMainTab, setActiveMainTab] = useState("catalog");

  // Equipment catalog (queries, filters, form/selection/dialog state, mutations)
  const catalog = useEquipmentCatalog();

  // Manufacturer management (query, filters/sort, form/dialog state, mutations)
  const manufacturers = useManufacturerManagement(activeMainTab);

  // Analytics + small arms queries
  const analytics = useEquipmentAnalytics(activeMainTab, catalog.showInactive);

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
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

  const openAddManufacturer = () => {
    manufacturers.setEditingManufacturerId(null);
    manufacturers.resetManufacturerForm();
    manufacturers.setIsManufacturerDialogOpen(true);
  };

  return (
    <div className="bg-background text-foreground min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header - Outside tabs, always visible */}
        <div className="glass-card-parent mb-6 rounded-xl border-2 border-red-500/20 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                  <Rocket className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                    Military Equipment Catalog
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Manage equipment catalog, manufacturers, and analytics
                  </p>
                </div>
              </div>
            </div>
            {activeMainTab === "catalog" && (
              <Button
                onClick={() => catalog.setIsAddDialogOpen(true)}
                className="bg-red-500/20 text-red-500 hover:bg-red-500/30"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Equipment
              </Button>
            )}
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
          <TabsList className="glass-card-parent flex w-full gap-2 overflow-x-auto border-b border-white/10 p-2">
            <TabsTrigger value="catalog" className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Equipment Catalog
            </TabsTrigger>
            <TabsTrigger value="manufacturers" className="flex items-center gap-2">
              <Factory className="h-4 w-4" />
              Manufacturers
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="small-arms" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Small Arms
            </TabsTrigger>
          </TabsList>

          {/* Tab Content: Equipment Catalog */}
          <TabsContent value="catalog">
            <CatalogTab
              selectedCategory={catalog.selectedCategory}
              setSelectedCategory={catalog.setSelectedCategory}
              searchQuery={catalog.searchQuery}
              setSearchQuery={catalog.setSearchQuery}
              eraFilter={catalog.eraFilter}
              setEraFilter={catalog.setEraFilter}
              subcategoryFilter={catalog.subcategoryFilter}
              setSubcategoryFilter={catalog.setSubcategoryFilter}
              techLevelRange={catalog.techLevelRange}
              setTechLevelRange={catalog.setTechLevelRange}
              costRange={catalog.costRange}
              setCostRange={catalog.setCostRange}
              showInactive={catalog.showInactive}
              setShowInactive={catalog.setShowInactive}
              selectedIds={catalog.selectedIds}
              setSelectedIds={catalog.setSelectedIds}
              equipmentData={catalog.equipmentData}
              filteredEquipment={catalog.filteredEquipment}
              manufacturers={catalog.manufacturers}
              isLoading={catalog.isLoading}
              setIsAddDialogOpen={catalog.setIsAddDialogOpen}
              handleBulkToggle={catalog.handleBulkToggle}
              toggleSelection={catalog.toggleSelection}
              toggleSelectAll={catalog.toggleSelectAll}
              handleEdit={catalog.handleEdit}
              handleClone={catalog.handleClone}
              handleDelete={catalog.handleDelete}
            />
          </TabsContent>

          {/* Tab Content: Manufacturers */}
          <TabsContent value="manufacturers">
            <ManufacturersTab
              manufacturerSearchQuery={manufacturers.manufacturerSearchQuery}
              setManufacturerSearchQuery={manufacturers.setManufacturerSearchQuery}
              countryFilter={manufacturers.countryFilter}
              setCountryFilter={manufacturers.setCountryFilter}
              showInactiveManufacturers={manufacturers.showInactiveManufacturers}
              setShowInactiveManufacturers={manufacturers.setShowInactiveManufacturers}
              countries={manufacturers.countries}
              normalizedManufacturers={manufacturers.normalizedManufacturers}
              filteredManufacturers={manufacturers.filteredManufacturers}
              manufacturersLoading={manufacturers.manufacturersLoading}
              onAddManufacturer={openAddManufacturer}
              handleSort={manufacturers.handleSort}
              handleEditManufacturer={manufacturers.handleEditManufacturer}
              handleToggleActive={manufacturers.handleToggleActive}
            />
          </TabsContent>

          {/* Tab Content: Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsTab
              usageStats={analytics.usageStats}
              manufacturerStats={analytics.manufacturerStats}
              allEquipment={analytics.allEquipment}
              isLoading={analytics.analyticsLoading}
              error={analytics.analyticsError}
            />
          </TabsContent>

          {/* Tab Content: Small Arms */}
          <TabsContent value="small-arms">
            <SmallArmsTab
              smallArmsEquipment={analytics.smallArmsEquipment}
              smallArmsStats={analytics.smallArmsStats}
              smallArmsLoading={analytics.smallArmsLoading}
            />
          </TabsContent>
        </Tabs>

        {/* Equipment Editor Dialog */}
        {(catalog.isAddDialogOpen || catalog.editingEquipment) && (
          <EquipmentFormDialog
            isOpen={catalog.isAddDialogOpen || !!catalog.editingEquipment}
            isEditing={!!catalog.editingEquipment}
            formData={catalog.formData}
            setFormData={catalog.setFormData}
            activeTab={catalog.activeTab}
            setActiveTab={catalog.setActiveTab}
            manufacturers={catalog.manufacturers || []}
            onClose={() => {
              catalog.setIsAddDialogOpen(false);
              catalog.setEditingEquipment(null);
              catalog.resetForm();
            }}
            onSave={catalog.editingEquipment ? catalog.handleUpdate : catalog.handleCreate}
            isPending={catalog.createMutation.isPending || catalog.updateMutation.isPending}
          />
        )}

        {/* Manufacturer Dialog */}
        <ManufacturerFormDialog
          isOpen={manufacturers.isManufacturerDialogOpen}
          onOpenChange={(open) => {
            manufacturers.setIsManufacturerDialogOpen(open);
            if (!open) {
              manufacturers.setEditingManufacturerId(null);
              manufacturers.resetManufacturerForm();
            }
          }}
          editingManufacturerId={manufacturers.editingManufacturerId}
          manufacturerFormData={manufacturers.manufacturerFormData}
          setManufacturerFormData={manufacturers.setManufacturerFormData}
          onCancel={() => manufacturers.setIsManufacturerDialogOpen(false)}
          onSave={
            manufacturers.editingManufacturerId
              ? manufacturers.handleUpdateManufacturer
              : manufacturers.handleCreateManufacturer
          }
          isPending={
            manufacturers.createManufacturerMutation.isPending ||
            manufacturers.updateManufacturerMutation.isPending
          }
        />
      </div>
    </div>
  );
}
