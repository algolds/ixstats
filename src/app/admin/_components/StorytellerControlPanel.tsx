// src/app/admin/_components/StorytellerControlPanel.tsx
"use client";

/**
 * STORYTELLER CONTROL PANEL
 *
 * Unified god-mode interface for complete narrative and economic control.
 * Merges DM Tools + SDI Admin + Direct Country Manipulation
 *
 * Features:
 * - Direct country data editing (all fields)
 * - Custom intervention/conflict creation
 * - Economic manipulation at all scales
 * - Crisis and event management
 * - Real-time impact simulation
 * - Comprehensive audit logging
 */

import { useState, useEffect, useMemo } from "react";
import {
  Wand2,
  Globe,
  Database,
  Zap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Factory,
  Shield,
  Sword,
  Building,
  Cpu,
  Wheat,
  Hospital,
  Settings,
  Eye,
  Play,
  Pause,
  Save,
  Trash2,
  Edit3,
  Plus,
  Search,
  Filter,
  BarChart3,
  Activity,
  Clock,
  Target,
  Layers,
  GitBranch,
  Calculator,
  FileText,
  Download,
  Upload,
  RefreshCw,
  XCircle,
  Check,
  Info,
  ArrowRight,
  Gamepad2,
  Crown,
  Sparkles,
  Flame,
  Snowflake,
  Wind,
  Droplets,
  Zap as Lightning,
  Microscope,
  Telescope,
  Scale,
  BookOpen,
  MessageSquare,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  History,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { formatDistanceToNow } from "date-fns";
import { cn } from "~/lib/utils";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type ControlMode = "interventions" | "god-mode" | "scenarios" | "analytics" | "history";
type InterventionScale = "macro" | "micro" | "sectoral" | "crisis" | "custom";
type InterventionCategory =
  | "economic"
  | "political"
  | "social"
  | "military"
  | "environmental"
  | "technological";

interface CountrySnapshot {
  id: string;
  name: string;
  population: number;
  gdpPerCapita: number;
  totalGDP: number;
  economicTier: string;
  growthRate: number;
  timestamp: Date;
}

interface Intervention {
  id: string;
  name: string;
  type: string;
  scale: InterventionScale;
  category: InterventionCategory;
  targetCountryId?: string;
  targetCountryName?: string;
  value: number;
  duration?: number;
  description: string;
  isActive: boolean;
  cascadeEffects: boolean;
  delayedStart: number;
  confidence: number;
  createdAt: Date;
  createdBy: string;
}

interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  interventions: Partial<Intervention>[];
  affectedCountries: string[];
  estimatedImpact: string;
}

interface AdminAction {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  changes: Record<string, any>;
  adminId: string;
  adminName: string;
  timestamp: Date;
  ipAddress?: string;
}

// ============================================================================
// SCENARIO TEMPLATES
// ============================================================================

const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "global-recession",
    name: "Global Economic Recession",
    description: "Worldwide economic downturn affecting all nations",
    icon: TrendingDown,
    color: "red",
    interventions: [
      {
        name: "Global GDP Shock",
        type: "global_recession",
        scale: "macro",
        category: "economic",
        value: -0.15,
        duration: 2,
        cascadeEffects: true,
        delayedStart: 0,
        confidence: 95,
      },
    ],
    affectedCountries: ["all"],
    estimatedImpact: "-10% to -20% GDP globally over 18-24 months",
  },
  {
    id: "tech-revolution",
    name: "Technological Revolution",
    description: "Major breakthrough in AI, automation, or energy",
    icon: Cpu,
    color: "blue",
    interventions: [
      {
        name: "Tech Sector Boom",
        type: "tech_revolution",
        scale: "sectoral",
        category: "technological",
        value: 0.3,
        duration: 5,
        cascadeEffects: true,
        delayedStart: 1,
        confidence: 75,
      },
    ],
    affectedCountries: ["selected"],
    estimatedImpact: "+15% to +35% productivity in tech-focused economies",
  },
  {
    id: "climate-crisis",
    name: "Climate Emergency",
    description: "Severe environmental disasters and climate impacts",
    icon: Flame,
    color: "orange",
    interventions: [
      {
        name: "Environmental Disaster",
        type: "climate_disaster",
        scale: "crisis",
        category: "environmental",
        value: -0.12,
        duration: 3,
        cascadeEffects: true,
        delayedStart: 0,
        confidence: 90,
      },
      {
        name: "Agricultural Collapse",
        type: "agricultural_crisis",
        scale: "sectoral",
        category: "environmental",
        value: -0.25,
        duration: 2,
        cascadeEffects: true,
        delayedStart: 0.5,
        confidence: 85,
      },
    ],
    affectedCountries: ["selected"],
    estimatedImpact: "-8% to -15% GDP, significant agricultural and infrastructure damage",
  },
  {
    id: "pandemic",
    name: "Global Pandemic",
    description: "Worldwide health crisis with economic fallout",
    icon: Hospital,
    color: "purple",
    interventions: [
      {
        name: "Healthcare Crisis",
        type: "pandemic",
        scale: "crisis",
        category: "social",
        value: -0.18,
        duration: 1.5,
        cascadeEffects: true,
        delayedStart: 0,
        confidence: 92,
      },
      {
        name: "Supply Chain Disruption",
        type: "logistics_crisis",
        scale: "sectoral",
        category: "economic",
        value: -0.1,
        duration: 2,
        cascadeEffects: true,
        delayedStart: 0.25,
        confidence: 88,
      },
    ],
    affectedCountries: ["all"],
    estimatedImpact: "-12% to -22% GDP during peak, 3-5 year recovery",
  },
  {
    id: "trade-war",
    name: "Major Trade War",
    description: "Escalating tariffs and trade restrictions between blocs",
    icon: Sword,
    color: "red",
    interventions: [
      {
        name: "Trade Restrictions",
        type: "trade_war",
        scale: "macro",
        category: "political",
        value: -0.08,
        duration: 3,
        cascadeEffects: true,
        delayedStart: 0,
        confidence: 80,
      },
      {
        name: "Manufacturing Impact",
        type: "manufacturing_decline",
        scale: "sectoral",
        category: "economic",
        value: -0.15,
        duration: 2,
        cascadeEffects: true,
        delayedStart: 0.5,
        confidence: 85,
      },
    ],
    affectedCountries: ["selected"],
    estimatedImpact: "-5% to -12% GDP in affected trading nations",
  },
  {
    id: "peace-dividend",
    name: "Peace & Prosperity Era",
    description: "Major conflicts resolved, trade flourishes",
    icon: Sparkles,
    color: "green",
    interventions: [
      {
        name: "Global Trade Boom",
        type: "trade_expansion",
        scale: "macro",
        category: "political",
        value: 0.12,
        duration: 5,
        cascadeEffects: true,
        delayedStart: 0.5,
        confidence: 78,
      },
      {
        name: "Investment Surge",
        type: "capital_inflow",
        scale: "sectoral",
        category: "economic",
        value: 0.18,
        duration: 3,
        cascadeEffects: true,
        delayedStart: 1,
        confidence: 82,
      },
    ],
    affectedCountries: ["all"],
    estimatedImpact: "+8% to +15% GDP growth over 3-5 years",
  },
];

// ============================================================================
// INTERVENTION TYPE DEFINITIONS
// ============================================================================

const INTERVENTION_TYPES = {
  macro: [
    { value: "global_growth_shock", label: "Global Growth Shock", icon: Globe, color: "blue" },
    { value: "global_recession", label: "Global Recession", icon: TrendingDown, color: "red" },
    { value: "trade_war", label: "Trade War", icon: Sword, color: "red" },
    { value: "trade_expansion", label: "Trade Expansion", icon: TrendingUp, color: "green" },
    { value: "currency_crisis", label: "Currency Crisis", icon: DollarSign, color: "orange" },
    { value: "commodity_shock", label: "Commodity Price Shock", icon: Lightning, color: "yellow" },
  ],
  micro: [
    { value: "local_business_boom", label: "Local Business Boom", icon: Building, color: "green" },
    {
      value: "infrastructure_project",
      label: "Infrastructure Project",
      icon: Factory,
      color: "blue",
    },
    { value: "education_reform", label: "Education Reform", icon: BookOpen, color: "purple" },
    { value: "healthcare_expansion", label: "Healthcare Expansion", icon: Hospital, color: "teal" },
    { value: "housing_development", label: "Housing Development", icon: Building, color: "orange" },
  ],
  sectoral: [
    { value: "manufacturing_boost", label: "Manufacturing Boost", icon: Factory, color: "gray" },
    { value: "service_expansion", label: "Service Sector Expansion", icon: Users, color: "blue" },
    {
      value: "agricultural_innovation",
      label: "Agricultural Innovation",
      icon: Wheat,
      color: "green",
    },
    { value: "tech_revolution", label: "Tech Revolution", icon: Cpu, color: "purple" },
    {
      value: "financial_reform",
      label: "Financial Sector Reform",
      icon: DollarSign,
      color: "yellow",
    },
  ],
  crisis: [
    { value: "natural_disaster", label: "Natural Disaster", icon: Wind, color: "red" },
    { value: "pandemic", label: "Pandemic", icon: Hospital, color: "purple" },
    { value: "political_crisis", label: "Political Instability", icon: Scale, color: "red" },
    { value: "cyber_attack", label: "Cyber Attack", icon: Shield, color: "red" },
    { value: "climate_disaster", label: "Climate Disaster", icon: Flame, color: "orange" },
    { value: "financial_crisis", label: "Financial Crisis", icon: TrendingDown, color: "red" },
  ],
  custom: [
    { value: "custom_intervention", label: "Custom Intervention", icon: Wand2, color: "purple" },
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StorytellerControlPanel() {
  // ========== STATE ==========
  const [mode, setMode] = useState<ControlMode>("interventions");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedScale, setSelectedScale] = useState<InterventionScale>("macro");
  const [searchTerm, setSearchTerm] = useState("");
  const [showInterventionDialog, setShowInterventionDialog] = useState(false);
  const [showGodModeDialog, setShowGodModeDialog] = useState(false);
  const [showScenarioDialog, setShowScenarioDialog] = useState(false);
  const [editingCountry, setEditingCountry] = useState<any>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);

  // Intervention form state
  const [interventionForm, setInterventionForm] = useState({
    name: "",
    type: "",
    scale: "macro" as InterventionScale,
    category: "economic" as InterventionCategory,
    targetCountryId: undefined as string | undefined,
    value: 0,
    duration: undefined as number | undefined,
    description: "",
    cascadeEffects: true,
    delayedStart: 0,
    confidence: 85,
  });

  // ========== QUERIES ==========
  const { data: countriesData, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const {
    data: interventionsData,
    isLoading: interventionsLoading,
    refetch: refetchInterventions,
  } = api.countries.getDmInputs.useQuery({
    countryId: selectedCountry || undefined,
  });
  const { data: auditLogData, isLoading: auditLogLoading } = api.admin.getAdminAuditLog.useQuery({
    limit: 50,
    offset: 0,
  });

  // ========== MUTATIONS ==========
  const createInterventionMutation = api.countries.addDmInput.useMutation({
    onSuccess: () => {
      refetchInterventions();
      setShowInterventionDialog(false);
      resetInterventionForm();
    },
  });

  const updateCountryMutation = api.admin.updateCountryData.useMutation({
    onSuccess: () => {
      setShowGodModeDialog(false);
      setEditingCountry(null);
    },
  });

  const deleteInterventionMutation = api.countries.deleteDmInput.useMutation({
    onSuccess: () => refetchInterventions(),
  });

  // ========== COMPUTED ==========
  const countries = countriesData?.countries || [];
  const interventions = interventionsData || [];
  const activeInterventions = interventions.filter((i: any) => i.isActive);

  const selectedCountryData = useMemo(() => {
    return countries.find((c) => c.id === selectedCountry);
  }, [countries, selectedCountry]);

  // ========== HANDLERS ==========
  const resetInterventionForm = () => {
    setInterventionForm({
      name: "",
      type: "",
      scale: "macro",
      category: "economic",
      targetCountryId: undefined,
      value: 0,
      duration: undefined,
      description: "",
      cascadeEffects: true,
      delayedStart: 0,
      confidence: 85,
    });
  };

  const handleCreateIntervention = () => {
    if (!interventionForm.type || interventionForm.value === 0) {
      alert("Please fill in all required fields");
      return;
    }

    createInterventionMutation.mutate({
      countryId: interventionForm.targetCountryId,
      inputType: interventionForm.type,
      value: interventionForm.value,
      description: interventionForm.description || interventionForm.name,
      duration: interventionForm.duration,
    });
  };

  const handleApplyScenario = (scenario: ScenarioTemplate) => {
    // Apply all interventions from the scenario
    scenario.interventions.forEach((intervention) => {
      if (intervention.type) {
        createInterventionMutation.mutate({
          countryId: scenario.affectedCountries.includes("all")
            ? undefined
            : selectedCountry || undefined,
          inputType: intervention.type,
          value: intervention.value || 0,
          description: intervention.description || scenario.description,
          duration: intervention.duration,
        });
      }
    });
    setShowScenarioDialog(false);
  };

  const handleDeleteIntervention = (id: string) => {
    if (confirm("Delete this intervention?")) {
      deleteInterventionMutation.mutate({ id });
    }
  };

  const handleGodModeEdit = (country: any) => {
    setEditingCountry({ ...country });
    setShowGodModeDialog(true);
  };

  const handleSaveGodModeChanges = () => {
    if (!editingCountry) return;

    // Call mutation to update country data with all fields
    updateCountryMutation.mutate({
      id: editingCountry.id,
      data: {
        // Economic data
        population: editingCountry.currentPopulation,
        gdpPerCapita: editingCountry.currentGdpPerCapita,
        totalGDP: editingCountry.currentTotalGdp,
        growthRate: editingCountry.adjustedGdpGrowth,
        populationGrowthRate: editingCountry.populationGrowthRate,
        economicTier: editingCountry.economicTier,
        populationTier: editingCountry.populationTier,

        // Geographic data
        landArea: editingCountry.landArea,
        continent: editingCountry.continent,
        region: editingCountry.region,

        // Identity data
        name: editingCountry.name,
        governmentType: editingCountry.governmentType,
        leader: editingCountry.leader,
        religion: editingCountry.religion,

        // Projections
        projected2040Population: editingCountry.projected2040Population,
        projected2040Gdp: editingCountry.projected2040Gdp,
        projected2040GdpPerCapita: editingCountry.projected2040GdpPerCapita,
      },
    });
  };

  // ========== RENDER ==========
  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-indigo-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-3">
                <Wand2 className="h-8 w-8 text-purple-400" />
              </div>
              <div>
                <CardTitle className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-3xl font-bold text-transparent">
                  Storyteller Control Panel
                </CardTitle>
                <CardDescription className="mt-1 text-lg">
                  Complete narrative and economic god-mode control
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5">
                <Activity className="h-4 w-4 text-purple-400" />
                <span>{activeInterventions.length} Active</span>
              </Badge>
              <Button
                variant={simulationRunning ? "destructive" : "default"}
                onClick={() => setSimulationRunning(!simulationRunning)}
                className="gap-2"
              >
                {simulationRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {simulationRunning ? "Pause" : "Run"} Simulation
              </Button>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="mt-6 flex items-center gap-2">
            {[
              { value: "interventions", label: "Interventions", icon: Zap },
              { value: "god-mode", label: "God Mode", icon: Crown },
              { value: "scenarios", label: "Scenarios", icon: Gamepad2 },
              { value: "analytics", label: "Analytics", icon: BarChart3 },
              { value: "history", label: "History", icon: History },
            ].map((m) => (
              <Button
                key={m.value}
                variant={mode === m.value ? "default" : "outline"}
                onClick={() => setMode(m.value as ControlMode)}
                className="gap-2"
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Area */}
      {mode === "interventions" && (
        <InterventionsPanel
          countries={countries}
          interventions={interventions}
          selectedCountry={selectedCountry}
          selectedScale={selectedScale}
          onCountryChange={setSelectedCountry}
          onScaleChange={setSelectedScale}
          onCreateNew={() => setShowInterventionDialog(true)}
          onDelete={handleDeleteIntervention}
        />
      )}

      {mode === "god-mode" && (
        <GodModePanel
          countries={countries}
          selectedCountry={selectedCountry}
          onCountryChange={setSelectedCountry}
          onEdit={handleGodModeEdit}
        />
      )}

      {mode === "scenarios" && (
        <ScenariosPanel scenarios={SCENARIO_TEMPLATES} onApply={handleApplyScenario} />
      )}

      {mode === "analytics" && (
        <AnalyticsPanel interventions={interventions} countries={countries} />
      )}

      {mode === "history" && (
        <HistoryPanel auditLog={auditLogData?.logs || []} isLoading={auditLogLoading} />
      )}

      {/* Create Intervention Dialog */}
      <Dialog open={showInterventionDialog} onOpenChange={setShowInterventionDialog}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-500" />
              Create New Intervention
            </DialogTitle>
            <DialogDescription>
              Define a custom economic or political intervention
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Intervention Name */}
            <div>
              <Label htmlFor="int-name">Intervention Name</Label>
              <Input
                id="int-name"
                placeholder="e.g., Tech Sector Investment Program"
                value={interventionForm.name}
                onChange={(e) => setInterventionForm({ ...interventionForm, name: e.target.value })}
              />
            </div>

            {/* Scale & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Scale</Label>
                <Select
                  value={interventionForm.scale}
                  onValueChange={(v) =>
                    setInterventionForm({ ...interventionForm, scale: v as InterventionScale })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="macro">Macro (Global/Regional)</SelectItem>
                    <SelectItem value="micro">Micro (Local)</SelectItem>
                    <SelectItem value="sectoral">Sectoral (Industry-Specific)</SelectItem>
                    <SelectItem value="crisis">Crisis Event</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category</Label>
                <Select
                  value={interventionForm.category}
                  onValueChange={(v) =>
                    setInterventionForm({
                      ...interventionForm,
                      category: v as InterventionCategory,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economic">Economic</SelectItem>
                    <SelectItem value="political">Political</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="military">Military</SelectItem>
                    <SelectItem value="environmental">Environmental</SelectItem>
                    <SelectItem value="technological">Technological</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Intervention Type */}
            <div>
              <Label>Intervention Type</Label>
              <Select
                value={interventionForm.type}
                onValueChange={(v) => setInterventionForm({ ...interventionForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {INTERVENTION_TYPES[interventionForm.scale].map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Country */}
            <div>
              <Label>Target Country (Optional - leave empty for global)</Label>
              <Select
                value={interventionForm.targetCountryId || "global"}
                onValueChange={(v) =>
                  setInterventionForm({
                    ...interventionForm,
                    targetCountryId: v === "global" ? undefined : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌍 Global Effect</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Impact Value (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={interventionForm.value}
                    onChange={(e) =>
                      setInterventionForm({
                        ...interventionForm,
                        value: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="text-muted-foreground text-sm whitespace-nowrap">
                    = {(interventionForm.value * 100).toFixed(2)}%
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Positive for growth, negative for decline
                </p>
              </div>

              <div>
                <Label>Duration (Years, optional)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Permanent"
                  value={interventionForm.duration || ""}
                  onChange={(e) =>
                    setInterventionForm({
                      ...interventionForm,
                      duration: parseFloat(e.target.value) || undefined,
                    })
                  }
                />
              </div>
            </div>

            {/* Advanced Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cascade Effects</Label>
                  <p className="text-muted-foreground text-xs">
                    Apply ripple effects to related sectors
                  </p>
                </div>
                <Switch
                  checked={interventionForm.cascadeEffects}
                  onCheckedChange={(v) =>
                    setInterventionForm({ ...interventionForm, cascadeEffects: v })
                  }
                />
              </div>

              <div>
                <Label>Delayed Start (Years)</Label>
                <Slider
                  value={[interventionForm.delayedStart]}
                  onValueChange={([v]) =>
                    setInterventionForm({ ...interventionForm, delayedStart: v })
                  }
                  max={5}
                  step={0.25}
                  className="my-2"
                />
                <p className="text-muted-foreground text-xs">
                  {interventionForm.delayedStart === 0
                    ? "Immediate effect"
                    : `${interventionForm.delayedStart} year delay`}
                </p>
              </div>

              <div>
                <Label>Confidence Level (%)</Label>
                <Slider
                  value={[interventionForm.confidence]}
                  onValueChange={([v]) =>
                    setInterventionForm({ ...interventionForm, confidence: v })
                  }
                  min={50}
                  max={100}
                  step={5}
                  className="my-2"
                />
                <p className="text-muted-foreground text-xs">
                  {interventionForm.confidence}% -{" "}
                  {interventionForm.confidence >= 90
                    ? "Very High"
                    : interventionForm.confidence >= 75
                      ? "High"
                      : "Medium"}
                </p>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the intervention and its expected effects..."
                value={interventionForm.description}
                onChange={(e) =>
                  setInterventionForm({ ...interventionForm, description: e.target.value })
                }
                rows={3}
              />
            </div>

            {/* Impact Preview */}
            {interventionForm.value !== 0 && (
              <Alert className="border-purple-500/20 bg-purple-500/5">
                <Calculator className="h-4 w-4 text-purple-500" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Estimated Impact:</p>
                    <p className="text-sm">
                      {interventionForm.value > 0 ? "+" : ""}
                      {(interventionForm.value * 100).toFixed(2)}%
                      {interventionForm.targetCountryId
                        ? ` to ${countries.find((c) => c.id === interventionForm.targetCountryId)?.name}`
                        : " globally"}
                    </p>
                    {interventionForm.duration && (
                      <p className="text-muted-foreground text-sm">
                        Over {interventionForm.duration} year
                        {interventionForm.duration > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterventionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateIntervention}
              disabled={createInterventionMutation.isPending}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Create Intervention
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* God Mode Edit Dialog */}
      <Dialog open={showGodModeDialog} onOpenChange={setShowGodModeDialog}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              God Mode Editor: {editingCountry?.name}
            </DialogTitle>
            <DialogDescription>
              Direct manipulation of all country data (use with caution)
            </DialogDescription>
          </DialogHeader>

          {editingCountry && (
            <div className="space-y-4 py-4">
              <Tabs defaultValue="economy" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="economy">Economy</TabsTrigger>
                  <TabsTrigger value="population">Population</TabsTrigger>
                  <TabsTrigger value="geography">Geography</TabsTrigger>
                  <TabsTrigger value="identity">Identity</TabsTrigger>
                </TabsList>

                <TabsContent value="economy" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Current GDP Per Capita ($)</Label>
                      <Input
                        type="number"
                        value={editingCountry.currentGdpPerCapita}
                        onChange={(e) =>
                          setEditingCountry({
                            ...editingCountry,
                            currentGdpPerCapita: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Total GDP ($)</Label>
                      <Input
                        type="number"
                        value={editingCountry.currentTotalGdp}
                        onChange={(e) =>
                          setEditingCountry({
                            ...editingCountry,
                            currentTotalGdp: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Growth Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingCountry.adjustedGdpGrowth}
                        onChange={(e) =>
                          setEditingCountry({
                            ...editingCountry,
                            adjustedGdpGrowth: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Economic Tier</Label>
                      <Select
                        value={editingCountry.economicTier}
                        onValueChange={(v) =>
                          setEditingCountry({ ...editingCountry, economicTier: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tier1">Tier 1 (Ultra Wealthy)</SelectItem>
                          <SelectItem value="tier2">Tier 2 (Developed)</SelectItem>
                          <SelectItem value="tier3">Tier 3 (Emerging)</SelectItem>
                          <SelectItem value="tier4">Tier 4 (Developing)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="population" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Current Population</Label>
                      <Input
                        type="number"
                        value={editingCountry.currentPopulation}
                        onChange={(e) =>
                          setEditingCountry({
                            ...editingCountry,
                            currentPopulation: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Population Growth Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={editingCountry.populationGrowthRate}
                        onChange={(e) =>
                          setEditingCountry({
                            ...editingCountry,
                            populationGrowthRate: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Population Density (per km²)</Label>
                      <Input
                        type="number"
                        value={editingCountry.populationDensity || 0}
                        onChange={(e) =>
                          setEditingCountry({
                            ...editingCountry,
                            populationDensity: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="geography" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Land Area (km²)</Label>
                      <Input
                        type="number"
                        value={editingCountry.landArea || 0}
                        onChange={(e) =>
                          setEditingCountry({
                            ...editingCountry,
                            landArea: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Continent</Label>
                      <Input
                        value={editingCountry.continent || ""}
                        onChange={(e) =>
                          setEditingCountry({ ...editingCountry, continent: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Region</Label>
                      <Input
                        value={editingCountry.region || ""}
                        onChange={(e) =>
                          setEditingCountry({ ...editingCountry, region: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="identity" className="mt-4 space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Country Name</Label>
                      <Input
                        value={editingCountry.name}
                        onChange={(e) =>
                          setEditingCountry({ ...editingCountry, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Government Type</Label>
                      <Input
                        value={editingCountry.governmentType || ""}
                        onChange={(e) =>
                          setEditingCountry({ ...editingCountry, governmentType: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Leader</Label>
                      <Input
                        value={editingCountry.leader || ""}
                        onChange={(e) =>
                          setEditingCountry({ ...editingCountry, leader: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Alert className="border-red-500/20 bg-red-500/5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-sm">
                  <strong>Warning:</strong> Changes are immediate and irreversible. All
                  modifications are logged for audit purposes.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGodModeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveGodModeChanges}
              disabled={updateCountryMutation.isPending}
              className="gap-2 bg-gradient-to-r from-yellow-500 to-orange-500"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// SUB-PANELS
// ============================================================================

interface InterventionsPanelProps {
  countries: any[];
  interventions: any[];
  selectedCountry: string | null;
  selectedScale: InterventionScale;
  onCountryChange: (id: string | null) => void;
  onScaleChange: (scale: InterventionScale) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
}

function InterventionsPanel({
  countries,
  interventions,
  selectedCountry,
  selectedScale,
  onCountryChange,
  onScaleChange,
  onCreateNew,
  onDelete,
}: InterventionsPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target Scope</Label>
            <Select
              value={selectedCountry || "global"}
              onValueChange={(v) => onCountryChange(v === "global" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">🌍 Global</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Scale</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["macro", "micro", "sectoral", "crisis"] as InterventionScale[]).map((scale) => (
                <Button
                  key={scale}
                  variant={selectedScale === scale ? "default" : "outline"}
                  size="sm"
                  onClick={() => onScaleChange(scale)}
                  className="capitalize"
                >
                  {scale}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={onCreateNew} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            New Intervention
          </Button>
        </CardContent>
      </Card>

      {/* Active Interventions List */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Active Interventions ({interventions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {interventions.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <Zap className="mx-auto mb-3 h-12 w-12 opacity-50" />
                  <p>No active interventions</p>
                </div>
              ) : (
                interventions.map((intervention: any) => (
                  <div
                    key={intervention.id}
                    className="bg-card/50 flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant={intervention.isActive ? "default" : "secondary"}>
                          {intervention.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="font-medium">{intervention.inputType}</span>
                      </div>
                      <p className="text-muted-foreground text-sm">{intervention.description}</p>
                      <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                        <span>
                          Value:{" "}
                          <span
                            className={intervention.value > 0 ? "text-green-600" : "text-red-600"}
                          >
                            {intervention.value > 0 ? "+" : ""}
                            {(intervention.value * 100).toFixed(2)}%
                          </span>
                        </span>
                        {intervention.duration && <span>Duration: {intervention.duration}y</span>}
                        <span>{intervention.country?.name || "Global"}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(intervention.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

interface GodModePanelProps {
  countries: any[];
  selectedCountry: string | null;
  onCountryChange: (id: string | null) => void;
  onEdit: (country: any) => void;
}

function GodModePanel({ countries, selectedCountry, onCountryChange, onEdit }: GodModePanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Direct Country Data Manipulation
          </CardTitle>
          <CardDescription>
            Edit all country fields directly with full god-mode access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search countries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <ScrollArea className="h-[700px]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCountries.map((country) => (
                  <Card
                    key={country.id}
                    className="hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{country.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Badge variant="outline">{country.economicTier}</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Population:</span>
                          <span className="font-medium">
                            {(country.currentPopulation / 1e6).toFixed(2)}M
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GDP/Capita:</span>
                          <span className="font-medium">
                            ${country.currentGdpPerCapita.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Growth:</span>
                          <span
                            className={`font-medium ${country.adjustedGdpGrowth > 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {(country.adjustedGdpGrowth * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => onEdit(country)}
                        className="mt-4 w-full gap-2"
                        variant="outline"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit All Data
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ScenariosPanelProps {
  scenarios: ScenarioTemplate[];
  onApply: (scenario: ScenarioTemplate) => void;
}

function ScenariosPanel({ scenarios, onApply }: ScenariosPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Scenario Templates
          </CardTitle>
          <CardDescription>
            Pre-configured narrative scenarios with multiple coordinated interventions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((scenario) => {
              const Icon = scenario.icon;
              return (
                <Card
                  key={scenario.id}
                  className="hover:border-primary cursor-pointer border-2 border-dashed transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-3 bg-${scenario.color}-500/10 border border-${scenario.color}-500/20`}
                      >
                        <Icon className={`h-6 w-6 text-${scenario.color}-500`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{scenario.name}</CardTitle>
                      </div>
                    </div>
                    <CardDescription className="mt-2">{scenario.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Interventions:</p>
                        <div className="flex flex-wrap gap-1">
                          {scenario.interventions.map((int, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {int.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Impact:</p>
                        <p className="text-xs">{scenario.estimatedImpact}</p>
                      </div>
                      <Button
                        onClick={() => onApply(scenario)}
                        className="w-full gap-2"
                        variant="default"
                      >
                        <Play className="h-4 w-4" />
                        Apply Scenario
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AnalyticsPanelProps {
  interventions: any[];
  countries: any[];
}

function AnalyticsPanel({ interventions, countries }: AnalyticsPanelProps) {
  const totalInterventions = interventions.length;
  const activeInterventions = interventions.filter((i: any) => i.isActive).length;
  const globalInterventions = interventions.filter((i: any) => !i.countryId).length;
  const countrySpecificInterventions = interventions.filter((i: any) => i.countryId).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total Interventions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalInterventions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">Active Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{activeInterventions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Global Effects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{globalInterventions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Country-Specific
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{countrySpecificInterventions}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-12 text-center">
            <BarChart3 className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p>Advanced analytics and visualizations coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface HistoryPanelProps {
  auditLog: any[];
  isLoading: boolean;
}

function HistoryPanel({ auditLog, isLoading }: HistoryPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Admin Action History
        </CardTitle>
        <CardDescription>
          Complete audit log of all god-mode and intervention actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground py-12 text-center">
            <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin" />
            <p>Loading audit history...</p>
          </div>
        ) : auditLog.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center">
            <History className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p>No audit history yet</p>
            <p className="mt-2 text-sm">All god-mode actions will be logged here</p>
          </div>
        ) : (
          <ScrollArea className="h-[700px]">
            <div className="space-y-3">
              {auditLog.map((log: any) => (
                <Card key={log.id} className="border-l-4 border-l-purple-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge
                            variant={log.action.includes("GOD_MODE") ? "default" : "secondary"}
                          >
                            {log.action}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm font-medium">
                          {log.targetType}: <span className="text-primary">{log.targetName}</span>
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          By {log.adminName} ({log.adminId})
                        </p>
                        {log.changes && Object.keys(log.changes).length > 0 && (
                          <div className="bg-muted/30 mt-2 rounded p-2 text-xs">
                            <p className="mb-1 font-medium">Changes:</p>
                            <div className="space-y-1">
                              {Object.entries(log.changes)
                                .slice(0, 5)
                                .map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{key}:</span>
                                    <span className="font-mono">
                                      {JSON.stringify(value).slice(0, 50)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {log.ipAddress && (
                        <div className="text-muted-foreground text-xs">IP: {log.ipAddress}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
