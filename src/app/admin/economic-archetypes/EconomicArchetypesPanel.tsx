"use client";
// src/app/admin/economic-archetypes/EconomicArchetypesPanel.tsx
// Admin interface for managing economic archetypes

import { RowActions } from "../_components/RowActions";
import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import {
  Plus,
  Search, // oxlint-disable-next-line eslint/no-unused-vars
  EyeClosed as EyeOff,
} from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import {
  EconomicArchetypeFormDialog,
  type ArchetypeFormData,
  type ArchetypeEra,
  COMPLEXITY_LEVELS,
} from "./_components/EconomicArchetypeFormDialog";
import {
  type ArchetypeRecord,
  archetypeToFormData,
  complexityLabel,
  defaultArchetypeFormData,
  formDataToArchetypeInput,
} from "./_components/archetype-form-types";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";

const COMPLEXITY_COLORS: Record<string, string> = {
  low: "text-green",
  medium: "text-blue",
  high: "text-yellow",
};

export function EconomicArchetypesPanel() {
  usePageTitle({ title: "Admin - Economic Archetypes" });

  const notify = useNotify();

  // State
  const [selectedEra, setSelectedEra] = useState<ArchetypeEra | "all">("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedComplexity, setSelectedComplexity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  // oxlint-disable-next-line eslint/no-unused-vars
  const [showInactive, setShowInactive] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingArchetype, setEditingArchetype] = useState<ArchetypeRecord | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // Form state
  const [formData, setFormData] = useState<ArchetypeFormData>(defaultArchetypeFormData);

  // Queries
  const {
    data: archetypesData,
    isLoading,
    refetch,
  } = api.economicArchetypes.getAllArchetypes.useQuery({
    isActive: showInactive ? undefined : true,
  });

  const archetypes = archetypesData?.archetypes || [];

  // oxlint-disable-next-line eslint/no-unused-vars
  const { data: stats } = api.economicArchetypes.getArchetypeUsageStats.useQuery();

  // Mutations
  const createMutation = api.economicArchetypes.createArchetype.useMutation({
    onSuccess: () => {
      notify.success("Success", "Archetype created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to create archetype");
    },
  });

  const updateMutation = api.economicArchetypes.updateArchetype.useMutation({
    onSuccess: () => {
      notify.success("Success", "Archetype updated successfully");
      setEditingArchetype(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to update archetype");
    },
  });

  const deleteMutation = api.economicArchetypes.deleteArchetype.useMutation({
    onSuccess: () => {
      notify.success("Success", "Archetype deactivated successfully");
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to delete archetype");
    },
  });

  // Filter regions
  const regions = useMemo(() => {
    const uniqueRegions = new Set<string>();
    archetypes.forEach((a: any) => {
      if (a.region) uniqueRegions.add(a.region);
    });
    return Array.from(uniqueRegions).sort();
    // oxlint-disable-next-line
  }, [archetypes]);

  // Filtered archetypes
  const filteredArchetypes = useMemo(() => {
    return archetypes.filter((archetype: any) => {
      if (selectedEra !== "all" && archetype.era !== selectedEra) return false;
      if (selectedRegion !== "all" && archetype.region !== selectedRegion) return false;
      if (selectedComplexity !== "all" && archetype.implementationComplexity !== selectedComplexity)
        return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = archetype.name.toLowerCase().includes(query);
        const matchesDesc = archetype.description?.toLowerCase().includes(query);
        const matchesRegion = archetype.region?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesRegion) return false;
      }
      return true;
    });
    // oxlint-disable-next-line
  }, [archetypes, selectedEra, selectedRegion, selectedComplexity, searchQuery]);

  const resetForm = () => {
    setFormData(defaultArchetypeFormData());
    setActiveTab("general");
  };

  const handleCreate = () => {
    createMutation.mutate(formDataToArchetypeInput(formData));
  };

  const handleUpdate = () => {
    if (editingArchetype?.id) {
      updateMutation.mutate({
        id: editingArchetype.id,
        ...formDataToArchetypeInput(formData),
      });
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to deactivate "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (archetype: ArchetypeRecord) => {
    setFormData(archetypeToFormData(archetype));
    setEditingArchetype(archetype);
    setActiveTab("general");
  };

  const handleClone = (archetype: ArchetypeRecord) => {
    setFormData({
      ...archetypeToFormData(archetype),
      key: `${archetype.key}-copy`,
      name: `${archetype.name} (Copy)`,
    });
    setIsAddDialogOpen(true);
    setActiveTab("general");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Economic archetypes"
        subtitle="Macroeconomic policy models, component templates and simulation archetypes."
      />

      {/* Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-label-secondary text-stat-label">Total archetypes</div>
          <div className="text-label text-title-2 mt-1 tabular-nums">{archetypes?.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-label-secondary text-stat-label">Modern policy</div>
          <div className="text-title-2 text-blue mt-1 tabular-nums">
            {archetypes?.filter((a: any) => a.era === "modern").length ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-label-secondary text-stat-label">Historical models</div>
          <div className="text-title-2 text-yellow mt-1 tabular-nums">
            {archetypes?.filter((a: any) => a.era === "historical").length ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-label-secondary text-stat-label">Filtered roster</div>
          <div className="text-title-2 text-purple mt-1 tabular-nums">
            {filteredArchetypes.length}
          </div>
        </Card>
      </div>

      {/* Filter & Action Rail */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-sm min-w-[200px] flex-1">
            <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search archetypes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
            />
          </div>

          <Select value={selectedEra} onValueChange={(v: any) => setSelectedEra(v)}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="All eras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-footnote">
                All eras
              </SelectItem>
              <SelectItem value="modern" className="text-footnote">
                Modern
              </SelectItem>
              <SelectItem value="historical" className="text-footnote">
                Historical
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-footnote">
                All regions
              </SelectItem>
              {regions.map((region) => (
                <SelectItem key={region} value={region} className="text-footnote">
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedComplexity} onValueChange={setSelectedComplexity}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue placeholder="All complexities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-footnote">
                All complexities
              </SelectItem>
              {COMPLEXITY_LEVELS.map((level) => (
                <SelectItem key={level} value={level} className="text-footnote">
                  {complexityLabel(level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add archetype
        </Button>
      </div>

      {/* High-Density Inset Glass Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="rounded-row h-12 w-full" />
          ))}
        </div>
      ) : filteredArchetypes.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-label-secondary text-footnote">
            No archetypes found matching criteria.
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Model & focus</TableHead>
                <TableHead className="px-4">Era & region</TableHead>
                <TableHead className="px-4">Complexity</TableHead>
                <TableHead className="px-4">Usage</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArchetypes.map((archetype: any) => (
                <TableRow key={archetype.id}>
                  <TableCell className="px-4">
                    <div className="text-label font-semibold">{archetype.name}</div>
                    <div className="text-label-secondary text-footnote max-w-sm truncate">
                      {archetype.description}
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-control-sm text-eyebrow px-2 py-0.5 ${
                          archetype.era === "modern"
                            ? "border-blue/20 bg-blue/10 text-blue border"
                            : "border-yellow/20 bg-yellow/10 text-yellow border"
                        }`}
                      >
                        {archetype.era}
                      </span>
                      <span className="text-label-secondary text-footnote">{archetype.region}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 font-medium">
                    <span
                      className={
                        COMPLEXITY_COLORS[archetype.implementationComplexity] ||
                        "text-label-secondary"
                      }
                    >
                      {complexityLabel(archetype.implementationComplexity)}
                    </span>
                  </TableCell>
                  <TableCell className="text-label px-4 font-medium">
                    {archetype.usageCount || 0}×
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <RowActions
                      onClone={() => handleClone(archetype)}
                      onEdit={() => handleEdit(archetype)}
                      onDelete={() => handleDelete(archetype.id, archetype.name)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Editor Dialog */}
      {(isAddDialogOpen || editingArchetype) && (
        <EconomicArchetypeFormDialog
          isOpen={isAddDialogOpen || !!editingArchetype}
          isEditing={!!editingArchetype}
          formData={formData}
          setFormData={setFormData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={() => {
            setIsAddDialogOpen(false);
            setEditingArchetype(null);
            resetForm();
          }}
          onSave={editingArchetype ? handleUpdate : handleCreate}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}
