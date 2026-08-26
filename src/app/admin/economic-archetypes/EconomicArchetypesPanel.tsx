// src/app/admin/economic-archetypes/EconomicArchetypesPanel.tsx
// Admin interface for managing economic archetypes
"use client";

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
  EditPencil as Pencil,
  Trash as Trash2,
  Copy,
  Search,
  // oxlint-disable-next-line eslint/no-unused-vars
  EyeClosed as EyeOff,
  StatUp as TrendingUp,
} from "iconoir-react";
import { AdminHeader } from "../_components/AdminHeader";
import {
  EconomicArchetypeFormDialog,
  type ArchetypeFormData,
  type ArchetypeEra,
  COMPLEXITY_LEVELS,
} from "./_components/EconomicArchetypeFormDialog";
import { Skeleton } from "~/components/ui/skeleton";

const COMPLEXITY_COLORS: Record<string, string> = {
  Low: "text-green-400",
  Moderate: "text-blue-400",
  High: "text-amber-400",
  "Very High": "text-red-400",
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
  const [editingArchetype, setEditingArchetype] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // Form state
  const [formData, setFormData] = useState<ArchetypeFormData>({
    key: "",
    name: "",
    description: "",
    region: "",
    era: "modern",
    implementationComplexity: "Moderate",
    historicalContext: "",
    characteristics: [],
    economicComponents: [],
    governmentComponents: [],
    taxProfile: {
      corporateTax: 20,
      incomeTax: 25,
      consumptionTax: 10,
      taxEfficiency: 75,
    },
    sectorFocus: {
      agriculture: 10,
      manufacturing: 25,
      services: 35,
      technology: 20,
      finance: 5,
      tourism: 5,
    },
    employmentProfile: {
      unemploymentRate: 5.0,
      laborParticipation: 65.0,
      wageGrowth: 2.5,
    },
    growthMetrics: {
      gdpGrowth: 3.0,
      innovationIndex: 50,
      competitiveness: 50,
      stability: 50,
    },
    strengths: [],
    challenges: [],
    culturalFactors: [],
    modernExamples: [],
    recommendations: [],
  });

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
  }, [archetypes]);

  // Filtered archetypes
  const filteredArchetypes = useMemo(() => {
    return archetypes.filter((archetype: any) => {
      if (selectedEra !== "all" && archetype.era !== selectedEra) return false;
      if (selectedRegion !== "all" && archetype.region !== selectedRegion) return false;
      if (
        selectedComplexity !== "all" &&
        archetype.implementationComplexity !== selectedComplexity
      )
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
  }, [archetypes, selectedEra, selectedRegion, selectedComplexity, searchQuery]);

  const resetForm = () => {
    setFormData({
      key: "",
      name: "",
      description: "",
      region: "",
      era: "modern",
      implementationComplexity: "Moderate",
      historicalContext: "",
      characteristics: [],
      economicComponents: [],
      governmentComponents: [],
      taxProfile: {
        corporateTax: 20,
        incomeTax: 25,
        consumptionTax: 10,
        taxEfficiency: 75,
      },
      sectorFocus: {
        agriculture: 10,
        manufacturing: 25,
        services: 35,
        technology: 20,
        finance: 5,
        tourism: 5,
      },
      employmentProfile: {
        unemploymentRate: 5.0,
        laborParticipation: 65.0,
        wageGrowth: 2.5,
      },
      growthMetrics: {
        gdpGrowth: 3.0,
        innovationIndex: 50,
        competitiveness: 50,
        stability: 50,
      },
      strengths: [],
      challenges: [],
      culturalFactors: [],
      modernExamples: [],
      recommendations: [],
    });
    setActiveTab("general");
  };

  const handleCreate = () => {
    createMutation.mutate(formData as any);
  };

  const handleUpdate = () => {
    if (editingArchetype?.id) {
      updateMutation.mutate({
        id: editingArchetype.id,
        ...formData,
      } as any);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to deactivate "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (archetype: any) => {
    setFormData({
      key: archetype.key,
      name: archetype.name,
      description: archetype.description,
      region: archetype.region,
      era: archetype.era,
      implementationComplexity: archetype.implementationComplexity,
      historicalContext: archetype.historicalContext,
      characteristics: archetype.characteristics || [],
      economicComponents: archetype.economicComponents || [],
      governmentComponents: archetype.governmentComponents || [],
      taxProfile: archetype.taxProfile || {
        corporateTax: 20,
        incomeTax: 25,
        consumptionTax: 10,
        taxEfficiency: 75,
      },
      sectorFocus: archetype.sectorFocus || {},
      employmentProfile: archetype.employmentProfile || {
        unemploymentRate: 5.0,
        laborParticipation: 65.0,
        wageGrowth: 2.5,
      },
      growthMetrics: archetype.growthMetrics || {
        gdpGrowth: 3.0,
        innovationIndex: 50,
        competitiveness: 50,
        stability: 50,
      },
      strengths: archetype.strengths || [],
      challenges: archetype.challenges || [],
      culturalFactors: archetype.culturalFactors || [],
      modernExamples: archetype.modernExamples || [],
      recommendations: archetype.recommendations || [],
    });
    setEditingArchetype(archetype);
    setActiveTab("general");
  };

  const handleClone = (archetype: any) => {
    setFormData({
      ...archetype,
      key: `${archetype.key}-copy`,
      name: `${archetype.name} (Copy)`,
    });
    setIsAddDialogOpen(true);
    setActiveTab("general");
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={TrendingUp}
        title="Economic Archetypes"
        description="Comprehensive macroeconomic policy models, structural component templates, and simulation archetypes."
      />

      {/* Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Archetypes
          </div>
          <div className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {archetypes?.length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Modern Policy
          </div>
          <div className="text-blue-400 mt-1 font-mono text-xl font-bold tracking-tight">
            {archetypes?.filter((a: any) => a.era === "modern").length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Historical Models
          </div>
          <div className="text-amber-400 mt-1 font-mono text-xl font-bold tracking-tight">
            {archetypes?.filter((a: any) => a.era === "historical").length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Filtered Roster
          </div>
          <div className="text-purple-400 mt-1 font-mono text-xl font-bold tracking-tight">
            {filteredArchetypes.length}
          </div>
        </div>
      </div>

      {/* Filter & Action Rail */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search archetypes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-xl border-border/30 bg-background/50 pl-8 text-xs backdrop-blur-md focus:border-border/60"
            />
          </div>

          <Select value={selectedEra} onValueChange={(v: any) => setSelectedEra(v)}>
            <SelectTrigger className="h-8 w-36 rounded-xl border-border/30 bg-background/50 text-xs backdrop-blur-md">
              <SelectValue placeholder="All Eras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Eras</SelectItem>
              <SelectItem value="modern" className="text-xs">Modern</SelectItem>
              <SelectItem value="historical" className="text-xs">Historical</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="h-8 w-36 rounded-xl border-border/30 bg-background/50 text-xs backdrop-blur-md">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Regions</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region} value={region} className="text-xs">
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedComplexity} onValueChange={setSelectedComplexity}>
            <SelectTrigger className="h-8 w-40 rounded-xl border-border/30 bg-background/50 text-xs backdrop-blur-md">
              <SelectValue placeholder="All Complexities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Complexities</SelectItem>
              {COMPLEXITY_LEVELS.map((level) => (
                <SelectItem key={level} value={level} className="text-xs">
                  {level}
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
          className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Archetype
        </Button>
      </div>

      {/* High-Density Inset Glass Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredArchetypes.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card/25 p-12 text-center backdrop-blur-md">
          <p className="text-muted-foreground text-xs">No archetypes found matching criteria.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card/25 backdrop-blur-md shadow-xs">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20 text-muted-foreground font-semibold">
                <th className="px-4 py-2.5 text-left font-medium">Model & Focus</th>
                <th className="px-4 py-2.5 text-left font-medium">Era & Region</th>
                <th className="px-4 py-2.5 text-left font-medium">Complexity</th>
                <th className="px-4 py-2.5 text-left font-medium">Usage</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/15">
              {filteredArchetypes.map((archetype: any) => (
                <tr key={archetype.id} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-foreground">{archetype.name}</div>
                    <div className="text-muted-foreground text-[11px] truncate max-w-sm">
                      {archetype.description}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                          archetype.era === "modern"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {archetype.era}
                      </span>
                      <span className="text-muted-foreground text-[11px]">{archetype.region}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    <span className={COMPLEXITY_COLORS[archetype.implementationComplexity] || "text-muted-foreground"}>
                      {archetype.implementationComplexity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-foreground font-medium">
                    {archetype.usageCount || 0}×
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => handleClone(archetype)}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground active:scale-[0.98] transition-transform"
                        title="Clone"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleEdit(archetype)}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground active:scale-[0.98] transition-transform"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(archetype.id, archetype.name)}
                        className="rounded-lg p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98] transition-transform"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

export default EconomicArchetypesPanel;
