"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Calculator,
  TrendingUp,
  BarChart3,
  LineChart,
  Target,
  Zap,
  Settings,
  Eye,
  Pencil,
  Save,
  RotateCcw,
  HelpCircle,
  Activity,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Plus,
  Minus,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  ComposedChart,
  Area,
  AreaChart,
} from "recharts";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { formatCurrency, formatPercentage, formatPopulation } from "./utils";
import type {
  Country,
  EconomicYearData,
  DMInputs,
  EconomicModel,
  SectoralOutput,
  PolicyEffect,
} from "~/server/db/schema";

interface EconomicModelingEngineProps {
  country: Country & {
    economicYears: EconomicYearData[];
    dmInputs?: DMInputs | null;
    economicModel?: EconomicModel | null;
  };
  onModelUpdate?: (updatedModel: EconomicModel) => void;
}

interface ModelParameters {
  baseYear: number;
  projectionYears: number;
  gdpGrowthRate: number;
  inflationRate: number;
  unemploymentRate: number;
  interestRate: number;
  exchangeRate: number;
  populationGrowthRate: number;
  investmentRate: number;
  fiscalBalance: number;
  tradeBalance: number;
}

interface SectorData {
  year: number;
  agriculture: number;
  industry: number;
  services: number;
  government: number;
  totalGDP: number;
}

interface PolicyData {
  id: string;
  name: string;
  description: string;
  gdpEffectPercentage: number;
  inflationEffectPercentage: number;
  employmentEffectPercentage: number;
  yearImplemented: number;
  durationYears: number;
  economicModelId: string;
}

const initialSectorData: SectorData = {
  year: new Date().getFullYear(),
  agriculture: 0,
  industry: 0,
  services: 0,
  government: 0,
  totalGDP: 0,
};

const initialPolicyData: PolicyData = {
  id: "",
  name: "New Policy",
  description: "Details about the policy",
  gdpEffectPercentage: 0,
  inflationEffectPercentage: 0,
  employmentEffectPercentage: 0,
  yearImplemented: new Date().getFullYear(),
  durationYears: 1,
  economicModelId: "",
};

const parameterDefinitions = {
  baseYear: {
    description: "The starting year for the economic model and projections",
    min: 1900,
    max: 2100,
    step: 1,
    isPercentage: false,
  },
  projectionYears: {
    description: "Number of years into the future to forecast",
    min: 1,
    max: 50,
    step: 1,
    isPercentage: false,
  },
  gdpGrowthRate: {
    description: "Annual percentage change in Gross Domestic Product (GDP)",
    min: -20,
    max: 20,
    step: 0.1,
    isPercentage: true,
  },
  inflationRate: {
    description: "Annual percentage increase in the general price level",
    min: -10,
    max: 50,
    step: 0.1,
    isPercentage: true,
  },
  unemploymentRate: {
    description: "Percentage of the labor force that is jobless and looking for jobs",
    min: 0,
    max: 50,
    step: 0.1,
    isPercentage: true,
  },
  interestRate: {
    description: "The cost of borrowing money, set by the central bank or market forces",
    min: -5,
    max: 30,
    step: 0.05,
    isPercentage: true,
  },
  exchangeRate: {
    description: "Value of the national currency against a benchmark (e.g., USD)",
    min: 0,
    max: 1000,
    step: 0.01,
    isPercentage: false,
  },
  populationGrowthRate: {
    description: "Annual percentage change in population size",
    min: -5,
    max: 10,
    step: 0.01,
    isPercentage: true,
  },
  investmentRate: {
    description: "Percentage of GDP allocated to investment",
    min: 0,
    max: 50,
    step: 0.5,
    isPercentage: true,
  },
  fiscalBalance: {
    description: "Difference between government revenue and expenditure, as % of GDP",
    min: -20,
    max: 20,
    step: 0.1,
    isPercentage: true,
  },
  tradeBalance: {
    description: "Difference between exports and imports, as % of GDP",
    min: -20,
    max: 20,
    step: 0.1,
    isPercentage: true,
  },
};

export function EconomicModelingEngine({
  country,
  onModelUpdate,
}: EconomicModelingEngineProps) {
  const [view, setView] = useState<"parameters" | "sectors" | "policies" | "projections">("parameters");
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const utils = api.useUtils();

  // Model parameters state
  const [parameters, setParameters] = useState<ModelParameters>({
    baseYear: country.economicModel?.baseYear ?? new Date().getFullYear(),
    projectionYears: country.economicModel?.projectionYears ?? 5,
    gdpGrowthRate: country.economicModel?.gdpGrowthRate ?? 3.0,
    inflationRate: country.economicModel?.inflationRate ?? 2.0,
    unemploymentRate: country.economicModel?.unemploymentRate ?? 5.0,
    interestRate: country.economicModel?.interestRate ?? 3.0,
    exchangeRate: country.economicModel?.exchangeRate ?? 1.0,
    populationGrowthRate: country.economicModel?.populationGrowthRate ?? 1.0,
    investmentRate: country.economicModel?.investmentRate ?? 20.0,
    fiscalBalance: country.economicModel?.fiscalBalance ?? 0.0,
    tradeBalance: country.economicModel?.tradeBalance ?? 0.0,
  });

  const [sectoralOutputs, setSectoralOutputs] = useState<SectorData[]>(
    (country.economicModel?.sectoralOutputs as SectorData[]) ?? [
      { ...initialSectorData, year: parameters.baseYear },
    ],
  );

  const [policyEffects, setPolicyEffects] = useState<PolicyData[]>(
    (country.economicModel?.policyEffects as PolicyData[]) ?? [],
  );

  const updateEconomicModelMutation = api.countries.updateEconomicData.useMutation({
    onSuccess: (data) => {
      toast.success("Economic model updated successfully!");
      if (data.success && onModelUpdate) {
        void utils.countries.getByIdWithEconomicData.invalidate({ id: country.id });
      }
      setIsLoading(false);
    },
    onError: (error) => {
      toast.error(`Error updating model: ${error.message}`);
      setIsLoading(false);
    },
  });

  // Update parameters when country data changes
  useEffect(() => {
    if (country.economicModel) {
      setParameters({
        baseYear: country.economicModel.baseYear ?? new Date().getFullYear(),
        projectionYears: country.economicModel.projectionYears ?? 5,
        gdpGrowthRate: country.economicModel.gdpGrowthRate ?? 3.0,
        inflationRate: country.economicModel.inflationRate ?? 2.0,
        unemploymentRate: country.economicModel.unemploymentRate ?? 5.0,
        interestRate: country.economicModel.interestRate ?? 3.0,
        exchangeRate: country.economicModel.exchangeRate ?? 1.0,
        populationGrowthRate: country.economicModel.populationGrowthRate ?? 1.0,
        investmentRate: country.economicModel.investmentRate ?? 20.0,
        fiscalBalance: country.economicModel.fiscalBalance ?? 0.0,
        tradeBalance: country.economicModel.tradeBalance ?? 0.0,
      });
      setSectoralOutputs(
        (country.economicModel.sectoralOutputs as SectorData[]) ?? [
          { ...initialSectorData, year: parameters.baseYear },
        ],
      );
      setPolicyEffects(
        (country.economicModel.policyEffects as PolicyData[]) ?? [],
      );
    }
  }, [country.economicModel, parameters.baseYear]);

  // Parameter handlers
  const handleParameterChange = <K extends keyof ModelParameters>(
    field: K,
    value: number
  ) => {
    setParameters(prev => ({ ...prev, [field]: value }));
  };

  const handleSectoralOutputChange = (
    index: number,
    field: keyof SectorData,
    value: string | number,
  ) => {
    const updatedOutputs = [...sectoralOutputs];
    const numericValue = typeof value === "string" ? parseFloat(value) : value;
    
    if (!isNaN(numericValue) && updatedOutputs[index]) {
      (updatedOutputs[index] as any)[field] = numericValue;
      
      // Recalculate totalGDP for the changed sector
      if (field !== 'year' && field !== 'totalGDP') {
        updatedOutputs[index]!.totalGDP =
          (updatedOutputs[index]?.agriculture ?? 0) +
          (updatedOutputs[index]?.industry ?? 0) +
          (updatedOutputs[index]?.services ?? 0) +
          (updatedOutputs[index]?.government ?? 0);
      }
      
      setSectoralOutputs(updatedOutputs);
    }
  };

  const addSectoralOutputYear = () => {
    const lastYearOutput = sectoralOutputs[sectoralOutputs.length - 1];
    const nextYear = (lastYearOutput?.year ?? parameters.baseYear) + 1;
    setSectoralOutputs([
      ...sectoralOutputs,
      { ...initialSectorData, year: nextYear },
    ]);
  };

  const removeSectoralOutputYear = (index: number) => {
    if (sectoralOutputs.length > 1) {
      const updatedOutputs = sectoralOutputs.filter((_, i) => i !== index);
      setSectoralOutputs(updatedOutputs);
    } else {
      toast.error("Cannot remove the last sectoral output year.");
    }
  };

  const handlePolicyEffectChange = (
    index: number,
    field: keyof PolicyData,
    value: string | number,
  ) => {
    const updatedPolicies = [...policyEffects];
    if (field === "name" || field === "description") {
      (updatedPolicies[index] as any)[field] = value as string;
    } else {
      const numericValue = typeof value === "string" ? parseFloat(value) : value;
      if (!isNaN(numericValue)) {
        (updatedPolicies[index] as any)[field] = numericValue;
      }
    }
    setPolicyEffects(updatedPolicies);
  };

  const addPolicyEffect = () => {
    setPolicyEffects([
      ...policyEffects,
      {
        ...initialPolicyData,
        id: `temp-${Date.now()}`,
        economicModelId: country.economicModel?.id ?? "",
      },
    ]);
  };

  const removePolicyEffect = (index: number) => {
    const updatedPolicies = policyEffects.filter((_, i) => i !== index);
    setPolicyEffects(updatedPolicies);
  };

  // Reset to defaults
  const resetParameters = () => {
    setParameters({
      baseYear: new Date().getFullYear(),
      projectionYears: 5,
      gdpGrowthRate: 3.0,
      inflationRate: 2.0,
      unemploymentRate: 5.0,
      interestRate: 3.0,
      exchangeRate: 1.0,
      populationGrowthRate: 1.0,
      investmentRate: 20.0,
      fiscalBalance: 0.0,
      tradeBalance: 0.0,
    });
  };

  // Calculate projections
  const projectedData = useMemo(() => {
    const data = [];
    let currentGDP =
      sectoralOutputs.find((s) => s.year === parameters.baseYear)?.totalGDP ??
      country.economicData?.gdp ??
      1000;
    let currentPopulation = country.population ?? 1000000;

    for (let i = 0; i < parameters.projectionYears; i++) {
      const year = parameters.baseYear + i;
      let yearGdpGrowthRate = parameters.gdpGrowthRate;
      let yearInflationRate = parameters.inflationRate;
      let yearUnemploymentRate = parameters.unemploymentRate;

      // Apply policy effects
      policyEffects.forEach((policy) => {
        if (
          year >= policy.yearImplemented &&
          year < policy.yearImplemented + (policy.durationYears ?? 0)
        ) {
          yearGdpGrowthRate += policy.gdpEffectPercentage ?? 0;
          yearInflationRate += policy.inflationEffectPercentage ?? 0;
          yearUnemploymentRate -= policy.employmentEffectPercentage ?? 0;
        }
      });

      currentGDP *= 1 + yearGdpGrowthRate / 100;
      currentPopulation *= 1 + parameters.populationGrowthRate / 100;

      data.push({
        year: year.toString(),
        gdp: parseFloat(currentGDP.toFixed(2)),
        gdpPerCapita: parseFloat((currentGDP / currentPopulation).toFixed(2)),
        inflation: parseFloat(yearInflationRate.toFixed(2)),
        unemployment: parseFloat(Math.max(0, yearUnemploymentRate).toFixed(2)),
        population: Math.round(currentPopulation),
      });
    }
    return data;
  }, [
    parameters,
    sectoralOutputs,
    policyEffects,
    country.economicData?.gdp,
    country.population,
  ]);

  const handleSaveModel = () => {
    setIsLoading(true);
    const population = country.population ?? 0;
    const totalGDP = sectoralOutputs[0]?.totalGDP ?? 0;
    
    const modelData = {
      countryId: country.id,
      economicData: {
        nominalGDP: totalGDP,
        realGDPGrowthRate: parameters.gdpGrowthRate,
        inflationRate: parameters.inflationRate,
        currencyExchangeRate: parameters.exchangeRate,
        unemploymentRate: parameters.unemploymentRate,
        interestRates: parameters.interestRate,
        populationGrowthRate: parameters.populationGrowthRate,
        taxRevenueGDPPercent: parameters.fiscalBalance,
        tradeBalance: parameters.tradeBalance,
        // Add other required fields with default values
        laborForceParticipationRate: 65,
        employmentRate: 95,
        totalWorkforce: Math.round(population * 0.65),
        averageWorkweekHours: 40,
        minimumWage: 12,
        averageAnnualIncome: 35000,
        governmentBudgetGDPPercent: parameters.fiscalBalance + 2,
        budgetDeficitSurplus: 0,
        internalDebtGDPPercent: 45,
        externalDebtGDPPercent: 25,
        totalDebtGDPRatio: 70,
        debtPerCapita: (totalGDP * 0.7) / (population || 1),
        debtServiceCosts: totalGDP * 0.7 * 0.035,
        povertyRate: 15,
        incomeInequalityGini: 0.38,
        socialMobilityIndex: 60,
        totalGovernmentSpending: totalGDP * (parameters.fiscalBalance + 2) / 100,
        spendingGDPPercent: parameters.fiscalBalance + 2,
        spendingPerCapita: (totalGDP * (parameters.fiscalBalance + 2) / 100) / (population || 1),
        lifeExpectancy: 75,
        urbanPopulationPercent: 60,
        ruralPopulationPercent: 40,
        literacyRate: 90
      }
    };
    
    updateEconomicModelMutation.mutate(modelData);
  };

  const runSimulation = () => {
    setIsSimulating(true);
    // Simulate for a moment to show loading state
    setTimeout(() => {
      setIsSimulating(false);
      toast.success("Economic simulation completed!");
    }, 2000);
  };

  const getModelHealth = () => {
    let score = 70;
    
    // Growth rate assessment
    if (parameters.gdpGrowthRate >= 2 && parameters.gdpGrowthRate <= 5) score += 10;
    else if (parameters.gdpGrowthRate < 0) score -= 15;
    
    // Inflation assessment
    if (parameters.inflationRate >= 1 && parameters.inflationRate <= 3) score += 10;
    else if (parameters.inflationRate > 8) score -= 15;
    
    // Unemployment assessment
    if (parameters.unemploymentRate <= 5) score += 10;
    else if (parameters.unemploymentRate > 15) score -= 15;
    
    // Fiscal balance assessment
    if (Math.abs(parameters.fiscalBalance) <= 3) score += 5;
    else if (Math.abs(parameters.fiscalBalance) > 10) score -= 10;
    
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    
    return {
      score: finalScore,
      label: finalScore >= 85 ? "Excellent" : finalScore >= 70 ? "Good" : 
             finalScore >= 55 ? "Fair" : "Needs Attention",
      color: finalScore >= 85 ? "text-green-600" : finalScore >= 70 ? "text-blue-600" : 
             finalScore >= 55 ? "text-yellow-600" : "text-red-600"
    };
  };

  const modelHealth = getModelHealth();

  const renderParameterInput = (
    label: string,
    field: keyof ModelParameters,
    value: number,
  ) => {
    const def = parameterDefinitions[field];
    
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{label}</Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{def.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium">
            {value.toFixed(def.step < 1 ? 1 : 0)}{def.isPercentage ? "%" : ""}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            type="number"
            value={value}
            onChange={(e) => handleParameterChange(field, parseFloat(e.target.value) || 0)}
            step={def.step}
            min={def.min}
            max={def.max}
            className="md:col-span-1"
          />
          
          <div className="md:col-span-2 flex items-center gap-2">
            <Slider
              value={[value]}
              onValueChange={(val) => handleParameterChange(field, val[0] ?? 0)}
              max={def.max}
              min={def.min}
              step={def.step}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Economic Modeling Engine
            </h3>
            <p className="text-sm text-muted-foreground">
              Build and simulate economic scenarios for {country.name}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <Eye className="h-4 w-4 mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
              {editMode ? "View" : "Edit"}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={resetParameters}
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={runSimulation}
              disabled={isSimulating}
            >
              {isSimulating ? (
                <PauseCircle className="h-4 w-4 mr-1" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-1" />
              )}
              {isSimulating ? "Simulating..." : "Run Simulation"}
            </Button>
          </div>
        </div>

        {/* Model Health Status */}
        <Alert className={`border-l-4 ${
          modelHealth.color === 'text-green-600' ? 'border-l-green-500' : 
          modelHealth.color === 'text-blue-600' ? 'border-l-blue-500' :
          modelHealth.color === 'text-yellow-600' ? 'border-l-yellow-500' : 'border-l-red-500'
        }`}>
          <Activity className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Model Health: <span className={`font-semibold ${modelHealth.color}`}>{modelHealth.label}</span>
              <span className="ml-4">Score: {modelHealth.score}/100</span>
            </span>
            <Badge variant={
              modelHealth.score >= 85 ? "default" : 
              modelHealth.score >= 70 ? "secondary" : "destructive"
            }>
              {projectedData.length} Year Forecast
            </Badge>
          </AlertDescription>
        </Alert>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(parameters.gdpGrowthRate)}
                </div>
                <div className="text-xs text-muted-foreground">GDP Growth</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPercentage(parameters.inflationRate)}
                </div>
                <div className="text-xs text-muted-foreground">Inflation</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-orange-600">
                  {formatPercentage(parameters.unemploymentRate)}
                </div>
                <div className="text-xs text-muted-foreground">Unemployment</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-purple-600">
                  {parameters.projectionYears}
                </div>
                <div className="text-xs text-muted-foreground">Years Forecast</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="sectors">Sectors</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="projections">Projections</TabsTrigger>
          </TabsList>

          <TabsContent value="parameters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Core Economic Parameters
                </CardTitle>
                <CardDescription>
                  Set the fundamental economic variables for your model
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {renderParameterInput("Base Year", "baseYear", parameters.baseYear)}
                  {renderParameterInput("Projection Years", "projectionYears", parameters.projectionYears)}
                  {renderParameterInput("GDP Growth Rate (%)", "gdpGrowthRate", parameters.gdpGrowthRate)}
                  {renderParameterInput("Inflation Rate (%)", "inflationRate", parameters.inflationRate)}
                  {renderParameterInput("Unemployment Rate (%)", "unemploymentRate", parameters.unemploymentRate)}
                  {renderParameterInput("Interest Rate (%)", "interestRate", parameters.interestRate)}
                  {renderParameterInput("Exchange Rate (to USD)", "exchangeRate", parameters.exchangeRate)}
                  {renderParameterInput("Population Growth Rate (%)", "populationGrowthRate", parameters.populationGrowthRate)}
                  {renderParameterInput("Investment Rate (% of GDP)", "investmentRate", parameters.investmentRate)}
                  {renderParameterInput("Fiscal Balance (% of GDP)", "fiscalBalance", parameters.fiscalBalance)}
                  {renderParameterInput("Trade Balance (% of GDP)", "tradeBalance", parameters.tradeBalance)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sectors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Sectoral GDP Components
                </CardTitle>
                <CardDescription>
                  Define economic output by sector for baseline years
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead>Agriculture</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Services</TableHead>
                        <TableHead>Government</TableHead>
                        <TableHead>Total GDP</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sectoralOutputs.map((output, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.year}
                              onChange={(e) =>
                                handleSectoralOutputChange(index, "year", e.target.value)
                              }
                              className="w-24"
                              disabled={!editMode}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.agriculture}
                              onChange={(e) =>
                                handleSectoralOutputChange(index, "agriculture", e.target.value)
                              }
                              disabled={!editMode}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.industry}
                              onChange={(e) =>
                                handleSectoralOutputChange(index, "industry", e.target.value)
                              }
                              disabled={!editMode}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.services}
                              onChange={(e) =>
                                handleSectoralOutputChange(index, "services", e.target.value)
                              }
                              disabled={!editMode}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.government}
                              onChange={(e) =>
                                handleSectoralOutputChange(index, "government", e.target.value)
                              }
                              disabled={!editMode}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(output.totalGDP)}
                          </TableCell>
                          <TableCell>
                            {editMode && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSectoralOutputYear(index)}
                                disabled={sectoralOutputs.length <= 1}
                              >
                                <Minus className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {editMode && (
                  <Button
                    onClick={addSectoralOutputYear}
                    variant="outline"
                    className="mt-4"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Year
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Policy Effects Simulation
                </CardTitle>
                <CardDescription>
                  Model the impact of economic policies and external events
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {policyEffects.map((policy, index) => (
                  <Card key={policy.id || index} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <Input
                        value={policy.name}
                        onChange={(e) =>
                          handlePolicyEffectChange(index, "name", e.target.value)
                        }
                        className="text-md font-semibold w-1/2"
                        disabled={!editMode}
                      />
                      {editMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePolicyEffect(index)}
                        >
                          <Minus className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Description</Label>
                        <Input
                          value={policy.description}
                          onChange={(e) =>
                            handlePolicyEffectChange(index, "description", e.target.value)
                          }
                          disabled={!editMode}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Year Implemented</Label>
                        <Input
                          type="number"
                          value={policy.yearImplemented}
                          onChange={(e) =>
                            handlePolicyEffectChange(index, "yearImplemented", e.target.value)
                          }
                          disabled={!editMode}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Duration (Years)</Label>
                        <Input
                          type="number"
                          value={policy.durationYears}
                          onChange={(e) =>
                            handlePolicyEffectChange(index, "durationYears", e.target.value)
                          }
                          disabled={!editMode}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">GDP Effect (%)</Label>
                        <Input
                          type="number"
                          value={policy.gdpEffectPercentage}
                          onChange={(e) =>
                            handlePolicyEffectChange(index, "gdpEffectPercentage", e.target.value)
                          }
                          step="0.1"
                          disabled={!editMode}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Inflation Effect (%)</Label>
                        <Input
                          type="number"
                          value={policy.inflationEffectPercentage}
                          onChange={(e) =>
                            handlePolicyEffectChange(index, "inflationEffectPercentage", e.target.value)
                          }
                          step="0.1"
                          disabled={!editMode}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Employment Effect (%)</Label>
                        <Input
                          type="number"
                          value={policy.employmentEffectPercentage}
                          onChange={(e) =>
                            handlePolicyEffectChange(index, "employmentEffectPercentage", e.target.value)
                          }
                          step="0.1"
                          disabled={!editMode}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
                
                {editMode && (
                  <Button onClick={addPolicyEffect} variant="outline">
                    <Plus className="mr-2 h-4 w-4" /> Add Policy Scenario
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Economic Projections
                </CardTitle>
                <CardDescription>
                  Forecasted economic indicators based on your model parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer>
                    <ComposedChart data={projectedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [
                          name === "gdp" ? formatCurrency(value) :
                          name === "gdpPerCapita" ? formatCurrency(value) :
                          name === "population" ? formatPopulation(value) :
                          formatPercentage(value),
                          name.charAt(0).toUpperCase() + name.slice(1),
                        ]}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="gdp" fill="#3b82f6" name="GDP (Total)" />
                      <Line yAxisId="right" type="monotone" dataKey="inflation" stroke="#f59e0b" name="Inflation %" />
                      <Line yAxisId="right" type="monotone" dataKey="unemployment" stroke="#ef4444" name="Unemployment %" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                
                <Separator className="my-6" />
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead>GDP (Total)</TableHead>
                        <TableHead>GDP per Capita</TableHead>
                        <TableHead>Inflation (%)</TableHead>
                        <TableHead>Unemployment (%)</TableHead>
                        <TableHead>Population</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectedData.map((data) => (
                        <TableRow key={data.year}>
                          <TableCell className="font-medium">{data.year}</TableCell>
                          <TableCell>{formatCurrency(data.gdp)}</TableCell>
                          <TableCell>{formatCurrency(data.gdpPerCapita)}</TableCell>
                          <TableCell>{formatPercentage(data.inflation)}</TableCell>
                          <TableCell>{formatPercentage(data.unemployment)}</TableCell>
                          <TableCell>{formatPopulation(data.population)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSaveModel}
            disabled={isLoading || updateEconomicModelMutation.isPending}
            size="lg"
          >
            {isLoading || updateEconomicModelMutation.isPending ? (
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Economic Model
          </Button>
        </div>

        {/* Model Summary */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Model Summary</div>
            <p className="text-sm mt-1">
              {parameters.projectionYears}-year economic model with {formatPercentage(parameters.gdpGrowthRate)} GDP growth, 
              {formatPercentage(parameters.inflationRate)} inflation, and {policyEffects.length} policy scenarios.
              Model health score: {modelHealth.score}/100 ({modelHealth.label}).
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}

export default EconomicModelingEngine;

