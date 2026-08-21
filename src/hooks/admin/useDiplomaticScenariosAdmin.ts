"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  type ScenarioFormData,
  type ChoiceFormData,
  defaultScenarioFormData,
  defaultChoiceFormData,
  scenarioToFormData,
  scenarioToCloneFormData,
  calculateScenarioExpiry,
  filterDiplomaticScenarios,
} from "~/lib/admin/diplomatic-scenario-transforms";

export function useDiplomaticScenariosAdmin() {
  const notify = useNotify();

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [relationshipFilter, setRelationshipFilter] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<string[]>([]);
  const [timeFrameFilter, setTimeFrameFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // Choice editing state
  const [editingChoiceIndex, setEditingChoiceIndex] = useState<number | null>(null);
  const [choiceFormData, setChoiceFormData] = useState<ChoiceFormData>(defaultChoiceFormData());

  // Form state
  const [formData, setFormData] = useState<ScenarioFormData>(defaultScenarioFormData());
  const [responseOptions, setResponseOptions] = useState<ChoiceFormData[]>([]);

  // Queries
  const {
    data: scenarios,
    isLoading,
    refetch,
  } = api.diplomaticScenarios.getAllScenariosAdmin.useQuery(
    {
      includeInactive: showInactive,
      includeExpired: showInactive,
      type: typeFilter !== "all" ? (typeFilter as any) : undefined,
      search: searchQuery || undefined,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const { data: countries } = api.countries.getAll.useQuery(
    { limit: 500 },
    {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Mutations
  const createMutation = api.diplomaticScenarios.createScenario.useMutation({
    onSuccess: () => {
      notify.success("Success", "Scenario created successfully");
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to create scenario");
    },
  });

  const updateMutation = api.diplomaticScenarios.updateScenario.useMutation({
    onSuccess: () => {
      notify.success("Success", "Scenario updated successfully");
      refetch();
      setEditingScenario(null);
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to update scenario");
    },
  });

  const deleteMutation = api.diplomaticScenarios.deleteScenario.useMutation({
    onSuccess: () => {
      notify.success("Success", "Scenario deleted successfully");
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to delete scenario");
    },
  });

  // Filter scenarios
  const filteredScenarios = useMemo(() => {
    return filterDiplomaticScenarios(
      scenarios,
      relationshipFilter,
      difficultyFilter,
      timeFrameFilter
    );
  }, [scenarios, relationshipFilter, difficultyFilter, timeFrameFilter]);

  const resetForm = () => {
    setFormData(defaultScenarioFormData());
    setResponseOptions([]);
    setEditingChoiceIndex(null);
    setChoiceFormData(defaultChoiceFormData());
    setActiveTab("general");
  };

  const handleCreate = () => {
    if (!formData.title || !formData.narrative || !formData.country1Id || !formData.country2Id) {
      notify.error("Validation Error", "Please fill in all required fields");
      return;
    }

    const expiresAt = calculateScenarioExpiry(formData.timeFrame);

    createMutation.mutate({
      type: formData.type,
      title: formData.title,
      narrative: formData.narrative,
      country1Id: formData.country1Id,
      country2Id: formData.country2Id,
      relationshipState: formData.relationshipState,
      relationshipStrength: formData.relationshipStrength,
      responseOptions: responseOptions,
      tags: [formData.type, formData.difficulty, formData.timeFrame],
      culturalImpact: formData.culturalImpact,
      diplomaticRisk: formData.diplomaticRisk,
      economicCost: formData.economicCost,
      expiresAt,
      status: formData.status as any,
    });
  };

  const handleUpdate = () => {
    if (!editingScenario?.id) return;

    const expiresAt = calculateScenarioExpiry(formData.timeFrame);

    updateMutation.mutate({
      id: editingScenario.id,
      type: formData.type,
      title: formData.title,
      narrative: formData.narrative,
      relationshipState: formData.relationshipState,
      relationshipStrength: formData.relationshipStrength,
      responseOptions: responseOptions,
      tags: [formData.type, formData.difficulty, formData.timeFrame],
      culturalImpact: formData.culturalImpact,
      diplomaticRisk: formData.diplomaticRisk,
      economicCost: formData.economicCost,
      expiresAt,
      status: formData.status as any,
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (scenario: any) => {
    const { formData: initialForm, responseOptions: initialOpts } = scenarioToFormData(scenario);
    setFormData(initialForm);
    setResponseOptions(initialOpts);
    setEditingScenario(scenario);
    setActiveTab("general");
  };

  const handleClone = (scenario: any) => {
    const { formData: cloneForm, responseOptions: cloneOpts } = scenarioToCloneFormData(scenario);
    setFormData(cloneForm);
    setResponseOptions(cloneOpts);
    setIsAddDialogOpen(true);
    setActiveTab("general");
  };

  const handleBulkActivate = () => {
    if (selectedIds.size === 0) {
      notify.warning("No selection", "Please select at least one scenario");
      return;
    }

    Promise.all(
      Array.from(selectedIds).map((id) => updateMutation.mutateAsync({ id, status: "active" }))
    )
      .then(() => {
        notify.success("Success", `Activated ${selectedIds.size} scenarios`);
        setSelectedIds(new Set());
        refetch();
      })
      .catch(() => {
        notify.error("Error", "Failed to activate some scenarios");
      });
  };

  const handleBulkDeactivate = () => {
    if (selectedIds.size === 0) {
      notify.warning("No selection", "Please select at least one scenario");
      return;
    }

    Promise.all(
      Array.from(selectedIds).map((id) => updateMutation.mutateAsync({ id, status: "expired" }))
    )
      .then(() => {
        notify.success("Success", `Deactivated ${selectedIds.size} scenarios`);
        setSelectedIds(new Set());
        refetch();
      })
      .catch(() => {
        notify.error("Error", "Failed to deactivate some scenarios");
      });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredScenarios.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredScenarios.map((s) => s.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingScenario(null);
    resetForm();
  };

  // Choice management
  const handleAddChoice = () => {
    setEditingChoiceIndex(responseOptions.length);
    setChoiceFormData({
      id: `choice_${Date.now()}`,
      label: "",
      description: "",
      skillRequired: "diplomacy",
      skillLevel: 50,
      riskLevel: "medium",
      effects: {},
      predictedOutcomes: {},
    });
  };

  const handleEditChoice = (index: number) => {
    const choice = responseOptions[index];
    if (choice) {
      setChoiceFormData({ ...choice });
      setEditingChoiceIndex(index);
    }
  };

  const handleSaveChoice = () => {
    if (!choiceFormData.label || !choiceFormData.description) {
      notify.error("Validation Error", "Choice label and description are required");
      return;
    }

    if (editingChoiceIndex !== null) {
      if (editingChoiceIndex < responseOptions.length) {
        // Edit existing
        const updated = [...responseOptions];
        updated[editingChoiceIndex] = choiceFormData;
        setResponseOptions(updated);
      } else {
        // Add new
        setResponseOptions([...responseOptions, choiceFormData]);
      }
      setEditingChoiceIndex(null);
      setChoiceFormData(defaultChoiceFormData());
    }
  };

  const handleDeleteChoice = (index: number) => {
    setResponseOptions(responseOptions.filter((_, i) => i !== index));
    if (editingChoiceIndex === index) {
      setEditingChoiceIndex(null);
      setChoiceFormData(defaultChoiceFormData());
    }
  };

  const handleCancelChoiceEdit = () => {
    setEditingChoiceIndex(null);
    setChoiceFormData(defaultChoiceFormData());
  };

  return {
    // Data
    scenarios,
    filteredScenarios,
    countries: countries?.countries || [],
    isLoading,
    isPending: createMutation.isPending || updateMutation.isPending,

    // Filters
    typeFilter,
    setTypeFilter,
    relationshipFilter,
    setRelationshipFilter,
    difficultyFilter,
    setDifficultyFilter,
    timeFrameFilter,
    setTimeFrameFilter,
    searchQuery,
    setSearchQuery,
    showInactive,
    setShowInactive,

    // Selection
    selectedIds,
    setSelectedIds,
    handleSelectAll,
    handleToggleSelect,
    handleBulkActivate,
    handleBulkDeactivate,

    // Dialog state
    isAddDialogOpen,
    setIsAddDialogOpen,
    editingScenario,
    activeTab,
    setActiveTab,
    handleCloseDialog,

    // Choice editing
    editingChoiceIndex,
    setEditingChoiceIndex,
    choiceFormData,
    setChoiceFormData,
    handleAddChoice,
    handleEditChoice,
    handleSaveChoice,
    handleDeleteChoice,
    handleCancelChoiceEdit,

    // Form state & actions
    formData,
    setFormData,
    responseOptions,
    setResponseOptions,
    resetForm,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleEdit,
    handleClone,
  };
}
