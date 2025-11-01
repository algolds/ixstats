// src/app/admin/economic-archetypes/page.tsx
// Admin interface for managing economic archetypes

"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { Checkbox } from "~/components/ui/checkbox";
import { MultiSelect } from "~/components/ui/multi-select";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useToast } from "~/components/ui/toast";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Search,
  BarChart3,
  Eye,
  EyeOff,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Building2,
  DollarSign,
  Users,
  Activity,
  Award,
} from "lucide-react";
import Link from "next/link";

// Import component types
import { EconomicComponentType } from "~/lib/atomic-economic-data";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";

type ArchetypeEra = "modern" | "historical";

interface ArchetypeFormData {
  key: string;
  name: string;
  description: string;
  region: string;
  era: ArchetypeEra;
  implementationComplexity: string;
  historicalContext: string;
  characteristics: string[];
  economicComponents: string[];
  governmentComponents: string[];
  taxProfile: {
    corporateTax: number;
    incomeTax: number;
    consumptionTax: number;
    taxEfficiency: number;
  };
  sectorFocus: Record<string, number>;
  employmentProfile: {
    unemploymentRate: number;
    laborParticipation: number;
    wageGrowth: number;
  };
  growthMetrics: {
    gdpGrowth: number;
    innovationIndex: number;
    competitiveness: number;
    stability: number;
  };
  strengths: string[];
  challenges: string[];
  culturalFactors: string[];
  modernExamples: string[];
  recommendations: string[];
}

const COMPLEXITY_LEVELS = ["Low", "Medium", "High"];
const ECONOMIC_COMPONENTS = Object.values(EconomicComponentType);
const GOVERNMENT_COMPONENTS = Object.values(ComponentType);
const SECTOR_TYPES = [
  "technology",
  "finance",
  "services",
  "manufacturing",
  "agriculture",
  "government",
];

const COMPLEXITY_COLORS: Record<string, string> = {
  Low: "text-green-400",
  Medium: "text-yellow-400",
  High: "text-red-400",
};

export default function EconomicArchetypesPage() {
  usePageTitle({ title: "Economic Archetypes Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [eraFilter, setEraFilter] = useState<"all" | "modern" | "historical">("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [complexityFilter, setComplexityFilter] = useState("all");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [editingArchetype, setEditingArchetype] = useState<any | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Queries
  const {
    data: archetypes,
    isLoading,
    refetch,
  } = api.archetypes.getAllArchetypes.useQuery(
    {
      era: eraFilter,
      isActive: showActiveOnly ? true : undefined,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const { data: stats } = api.archetypes.getArchetypeUsageStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Mutations
  const createMutation = api.archetypes.createArchetype.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Archetype created successfully",
        type: "success",
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create archetype",
        type: "error",
      });
    },
  });

  const updateMutation = api.archetypes.updateArchetype.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Archetype updated successfully",
        type: "success",
      });
      refetch();
      setEditingArchetype(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update archetype",
        type: "error",
      });
    },
  });

  const deleteMutation = api.archetypes.deleteArchetype.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Archetype deactivated successfully",
        type: "success",
      });
      refetch();
    },
    onError: (error: { message?: string }) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate archetype",
        type: "error",
      });
    },
  });

  // Filtered archetypes
  const filteredArchetypes = useMemo(() => {
    if (!archetypes) return [];

    return archetypes.filter((archetype) => {
      const matchesSearch =
        archetype.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        archetype.description.toLowerCase().includes(searchTerm.toLowerCase());

      // Note: region and implementationComplexity fields not in current schema
      // const matchesRegion = regionFilter === "all" || archetype.region === regionFilter;
      // const matchesComplexity =
      //   complexityFilter === "all" || archetype.implementationComplexity === complexityFilter;

      return matchesSearch; // && matchesRegion && matchesComplexity;
    });
  }, [archetypes, searchTerm]); // removed regionFilter, complexityFilter

  // Extract unique regions (placeholder - field not in schema)
  const regions = useMemo<string[]>(() => {
    // if (!archetypes) return [];
    // return Array.from(new Set(archetypes.map((a) => a.region))).sort();
    return [];
  }, []);

  // Form data
  const [formData, setFormData] = useState<ArchetypeFormData>({
    key: "",
    name: "",
    description: "",
    region: "",
    era: "modern",
    implementationComplexity: "Medium",
    historicalContext: "",
    characteristics: [],
    economicComponents: [],
    governmentComponents: [],
    taxProfile: {
      corporateTax: 25,
      incomeTax: 30,
      consumptionTax: 15,
      taxEfficiency: 75,
    },
    sectorFocus: {
      technology: 20,
      finance: 15,
      services: 30,
      manufacturing: 20,
      agriculture: 10,
      government: 5,
    },
    employmentProfile: {
      unemploymentRate: 5,
      laborParticipation: 65,
      wageGrowth: 3,
    },
    growthMetrics: {
      gdpGrowth: 3,
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

  const resetForm = () => {
    setFormData({
      key: "",
      name: "",
      description: "",
      region: "",
      era: "modern",
      implementationComplexity: "Medium",
      historicalContext: "",
      characteristics: [],
      economicComponents: [],
      governmentComponents: [],
      taxProfile: {
        corporateTax: 25,
        incomeTax: 30,
        consumptionTax: 15,
        taxEfficiency: 75,
      },
      sectorFocus: {
        technology: 20,
        finance: 15,
        services: 30,
        manufacturing: 20,
        agriculture: 10,
        government: 5,
      },
      employmentProfile: {
        unemploymentRate: 5,
        laborParticipation: 65,
        wageGrowth: 3,
      },
      growthMetrics: {
        gdpGrowth: 3,
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
      characteristics: archetype.characteristics,
      economicComponents: archetype.economicComponents,
      governmentComponents: archetype.governmentComponents,
      taxProfile: archetype.taxProfile,
      sectorFocus: archetype.sectorFocus,
      employmentProfile: archetype.employmentProfile,
      growthMetrics: archetype.growthMetrics,
      strengths: archetype.strengths,
      challenges: archetype.challenges,
      culturalFactors: archetype.culturalFactors,
      modernExamples: archetype.modernExamples,
      recommendations: archetype.recommendations,
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

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
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
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h1 className="mb-4 text-2xl font-bold text-red-600 dark:text-red-400">Access Denied</h1>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="glass-card-parent mb-6 rounded-xl border-2 border-[--intel-gold]/20 bg-gradient-to-br from-[--intel-gold]/5 via-transparent to-[--intel-gold]/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-[--intel-gold]/20 bg-[--intel-gold]/10 p-3">
                  <TrendingUp className="h-6 w-6 text-[--intel-gold]" />
                </div>
                <div>
                  <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                    Economic Archetypes
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Manage pre-configured economic system templates for country builders
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Archetype
              </Button>
              <Button variant="outline">
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search archetypes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={eraFilter} onValueChange={(v: any) => setEraFilter(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Era" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Eras</SelectItem>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="historical">Historical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((region: string) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={complexityFilter} onValueChange={setComplexityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Complexity</SelectItem>
                {COMPLEXITY_LEVELS.map((complexity) => (
                  <SelectItem key={complexity} value={complexity}>
                    {complexity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Checkbox
              id="activeOnly"
              checked={showActiveOnly}
              onCheckedChange={(checked) => setShowActiveOnly(checked as boolean)}
            />
            <label htmlFor="activeOnly" className="text-foreground cursor-pointer text-sm">
              Show active only
            </label>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Total Archetypes</p>
              <p className="text-foreground mt-2 text-3xl font-bold">
                {stats.totalArchetypes}
              </p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Active</p>
              <p className="mt-2 text-3xl font-bold text-[--intel-gold]">
                {stats.activeArchetypes}
              </p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Selectable</p>
              <p className="mt-2 text-3xl font-bold text-blue-400">{stats.selectableArchetypes}</p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">User Selections</p>
              <p className="mt-2 text-3xl font-bold text-green-400">{stats.userSelections}</p>
            </Card>
          </div>
        )}

        {/* Archetypes Grid */}
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[--intel-gold]"></div>
            <p className="text-muted-foreground">Loading archetypes...</p>
          </div>
        ) : filteredArchetypes.length === 0 ? (
          <Card className="glass-card-parent p-12 text-center">
            <p className="text-[--intel-silver]">No archetypes found matching your filters</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredArchetypes.map((archetype) => (
              <ArchetypeCard
                key={archetype.id}
                archetype={archetype}
                onEdit={() => handleEdit(archetype)}
                onDelete={() => handleDelete(archetype.id, archetype.name)}
                onClone={() => handleClone(archetype)}
              />
            ))}
          </div>
        )}

        {/* Editor Dialog */}
        {(isAddDialogOpen || editingArchetype) && (
          <ArchetypeEditorDialog
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
    </div>
  );
}

// Archetype Card Component
interface ArchetypeCardProps {
  archetype: any;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
}

function ArchetypeCard({ archetype, onEdit, onDelete, onClone }: ArchetypeCardProps) {
  return (
    <Card className="glass-card-child p-4 transition-all hover:border-[--intel-gold]/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-foreground line-clamp-1 font-semibold">{archetype.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                archetype.era === "modern"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {archetype.era}
            </span>
            <span className="text-xs text-[--intel-silver]">{archetype.region}</span>
          </div>
        </div>
        {!archetype.isActive && <EyeOff className="h-4 w-4 text-red-400" aria-label="Inactive" />}
      </div>

      {/* Description */}
      <p className="mb-3 line-clamp-2 text-xs text-[--intel-silver]">{archetype.description}</p>

      {/* Metrics */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Complexity:</span>
          <span className={`font-medium ${COMPLEXITY_COLORS[archetype.implementationComplexity]}`}>
            {archetype.implementationComplexity}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Usage:</span>
          <span className="text-foreground font-medium">{archetype.usageCount}×</span>
        </div>
        {archetype.isCustom && (
          <div className="flex items-center gap-1 text-xs text-purple-400">
            <Sparkles className="h-3 w-3" />
            <span>Custom</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 text-xs">
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onClone} className="text-xs">
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-300"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}

// Archetype Editor Dialog
interface ArchetypeEditorDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: ArchetypeFormData;
  setFormData: (data: ArchetypeFormData) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}

function ArchetypeEditorDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  activeTab,
  setActiveTab,
  onClose,
  onSave,
  isPending,
}: ArchetypeEditorDialogProps) {
  const tabs = [
    { id: "general", label: "General", icon: Award },
    { id: "economics", label: "Economics", icon: TrendingUp },
    { id: "government", label: "Government", icon: Building2 },
    { id: "tax", label: "Tax System", icon: DollarSign },
    { id: "employment", label: "Employment", icon: Users },
    { id: "metrics", label: "Metrics", icon: Activity },
    { id: "characteristics", label: "Characteristics", icon: Award },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Archetype" : "Add Archetype"}</DialogTitle>
          <DialogDescription>Configure the economic archetype template</DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`rounded px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                      : "hover:text-foreground text-[--intel-silver]"
                  }`}
                >
                  <Icon className="mr-1 inline h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab Content */}
          <div className="mt-4 flex-1 overflow-y-auto">
            <TabsContent value="general">
              <GeneralTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="economics">
              <EconomicsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="government">
              <GovernmentTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="tax">
              <TaxTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="employment">
              <EmploymentTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="metrics">
              <MetricsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="characteristics">
              <CharacteristicsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Actions */}
        <DialogFooter className="shrink-0 border-t border-white/10 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!formData.name || !formData.key || isPending}
            className="bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30"
          >
            {isPending ? "Saving..." : isEditing ? "Update Archetype" : "Create Archetype"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tab Components
function GeneralTab({
  formData,
  setFormData,
}: {
  formData: ArchetypeFormData;
  setFormData: (data: ArchetypeFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Key *</label>
          <Input
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            placeholder="e.g., silicon-valley"
          />
        </div>
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Name *</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Silicon Valley Model"
          />
        </div>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Description *</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the economic archetype..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Region *</label>
          <Input
            value={formData.region}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            placeholder="e.g., United States (California)"
          />
        </div>
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Era *</label>
          <Select
            value={formData.era}
            onValueChange={(v: ArchetypeEra) => setFormData({ ...formData, era: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="modern">Modern</SelectItem>
              <SelectItem value="historical">Historical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Implementation Complexity
        </label>
        <Select
          value={formData.implementationComplexity}
          onValueChange={(v) => setFormData({ ...formData, implementationComplexity: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPLEXITY_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Historical Context</label>
        <Textarea
          value={formData.historicalContext}
          onChange={(e) => setFormData({ ...formData, historicalContext: e.target.value })}
          placeholder="Historical background and development..."
          rows={3}
        />
      </div>
    </div>
  );
}

function EconomicsTab({
  formData,
  setFormData,
}: {
  formData: ArchetypeFormData;
  setFormData: (data: ArchetypeFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Economic Components
        </label>
        <MultiSelect
          options={ECONOMIC_COMPONENTS as readonly string[]}
          value={formData.economicComponents}
          onChange={(value) => setFormData({ ...formData, economicComponents: value })}
          placeholder="Select economic components..."
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Sector Focus (%)</label>
        <div className="space-y-3">
          {SECTOR_TYPES.map((sector) => (
            <div key={sector} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-sm capitalize">{sector}</span>
                <span className="text-sm text-[--intel-silver]">
                  {formData.sectorFocus[sector] || 0}%
                </span>
              </div>
              <Slider
                value={[formData.sectorFocus[sector] || 0]}
                onValueChange={([value]) =>
                  setFormData({
                    ...formData,
                    sectorFocus: { ...formData.sectorFocus, [sector]: value },
                  })
                }
                min={0}
                max={100}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GovernmentTab({
  formData,
  setFormData,
}: {
  formData: ArchetypeFormData;
  setFormData: (data: ArchetypeFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Government Components
        </label>
        <MultiSelect
          options={GOVERNMENT_COMPONENTS as readonly string[]}
          value={formData.governmentComponents}
          onChange={(value) => setFormData({ ...formData, governmentComponents: value })}
          placeholder="Select government components..."
        />
      </div>
    </div>
  );
}

function TaxTab({
  formData,
  setFormData,
}: {
  formData: ArchetypeFormData;
  setFormData: (data: ArchetypeFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Corporate Tax Rate</span>
            <span className="text-sm text-[--intel-silver]">
              {formData.taxProfile.corporateTax}%
            </span>
          </div>
          <Slider
            value={[formData.taxProfile.corporateTax]}
            onValueChange={([value]) =>
              setFormData({
                ...formData,
                taxProfile: { ...formData.taxProfile, corporateTax: value },
              })
            }
            min={0}
            max={50}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Income Tax Rate</span>
            <span className="text-sm text-[--intel-silver]">{formData.taxProfile.incomeTax}%</span>
          </div>
          <Slider
            value={[formData.taxProfile.incomeTax]}
            onValueChange={([value]) =>
              setFormData({
                ...formData,
                taxProfile: { ...formData.taxProfile, incomeTax: value },
              })
            }
            min={0}
            max={60}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Consumption Tax Rate</span>
            <span className="text-sm text-[--intel-silver]">
              {formData.taxProfile.consumptionTax}%
            </span>
          </div>
          <Slider
            value={[formData.taxProfile.consumptionTax]}
            onValueChange={([value]) =>
              setFormData({
                ...formData,
                taxProfile: { ...formData.taxProfile, consumptionTax: value },
              })
            }
            min={0}
            max={30}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Tax Efficiency</span>
            <span className="text-sm text-[--intel-silver]">
              {formData.taxProfile.taxEfficiency}%
            </span>
          </div>
          <Slider
            value={[formData.taxProfile.taxEfficiency]}
            onValueChange={([value]) =>
              setFormData({
                ...formData,
                taxProfile: { ...formData.taxProfile, taxEfficiency: value },
              })
            }
            min={0}
            max={100}
          />
        </div>
      </div>
    </div>
  );
}

function EmploymentTab({
  formData,
  setFormData,
}: {
  formData: ArchetypeFormData;
  setFormData: (data: ArchetypeFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Unemployment Rate (%)
          </label>
          <Input
            type="number"
            step="0.1"
            value={formData.employmentProfile.unemploymentRate}
            onChange={(e) =>
              setFormData({
                ...formData,
                employmentProfile: {
                  ...formData.employmentProfile,
                  unemploymentRate: parseFloat(e.target.value) || 0,
                },
              })
            }
          />
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Labor Participation (%)
          </label>
          <Input
            type="number"
            step="0.1"
            value={formData.employmentProfile.laborParticipation}
            onChange={(e) =>
              setFormData({
                ...formData,
                employmentProfile: {
                  ...formData.employmentProfile,
                  laborParticipation: parseFloat(e.target.value) || 0,
                },
              })
            }
          />
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Wage Growth (%)</label>
          <Input
            type="number"
            step="0.1"
            value={formData.employmentProfile.wageGrowth}
            onChange={(e) =>
              setFormData({
                ...formData,
                employmentProfile: {
                  ...formData.employmentProfile,
                  wageGrowth: parseFloat(e.target.value) || 0,
                },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

function MetricsTab({
  formData,
  setFormData,
}: {
  formData: ArchetypeFormData;
  setFormData: (data: ArchetypeFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">GDP Growth (%)</span>
            <span className="text-sm text-[--intel-silver]">
              {formData.growthMetrics.gdpGrowth}%
            </span>
          </div>
          <Slider
            value={[formData.growthMetrics.gdpGrowth]}
            onValueChange={([value]) =>
              setFormData({
                ...formData,
                growthMetrics: { ...formData.growthMetrics, gdpGrowth: value },
              })
            }
            min={-5}
            max={15}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Innovation Index</span>
            <span className="text-sm text-[--intel-silver]">
              {formData.growthMetrics.innovationIndex}
            </span>
          </div>
          <Slider
            value={[formData.growthMetrics.innovationIndex]}
            onValueChange={([value]) =>
              setFormData({
                ...formData,
                growthMetrics: { ...formData.growthMetrics, innovationIndex: value },
              })
            }
            min={0}
            max={100}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Competitiveness</span>
            <span className="text-sm text-[--intel-silver]">
              {formData.growthMetrics.competitiveness}
            </span>
          </div>
          <Slider
            value={[formData.growthMetrics.competitiveness]}
            onValueChange={([value]) =>
              setFormData({
                ...formData,
                growthMetrics: { ...formData.growthMetrics, competitiveness: value },
              })
            }
            min={0}
            max={100}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Stability</span>
            <span className="text-sm text-[--intel-silver]">
              {formData.growthMetrics.stability}
            </span>
          </div>
          <Slider
            value={[formData.growthMetrics.stability]}
            onValueChange={([value]) =>
              setFormData({
                ...formData,
                growthMetrics: { ...formData.growthMetrics, stability: value },
              })
            }
            min={0}
            max={100}
          />
        </div>
      </div>
    </div>
  );
}

function CharacteristicsTab({
  formData,
  setFormData,
}: {
  formData: ArchetypeFormData;
  setFormData: (data: ArchetypeFormData) => void;
}) {
  const addArrayItem = (field: keyof ArchetypeFormData) => {
    const currentArray = formData[field] as string[];
    setFormData({ ...formData, [field]: [...currentArray, ""] });
  };

  const updateArrayItem = (field: keyof ArchetypeFormData, index: number, value: string) => {
    const currentArray = formData[field] as string[];
    const newArray = [...currentArray];
    newArray[index] = value;
    setFormData({ ...formData, [field]: newArray });
  };

  const removeArrayItem = (field: keyof ArchetypeFormData, index: number) => {
    const currentArray = formData[field] as string[];
    setFormData({ ...formData, [field]: currentArray.filter((_, i) => i !== index) });
  };

  const renderArrayEditor = (
    field: keyof ArchetypeFormData,
    label: string,
    placeholder: string
  ) => {
    const items = formData[field] as string[];
    return (
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">{label}</label>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => updateArrayItem(field, index, e.target.value)}
                placeholder={placeholder}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeArrayItem(field, index)}
                className="text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => addArrayItem(field)}>
            <Plus className="mr-2 h-4 w-4" />
            Add {label.slice(0, -1)}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderArrayEditor("characteristics", "Characteristics", "Enter characteristic...")}
      {renderArrayEditor("strengths", "Strengths", "Enter strength...")}
      {renderArrayEditor("challenges", "Challenges", "Enter challenge...")}
      {renderArrayEditor("culturalFactors", "Cultural Factors", "Enter cultural factor...")}
      {renderArrayEditor("modernExamples", "Modern Examples", "Enter example...")}
      {renderArrayEditor("recommendations", "Recommendations", "Enter recommendation...")}
    </div>
  );
}
