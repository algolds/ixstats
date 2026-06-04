"use client";

// src/hooks/useEquipmentMutations.ts
// Equipment catalog mutations (create/update/delete/bulkToggle) + their action handlers.

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { EquipmentFormData } from "~/lib/equipment-catalog-utils";

interface UseEquipmentMutationsArgs {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
  editingEquipment: any | null;
  setEditingEquipment: (eq: any | null) => void;
  setIsAddDialogOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  resetForm: () => void;
  refetch: () => void;
}

export function useEquipmentMutations({
  formData,
  setFormData,
  editingEquipment,
  setEditingEquipment,
  setIsAddDialogOpen,
  setActiveTab,
  selectedIds,
  setSelectedIds,
  resetForm,
  refetch,
}: UseEquipmentMutationsArgs) {
  const notify = useNotify();

  // Mutations - Equipment Catalog
  const createMutation = api.militaryEquipment.createCatalogEquipment.useMutation({
    onSuccess: () => {
      notify.success("Success", "Equipment created successfully");
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to create equipment");
    },
  });

  const updateMutation = api.militaryEquipment.updateCatalogEquipment.useMutation({
    onSuccess: () => {
      notify.success("Success", "Equipment updated successfully");
      refetch();
      setEditingEquipment(null);
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to update equipment");
    },
  });

  const deleteMutation = api.militaryEquipment.deleteCatalogEquipment.useMutation({
    onSuccess: () => {
      notify.success("Success", "Equipment deactivated successfully");
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to deactivate equipment");
    },
  });

  const bulkToggleMutation = api.militaryEquipment.bulkToggleEquipment.useMutation({
    onSuccess: () => {
      notify.success("Success", "Bulk operation completed successfully");
      refetch();
      setSelectedIds(new Set());
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to complete bulk operation");
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      key: formData.key,
      name: formData.name,
      manufacturer: formData.manufacturer,
      category: formData.category as any,
      subcategory: formData.subcategory,
      era: formData.era as any,
      specifications: formData.specifications,
      capabilities: formData.capabilities,
      acquisitionCost: formData.acquisitionCost,
      maintenanceCost: formData.maintenanceCost,
      technologyLevel: formData.technologyLevel,
      crewRequirement: formData.crewRequirement,
      maintenanceHours: formData.maintenanceHours,
      imageUrl: formData.imageUrl || undefined,
      description: formData.description || undefined,
      historicalContext: formData.historicalContext || undefined,
      isActive: formData.isActive,
    } as any);
  };

  const handleUpdate = () => {
    if (!editingEquipment?.id) return;

    updateMutation.mutate({
      id: editingEquipment.id,
      name: formData.name,
      category: formData.category as any,
      subcategory: formData.subcategory,
      era: formData.era as any,
      manufacturer: formData.manufacturer,
      specifications: formData.specifications,
      capabilities: formData.capabilities,
      acquisitionCost: formData.acquisitionCost,
      maintenanceCost: formData.maintenanceCost,
      technologyLevel: formData.technologyLevel,
      crewRequirement: formData.crewRequirement,
      maintenanceHours: formData.maintenanceHours,
      imageUrl: formData.imageUrl || undefined,
      description: formData.description || undefined,
      historicalContext: formData.historicalContext || undefined,
      isActive: formData.isActive,
    } as any);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to deactivate "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (equipment: any) => {
    setFormData({
      key: equipment.key,
      name: equipment.name,
      manufacturer: equipment.manufacturer,
      category: equipment.category,
      subcategory: equipment.subcategory || "",
      era: equipment.era,
      specifications: equipment.specifications || {},
      capabilities: equipment.capabilities || {},
      acquisitionCost: equipment.acquisitionCost,
      maintenanceCost: equipment.maintenanceCost,
      technologyLevel: equipment.technologyLevel,
      crewRequirement: equipment.crewRequirement,
      maintenanceHours: equipment.maintenanceHours || 0,
      imageUrl: equipment.imageUrl || "",
      description: equipment.description || "",
      historicalContext: equipment.historicalContext || "",
      isActive: equipment.isActive,
    });
    setEditingEquipment(equipment);
    setActiveTab("general");
  };

  const handleClone = (equipment: any) => {
    setFormData({
      key: `${equipment.key}_COPY`,
      name: `${equipment.name} (Copy)`,
      manufacturer: equipment.manufacturer,
      category: equipment.category,
      subcategory: equipment.subcategory || "",
      era: equipment.era,
      specifications: equipment.specifications || {},
      capabilities: equipment.capabilities || {},
      acquisitionCost: equipment.acquisitionCost,
      maintenanceCost: equipment.maintenanceCost,
      technologyLevel: equipment.technologyLevel,
      crewRequirement: equipment.crewRequirement,
      maintenanceHours: equipment.maintenanceHours || 0,
      imageUrl: equipment.imageUrl || "",
      description: equipment.description || "",
      historicalContext: equipment.historicalContext || "",
      isActive: true,
    });
    setIsAddDialogOpen(true);
    setActiveTab("general");
  };

  const handleBulkToggle = (isActive: boolean) => {
    if (selectedIds.size === 0) {
      notify.warning("No selection", "Please select at least one equipment item");
      return;
    }

    bulkToggleMutation.mutate({
      equipmentIds: Array.from(selectedIds),
      isActive,
    });
  };

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    bulkToggleMutation,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleEdit,
    handleClone,
    handleBulkToggle,
  };
}
