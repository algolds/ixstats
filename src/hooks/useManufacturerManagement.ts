"use client";

// src/hooks/useManufacturerManagement.ts
// Manufacturer query (conditional on active tab) + filter/sort/form/dialog state.
// Composes useManufacturerMutations for create/update/edit/toggle handlers.

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import {
  DEFAULT_MANUFACTURER_FORM,
  normalizeManufacturers,
  getUniqueCountries,
  filterAndSortManufacturers,
  type Manufacturer,
  type ManufacturerFormData,
  type SortField,
  type SortDirection,
} from "~/lib/military/manufacturer-utils";
import { useManufacturerMutations } from "~/hooks/useManufacturerMutations";

export function useManufacturerManagement(activeMainTab: string) {
  // Filter/sort state
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [manufacturerSearchQuery, setManufacturerSearchQuery] = useState("");
  const [showInactiveManufacturers, setShowInactiveManufacturers] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Dialog/form state
  const [isManufacturerDialogOpen, setIsManufacturerDialogOpen] = useState(false);
  const [editingManufacturerId, setEditingManufacturerId] = useState<string | null>(null);
  const [manufacturerFormData, setManufacturerFormData] = useState<ManufacturerFormData>({
    ...DEFAULT_MANUFACTURER_FORM,
  });

  // Queries - Manufacturers Tab (conditional)
  const {
    data: manufacturersAll,
    isLoading: manufacturersLoading,
    refetch: refetchManufacturers,
  } = api.militaryEquipment.getManufacturers.useQuery(
    {
      isActive: showInactiveManufacturers ? undefined : true,
    },
    {
      refetchOnWindowFocus: false,
      enabled: activeMainTab === "manufacturers",
    }
  );

  // Normalized manufacturers for Manufacturers tab
  const normalizedManufacturers = useMemo<Manufacturer[]>(
    () => normalizeManufacturers(manufacturersAll),
    [manufacturersAll]
  );

  // Get unique countries for filter
  const countries = useMemo(
    () => getUniqueCountries(normalizedManufacturers),
    [normalizedManufacturers]
  );

  // Filtered and sorted manufacturers
  const filteredManufacturers = useMemo(
    () =>
      filterAndSortManufacturers(
        normalizedManufacturers,
        countryFilter,
        manufacturerSearchQuery,
        sortField,
        sortDirection
      ),
    [normalizedManufacturers, countryFilter, manufacturerSearchQuery, sortField, sortDirection]
  );

  const resetManufacturerForm = () => {
    setManufacturerFormData({ ...DEFAULT_MANUFACTURER_FORM });
  };

  const mutations = useManufacturerMutations({
    manufacturerFormData,
    setManufacturerFormData,
    editingManufacturerId,
    setEditingManufacturerId,
    setIsManufacturerDialogOpen,
    resetManufacturerForm,
    refetchManufacturers,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return {
    // filter/sort state
    countryFilter,
    setCountryFilter,
    manufacturerSearchQuery,
    setManufacturerSearchQuery,
    showInactiveManufacturers,
    setShowInactiveManufacturers,
    sortField,
    sortDirection,
    handleSort,
    // dialog/form state
    isManufacturerDialogOpen,
    setIsManufacturerDialogOpen,
    editingManufacturerId,
    setEditingManufacturerId,
    manufacturerFormData,
    setManufacturerFormData,
    resetManufacturerForm,
    // data
    manufacturersLoading,
    normalizedManufacturers,
    countries,
    filteredManufacturers,
    // mutations + handlers
    ...mutations,
  };
}
