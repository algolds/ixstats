// src/app/admin/military-equipment/MilitaryEquipmentPanel.tsx
// Unified tabbed Military Equipment Catalog Admin Panel
"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Plus,
  Rocket,
  Industry as Factory,
  StatsReport as BarChart3,
  Archery as Target,
} from "iconoir-react";
import { AdminHeader } from "../_components/AdminHeader";

import { useEquipmentCatalog } from "~/hooks/useEquipmentCatalog";
import { useManufacturerManagement } from "~/hooks/useManufacturerManagement";
import { useEquipmentAnalytics } from "~/hooks/useEquipmentAnalytics";

import { CatalogTab } from "~/components/admin/equipment/CatalogTab";
import { ManufacturersTab } from "~/components/admin/equipment/ManufacturersTab";
import { AnalyticsTab } from "~/components/admin/equipment/AnalyticsTab";
import { SmallArmsTab } from "~/components/admin/equipment/SmallArmsTab";
import { EquipmentFormDialog } from "~/components/admin/equipment/EquipmentFormDialog";
import { ManufacturerFormDialog } from "~/components/admin/equipment/ManufacturerFormDialog";

export function MilitaryEquipmentPanel() {
  usePageTitle({ title: "Admin - Military Equipment" });

  // Main tab state
  const [activeMainTab, setActiveMainTab] = useState("catalog");

  // Equipment catalog
  const catalog = useEquipmentCatalog();

  // Manufacturer management
  const manufacturers = useManufacturerManagement(activeMainTab);

  // Analytics + small arms queries
  const analytics = useEquipmentAnalytics(activeMainTab, catalog.showInactive);

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Rocket}
        title="Military Equipment Catalog"
        description="Comprehensive defense systems catalog, small arms registry, defense manufacturers, and market intelligence."
      />

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <TabsList className="bg-card/40 border-border/40 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md sm:w-auto">
            <TabsTrigger
              value="catalog"
              className="flex items-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              <Rocket className="h-4 w-4" />
              Equipment Catalog
            </TabsTrigger>
            <TabsTrigger
              value="manufacturers"
              className="flex items-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              <Factory className="h-4 w-4" />
              Manufacturers
            </TabsTrigger>
            <TabsTrigger
              value="small-arms"
              className="flex items-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              <Target className="h-4 w-4" />
              Small Arms
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex items-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {activeMainTab === "catalog" && (
              <Button
                onClick={() => catalog.setIsAddDialogOpen(true)}
                size="sm"
                className="text-xs active:scale-[0.98]"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Equipment
              </Button>
            )}
            {activeMainTab === "manufacturers" && (
              <Button
                onClick={() => manufacturers.setIsManufacturerDialogOpen(true)}
                size="sm"
                className="text-xs active:scale-[0.98]"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Manufacturer
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="catalog" className="mt-6 focus-visible:outline-none">
          <CatalogTab
            {...catalog}
            manufacturers={manufacturers.normalizedManufacturers}
          />
        </TabsContent>

        <TabsContent value="manufacturers" className="mt-6 focus-visible:outline-none">
          <ManufacturersTab
            {...manufacturers}
            onAddManufacturer={() => manufacturers.setIsManufacturerDialogOpen(true)}
          />
        </TabsContent>

        <TabsContent value="small-arms" className="mt-6 focus-visible:outline-none">
          <SmallArmsTab {...analytics} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6 focus-visible:outline-none">
          <AnalyticsTab
            usageStats={analytics.usageStats}
            manufacturerStats={analytics.manufacturerStats}
            allEquipment={analytics.allEquipment}
            isLoading={analytics.analyticsLoading}
            error={analytics.analyticsError}
          />
        </TabsContent>
      </Tabs>

      {/* Equipment Add/Edit Dialog */}
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
        }}
        onSave={
          catalog.editingEquipment ? catalog.handleUpdate : catalog.handleCreate
        }
        isPending={
          catalog.createMutation.isPending || catalog.updateMutation.isPending
        }
      />

      {/* Manufacturer Add/Edit Dialog */}
      <ManufacturerFormDialog
        isOpen={
          manufacturers.isManufacturerDialogOpen ||
          !!manufacturers.editingManufacturerId
        }
        onOpenChange={manufacturers.setIsManufacturerDialogOpen}
        editingManufacturerId={manufacturers.editingManufacturerId}
        manufacturerFormData={manufacturers.manufacturerFormData}
        setManufacturerFormData={manufacturers.setManufacturerFormData}
        onCancel={() => {
          manufacturers.setIsManufacturerDialogOpen(false);
          manufacturers.setEditingManufacturerId(null);
        }}
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
  );
}

export default MilitaryEquipmentPanel;
