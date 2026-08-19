"use client";

// src/hooks/useEquipmentCatalog.ts
// Equipment catalog query + filter state + form/selection/dialog state + filtered list.
// Composes useEquipmentMutations for create/update/delete/clone/bulk handlers.

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import {
  DEFAULT_EQUIPMENT_FORM,
  filterEquipment,
  type EquipmentFormData,
} from "~/lib/military/catalog-utils";
import { useEquipmentMutations } from "~/hooks/useEquipmentMutations";

export function useEquipmentCatalog() {
  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [eraFilter, setEraFilter] = useState<string>("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all");
  const [techLevelRange, setTechLevelRange] = useState<[number, number]>([60, 100]);
  const [costRange, setCostRange] = useState<[number, number]>([0, 10000000]);
  const [showInactive, setShowInactive] = useState(false);

  // Selection + dialog state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // Form state
  const [formData, setFormData] = useState<EquipmentFormData>({ ...DEFAULT_EQUIPMENT_FORM });

  // Queries - Equipment Catalog (always active)
  const {
    data: equipmentData,
    isLoading,
    refetch,
  } = api.militaryEquipment.getAllCatalogEquipment.useQuery(
    {
      includeInactive: showInactive,
      category: selectedCategory !== "all" ? (selectedCategory as any) : undefined,
      era: eraFilter !== "all" ? (eraFilter as any) : undefined,
      search: searchQuery || undefined,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const { data: manufacturers } = api.militaryEquipment.getManufacturers.useQuery(
    { isActive: true },
    { refetchOnWindowFocus: false }
  );

  // Filter equipment
  const filteredEquipment = useMemo(
    () => filterEquipment(equipmentData, subcategoryFilter, techLevelRange, costRange),
    [equipmentData, subcategoryFilter, techLevelRange, costRange]
  );

  const resetForm = () => {
    setFormData({ ...DEFAULT_EQUIPMENT_FORM });
    setActiveTab("general");
  };

  const mutations = useEquipmentMutations({
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
  });

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEquipment.map((e: { id: string }) => e.id)));
    }
  };

  return {
    // filter state
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    eraFilter,
    setEraFilter,
    subcategoryFilter,
    setSubcategoryFilter,
    techLevelRange,
    setTechLevelRange,
    costRange,
    setCostRange,
    showInactive,
    setShowInactive,
    // selection + dialog state
    selectedIds,
    setSelectedIds,
    isAddDialogOpen,
    setIsAddDialogOpen,
    editingEquipment,
    setEditingEquipment,
    activeTab,
    setActiveTab,
    // form state
    formData,
    setFormData,
    resetForm,
    // data
    equipmentData,
    isLoading,
    manufacturers,
    filteredEquipment,
    // selection helpers
    toggleSelection,
    toggleSelectAll,
    // mutations + handlers
    ...mutations,
  };
}
