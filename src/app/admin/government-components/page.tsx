// src/app/admin/government-components/page.tsx
// Admin interface for managing government components and synergy relationships

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
  Search,
  Network,
  Eye,
  EyeOff,
  ArrowLeft,
  Settings,
  Building2,
  Users,
  Shield,
  DollarSign,
  Activity,
  BarChart3,
  Target,
  Award,
  Palette,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { ComponentType } from "@prisma/client";

// Component categories mapping
const COMPONENT_CATEGORIES = {
  "Power Distribution": [
    "CENTRALIZED_POWER",
    "FEDERAL_SYSTEM",
    "CONFEDERATE_SYSTEM",
    "UNITARY_SYSTEM",
  ],
  "Decision Process": [
    "DEMOCRATIC_PROCESS",
    "AUTOCRATIC_PROCESS",
    "TECHNOCRATIC_PROCESS",
    "CONSENSUS_PROCESS",
    "OLIGARCHIC_PROCESS",
  ],
  "Legitimacy Sources": [
    "ELECTORAL_LEGITIMACY",
    "TRADITIONAL_LEGITIMACY",
    "PERFORMANCE_LEGITIMACY",
    "CHARISMATIC_LEGITIMACY",
    "RELIGIOUS_LEGITIMACY",
    "INSTITUTIONAL_LEGITIMACY",
  ],
  Institutions: [
    "PROFESSIONAL_BUREAUCRACY",
    "MILITARY_ADMINISTRATION",
    "INDEPENDENT_JUDICIARY",
    "PARTISAN_INSTITUTIONS",
    "TECHNOCRATIC_AGENCIES",
  ],
  "Control Mechanisms": [
    "RULE_OF_LAW",
    "SURVEILLANCE_SYSTEM",
    "ECONOMIC_INCENTIVES",
    "SOCIAL_PRESSURE",
    "MILITARY_ENFORCEMENT",
  ],
  "Economic Governance": [
    "FREE_MARKET_SYSTEM",
    "PLANNED_ECONOMY",
    "MIXED_ECONOMY",
    "CORPORATIST_SYSTEM",
    "SOCIAL_MARKET_ECONOMY",
    "STATE_CAPITALISM",
    "RESOURCE_BASED_ECONOMY",
    "KNOWLEDGE_ECONOMY",
  ],
  "Administrative Efficiency": [
    "DIGITAL_GOVERNMENT",
    "E_GOVERNANCE",
    "ADMINISTRATIVE_DECENTRALIZATION",
    "MERIT_BASED_SYSTEM",
    "PERFORMANCE_MANAGEMENT",
    "QUALITY_ASSURANCE",
    "STRATEGIC_PLANNING",
    "RISK_MANAGEMENT",
  ],
  "Social Policy": [
    "WELFARE_STATE",
    "UNIVERSAL_HEALTHCARE",
    "PUBLIC_EDUCATION",
    "SOCIAL_SAFETY_NET",
    "WORKER_PROTECTION",
    "ENVIRONMENTAL_PROTECTION",
    "CULTURAL_PRESERVATION",
    "MINORITY_RIGHTS",
  ],
  "International Relations": [
    "MULTILATERAL_DIPLOMACY",
    "BILATERAL_RELATIONS",
    "REGIONAL_INTEGRATION",
    "INTERNATIONAL_LAW",
    "DEVELOPMENT_AID",
    "HUMANITARIAN_INTERVENTION",
    "TRADE_AGREEMENTS",
    "SECURITY_ALLIANCES",
  ],
  "Innovation & Development": [
    "RESEARCH_AND_DEVELOPMENT",
    "INNOVATION_ECOSYSTEM",
    "TECHNOLOGY_TRANSFER",
    "ENTREPRENEURSHIP_SUPPORT",
  ],
};

const COMPLEXITY_LEVELS = ["Low", "Medium", "High"] as const;
const COMPLEXITY_COLORS: Record<string, string> = {
  Low: "text-green-400",
  Medium: "text-yellow-400",
  High: "text-red-400",
};

const COLOR_OPTIONS = ["blue", "green", "red", "purple", "amber", "orange", "pink", "indigo"];

interface ComponentFormData {
  type: ComponentType;
  name: string;
  description: string;
  category: string;
  effectiveness: number;
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  synergies: ComponentType[];
  conflicts: ComponentType[];
  complexity: "Low" | "Medium" | "High";
  timeToImplement: string;
  staffRequired: number;
  technologyRequired: boolean;
  color: string;
  icon: string;
}

export default function GovernmentComponentsPage() {
  usePageTitle({ title: "Government Components Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [complexityFilter, setComplexityFilter] = useState("all");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [editingComponent, setEditingComponent] = useState<any | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSynergyMatrixOpen, setIsSynergyMatrixOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Queries
  const {
    data: components,
    isLoading,
    refetch,
  } = api.governmentComponents.getAllComponents.useQuery(
    {
      isActive: showActiveOnly ? true : undefined,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const { data: stats } = api.governmentComponents.getComponentUsageStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Mutations
  const createMutation = api.governmentComponents.createComponent.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Component created successfully",
        type: "success",
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create component",
        type: "error",
      });
    },
  });

  const updateMutation = api.governmentComponents.updateComponent.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Component updated successfully",
        type: "success",
      });
      refetch();
      setEditingComponent(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update component",
        type: "error",
      });
    },
  });

  const deleteMutation = api.governmentComponents.deleteComponent.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Component deactivated successfully",
        type: "success",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate component",
        type: "error",
      });
    },
  });

  const createSynergyMutation = api.governmentComponents.createSynergy.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Synergy relationship created",
        type: "success",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create synergy",
        type: "error",
      });
    },
  });

  // Filtered components
  const filteredComponents = useMemo(() => {
    if (!components) return [];

    return components.filter((component) => {
      const matchesSearch =
        component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" ||
        COMPONENT_CATEGORIES[categoryFilter as keyof typeof COMPONENT_CATEGORIES]?.includes(
          component.type
        );

      const matchesComplexity =
        complexityFilter === "all" || component.metadata?.complexity === complexityFilter;

      return matchesSearch && matchesCategory && matchesComplexity;
    });
  }, [components, searchTerm, categoryFilter, complexityFilter]);

  // Form data
  const [formData, setFormData] = useState<ComponentFormData>({
    type: ComponentType.CENTRALIZED_POWER,
    name: "",
    description: "",
    category: "governance",
    effectiveness: 75,
    implementationCost: 100000,
    maintenanceCost: 50000,
    requiredCapacity: 75,
    synergies: [],
    conflicts: [],
    complexity: "Medium",
    timeToImplement: "12 months",
    staffRequired: 20,
    technologyRequired: false,
    color: "blue",
    icon: "Settings",
  });

  const resetForm = () => {
    setFormData({
      type: ComponentType.CENTRALIZED_POWER,
      name: "",
      description: "",
      category: "governance",
      effectiveness: 75,
      implementationCost: 100000,
      maintenanceCost: 50000,
      requiredCapacity: 75,
      synergies: [],
      conflicts: [],
      complexity: "Medium",
      timeToImplement: "12 months",
      staffRequired: 20,
      technologyRequired: false,
      color: "blue",
      icon: "Settings",
    });
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

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to deactivate "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (component: any) => {
    setFormData({
      type: component.type,
      name: component.name,
      description: component.description,
      category: component.category,
      effectiveness: component.effectiveness,
      implementationCost: component.implementationCost,
      maintenanceCost: component.maintenanceCost,
      requiredCapacity: component.requiredCapacity,
      synergies: component.synergies || [],
      conflicts: component.conflicts || [],
      complexity: component.metadata?.complexity || "Medium",
      timeToImplement: component.metadata?.timeToImplement || "12 months",
      staffRequired: component.metadata?.staffRequired || 20,
      technologyRequired: component.metadata?.technologyRequired || false,
      color: component.color || "blue",
      icon: component.icon || "Settings",
    });
    setEditingComponent(component);
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
                  <Building2 className="h-6 w-6 text-[--intel-gold]" />
                </div>
                <div>
                  <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                    Government Components
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Manage atomic government components and synergy relationships
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
                Add Component
              </Button>
              <Button variant="outline" onClick={() => setIsSynergyMatrixOpen(true)}>
                <Network className="mr-2 h-4 w-4" />
                Synergy Matrix
              </Button>
              <Button variant="outline">
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="mb-4">
            <TabsList className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
              <TabsTrigger value="all">All</TabsTrigger>
              {Object.keys(COMPONENT_CATEGORIES).map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

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

            <div className="flex items-center gap-2">
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
        </div>

        {/* Statistics */}
        {stats && (
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Total Components</p>
              <p className="text-foreground mt-2 text-3xl font-bold">{stats.totalComponents}</p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Active Components</p>
              <p className="mt-2 text-3xl font-bold text-[--intel-gold]">
                {stats.activeComponents}
              </p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Total Usage</p>
              <p className="mt-2 text-3xl font-bold text-blue-400">{stats.totalUsage}</p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Total Synergies</p>
              <p className="mt-2 text-3xl font-bold text-green-400">{stats.totalSynergies || 0}</p>
            </Card>
          </div>
        )}

        {/* Components Grid */}
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[--intel-gold]"></div>
            <p className="text-muted-foreground">Loading components...</p>
          </div>
        ) : filteredComponents.length === 0 ? (
          <Card className="glass-card-parent p-12 text-center">
            <p className="text-[--intel-silver]">No components found matching your filters</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredComponents.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                onEdit={() => handleEdit(component)}
                onDelete={() => handleDelete(component.id, component.name)}
              />
            ))}
          </div>
        )}

        {/* Editor Dialog */}
        {(isAddDialogOpen || editingComponent) && (
          <ComponentEditorDialog
            isOpen={isAddDialogOpen || !!editingComponent}
            isEditing={!!editingComponent}
            formData={formData}
            setFormData={setFormData}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onClose={() => {
              setIsAddDialogOpen(false);
              setEditingComponent(null);
              resetForm();
            }}
            onSave={editingComponent ? handleUpdate : handleCreate}
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        )}

        {/* Synergy Matrix Modal */}
        {isSynergyMatrixOpen && (
          <SynergyMatrixModal
            isOpen={isSynergyMatrixOpen}
            components={components || []}
            onClose={() => setIsSynergyMatrixOpen(false)}
            onCreateSynergy={(data) => createSynergyMutation.mutate(data)}
          />
        )}
      </div>
    </div>
  );
}

// Component Card Component
interface ComponentCardProps {
  component: any;
  onEdit: () => void;
  onDelete: () => void;
}

function ComponentCard({ component, onEdit, onDelete }: ComponentCardProps) {
  return (
    <Card className="glass-card-child p-4 transition-all hover:border-[--intel-gold]/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Settings className="h-4 w-4 text-[--intel-gold]" />
            <h3 className="text-foreground line-clamp-1 font-semibold">{component.name}</h3>
          </div>
          <span
            className={`rounded px-2 py-0.5 text-xs bg-${component.color}-500/20 text-${component.color}-400`}
          >
            {component.category}
          </span>
        </div>
        {!component.isActive && <EyeOff className="h-4 w-4 text-red-400" title="Inactive" />}
      </div>

      {/* Description */}
      <p className="mb-3 line-clamp-2 text-xs text-[--intel-silver]">{component.description}</p>

      {/* Effectiveness Bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Effectiveness</span>
          <span className="text-foreground font-medium">{component.effectiveness}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full ${
              component.effectiveness >= 75
                ? "bg-green-400"
                : component.effectiveness >= 50
                  ? "bg-yellow-400"
                  : "bg-red-400"
            }`}
            style={{ width: `${component.effectiveness}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Complexity:</span>
          <span
            className={`font-medium ${COMPLEXITY_COLORS[component.metadata?.complexity || "Medium"]}`}
          >
            {component.metadata?.complexity || "Medium"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Usage:</span>
          <span className="text-foreground font-medium">{component.usageCount || 0}×</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Cost:</span>
          <span className="text-foreground font-medium">
            ${(component.implementationCost / 1000).toFixed(0)}k / $
            {(component.maintenanceCost / 1000).toFixed(0)}k
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 text-xs">
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit} className="text-xs">
          <Network className="mr-1 h-3 w-3" />
          Synergies
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

// Component Editor Dialog
interface ComponentEditorDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: ComponentFormData;
  setFormData: (data: ComponentFormData) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}

function ComponentEditorDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  activeTab,
  setActiveTab,
  onClose,
  onSave,
  isPending,
}: ComponentEditorDialogProps) {
  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "costs", label: "Costs", icon: DollarSign },
    { id: "relationships", label: "Relationships", icon: Network },
    { id: "metadata", label: "Metadata", icon: Award },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  // Get all component types for relationships
  const allComponentTypes = Object.values(ComponentType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Component" : "Add Component"}</DialogTitle>
          <DialogDescription>
            Configure the government component and its relationships
          </DialogDescription>
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
            <TabsContent value="costs">
              <CostsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="relationships">
              <RelationshipsTab
                formData={formData}
                setFormData={setFormData}
                allComponentTypes={allComponentTypes}
              />
            </TabsContent>
            <TabsContent value="metadata">
              <MetadataTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="appearance">
              <AppearanceTab formData={formData} setFormData={setFormData} />
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
            disabled={!formData.name || isPending}
            className="bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30"
          >
            {isPending ? "Saving..." : isEditing ? "Update Component" : "Create Component"}
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
  formData: ComponentFormData;
  setFormData: (data: ComponentFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Component Type *</label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value as ComponentType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ComponentType).map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Name *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Centralized Power Structure"
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Description *</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the component..."
          rows={3}
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Category</label>
        <Input
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="e.g., governance, economic, social"
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Effectiveness Score: {formData.effectiveness}%
        </label>
        <Slider
          value={[formData.effectiveness]}
          onValueChange={([value]) => setFormData({ ...formData, effectiveness: value })}
          min={0}
          max={100}
        />
      </div>
    </div>
  );
}

function CostsTab({
  formData,
  setFormData,
}: {
  formData: ComponentFormData;
  setFormData: (data: ComponentFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Implementation Cost ($)
        </label>
        <Input
          type="number"
          value={formData.implementationCost}
          onChange={(e) =>
            setFormData({ ...formData, implementationCost: parseFloat(e.target.value) || 0 })
          }
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Maintenance Cost ($ / year)
        </label>
        <Input
          type="number"
          value={formData.maintenanceCost}
          onChange={(e) =>
            setFormData({ ...formData, maintenanceCost: parseFloat(e.target.value) || 0 })
          }
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Required Capacity: {formData.requiredCapacity}%
        </label>
        <Slider
          value={[formData.requiredCapacity]}
          onValueChange={([value]) => setFormData({ ...formData, requiredCapacity: value })}
          min={0}
          max={100}
        />
      </div>
    </div>
  );
}

function RelationshipsTab({
  formData,
  setFormData,
  allComponentTypes,
}: {
  formData: ComponentFormData;
  setFormData: (data: ComponentFormData) => void;
  allComponentTypes: ComponentType[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Synergies</label>
        <MultiSelect
          options={allComponentTypes as readonly string[]}
          value={formData.synergies}
          onChange={(value) => setFormData({ ...formData, synergies: value as ComponentType[] })}
          placeholder="Select components that synergize..."
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Components that work well together for multiplied effectiveness
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Conflicts</label>
        <MultiSelect
          options={allComponentTypes as readonly string[]}
          value={formData.conflicts}
          onChange={(value) => setFormData({ ...formData, conflicts: value as ComponentType[] })}
          placeholder="Select conflicting components..."
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Components that conflict or reduce effectiveness when combined
        </p>
      </div>
    </div>
  );
}

function MetadataTab({
  formData,
  setFormData,
}: {
  formData: ComponentFormData;
  setFormData: (data: ComponentFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Complexity</label>
        <Select
          value={formData.complexity}
          onValueChange={(value) =>
            setFormData({ ...formData, complexity: value as "Low" | "Medium" | "High" })
          }
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
        <label className="text-foreground mb-2 block text-sm font-medium">Time to Implement</label>
        <Input
          value={formData.timeToImplement}
          onChange={(e) => setFormData({ ...formData, timeToImplement: e.target.value })}
          placeholder="e.g., 12 months"
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Staff Required</label>
        <Input
          type="number"
          value={formData.staffRequired}
          onChange={(e) =>
            setFormData({ ...formData, staffRequired: parseInt(e.target.value) || 0 })
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="technologyRequired"
          checked={formData.technologyRequired}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, technologyRequired: checked as boolean })
          }
        />
        <label htmlFor="technologyRequired" className="text-foreground cursor-pointer text-sm">
          Requires advanced technology
        </label>
      </div>
    </div>
  );
}

function AppearanceTab({
  formData,
  setFormData,
}: {
  formData: ComponentFormData;
  setFormData: (data: ComponentFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Color Theme</label>
        <div className="grid grid-cols-4 gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              onClick={() => setFormData({ ...formData, color })}
              className={`rounded-lg border-2 p-3 transition-all ${
                formData.color === color
                  ? `border-${color}-400 bg-${color}-500/20`
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className={`h-8 w-full rounded bg-${color}-500`} />
              <p className="mt-1 text-center text-xs capitalize">{color}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Icon Name</label>
        <Input
          value={formData.icon}
          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
          placeholder="e.g., Settings, Building2, Users"
        />
        <p className="mt-1 text-xs text-[--intel-silver]">Icon name from lucide-react library</p>
      </div>
    </div>
  );
}

// Synergy Matrix Modal
interface SynergyMatrixModalProps {
  isOpen: boolean;
  components: any[];
  onClose: () => void;
  onCreateSynergy: (data: any) => void;
}

function SynergyMatrixModal({
  isOpen,
  components,
  onClose,
  onCreateSynergy,
}: SynergyMatrixModalProps) {
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(null);

  const getSynergyType = (primary: any, secondary: any) => {
    if (primary.synergies?.includes(secondary.type)) return "strong";
    if (secondary.synergies?.includes(primary.type)) return "moderate";
    if (primary.conflicts?.includes(secondary.type) || secondary.conflicts?.includes(primary.type))
      return "conflict";
    return "none";
  };

  const getSynergyColor = (type: string) => {
    switch (type) {
      case "strong":
        return "bg-green-500/30 hover:bg-green-500/50";
      case "moderate":
        return "bg-yellow-500/30 hover:bg-yellow-500/50";
      case "conflict":
        return "bg-red-500/30 hover:bg-red-500/50";
      default:
        return "bg-white/5 hover:bg-white/10";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Synergy Matrix</DialogTitle>
          <DialogDescription>
            Visualize and manage synergy relationships between components
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `auto repeat(${components.length}, 1fr)` }}
          >
            {/* Header Row */}
            <div className="bg-background sticky top-0 left-0 z-20" />
            {components.map((comp) => (
              <div
                key={comp.id}
                className="bg-background sticky top-0 z-10 border border-white/10 p-2 text-center text-xs font-medium"
              >
                <div className="origin-center -rotate-45 transform whitespace-nowrap">
                  {comp.name.substring(0, 20)}
                </div>
              </div>
            ))}

            {/* Matrix Rows */}
            {components.map((primary) => (
              <>
                <div className="bg-background sticky left-0 z-10 border border-white/10 p-2 text-xs font-medium">
                  {primary.name}
                </div>
                {components.map((secondary) => {
                  const synergyType = getSynergyType(primary, secondary);
                  const isSelected =
                    selectedPrimary === primary.id && selectedSecondary === secondary.id;

                  return (
                    <button
                      key={`${primary.id}-${secondary.id}`}
                      onClick={() => {
                        if (primary.id !== secondary.id) {
                          setSelectedPrimary(primary.id);
                          setSelectedSecondary(secondary.id);
                        }
                      }}
                      disabled={primary.id === secondary.id}
                      className={`border border-white/10 p-2 transition-all ${
                        primary.id === secondary.id
                          ? "cursor-not-allowed bg-white/5"
                          : `${getSynergyColor(synergyType)} cursor-pointer ${
                              isSelected ? "ring-2 ring-[--intel-gold]" : ""
                            }`
                      }`}
                      title={
                        primary.id === secondary.id
                          ? "Same component"
                          : `${primary.name} ↔ ${secondary.name}`
                      }
                    />
                  );
                })}
              </>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
            <span className="text-sm font-medium">Legend:</span>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-green-500/50" />
              <span className="text-xs">Strong Synergy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-yellow-500/50" />
              <span className="text-xs">Moderate Synergy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-red-500/50" />
              <span className="text-xs">Conflict</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-white/10" />
              <span className="text-xs">No Relationship</span>
            </div>
          </div>

          {selectedPrimary && selectedSecondary && (
            <div className="mt-4 rounded-lg border border-[--intel-gold]/20 bg-[--intel-gold]/10 p-4">
              <p className="mb-2 text-sm font-medium">Selected Relationship:</p>
              <p className="text-xs text-[--intel-silver]">
                {components.find((c) => c.id === selectedPrimary)?.name} ↔{" "}
                {components.find((c) => c.id === selectedSecondary)?.name}
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  // TODO: Open synergy editor
                  onCreateSynergy({
                    primaryComponentId: selectedPrimary,
                    secondaryComponentId: selectedSecondary,
                    synergyType: "MULTIPLICATIVE",
                    effectMultiplier: 1.2,
                  });
                }}
              >
                Edit Relationship
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
