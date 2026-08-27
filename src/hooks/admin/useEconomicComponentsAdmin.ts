"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  type ComponentFormData,
  defaultEconomicComponentFormData,
  economicComponentToFormData,
  filterEconomicComponents,
} from "~/lib/admin/economic-component-transforms";

export function useEconomicComponentsAdmin() {
  const notify = useNotify();

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [complexityFilter, setComplexityFilter] = useState("all");
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Dialog State
  const [editingComponent, setEditingComponent] = useState<any | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSynergyMatrixOpen, setIsSynergyMatrixOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Form State
  const [formData, setFormData] = useState<ComponentFormData>(defaultEconomicComponentFormData());

  // Queries
  const {
    data: componentsResponse,
    isLoading,
    refetch,
  } = api.economicComponents.getAllComponents.useQuery(
    {
      isActive: showActiveOnly ? true : undefined,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const components = componentsResponse?.components || [];

  const { data: stats } = api.economicComponents.getComponentUsageStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: templatesResponse } = api.economicComponents.getAllTemplates.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const templates = templatesResponse?.templates || [];

  // Mutations
  const createMutation = api.economicComponents.createComponent.useMutation({
    onSuccess: () => {
      notify.success("Success", "Component created successfully");
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to create component");
    },
  });

  const updateMutation = api.economicComponents.updateComponent.useMutation({
    onSuccess: () => {
      notify.success("Success", "Component updated successfully");
      refetch();
      setEditingComponent(null);
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to update component");
    },
  });

  const deleteMutation = api.economicComponents.deleteComponent.useMutation({
    onSuccess: () => {
      notify.success("Success", "Component deactivated successfully");
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to deactivate component");
    },
  });

  const createSynergyMutation = api.economicComponents.createSynergy.useMutation({
    onSuccess: () => {
      notify.success("Success", "Synergy relationship created");
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to create synergy");
    },
  });

  // Filtered components
  const filteredComponents = useMemo(() => {
    return filterEconomicComponents(components, searchTerm, categoryFilter, complexityFilter);
  // oxlint-disable-next-line
  }, [components, searchTerm, categoryFilter, complexityFilter]);

  const resetForm = () => {
    setFormData(defaultEconomicComponentFormData());
    setActiveTab("general");
  };

  const handleCreate = () => {
    createMutation.mutate(formData as any);
  };

  const handleUpdate = () => {
    if (editingComponent?.id) {
      updateMutation.mutate({
        id: editingComponent.id,
        ...formData,
      } as any);
    }
  };

  const handleDelete = (componentType: string, name: string) => {
    if (confirm(`Are you sure you want to deactivate "${name}"?`)) {
      deleteMutation.mutate({ componentType: componentType as any });
    }
  };

  const handleEdit = (component: any) => {
    setFormData(economicComponentToFormData(component));
    setEditingComponent(component);
    setActiveTab("general");
  };

  const handleCloseEditor = () => {
    setIsAddDialogOpen(false);
    setEditingComponent(null);
    resetForm();
  };

  return {
    // Data
    components,
    filteredComponents,
    stats,
    templates,
    isLoading,
    isPending: createMutation.isPending || updateMutation.isPending,

    // Filters
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    complexityFilter,
    setComplexityFilter,
    showActiveOnly,
    setShowActiveOnly,

    // Dialog state
    editingComponent,
    isAddDialogOpen,
    setIsAddDialogOpen,
    isSynergyMatrixOpen,
    setIsSynergyMatrixOpen,
    isTemplateManagerOpen,
    setIsTemplateManagerOpen,
    activeTab,
    setActiveTab,

    // Form state & actions
    formData,
    setFormData,
    resetForm,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleEdit,
    handleCloseEditor,
    createSynergyMutation,
  };
}
