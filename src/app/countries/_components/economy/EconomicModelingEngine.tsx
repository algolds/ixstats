"use client";
import React, { useState } from "react";
import {
  Calculator,
  TrendingUp,
  BarChart3,
  Zap,
  Settings,
  Eye,
  Pencil,
  Save,
  RotateCcw,
  HelpCircle,
  Activity,
  PlayCircle,
  PauseCircle,
  Plus,
  Minus,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { formatCurrency, formatPercentage, formatPopulation } from "./utils";
import type { Country, EconomicYearData, DMInputs, EconomicModel } from "~/server/db/schema";
import { useEconomicModel, type UseEconomicModelReturn } from "~/hooks/useEconomicModel";
import type { ModelParameters, SectorData, PolicyData } from "~/lib/economic-modeling-engine";

interface EconomicModelingEngineProps {
  country: Country & {
    economicYears: EconomicYearData[];
    dmInputs?: DMInputs | null;
    economicModel?: EconomicModel | null;
  };
  onModelUpdate?: (updatedModel: EconomicModel) => void;
}

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

export function EconomicModelingEngine({ country, onModelUpdate }: EconomicModelingEngineProps) {
  const [view, setView] = useState<"parameters" | "sectors" | "policies" | "projections">(
    "parameters"
  );

  // Use custom hook for all business logic
  const model = useEconomicModel(country, onModelUpdate);

  // Helper for getting model health display properties
  const getModelHealthDisplay = (health: UseEconomicModelReturn["modelHealth"]) => {
    const score = health.score;
    return {
      score,
      label:
        health.status === "excellent"
          ? "Excellent"
          : health.status === "good"
            ? "Good"
            : health.status === "fair"
              ? "Fair"
              : "Needs Attention",
      color:
        health.status === "excellent"
          ? "text-green-600"
          : health.status === "good"
            ? "text-blue-600"
            : health.status === "fair"
              ? "text-yellow-600"
              : "text-red-600",
    };
  };

  const modelHealthDisplay = getModelHealthDisplay(model.modelHealth);

  const renderParameterInput = (label: string, field: keyof ModelParameters, value: number) => {
    const def = parameterDefinitions[field];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{label}</Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="text-muted-foreground h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{def.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium">
            {value.toFixed(def.step < 1 ? 1 : 0)}
            {def.isPercentage ? "%" : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Input
            type="number"
            value={value}
            onChange={(e) => model.updateParameter(field, parseFloat(e.target.value) || 0)}
            step={def.step}
            min={def.min}
            max={def.max}
            className="md:col-span-1"
          />

          <div className="flex items-center gap-2 md:col-span-2">
            <Slider
              value={[value]}
              onValueChange={(val) => model.updateParameter(field, val[0] ?? 0)}
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Calculator className="text-primary h-5 w-5" />
              Economic Modeling Engine
            </h3>
            <p className="text-muted-foreground text-sm">
              Build and simulate economic scenarios for {country.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={model.editMode ? "default" : "outline"}
              size="sm"
              onClick={() => model.setEditMode(!model.editMode)}
            >
              {model.editMode ? (
                <Eye className="mr-1 h-4 w-4" />
              ) : (
                <Pencil className="mr-1 h-4 w-4" />
              )}
              {model.editMode ? "View" : "Edit"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={model.resetParameters}
              disabled={model.isLoading}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Reset
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={model.runSimulation}
              disabled={model.isSimulating}
            >
              {model.isSimulating ? (
                <PauseCircle className="mr-1 h-4 w-4" />
              ) : (
                <PlayCircle className="mr-1 h-4 w-4" />
              )}
              {model.isSimulating ? "Simulating..." : "Run Simulation"}
            </Button>
          </div>
        </div>

        {/* Model Health Status */}
        <Alert
          className={`border-l-4 ${
            modelHealthDisplay.color === "text-green-600"
              ? "border-l-green-500"
              : modelHealthDisplay.color === "text-blue-600"
                ? "border-l-blue-500"
                : modelHealthDisplay.color === "text-yellow-600"
                  ? "border-l-yellow-500"
                  : "border-l-red-500"
          }`}
        >
          <Activity className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Model Health:{" "}
              <span className={`font-semibold ${modelHealthDisplay.color}`}>
                {modelHealthDisplay.label}
              </span>
              <span className="ml-4">Score: {modelHealthDisplay.score}/100</span>
            </span>
            <Badge
              variant={
                modelHealthDisplay.score >= 85
                  ? "default"
                  : modelHealthDisplay.score >= 70
                    ? "secondary"
                    : "destructive"
              }
            >
              {model.projectedData.length} Year Forecast
            </Badge>
          </AlertDescription>
        </Alert>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(model.parameters.gdpGrowthRate)}
                </div>
                <div className="text-muted-foreground text-xs">GDP Growth</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-1 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPercentage(model.parameters.inflationRate)}
                </div>
                <div className="text-muted-foreground text-xs">Inflation</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-1 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatPercentage(model.parameters.unemploymentRate)}
                </div>
                <div className="text-muted-foreground text-xs">Unemployment</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-1 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {model.parameters.projectionYears}
                </div>
                <div className="text-muted-foreground text-xs">Years Forecast</div>
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
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {renderParameterInput("Base Year", "baseYear", model.parameters.baseYear)}
                  {renderParameterInput(
                    "Projection Years",
                    "projectionYears",
                    model.parameters.projectionYears
                  )}
                  {renderParameterInput(
                    "GDP Growth Rate (%)",
                    "gdpGrowthRate",
                    model.parameters.gdpGrowthRate
                  )}
                  {renderParameterInput(
                    "Inflation Rate (%)",
                    "inflationRate",
                    model.parameters.inflationRate
                  )}
                  {renderParameterInput(
                    "Unemployment Rate (%)",
                    "unemploymentRate",
                    model.parameters.unemploymentRate
                  )}
                  {renderParameterInput(
                    "Interest Rate (%)",
                    "interestRate",
                    model.parameters.interestRate
                  )}
                  {renderParameterInput(
                    "Exchange Rate (to USD)",
                    "exchangeRate",
                    model.parameters.exchangeRate
                  )}
                  {renderParameterInput(
                    "Population Growth Rate (%)",
                    "populationGrowthRate",
                    model.parameters.populationGrowthRate
                  )}
                  {renderParameterInput(
                    "Investment Rate (% of GDP)",
                    "investmentRate",
                    model.parameters.investmentRate
                  )}
                  {renderParameterInput(
                    "Fiscal Balance (% of GDP)",
                    "fiscalBalance",
                    model.parameters.fiscalBalance
                  )}
                  {renderParameterInput(
                    "Trade Balance (% of GDP)",
                    "tradeBalance",
                    model.parameters.tradeBalance
                  )}
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
                      {model.sectoralOutputs.map((output, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.year}
                              onChange={(e) =>
                                model.updateSectoralOutput(index, "year", e.target.value)
                              }
                              className="w-24"
                              disabled={!model.editMode}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.agriculture}
                              onChange={(e) =>
                                model.updateSectoralOutput(index, "agriculture", e.target.value)
                              }
                              disabled={!model.editMode}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.industry}
                              onChange={(e) =>
                                model.updateSectoralOutput(index, "industry", e.target.value)
                              }
                              disabled={!model.editMode}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.services}
                              onChange={(e) =>
                                model.updateSectoralOutput(index, "services", e.target.value)
                              }
                              disabled={!model.editMode}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={output.government}
                              onChange={(e) =>
                                model.updateSectoralOutput(index, "government", e.target.value)
                              }
                              disabled={!model.editMode}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(output.totalGDP)}
                          </TableCell>
                          <TableCell>
                            {model.editMode && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => model.removeSectoralOutputYear(index)}
                                disabled={model.sectoralOutputs.length <= 1}
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

                {model.editMode && (
                  <Button onClick={model.addSectoralOutputYear} variant="outline" className="mt-4">
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
                {model.policyEffects.map((policy, index) => (
                  <Card
                    key={policy.id ? `policy-${policy.id}` : `policy-fallback-${index}`}
                    className="p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <Input
                        value={policy.name}
                        onChange={(e) => model.updatePolicyEffect(index, "name", e.target.value)}
                        className="text-md w-1/2 font-semibold"
                        disabled={!model.editMode}
                      />
                      {model.editMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => model.removePolicyEffect(index)}
                        >
                          <Minus className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-sm font-medium">Description</Label>
                        <Input
                          value={policy.description}
                          onChange={(e) =>
                            model.updatePolicyEffect(index, "description", e.target.value)
                          }
                          disabled={!model.editMode}
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Year Implemented</Label>
                        <Input
                          type="number"
                          value={policy.yearImplemented}
                          onChange={(e) =>
                            model.updatePolicyEffect(index, "yearImplemented", e.target.value)
                          }
                          disabled={!model.editMode}
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Duration (Years)</Label>
                        <Input
                          type="number"
                          value={policy.durationYears}
                          onChange={(e) =>
                            model.updatePolicyEffect(index, "durationYears", e.target.value)
                          }
                          disabled={!model.editMode}
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">GDP Effect (%)</Label>
                        <Input
                          type="number"
                          value={policy.gdpEffectPercentage}
                          onChange={(e) =>
                            model.updatePolicyEffect(index, "gdpEffectPercentage", e.target.value)
                          }
                          step="0.1"
                          disabled={!model.editMode}
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Inflation Effect (%)</Label>
                        <Input
                          type="number"
                          value={policy.inflationEffectPercentage}
                          onChange={(e) =>
                            model.updatePolicyEffect(
                              index,
                              "inflationEffectPercentage",
                              e.target.value
                            )
                          }
                          step="0.1"
                          disabled={!model.editMode}
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Employment Effect (%)</Label>
                        <Input
                          type="number"
                          value={policy.employmentEffectPercentage}
                          onChange={(e) =>
                            model.updatePolicyEffect(
                              index,
                              "employmentEffectPercentage",
                              e.target.value
                            )
                          }
                          step="0.1"
                          disabled={!model.editMode}
                        />
                      </div>
                    </div>
                  </Card>
                ))}

                {model.editMode && (
                  <Button onClick={model.addPolicyEffect} variant="outline">
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
                    <ComposedChart data={model.projectedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [
                          name === "gdp"
                            ? formatCurrency(value)
                            : name === "gdpPerCapita"
                              ? formatCurrency(value)
                              : name === "population"
                                ? formatPopulation(value)
                                : formatPercentage(value),
                          name.charAt(0).toUpperCase() + name.slice(1),
                        ]}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="gdp" fill="#3b82f6" name="GDP (Total)" />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="inflation"
                        stroke="#f59e0b"
                        name="Inflation %"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="unemployment"
                        stroke="#ef4444"
                        name="Unemployment %"
                      />
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
                      {model.projectedData.map((data) => (
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
          <Button onClick={model.saveModel} disabled={model.isLoading} size="lg">
            {model.isLoading ? (
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
            <p className="mt-1 text-sm">
              {model.parameters.projectionYears}-year economic model with{" "}
              {formatPercentage(model.parameters.gdpGrowthRate)} GDP growth,
              {formatPercentage(model.parameters.inflationRate)} inflation, and{" "}
              {model.policyEffects.length} policy scenarios. Model health score:{" "}
              {modelHealthDisplay.score}/100 ({modelHealthDisplay.label}).
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}

export default EconomicModelingEngine;
