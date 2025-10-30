// src/app/admin/economic-components/page.tsx
// Admin interface for managing economic components and synergy relationships

"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
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
  EyeOff,
  ArrowLeft,
  Settings,
  Factory,
  Users,
  Globe,
  Lightbulb,
  Leaf,
  DollarSign,
  Activity,
  BarChart3,
  Target,
  Award,
  Palette,
  Building2,
  TrendingUp,
  FileText,
  Briefcase,
  Zap
} from "lucide-react";
import Link from "next/link";
import { EconomicComponentType } from '@prisma/client';
import { ComponentType } from '@prisma/client';

// Component categories mapping
const COMPONENT_CATEGORIES = {
  'Economic Model': [
    'FREE_MARKET_SYSTEM', 'MIXED_ECONOMY', 'STATE_CAPITALISM', 'PLANNED_ECONOMY',
    'SOCIAL_MARKET_ECONOMY', 'RESOURCE_BASED_ECONOMY', 'KNOWLEDGE_ECONOMY', 'INNOVATION_ECONOMY'
  ],
  'Sector Focus': [
    'AGRICULTURE_LED', 'MANUFACTURING_LED', 'SERVICE_BASED', 'TECHNOLOGY_FOCUSED',
    'FINANCE_CENTERED', 'EXPORT_ORIENTED', 'DOMESTIC_FOCUSED', 'TOURISM_BASED'
  ],
  'Labor System': [
    'FLEXIBLE_LABOR', 'PROTECTED_WORKERS', 'UNION_BASED', 'GIG_ECONOMY',
    'PROFESSIONAL_SERVICES', 'SKILL_BASED', 'EDUCATION_FIRST', 'MERIT_BASED',
    'HIGH_SKILLED_WORKERS', 'EDUCATION_FOCUSED', 'HEALTHCARE_FOCUSED', 'VOCATIONAL_TRAINING'
  ],
  'Trade Policy': [
    'FREE_TRADE', 'PROTECTIONIST', 'BALANCED_TRADE', 'EXPORT_SUBSIDY',
    'IMPORT_SUBSTITUTION', 'TRADE_BLOC', 'BILATERAL_FOCUS', 'MULTILATERAL_FOCUS',
    'TRADE_FACILITATION', 'COMPETITIVE_MARKETS'
  ],
  'Innovation': [
    'RD_INVESTMENT', 'TECH_TRANSFER', 'STARTUP_ECOSYSTEM', 'PATENT_PROTECTION',
    'OPEN_INNOVATION', 'UNIVERSITY_PARTNERSHIPS', 'VENTURE_CAPITAL', 'INTELLECTUAL_PROPERTY',
    'RESEARCH_AND_DEVELOPMENT'
  ],
  'Resource Management': [
    'SUSTAINABLE_DEVELOPMENT', 'EXTRACTION_FOCUSED', 'RENEWABLE_ENERGY',
    'CIRCULAR_ECONOMY', 'LINEAR_ECONOMY', 'CONSERVATION_FIRST', 'GREEN_TECHNOLOGY',
    'CARBON_NEUTRAL', 'CARBON_INTENSIVE', 'ECO_FRIENDLY', 'GREEN_ECONOMY'
  ]
};

const COMPLEXITY_LEVELS = ['Low', 'Medium', 'High'] as const;
const COMPLEXITY_COLORS: Record<string, string> = {
  'Low': 'text-green-400',
  'Medium': 'text-yellow-400',
  'High': 'text-red-400'
};

const COLOR_OPTIONS = ['emerald', 'green', 'blue', 'purple', 'amber', 'orange', 'pink', 'indigo'];

interface ComponentFormData {
  type: EconomicComponentType;
  name: string;
  description: string;
  category: string;
  effectiveness: number;
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  synergies: EconomicComponentType[];
  conflicts: EconomicComponentType[];
  governmentSynergies: string[];
  governmentConflicts: string[];
  taxImpact: {
    optimalCorporateRate: number;
    optimalIncomeRate: number;
    revenueEfficiency: number;
  };
  sectorImpact: {
    services: number;
    finance: number;
    technology: number;
    manufacturing: number;
    agriculture: number;
    government: number;
  };
  employmentImpact: {
    unemploymentModifier: number;
    participationModifier: number;
    wageGrowthModifier: number;
  };
  complexity: 'Low' | 'Medium' | 'High';
  timeToImplement: string;
  staffRequired: number;
  technologyRequired: boolean;
  color: string;
  icon: string;
}

export default function EconomicComponentsPage() {
  usePageTitle({ title: "Economic Components Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [complexityFilter, setComplexityFilter] = useState('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [editingComponent, setEditingComponent] = useState<any | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSynergyMatrixOpen, setIsSynergyMatrixOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Queries
  const { data: componentsResponse, isLoading, refetch } = api.economicComponents.getAllComponents.useQuery(
    {
      isActive: showActiveOnly ? true : undefined
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
      toast({
        title: "Success",
        description: "Component created successfully",
        type: "success"
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create component",
        type: "error"
      });
    }
  });

  const updateMutation = api.economicComponents.updateComponent.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Component updated successfully",
        type: "success"
      });
      refetch();
      setEditingComponent(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update component",
        type: "error"
      });
    }
  });

  const deleteMutation = api.economicComponents.deleteComponent.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Component deactivated successfully",
        type: "success"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate component",
        type: "error"
      });
    }
  });

  const createSynergyMutation = api.economicComponents.createSynergy.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Synergy relationship created",
        type: "success"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create synergy",
        type: "error"
      });
    }
  });

  // Filtered components
  const filteredComponents = useMemo(() => {
    if (!components) return [];

    return components.filter(component => {
      const matchesSearch =
        component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === 'all' ||
        component.category === categoryFilter;

      const matchesComplexity =
        complexityFilter === 'all' ||
        component.metadata?.complexity === complexityFilter;

      return matchesSearch && matchesCategory && matchesComplexity;
    });
  }, [components, searchTerm, categoryFilter, complexityFilter]);

  // Form data
  const [formData, setFormData] = useState<ComponentFormData>({
    type: EconomicComponentType.FREE_MARKET_SYSTEM,
    name: '',
    description: '',
    category: 'Economic Model',
    effectiveness: 75,
    implementationCost: 500000,
    maintenanceCost: 100000,
    requiredCapacity: 75,
    synergies: [],
    conflicts: [],
    governmentSynergies: [],
    governmentConflicts: [],
    taxImpact: {
      optimalCorporateRate: 20,
      optimalIncomeRate: 25,
      revenueEfficiency: 75,
    },
    sectorImpact: {
      services: 1.0,
      finance: 1.0,
      technology: 1.0,
      manufacturing: 1.0,
      agriculture: 1.0,
      government: 1.0,
    },
    employmentImpact: {
      unemploymentModifier: 0,
      participationModifier: 1.0,
      wageGrowthModifier: 1.0,
    },
    complexity: 'Medium',
    timeToImplement: '12 months',
    staffRequired: 25,
    technologyRequired: false,
    color: 'emerald',
    icon: 'Factory'
  });

  const resetForm = () => {
    setFormData({
      type: EconomicComponentType.FREE_MARKET_SYSTEM,
      name: '',
      description: '',
      category: 'Economic Model',
      effectiveness: 75,
      implementationCost: 500000,
      maintenanceCost: 100000,
      requiredCapacity: 75,
      synergies: [],
      conflicts: [],
      governmentSynergies: [],
      governmentConflicts: [],
      taxImpact: {
        optimalCorporateRate: 20,
        optimalIncomeRate: 25,
        revenueEfficiency: 75,
      },
      sectorImpact: {
        services: 1.0,
        finance: 1.0,
        technology: 1.0,
        manufacturing: 1.0,
        agriculture: 1.0,
        government: 1.0,
      },
      employmentImpact: {
        unemploymentModifier: 0,
        participationModifier: 1.0,
        wageGrowthModifier: 1.0,
      },
      complexity: 'Medium',
      timeToImplement: '12 months',
      staffRequired: 25,
      technologyRequired: false,
      color: 'emerald',
      icon: 'Factory'
    });
    setActiveTab('general');
  };

  const handleCreate = () => {
    createMutation.mutate(formData as any);
  };

  const handleUpdate = () => {
    if (editingComponent?.id) {
      updateMutation.mutate({
        id: editingComponent.id,
        ...formData
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
      governmentSynergies: component.governmentSynergies || [],
      governmentConflicts: component.governmentConflicts || [],
      taxImpact: component.taxImpact || {
        optimalCorporateRate: 20,
        optimalIncomeRate: 25,
        revenueEfficiency: 75,
      },
      sectorImpact: component.sectorImpact || {
        services: 1.0,
        finance: 1.0,
        technology: 1.0,
        manufacturing: 1.0,
        agriculture: 1.0,
        government: 1.0,
      },
      employmentImpact: component.employmentImpact || {
        unemploymentModifier: 0,
        participationModifier: 1.0,
        wageGrowthModifier: 1.0,
      },
      complexity: component.metadata?.complexity || 'Medium',
      timeToImplement: component.metadata?.timeToImplement || '12 months',
      staffRequired: component.metadata?.staffRequired || 25,
      technologyRequired: component.metadata?.technologyRequired || false,
      color: component.color || 'emerald',
      icon: component.icon || 'Factory'
    });
    setEditingComponent(component);
    setActiveTab('general');
  };

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--intel-gold] mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <SignInButton mode="modal" />
      </div>
    );
  }

  const allowedRoles = new Set(["admin", "owner", "staff"]);
  const isSystemOwnerUser = !!user && isSystemOwner(user.id);
  const hasAdminRole = typeof user?.publicMetadata?.role === "string" && allowedRoles.has(user.publicMetadata.role);

  if (!isSystemOwnerUser && !hasAdminRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass-card-parent p-6 rounded-xl border-2 border-[--intel-gold]/20 bg-gradient-to-br from-[--intel-gold]/5 via-transparent to-[--intel-gold]/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[--intel-gold]/10 border border-[--intel-gold]/20">
                  <Factory className="h-6 w-6 text-[--intel-gold]" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Economic Components
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage atomic economic components and impact calculations
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Component
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsTemplateManagerOpen(true)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Templates
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsSynergyMatrixOpen(true)}
              >
                <Network className="h-4 w-4 mr-2" />
                Synergy Matrix
              </Button>
              <Button variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="mb-4">
            <TabsList className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
              <TabsTrigger value="all">All</TabsTrigger>
              {Object.keys(COMPONENT_CATEGORIES).map(category => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                {COMPLEXITY_LEVELS.map(complexity => (
                  <SelectItem key={complexity} value={complexity}>{complexity}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox
                id="activeOnly"
                checked={showActiveOnly}
                onCheckedChange={(checked) => setShowActiveOnly(checked as boolean)}
              />
              <label htmlFor="activeOnly" className="text-sm text-foreground cursor-pointer">
                Show active only
              </label>
            </div>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Total Components</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.totalComponents}</p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Active Components</p>
              <p className="text-3xl font-bold text-[--intel-gold] mt-2">{stats.activeComponents}</p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Total Usage</p>
              <p className="text-3xl font-bold text-blue-400 mt-2">{stats.totalUsage}</p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Total Synergies</p>
              <p className="text-3xl font-bold text-green-400 mt-2">{stats.totalSynergies || 0}</p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-sm text-[--intel-silver]">Total Templates</p>
              <p className="text-3xl font-bold text-purple-400 mt-2">{stats.totalTemplates || 0}</p>
            </Card>
          </div>
        )}

        {/* Components Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--intel-gold] mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading components...</p>
          </div>
        ) : filteredComponents.length === 0 ? (
          <Card className="glass-card-parent p-12 text-center">
            <p className="text-[--intel-silver]">No components found matching your filters</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredComponents.map(component => (
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

        {/* Template Manager Modal */}
        {isTemplateManagerOpen && (
          <TemplateManagerModal
            isOpen={isTemplateManagerOpen}
            templates={templates}
            onClose={() => setIsTemplateManagerOpen(false)}
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
  const hasTaxImpact = component.taxImpact && (
    component.taxImpact.optimalCorporateRate !== 20 ||
    component.taxImpact.optimalIncomeRate !== 25 ||
    component.taxImpact.revenueEfficiency !== 75
  );

  const hasSectorImpact = component.sectorImpact && Object.values(component.sectorImpact).some(
    (val: any) => val !== 1.0
  );

  const hasEmploymentImpact = component.employmentImpact && (
    component.employmentImpact.unemploymentModifier !== 0 ||
    component.employmentImpact.participationModifier !== 1.0 ||
    component.employmentImpact.wageGrowthModifier !== 1.0
  );

  return (
    <Card className="glass-card-child p-4 hover:border-[--intel-gold]/50 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Factory className="h-4 w-4 text-[--intel-gold]" />
            <h3 className="font-semibold text-foreground line-clamp-1">{component.name}</h3>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded bg-${component.color}-500/20 text-${component.color}-400`}>
            {component.category}
          </span>
        </div>
        {!component.isActive && (
          <EyeOff className="h-4 w-4 text-red-400" title="Inactive" />
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-[--intel-silver] line-clamp-2 mb-3">
        {component.description}
      </p>

      {/* Effectiveness Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-[--intel-silver]">Effectiveness</span>
          <span className="font-medium text-foreground">{component.effectiveness}%</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full ${
              component.effectiveness >= 75
                ? 'bg-green-400'
                : component.effectiveness >= 50
                ? 'bg-yellow-400'
                : 'bg-red-400'
            }`}
            style={{ width: `${component.effectiveness}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Complexity:</span>
          <span className={`font-medium ${COMPLEXITY_COLORS[component.metadata?.complexity || 'Medium']}`}>
            {component.metadata?.complexity || 'Medium'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Usage:</span>
          <span className="font-medium text-foreground">{component.usageCount || 0}×</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Cost:</span>
          <span className="font-medium text-foreground">
            ${(component.implementationCost / 1000).toFixed(0)}k / ${(component.maintenanceCost / 1000).toFixed(0)}k
          </span>
        </div>
      </div>

      {/* Impact Indicators */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
        {hasTaxImpact && (
          <div className="p-1 rounded bg-blue-500/20" title="Tax Impact">
            <DollarSign className="h-3 w-3 text-blue-400" />
          </div>
        )}
        {hasSectorImpact && (
          <div className="p-1 rounded bg-purple-500/20" title="Sector Impact">
            <Target className="h-3 w-3 text-purple-400" />
          </div>
        )}
        {hasEmploymentImpact && (
          <div className="p-1 rounded bg-green-500/20" title="Employment Impact">
            <Users className="h-3 w-3 text-green-400" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="flex-1 text-xs"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          className="text-xs"
        >
          <Network className="h-3 w-3 mr-1" />
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

// Component Editor Dialog (6 tabs)
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
  isPending
}: ComponentEditorDialogProps) {
  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'costs', label: 'Costs', icon: DollarSign },
    { id: 'relationships', label: 'Relationships', icon: Network },
    { id: 'taxImpact', label: 'Tax Impact', icon: TrendingUp },
    { id: 'sectorImpact', label: 'Sector Impact', icon: Target },
    { id: 'employmentImpact', label: 'Employment Impact', icon: Users },
    { id: 'metadata', label: 'Metadata', icon: Award },
    { id: 'appearance', label: 'Appearance', icon: Palette }
  ];

  const allEconomicComponentTypes = Object.values(EconomicComponentType);
  const allGovernmentComponentTypes = Object.values(ComponentType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Component' : 'Add Component'}
          </DialogTitle>
          <DialogDescription>
            Configure the economic component and its impact calculations
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2 shrink-0">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`px-3 py-2 rounded text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[--intel-gold]/20 text-[--intel-gold]'
                      : 'text-[--intel-silver] hover:text-foreground'
                  }`}
                >
                  <Icon className="inline h-4 w-4 mr-1" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto mt-4">
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
                allEconomicComponentTypes={allEconomicComponentTypes}
                allGovernmentComponentTypes={allGovernmentComponentTypes}
              />
            </TabsContent>
            <TabsContent value="taxImpact">
              <TaxImpactTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="sectorImpact">
              <SectorImpactTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="employmentImpact">
              <EmploymentImpactTab formData={formData} setFormData={setFormData} />
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
        <DialogFooter className="border-t border-white/10 pt-4 shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!formData.name || isPending}
            className="bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold]"
          >
            {isPending ? "Saving..." : isEditing ? "Update Component" : "Create Component"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tab Components
function GeneralTab({ formData, setFormData }: { formData: ComponentFormData; setFormData: (data: ComponentFormData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Component Type *</label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value as EconomicComponentType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(EconomicComponentType).map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Name *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Free Market System"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Description *</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the component..."
          rows={3}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Category</label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(COMPONENT_CATEGORIES).map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
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

function CostsTab({ formData, setFormData }: { formData: ComponentFormData; setFormData: (data: ComponentFormData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Implementation Cost ($)</label>
        <Input
          type="number"
          value={formData.implementationCost}
          onChange={(e) => setFormData({ ...formData, implementationCost: parseFloat(e.target.value) || 0 })}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Maintenance Cost ($ / year)</label>
        <Input
          type="number"
          value={formData.maintenanceCost}
          onChange={(e) => setFormData({ ...formData, maintenanceCost: parseFloat(e.target.value) || 0 })}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
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
  allEconomicComponentTypes,
  allGovernmentComponentTypes
}: {
  formData: ComponentFormData;
  setFormData: (data: ComponentFormData) => void;
  allEconomicComponentTypes: EconomicComponentType[];
  allGovernmentComponentTypes: ComponentType[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Economic Synergies</label>
        <MultiSelect
          options={allEconomicComponentTypes as readonly string[]}
          value={formData.synergies}
          onChange={(value) => setFormData({ ...formData, synergies: value as EconomicComponentType[] })}
          placeholder="Select components that synergize..."
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Economic components that work well together for multiplied effectiveness
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Economic Conflicts</label>
        <MultiSelect
          options={allEconomicComponentTypes as readonly string[]}
          value={formData.conflicts}
          onChange={(value) => setFormData({ ...formData, conflicts: value as EconomicComponentType[] })}
          placeholder="Select conflicting components..."
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Economic components that conflict or reduce effectiveness when combined
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Government Synergies</label>
        <MultiSelect
          options={allGovernmentComponentTypes as readonly string[]}
          value={formData.governmentSynergies}
          onChange={(value) => setFormData({ ...formData, governmentSynergies: value as string[] })}
          placeholder="Select government components that synergize..."
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Government components that enhance this economic component
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Government Conflicts</label>
        <MultiSelect
          options={allGovernmentComponentTypes as readonly string[]}
          value={formData.governmentConflicts}
          onChange={(value) => setFormData({ ...formData, governmentConflicts: value as string[] })}
          placeholder="Select government components that conflict..."
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Government components that reduce this economic component's effectiveness
        </p>
      </div>
    </div>
  );
}

function TaxImpactTab({ formData, setFormData }: { formData: ComponentFormData; setFormData: (data: ComponentFormData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Optimal Corporate Tax Rate: {formData.taxImpact.optimalCorporateRate}%
        </label>
        <Slider
          value={[formData.taxImpact.optimalCorporateRate]}
          onValueChange={([value]) => setFormData({
            ...formData,
            taxImpact: { ...formData.taxImpact, optimalCorporateRate: value }
          })}
          min={0}
          max={50}
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Recommended corporate tax rate for this economic model (0-50%)
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Optimal Income Tax Rate: {formData.taxImpact.optimalIncomeRate}%
        </label>
        <Slider
          value={[formData.taxImpact.optimalIncomeRate]}
          onValueChange={([value]) => setFormData({
            ...formData,
            taxImpact: { ...formData.taxImpact, optimalIncomeRate: value }
          })}
          min={0}
          max={60}
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Recommended income tax rate for this economic model (0-60%)
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Revenue Efficiency: {formData.taxImpact.revenueEfficiency}%
        </label>
        <Slider
          value={[formData.taxImpact.revenueEfficiency]}
          onValueChange={([value]) => setFormData({
            ...formData,
            taxImpact: { ...formData.taxImpact, revenueEfficiency: value }
          })}
          min={0}
          max={100}
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Tax collection efficiency for this economic model (0-100%)
        </p>
      </div>
    </div>
  );
}

function SectorImpactTab({ formData, setFormData }: { formData: ComponentFormData; setFormData: (data: ComponentFormData) => void }) {
  const sectors = [
    { key: 'services', label: 'Services Sector', icon: Briefcase },
    { key: 'finance', label: 'Finance Sector', icon: DollarSign },
    { key: 'technology', label: 'Technology Sector', icon: Zap },
    { key: 'manufacturing', label: 'Manufacturing Sector', icon: Factory },
    { key: 'agriculture', label: 'Agriculture Sector', icon: Leaf },
    { key: 'government', label: 'Government Sector', icon: Building2 },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[--intel-silver] mb-4">
        Set multipliers for each economic sector (0.0 = no impact, 1.0 = neutral, 2.0 = doubled impact)
      </p>
      {sectors.map(sector => {
        const Icon = sector.icon;
        return (
          <div key={sector.key}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-[--intel-gold]" />
              <label className="text-sm font-medium text-foreground">
                {sector.label}: {formData.sectorImpact[sector.key as keyof typeof formData.sectorImpact].toFixed(1)}x
              </label>
            </div>
            <Slider
              value={[formData.sectorImpact[sector.key as keyof typeof formData.sectorImpact]]}
              onValueChange={([value]) => setFormData({
                ...formData,
                sectorImpact: { ...formData.sectorImpact, [sector.key]: value }
              })}
              min={0}
              max={2}
              step={0.1}
            />
          </div>
        );
      })}
    </div>
  );
}

function EmploymentImpactTab({ formData, setFormData }: { formData: ComponentFormData; setFormData: (data: ComponentFormData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Unemployment Modifier: {formData.employmentImpact.unemploymentModifier.toFixed(1)}
        </label>
        <Slider
          value={[formData.employmentImpact.unemploymentModifier]}
          onValueChange={([value]) => setFormData({
            ...formData,
            employmentImpact: { ...formData.employmentImpact, unemploymentModifier: value }
          })}
          min={-2}
          max={2}
          step={0.1}
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Effect on unemployment rate (negative = reduces unemployment, positive = increases)
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Participation Modifier: {formData.employmentImpact.participationModifier.toFixed(1)}x
        </label>
        <Slider
          value={[formData.employmentImpact.participationModifier]}
          onValueChange={([value]) => setFormData({
            ...formData,
            employmentImpact: { ...formData.employmentImpact, participationModifier: value }
          })}
          min={0.5}
          max={2}
          step={0.1}
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Multiplier for labor force participation rate (0.5-2.0x)
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Wage Growth Modifier: {formData.employmentImpact.wageGrowthModifier.toFixed(1)}x
        </label>
        <Slider
          value={[formData.employmentImpact.wageGrowthModifier]}
          onValueChange={([value]) => setFormData({
            ...formData,
            employmentImpact: { ...formData.employmentImpact, wageGrowthModifier: value }
          })}
          min={0.5}
          max={2}
          step={0.1}
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Multiplier for wage growth rate (0.5-2.0x)
        </p>
      </div>
    </div>
  );
}

function MetadataTab({ formData, setFormData }: { formData: ComponentFormData; setFormData: (data: ComponentFormData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Complexity</label>
        <Select
          value={formData.complexity}
          onValueChange={(value) => setFormData({ ...formData, complexity: value as 'Low' | 'Medium' | 'High' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPLEXITY_LEVELS.map(level => (
              <SelectItem key={level} value={level}>{level}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Time to Implement</label>
        <Input
          value={formData.timeToImplement}
          onChange={(e) => setFormData({ ...formData, timeToImplement: e.target.value })}
          placeholder="e.g., 12 months"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Staff Required</label>
        <Input
          type="number"
          value={formData.staffRequired}
          onChange={(e) => setFormData({ ...formData, staffRequired: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="technologyRequired"
          checked={formData.technologyRequired}
          onCheckedChange={(checked) => setFormData({ ...formData, technologyRequired: checked as boolean })}
        />
        <label htmlFor="technologyRequired" className="text-sm text-foreground cursor-pointer">
          Requires advanced technology
        </label>
      </div>
    </div>
  );
}

function AppearanceTab({ formData, setFormData }: { formData: ComponentFormData; setFormData: (data: ComponentFormData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Color Theme</label>
        <div className="grid grid-cols-4 gap-2">
          {COLOR_OPTIONS.map(color => (
            <button
              key={color}
              onClick={() => setFormData({ ...formData, color })}
              className={`p-3 rounded-lg border-2 transition-all ${
                formData.color === color
                  ? `border-${color}-400 bg-${color}-500/20`
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className={`w-full h-8 rounded bg-${color}-500`} />
              <p className="text-xs mt-1 text-center capitalize">{color}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Icon Name</label>
        <Input
          value={formData.icon}
          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
          placeholder="e.g., Factory, Building2, Users"
        />
        <p className="text-xs text-[--intel-silver] mt-1">
          Icon name from lucide-react library
        </p>
      </div>
    </div>
  );
}

// Template Manager Modal
interface TemplateManagerModalProps {
  isOpen: boolean;
  templates: any[];
  onClose: () => void;
}

function TemplateManagerModal({ isOpen, templates, onClose }: TemplateManagerModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Economic Templates</DialogTitle>
          <DialogDescription>
            Pre-configured economic component sets for common economic models
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template, idx) => (
              <Card key={idx} className="glass-card-child p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[--intel-gold]" />
                    <h3 className="font-semibold text-foreground">{template.name}</h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                    {template.targetTier}
                  </span>
                </div>

                <p className="text-sm text-[--intel-silver] mb-3">
                  {template.description}
                </p>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[--intel-silver]">Components:</span>
                    <span className="font-medium text-foreground">{template.components.length}</span>
                  </div>
                  <div className="text-xs text-[--intel-silver]">
                    <strong>Outcome:</strong> {template.expectedOutcome}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {template.components.slice(0, 4).map((comp: string, i: number) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded bg-white/5 text-[--intel-silver]">
                      {comp.split('_').slice(0, 2).join(' ')}...
                    </span>
                  ))}
                  {template.components.length > 4 && (
                    <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-[--intel-silver]">
                      +{template.components.length - 4} more
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs">
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs">
                    <Activity className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t border-white/10 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button className="bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold]">
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Synergy Matrix Modal
interface SynergyMatrixModalProps {
  isOpen: boolean;
  components: any[];
  onClose: () => void;
  onCreateSynergy: (data: any) => void;
}

function SynergyMatrixModal({ isOpen, components, onClose, onCreateSynergy }: SynergyMatrixModalProps) {
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(null);

  const getSynergyType = (primary: any, secondary: any) => {
    if (primary.synergies?.includes(secondary.type)) return 'strong';
    if (secondary.synergies?.includes(primary.type)) return 'moderate';
    if (primary.conflicts?.includes(secondary.type) || secondary.conflicts?.includes(primary.type)) return 'conflict';

    // Check cross-domain synergies (economic <-> government)
    if (primary.governmentSynergies?.includes(secondary.type) || secondary.governmentSynergies?.includes(primary.type)) return 'cross-synergy';

    return 'none';
  };

  const getSynergyColor = (type: string) => {
    switch (type) {
      case 'strong': return 'bg-green-500/30 hover:bg-green-500/50';
      case 'moderate': return 'bg-yellow-500/30 hover:bg-yellow-500/50';
      case 'cross-synergy': return 'bg-blue-500/30 hover:bg-blue-500/50';
      case 'conflict': return 'bg-red-500/30 hover:bg-red-500/50';
      default: return 'bg-white/5 hover:bg-white/10';
    }
  };

  // Limit display to first 20 components for performance
  const displayComponents = components.slice(0, 20);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Synergy Matrix</DialogTitle>
          <DialogDescription>
            Visualize and manage synergy relationships between economic components
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${displayComponents.length}, 1fr)` }}>
            {/* Header Row */}
            <div className="sticky top-0 left-0 z-20 bg-background" />
            {displayComponents.map(comp => (
              <div
                key={comp.id}
                className="sticky top-0 z-10 bg-background text-xs font-medium text-center p-2 border border-white/10"
              >
                <div className="transform -rotate-45 origin-center whitespace-nowrap">
                  {comp.name.substring(0, 15)}
                </div>
              </div>
            ))}

            {/* Matrix Rows */}
            {displayComponents.map(primary => (
              <>
                <div className="sticky left-0 z-10 bg-background text-xs font-medium p-2 border border-white/10">
                  {primary.name}
                </div>
                {displayComponents.map(secondary => {
                  const synergyType = getSynergyType(primary, secondary);
                  const isSelected = selectedPrimary === primary.id && selectedSecondary === secondary.id;

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
                      className={`p-2 border border-white/10 transition-all ${
                        primary.id === secondary.id
                          ? 'bg-white/5 cursor-not-allowed'
                          : `${getSynergyColor(synergyType)} cursor-pointer ${
                              isSelected ? 'ring-2 ring-[--intel-gold]' : ''
                            }`
                      }`}
                      title={primary.id === secondary.id ? 'Same component' : `${primary.name} ” ${secondary.name}`}
                    />
                  );
                })}
              </>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10 flex-wrap">
            <span className="text-sm font-medium">Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/50" />
              <span className="text-xs">Strong Synergy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500/50" />
              <span className="text-xs">Moderate Synergy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500/50" />
              <span className="text-xs">Cross-Domain Synergy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500/50" />
              <span className="text-xs">Conflict</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-white/10" />
              <span className="text-xs">No Relationship</span>
            </div>
          </div>

          {selectedPrimary && selectedSecondary && (
            <div className="mt-4 p-4 rounded-lg bg-[--intel-gold]/10 border border-[--intel-gold]/20">
              <p className="text-sm font-medium mb-2">Selected Relationship:</p>
              <p className="text-xs text-[--intel-silver]">
                {components.find(c => c.id === selectedPrimary)?.name} ”{' '}
                {components.find(c => c.id === selectedSecondary)?.name}
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  const primary = components.find(c => c.id === selectedPrimary);
                  const secondary = components.find(c => c.id === selectedSecondary);
                  onCreateSynergy({
                    component1: primary?.type,
                    component2: secondary?.type,
                    synergyType: 'STRONG',
                    bonusPercent: 15
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
