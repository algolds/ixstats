// src/app/admin/_components/DMControlPanel.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Plus,
  Trash2,
  Edit3,
  Globe,
  Zap,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Target,
  Activity,
  Save,
  XCircle,
  Users,
  Calculator,
  BarChart3,
  DollarSign,
  GitBranch,
  ArrowRight,
  ArrowDown,
  Settings,
  Layers,
  Microscope,
  Telescope,
  Factory,
  Building,
  Wheat,
  Cpu,
  Truck,
  Home,
  School,
  Hospital,
  Shield,
  Sword,
  Scale,
  TreePine,
  Waves,
  Zap as Lightning,
  RefreshCw,
  Eye,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Download,
  Filter,
  Search,
  Gamepad2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { formatDistanceToNow } from "date-fns";

// Comprehensive DM Input Categories
const MACRO_ECONOMIC_INPUTS = [
  {
    value: "global_growth_shock",
    label: "Global Growth Shock",
    icon: Globe,
    color: "red",
    scale: "macro",
    category: "global",
  },
  {
    value: "trade_war",
    label: "Trade War",
    icon: Sword,
    color: "red",
    scale: "macro",
    category: "trade",
  },
  {
    value: "currency_crisis",
    label: "Currency Crisis",
    icon: AlertTriangle,
    color: "orange",
    scale: "macro",
    category: "monetary",
  },
  {
    value: "oil_price_shock",
    label: "Oil Price Shock",
    icon: Lightning,
    color: "yellow",
    scale: "macro",
    category: "commodities",
  },
  {
    value: "global_recession",
    label: "Global Recession",
    icon: TrendingDown,
    color: "red",
    scale: "macro",
    category: "cycle",
  },
  {
    value: "tech_revolution",
    label: "Technology Revolution",
    icon: Cpu,
    color: "blue",
    scale: "macro",
    category: "innovation",
  },
] as const;

const MICRO_ECONOMIC_INPUTS = [
  {
    value: "local_business_boom",
    label: "Local Business Boom",
    icon: Building,
    color: "green",
    scale: "micro",
    category: "business",
  },
  {
    value: "infrastructure_project",
    label: "Infrastructure Project",
    icon: Factory,
    color: "blue",
    scale: "micro",
    category: "infrastructure",
  },
  {
    value: "education_reform",
    label: "Education Reform",
    icon: School,
    color: "purple",
    scale: "micro",
    category: "human_capital",
  },
  {
    value: "healthcare_expansion",
    label: "Healthcare Expansion",
    icon: Hospital,
    color: "teal",
    scale: "micro",
    category: "social",
  },
  {
    value: "agricultural_innovation",
    label: "Agricultural Innovation",
    icon: Wheat,
    color: "green",
    scale: "micro",
    category: "agriculture",
  },
  {
    value: "housing_development",
    label: "Housing Development",
    icon: Home,
    color: "orange",
    scale: "micro",
    category: "real_estate",
  },
] as const;

const SECTORAL_INPUTS = [
  {
    value: "manufacturing_boost",
    label: "Manufacturing Boost",
    icon: Factory,
    color: "gray",
    scale: "sectoral",
    category: "manufacturing",
  },
  {
    value: "service_expansion",
    label: "Service Sector Expansion",
    icon: Building,
    color: "blue",
    scale: "sectoral",
    category: "services",
  },
  {
    value: "agricultural_subsidies",
    label: "Agricultural Subsidies",
    icon: Wheat,
    color: "green",
    scale: "sectoral",
    category: "agriculture",
  },
  {
    value: "tech_sector_growth",
    label: "Tech Sector Growth",
    icon: Cpu,
    color: "purple",
    scale: "sectoral",
    category: "technology",
  },
  {
    value: "logistics_improvement",
    label: "Logistics Improvement",
    icon: Truck,
    color: "orange",
    scale: "sectoral",
    category: "logistics",
  },
  {
    value: "financial_sector_reform",
    label: "Financial Sector Reform",
    icon: DollarSign,
    color: "yellow",
    scale: "sectoral",
    category: "finance",
  },
] as const;

const CRISIS_EVENTS = [
  {
    value: "natural_disaster",
    label: "Natural Disaster",
    icon: Waves,
    color: "red",
    scale: "crisis",
    category: "natural",
  },
  {
    value: "political_instability",
    label: "Political Instability",
    icon: Scale,
    color: "red",
    scale: "crisis",
    category: "political",
  },
  {
    value: "cyber_attack",
    label: "Cyber Attack",
    icon: Shield,
    color: "red",
    scale: "crisis",
    category: "security",
  },
  {
    value: "pandemic",
    label: "Pandemic",
    icon: Hospital,
    color: "red",
    scale: "crisis",
    category: "health",
  },
  {
    value: "environmental_disaster",
    label: "Environmental Disaster",
    icon: TreePine,
    color: "red",
    scale: "crisis",
    category: "environmental",
  },
  {
    value: "financial_crisis",
    label: "Financial Crisis",
    icon: TrendingDown,
    color: "red",
    scale: "crisis",
    category: "financial",
  },
] as const;

const ALL_DM_INPUTS = [
  ...MACRO_ECONOMIC_INPUTS,
  ...MICRO_ECONOMIC_INPUTS,
  ...SECTORAL_INPUTS,
  ...CRISIS_EVENTS,
];

type DmInputType = (typeof ALL_DM_INPUTS)[number]["value"];
type InputScale = "macro" | "micro" | "sectoral" | "crisis";
type InputCategory =
  | "global"
  | "trade"
  | "monetary"
  | "commodities"
  | "cycle"
  | "innovation"
  | "business"
  | "infrastructure"
  | "human_capital"
  | "social"
  | "agriculture"
  | "real_estate"
  | "manufacturing"
  | "services"
  | "technology"
  | "logistics"
  | "finance"
  | "natural"
  | "political"
  | "security"
  | "health"
  | "environmental"
  | "financial";

interface DmInput {
  id: string;
  countryId: string | null;
  ixTimeTimestamp: Date;
  inputType: string;
  value: number;
  description: string | null;
  duration: number | null;
  isActive: boolean;
  createdBy: string | null;
  scale: InputScale;
  category: InputCategory;
  country?: {
    id: string;
    name: string;
  };
}

interface DmInputFormData {
  countryId?: string;
  inputType: DmInputType;
  value: number;
  description: string;
  duration?: number;
  scale: InputScale;
  category: InputCategory;
  cascadeEffects: boolean;
  delayedImplementation: number;
  confidenceLevel: number;
}

interface EconomicFlowNode {
  id: string;
  label: string;
  value: number;
  change: number;
  level: number;
  type: "input" | "calculation" | "output" | "effect";
  category: string;
  color: string;
  children: string[];
  formula?: string;
}

interface EconomicImpactPreview {
  countryName: string;
  currentGDP: number;
  projectedGDP: number;
  impactPercentage: number;
  affectedSectors: string[];
  flowChart: EconomicFlowNode[];
  cascadeEffects: {
    directEffects: { sector: string; impact: number; confidence: number }[];
    indirectEffects: { sector: string; impact: number; confidence: number; delay: number }[];
    rippleEffects: { sector: string; impact: number; confidence: number; delay: number }[];
  };
  timeline: {
    immediate: { effects: string[]; magnitude: number };
    shortTerm: { effects: string[]; magnitude: number; timeframe: string };
    mediumTerm: { effects: string[]; magnitude: number; timeframe: string };
    longTerm: { effects: string[]; magnitude: number; timeframe: string };
  };
}

export function DMControlPanel() {
  const [selectedScope, setSelectedScope] = useState<string>("global");
  const [selectedScale, setSelectedScale] = useState<InputScale>("macro");
  const [selectedCategory, setSelectedCategory] = useState<InputCategory | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [showFlowChart, setShowFlowChart] = useState(false);
  const [editingInput, setEditingInput] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"controls" | "preview" | "flowchart" | "timeline">(
    "controls"
  );
  const [formData, setFormData] = useState<DmInputFormData>({
    inputType: "global_growth_shock",
    value: 0,
    description: "",
    scale: "macro",
    category: "global",
    cascadeEffects: true,
    delayedImplementation: 0,
    confidenceLevel: 85,
  });
  const [impactPreview, setImpactPreview] = useState<EconomicImpactPreview | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [simulationRunning, setSimulationRunning] = useState(false);

  // Queries
  const { data: countriesData, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const {
    data: dmInputs,
    refetch: refetchDmInputs,
    isLoading: inputsLoading,
  } = api.countries.getDmInputs.useQuery({
    countryId: selectedScope === "global" ? undefined : selectedScope,
  });

  // Mutations
  const addDmInputMutation = api.countries.addDmInput.useMutation({
    onSuccess: () => {
      void refetchDmInputs();
      setShowForm(false);
      setFormData({
        inputType: "natural_disaster",
        value: 0,
        description: "",
        scale: "macro",
        category: "natural",
        cascadeEffects: true,
        delayedImplementation: 0,
        confidenceLevel: 85,
      });
    },
  });

  const updateDmInputMutation = api.countries.updateDmInput.useMutation({
    onSuccess: () => {
      void refetchDmInputs();
      setEditingInput(null);
      setShowForm(false);
    },
  });

  const deleteDmInputMutation = api.countries.deleteDmInput.useMutation({
    onSuccess: () => {
      void refetchDmInputs();
    },
  });

  // Calculate economic impact preview
  useEffect(() => {
    if (formData.value !== 0 && (selectedScope !== "global" || formData.countryId)) {
      const targetCountry = countriesData?.countries.find(
        (c) => c.id === (formData.countryId || selectedScope)
      );

      if (targetCountry) {
        // Mock impact calculation
        const currentGDP = targetCountry.currentGdpPerCapita * targetCountry.currentPopulation;
        let impactMultiplier = 1;

        switch (formData.inputType) {
          case "global_growth_shock":
          case "global_recession":
            impactMultiplier = 1 + formData.value;
            break;
          case "tech_revolution":
          case "local_business_boom":
            impactMultiplier = 1 + formData.value * 0.1; // Estimate annual impact
            break;
          default:
            impactMultiplier = 1 + formData.value * 0.3;
        }

        const projectedGDP = currentGDP * impactMultiplier;
        const impactPercentage = ((projectedGDP - currentGDP) / currentGDP) * 100;

        setImpactPreview({
          countryName: targetCountry.name,
          currentGDP,
          projectedGDP,
          impactPercentage,
          affectedSectors: ["Economy", "Trade", "Government Revenue"],
          flowChart: [],
          cascadeEffects: {
            directEffects: [],
            indirectEffects: [],
            rippleEffects: [],
          },
          timeline: {
            immediate: { effects: [], magnitude: 0 },
            shortTerm: { effects: [], magnitude: 0, timeframe: "1-3 months" },
            mediumTerm: { effects: [], magnitude: 0, timeframe: "6-12 months" },
            longTerm: { effects: [], magnitude: 0, timeframe: "1+ years" },
          },
        });
      }
    } else {
      setImpactPreview(null);
    }
  }, [formData, selectedScope, countriesData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingInput) {
      updateDmInputMutation.mutate({
        id: editingInput,
        inputType: formData.inputType,
        value: formData.value,
        description: formData.description,
        duration: formData.duration,
      });
    } else {
      addDmInputMutation.mutate({
        countryId: selectedScope === "global" ? undefined : selectedScope,
        inputType: formData.inputType,
        value: formData.value,
        description: formData.description,
        duration: formData.duration,
      });
    }
  };

  const handleEdit = (input: DmInput) => {
    setEditingInput(input.id);
    setSelectedScope(input.countryId || "global");
    const inputConfig = ALL_DM_INPUTS.find((config) => config.value === input.inputType);
    setFormData({
      inputType: input.inputType as DmInputType,
      value: input.value,
      description: input.description || "",
      duration: input.duration || undefined,
      scale: inputConfig?.scale || "macro",
      category: inputConfig?.category || "global",
      cascadeEffects: false,
      delayedImplementation: 0,
      confidenceLevel: 85,
    });
    setShowForm(true);
  };

  const handleDelete = (inputId: string) => {
    if (confirm("Are you sure you want to delete this DM input?")) {
      deleteDmInputMutation.mutate({ id: inputId });
    }
  };

  const getInputTypeInfo = (type: string) => {
    return ALL_DM_INPUTS.find((t) => t.value === type) || ALL_DM_INPUTS[0];
  };

  const getValueColor = (value: number) => {
    if (value > 0) return "text-green-600 dark:text-green-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const formatValue = (value: number, type: string) => {
    if (type.includes("adjustment") || type.includes("modifier")) {
      return `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
    }
    return value.toFixed(4);
  };

  // Quick preset actions
  const quickPresets = [
    {
      title: "Economic Crisis",
      description: "Apply -15% GDP adjustment globally",
      action: () => ({
        inputType: "global_recession" as DmInputType,
        value: -0.15,
        description: "Global economic crisis affecting all nations",
        duration: 2,
        scale: "macro" as const,
        category: "global" as const,
        cascadeEffects: true,
        delayedImplementation: 0,
        confidenceLevel: 95,
      }),
      color: "red",
      icon: TrendingDown,
    },
    {
      title: "Trade Boom",
      description: "Apply +10% GDP adjustment globally",
      action: () => ({
        inputType: "global_growth_shock" as DmInputType,
        value: 0.1,
        description: "Global trade expansion benefiting all economies",
        duration: 1,
        scale: "macro" as const,
        category: "global" as const,
        cascadeEffects: true,
        delayedImplementation: 0,
        confidenceLevel: 90,
      }),
      color: "green",
      icon: TrendingUp,
    },
    {
      title: "Tech Revolution",
      description: "Apply +25% growth rate modifier",
      action: () => ({
        inputType: "tech_revolution" as DmInputType,
        value: 0.25,
        description: "Major technological breakthrough increasing productivity",
        duration: 5,
        scale: "sectoral" as const,
        category: "technology" as const,
        cascadeEffects: true,
        delayedImplementation: 1,
        confidenceLevel: 80,
      }),
      color: "purple",
      icon: Zap,
    },
    {
      title: "Natural Disaster",
      description: "Apply -20% GDP with recovery",
      action: () => ({
        inputType: "natural_disaster" as DmInputType,
        value: -0.2,
        description: "Major natural disaster requiring reconstruction",
        duration: 3,
        scale: "crisis" as const,
        category: "natural" as const,
        cascadeEffects: true,
        delayedImplementation: 0,
        confidenceLevel: 85,
      }),
      color: "orange",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="glass-card-parent rounded-xl border-2 border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-purple-600/5 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3">
              <Gamepad2 className="h-8 w-8 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-foreground text-3xl font-bold">Advanced DM Control Center</h2>
              <p className="text-lg text-indigo-700/70 dark:text-indigo-300/70">
                Granular Economic Manipulation & Impact Analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
              <Activity className="h-4 w-4" />
              {dmInputs?.length || 0} Active Interventions
            </Badge>
            <Button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2">
              <Plus className="h-4 w-4" />
              Create Intervention
            </Button>
            <Button
              variant="outline"
              onClick={() => setSimulationRunning(!simulationRunning)}
              className={`flex items-center gap-2 ${simulationRunning ? "border-green-500/20 bg-green-500/10" : ""}`}
            >
              {simulationRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {simulationRunning ? "Pause" : "Run"} Simulation
            </Button>
          </div>
        </div>

        {/* Scale & Category Selection */}
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Layers className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-sm font-medium">Scale:</span>
            {["macro", "micro", "sectoral", "crisis"].map((scale) => (
              <Button
                key={scale}
                variant={selectedScale === scale ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedScale(scale as InputScale)}
                className="capitalize"
              >
                {scale === "macro" && <Telescope className="mr-1 h-3 w-3" />}
                {scale === "micro" && <Microscope className="mr-1 h-3 w-3" />}
                {scale === "sectoral" && <Layers className="mr-1 h-3 w-3" />}
                {scale === "crisis" && <AlertTriangle className="mr-1 h-3 w-3" />}
                {scale}
              </Button>
            ))}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          {[
            { value: "controls", label: "Controls", icon: Settings },
            { value: "preview", label: "Impact Preview", icon: Eye },
            { value: "flowchart", label: "Flow Chart", icon: GitBranch },
            { value: "timeline", label: "Timeline", icon: Clock },
          ].map((view) => (
            <Button
              key={view.value}
              variant={activeView === view.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView(view.value as any)}
              className="flex items-center gap-2"
            >
              <view.icon className="h-4 w-4" />
              {view.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Dynamic Content Based on Active View */}
      {activeView === "controls" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Input Categories by Scale */}
          <Card className="glass-card-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {selectedScale.charAt(0).toUpperCase() + selectedScale.slice(1)} Scale Interventions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="mb-4 flex items-center gap-2">
                  <Search className="text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search interventions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {ALL_DM_INPUTS.filter((input) => input.scale === selectedScale)
                    .filter((input) => input.label.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((input) => {
                      const Icon = input.icon;
                      return (
                        <Button
                          key={input.value}
                          variant="outline"
                          className="hover:border-primary/50 flex h-auto flex-col justify-start gap-2 p-4 text-left"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              inputType: input.value,
                              scale: input.scale,
                              category: input.category,
                            });
                            setShowForm(true);
                          }}
                        >
                          <div className="flex w-full items-center gap-2">
                            <Icon className={`h-4 w-4 text-${input.color}-500`} />
                            <span className="text-sm font-medium">{input.label}</span>
                          </div>
                          <span className="text-muted-foreground text-xs capitalize">
                            {input.category.replace("_", " ")}
                          </span>
                        </Button>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Interventions */}
          <Card className="glass-card-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Active Interventions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dmInputs && dmInputs.length > 0 ? (
                  dmInputs.slice(0, 5).map((input) => {
                    const typeInfo = ALL_DM_INPUTS.find((type) => type.value === input.inputType);
                    const Icon = typeInfo?.icon || Settings;
                    return (
                      <div
                        key={input.id}
                        className="bg-card/50 flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-4 w-4 text-${typeInfo?.color || "gray"}-500`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {typeInfo?.label || input.inputType}
                              </span>
                              <Badge
                                variant={input.isActive ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {input.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              {input.country?.name || "Global"} • {input.value > 0 ? "+" : ""}
                              {input.value}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm">
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <Activity className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>No active interventions</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === "flowchart" && (
        <Card className="glass-card-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Economic Impact Flow Chart
            </CardTitle>
            <div className="text-muted-foreground text-sm">
              Visualize how interventions cascade through the economic system
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Flow Chart Visualization */}
              <div className="from-muted/30 to-muted/10 border-muted-foreground/20 relative rounded-lg border-2 border-dashed bg-gradient-to-br p-8">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                  {/* Input Level */}
                  <div className="space-y-4">
                    <h4 className="text-primary text-center font-semibold">Input</h4>
                    <div className="space-y-3">
                      <div className="glass-card-child rounded-lg border-2 border-blue-500/20 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Globe className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Global Growth Shock</span>
                        </div>
                        <div className="text-muted-foreground text-xs">-2.5% GDP Impact</div>
                        <div className="text-xs text-blue-600">Confidence: 85%</div>
                      </div>
                    </div>
                  </div>

                  {/* Calculation Level */}
                  <div className="space-y-4">
                    <h4 className="text-center font-semibold text-orange-600">Calculations</h4>
                    <div className="space-y-3">
                      {[
                        {
                          label: "Trade Multiplier",
                          value: "×0.8",
                          formula: "tradeCoeff * globalShock",
                        },
                        {
                          label: "Sector Weights",
                          value: "Variable",
                          formula: "∑(sectorGDP × impact)",
                        },
                        {
                          label: "Time Decay",
                          value: "0.95^t",
                          formula: "baseImpact × decayRate^time",
                        },
                      ].map((calc, i) => (
                        <div
                          key={i}
                          className="glass-card-child rounded-lg border border-orange-500/20 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{calc.label}</span>
                            <span className="text-sm text-orange-600">{calc.value}</span>
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs">{calc.formula}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Output Level */}
                  <div className="space-y-4">
                    <h4 className="text-center font-semibold text-green-600">Effects</h4>
                    <div className="space-y-3">
                      {[
                        { sector: "Manufacturing", impact: -3.2, confidence: 90 },
                        { sector: "Services", impact: -1.8, confidence: 85 },
                        { sector: "Agriculture", impact: -0.5, confidence: 70 },
                        { sector: "Technology", impact: +0.3, confidence: 60 },
                      ].map((effect, i) => (
                        <div
                          key={i}
                          className="glass-card-child rounded-lg border border-green-500/20 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{effect.sector}</span>
                            <span
                              className={`text-sm font-bold ${effect.impact > 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {effect.impact > 0 ? "+" : ""}
                              {effect.impact}%
                            </span>
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Confidence: {effect.confidence}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Flow Arrows */}
                <div className="absolute top-1/2 left-1/3 -translate-y-1/2 transform">
                  <ArrowRight className="text-muted-foreground h-6 w-6" />
                </div>
                <div className="absolute top-1/2 right-1/3 -translate-y-1/2 transform">
                  <ArrowRight className="text-muted-foreground h-6 w-6" />
                </div>
              </div>

              {/* Real-time Impact Metrics */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Total GDP Impact", value: "-2.1%", color: "red" },
                  { label: "Employment Effect", value: "-180K jobs", color: "orange" },
                  { label: "Recovery Time", value: "18 months", color: "blue" },
                  { label: "Cascade Depth", value: "4 levels", color: "purple" },
                ].map((metric, i) => (
                  <div key={i} className="glass-card-child rounded-lg p-4 text-center">
                    <div className={`text-lg font-bold text-${metric.color}-600`}>
                      {metric.value}
                    </div>
                    <div className="text-muted-foreground text-sm">{metric.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === "timeline" && (
        <Card className="glass-card-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Impact Timeline Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                {
                  phase: "Immediate (0-1 months)",
                  color: "red",
                  effects: [
                    "Market shock absorption",
                    "Initial trade disruption",
                    "Currency volatility",
                  ],
                  magnitude: 100,
                },
                {
                  phase: "Short Term (1-6 months)",
                  color: "orange",
                  effects: [
                    "Supply chain adjustments",
                    "Employment impacts",
                    "Consumer behavior shifts",
                  ],
                  magnitude: 80,
                },
                {
                  phase: "Medium Term (6-18 months)",
                  color: "yellow",
                  effects: [
                    "Structural adaptations",
                    "Policy responses",
                    "Investment reallocation",
                  ],
                  magnitude: 60,
                },
                {
                  phase: "Long Term (18+ months)",
                  color: "green",
                  effects: ["New equilibrium", "Innovation responses", "Economic recovery"],
                  magnitude: 30,
                },
              ].map((phase, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-semibold text-${phase.color}-600`}>{phase.phase}</h4>
                    <Badge
                      variant="outline"
                      className={`text-${phase.color}-600 border-${phase.color}-500/20`}
                    >
                      {phase.magnitude}% intensity
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {phase.effects.map((effect, j) => (
                      <div
                        key={j}
                        className={`glass-card-child rounded-lg border p-3 border-${phase.color}-500/20`}
                      >
                        <span className="text-sm">{effect}</span>
                      </div>
                    ))}
                  </div>
                  {i < 3 && (
                    <div className="flex justify-center">
                      <ArrowDown className="text-muted-foreground h-5 w-5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <TabsTrigger value="active">Active Inputs</TabsTrigger>
          <TabsTrigger value="presets">Quick Presets</TabsTrigger>
          <TabsTrigger value="calculator">Impact Calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {/* Scope Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Target Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label htmlFor="scope">Select target for DM inputs:</Label>
                <Select value={selectedScope} onValueChange={setSelectedScope}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">🌍 Global Effects</SelectItem>
                    {countriesData?.countries.map((country) => (
                      <SelectItem key={country.id} value={country.id}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* DM Input Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingInput ? "Edit DM Input" : "Add New DM Input"}
                  {selectedScope !== "global" &&
                  countriesData?.countries.find((c) => c.id === selectedScope)
                    ? ` for ${countriesData.countries.find((c) => c.id === selectedScope)?.name}`
                    : " (Global)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="inputType">Input Type</Label>
                      <Select
                        value={formData.inputType}
                        onValueChange={(value) =>
                          setFormData({ ...formData, inputType: value as DmInputType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_DM_INPUTS.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <type.icon className={`h-4 w-4 text-${type.color}-500`} />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="value">Value</Label>
                      <Input
                        id="value"
                        type="number"
                        step="0.001"
                        value={formData.value}
                        onChange={(e) =>
                          setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="e.g., 0.05 for +5%, -0.1 for -10%"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="duration">Duration (Years)</Label>
                      <Input
                        id="duration"
                        type="number"
                        step="0.1"
                        value={formData.duration || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            duration: parseFloat(e.target.value) || undefined,
                          })
                        }
                        placeholder="Leave empty for permanent"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the effect (e.g., 'Trade war impacts', 'Natural disaster recovery')"
                      required
                    />
                  </div>

                  {/* Impact Preview */}
                  {impactPreview && (
                    <Alert>
                      <Calculator className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-medium">
                            Impact Preview for {impactPreview.countryName}:
                          </p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p>Current GDP: ${(impactPreview.currentGDP / 1e9).toFixed(2)}B</p>
                              <p>
                                Projected GDP: ${(impactPreview.projectedGDP / 1e9).toFixed(2)}B
                              </p>
                            </div>
                            <div>
                              <p
                                className={`font-medium ${getValueColor(impactPreview.impactPercentage / 100)}`}
                              >
                                Impact: {impactPreview.impactPercentage > 0 ? "+" : ""}
                                {impactPreview.impactPercentage.toFixed(2)}%
                              </p>
                              <p>Affected: {impactPreview.affectedSectors.join(", ")}</p>
                            </div>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setEditingInput(null);
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addDmInputMutation.isPending || updateDmInputMutation.isPending}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {editingInput ? "Update Input" : "Add Input"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Active DM Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>
                Active DM Inputs{" "}
                {selectedScope === "global"
                  ? "(Global)"
                  : `(${countriesData?.countries.find((c) => c.id === selectedScope)?.name || "..."})`}
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                {inputsLoading
                  ? "Loading inputs..."
                  : `${dmInputs?.length || 0} active inputs affecting economic calculations`}
              </p>
            </CardHeader>
            <CardContent>
              {inputsLoading ? (
                <div className="py-8 text-center">Loading inputs...</div>
              ) : dmInputs && dmInputs.length > 0 ? (
                <div className="space-y-3">
                  {dmInputs.map((input) => {
                    const typeInfo = getInputTypeInfo(input.inputType);
                    const Icon = typeInfo.icon;

                    return (
                      <div
                        key={input.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 text-${typeInfo.color}-500`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{typeInfo.label}</span>
                              <Badge variant={input.isActive ? "default" : "secondary"}>
                                {input.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">{input.description}</p>
                            <div className="text-muted-foreground flex items-center gap-4 text-xs">
                              <span>
                                Value:{" "}
                                <span className={`font-medium ${getValueColor(input.value)}`}>
                                  {formatValue(input.value, input.inputType)}
                                </span>
                              </span>
                              {input.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {input.duration} years
                                </span>
                              )}
                              <span>
                                Created: {IxTime.formatIxTime(input.ixTimeTimestamp.getTime())}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const inputConfig = ALL_DM_INPUTS.find(
                                (config) => config.value === input.inputType
                              );
                              const enrichedInput = {
                                ...input,
                                scale: inputConfig?.scale || ("macro" as InputScale),
                                category: inputConfig?.category || ("global" as InputCategory),
                              };
                              handleEdit(enrichedInput as any);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(input.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Database className="text-muted-foreground mx-auto h-12 w-12" />
                  <h3 className="mt-2 text-sm font-medium">No DM inputs</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {selectedScope === "global"
                      ? "No global economic modifiers are currently active."
                      : "No country-specific modifiers are currently active for the selected nation."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Action Presets</CardTitle>
              <p className="text-muted-foreground text-sm">
                Common scenario presets for rapid deployment
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {quickPresets.map((preset, index) => {
                  const Icon = preset.icon;
                  return (
                    <div
                      key={index}
                      onClick={() => {
                        setSelectedScope("global");
                        setFormData(preset.action());
                        setShowForm(true);
                        setEditingInput(null);
                      }}
                      className="hover:border-primary bg-card cursor-pointer rounded-lg border-2 border-dashed p-4 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-6 w-6 text-${preset.color}-500`} />
                        <div>
                          <h3 className="font-medium">{preset.title}</h3>
                          <p className="text-muted-foreground text-sm">{preset.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Impact Calculator</CardTitle>
              <p className="text-muted-foreground text-sm">
                Calculate the economic impact of DM inputs before applying them
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Calculator Input Section */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="calc-country">Target Country</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countriesData &&
                            Array.isArray(countriesData) &&
                            countriesData.map((country) => (
                              <SelectItem key={country.id} value={country.id}>
                                {country.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="calc-type">Input Type</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select input type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_DM_INPUTS.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="calc-value">Impact Value (%)</Label>
                      <Input
                        id="calc-value"
                        type="number"
                        step="0.1"
                        placeholder="e.g., 5.0 for +5%, -2.5 for -2.5%"
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="calc-duration">Duration (IxTime Days)</Label>
                      <Input
                        id="calc-duration"
                        type="number"
                        placeholder="Leave empty for permanent"
                        className="bg-background/50"
                      />
                    </div>
                  </div>

                  {/* Preview Results */}
                  <div className="space-y-3">
                    <div className="glass-card-child rounded-lg border border-indigo-500/20 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <Calculator className="h-4 w-4 text-indigo-500" />
                        Projected Impact Analysis
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current GDP:</span>
                          <span className="font-medium">$2.45T</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Projected GDP:</span>
                          <span className="font-medium text-green-600">$2.58T</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Net Change:</span>
                          <span className="font-medium text-green-600">+$125B (+5.1%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Per Capita:</span>
                          <span className="font-medium text-blue-600">+$1,250</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Economic Tier:</span>
                          <span className="font-medium text-indigo-600">Unchanged (Tier 2)</span>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card-child rounded-lg border border-amber-500/20 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Affected Sectors
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {["Manufacturing", "Services", "Agriculture", "Technology"].map(
                          (sector) => (
                            <Badge key={sector} variant="outline" className="text-xs">
                              {sector}
                            </Badge>
                          )
                        )}
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">
                        Estimated 3-6 month adjustment period for full economic integration
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 border-t pt-4">
                  <Button className="flex-1" size="sm">
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculate Impact
                  </Button>
                  <Button variant="outline" className="flex-1" size="sm">
                    <Save className="mr-2 h-4 w-4" />
                    Apply DM Input
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
