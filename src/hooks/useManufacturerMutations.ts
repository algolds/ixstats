"use client";

// src/hooks/useManufacturerMutations.ts
// Manufacturer mutations (create/update) + their action handlers.

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { Manufacturer, ManufacturerFormData } from "~/lib/manufacturer-utils";

interface UseManufacturerMutationsArgs {
  manufacturerFormData: ManufacturerFormData;
  setManufacturerFormData: (data: ManufacturerFormData) => void;
  editingManufacturerId: string | null;
  setEditingManufacturerId: (id: string | null) => void;
  setIsManufacturerDialogOpen: (open: boolean) => void;
  resetManufacturerForm: () => void;
  refetchManufacturers: () => void;
}

export function useManufacturerMutations({
  manufacturerFormData,
  setManufacturerFormData,
  editingManufacturerId,
  setEditingManufacturerId,
  setIsManufacturerDialogOpen,
  resetManufacturerForm,
  refetchManufacturers,
}: UseManufacturerMutationsArgs) {
  const notify = useNotify();

  const createManufacturerMutation = api.militaryEquipment.createManufacturer.useMutation({
    onSuccess: () => {
      notify.success("Success", "Manufacturer created successfully");
      refetchManufacturers();
      setIsManufacturerDialogOpen(false);
      resetManufacturerForm();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to create manufacturer");
    },
  });

  const updateManufacturerMutation = api.militaryEquipment.updateManufacturer.useMutation({
    onSuccess: () => {
      notify.success("Success", "Manufacturer updated successfully");
      refetchManufacturers();
      setEditingManufacturerId(null);
      resetManufacturerForm();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to update manufacturer");
    },
  });

  const handleCreateManufacturer = () => {
    if (!manufacturerFormData.name || !manufacturerFormData.country) {
      notify.error("Validation Error", "Name and country are required");
      return;
    }

    createManufacturerMutation.mutate({
      name: manufacturerFormData.name,
      country: manufacturerFormData.country,
      specialty:
        manufacturerFormData.specialty.length > 0
          ? manufacturerFormData.specialty.join(", ")
          : undefined,
      founded: manufacturerFormData.founded,
      description: manufacturerFormData.description || undefined,
      isActive: manufacturerFormData.isActive,
    });
  };

  const handleEditManufacturer = (manufacturer: Manufacturer) => {
    setEditingManufacturerId(manufacturer.id);
    setManufacturerFormData({
      name: manufacturer.name,
      country: manufacturer.country,
      specialty: manufacturer.specialty
        ? manufacturer.specialty.split(", ").map((s) => s.trim())
        : [],
      founded: manufacturer.founded || undefined,
      description: manufacturer.description || "",
      isActive: manufacturer.isActive,
    });
    setIsManufacturerDialogOpen(true);
  };

  const handleUpdateManufacturer = () => {
    if (!editingManufacturerId || !manufacturerFormData.name || !manufacturerFormData.country) {
      notify.error("Validation Error", "Name and country are required");
      return;
    }

    updateManufacturerMutation.mutate({
      id: editingManufacturerId,
      name: manufacturerFormData.name,
      country: manufacturerFormData.country,
      specialty:
        manufacturerFormData.specialty.length > 0
          ? manufacturerFormData.specialty.join(", ")
          : undefined,
      founded: manufacturerFormData.founded,
      description: manufacturerFormData.description || undefined,
      isActive: manufacturerFormData.isActive,
    });
  };

  const handleToggleActive = (manufacturer: Manufacturer) => {
    updateManufacturerMutation.mutate({
      id: manufacturer.id,
      isActive: !manufacturer.isActive,
    });
  };

  return {
    createManufacturerMutation,
    updateManufacturerMutation,
    handleCreateManufacturer,
    handleEditManufacturer,
    handleUpdateManufacturer,
    handleToggleActive,
  };
}
