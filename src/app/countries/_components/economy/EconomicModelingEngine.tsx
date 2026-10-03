"use client";
import React from "react";
import {
  StatUp as TrendingUp,
  StatsReport as BarChart3,
  Flash as Zap,
  Settings,
  Eye,
  EditPencil as Pencil,
  FloppyDisk as Save,
  Undo as RotateCcw,
  HelpCircle,
  Activity,
  Play as PlayCircle,
  Pause as PauseCircle,
  Plus,
  Minus,
  InfoCircle as Info,
  SystemRestart,
} from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { formatCurrency, formatPercent as formatPercentage, formatPopulation } from "~/lib/utils";
import type {
  CountryEconomicSummary,
  EconomicYearData,
  StorytellerEffect,
  EconomicModel,
} from "~/types/economics";
import { useEconomicModel, type UseEconomicModelReturn } from "~/hooks/useEconomicModel";
import type {
  ModelHealth,
  ModelParameters,
  PolicyData,
  SectorData,
  YearProjection,
} from "~/lib/economy/modeling-engine";

interface EconomicModelingEngineProps {
  country: CountryEconomicSummary & {
    economicYears: EconomicYearData[];
    storytellerEffects?: StorytellerEffect | null;
    economicModel?: EconomicModel | null;
  };
  onModelUpdate?: (updatedModel: EconomicModel) => void;
}

interface ParameterDefinition {
  field: keyof ModelParameters;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  isPercentage: boolean;
}

const PARAMETERS: ParameterDefinition[] = [
  {
    field: "baseYear",
    label: "Base year",
    description: "The starting year for the economic model and projections",
    min: 1900,
    max: 2100,
    step: 1,
    isPercentage: false,
  },
  {
    field: "projectionYears",
    label: "Projection years",
    description: "Number of years into the future to forecast",
    min: 1,
    max: 50,
    step: 1,
    isPercentage: false,
  },
  {
    field: "gdpGrowthRate",
    label: "GDP growth rate (%)",
    description: "Annual percentage change in Gross Domestic Product (GDP)",
    min: -20,
    max: 20,
    step: 0.1,
    isPercentage: true,
  },
  {
    field: "inflationRate",
    label: "Inflation rate (%)",
    description: "Annual percentage increase in the general price level",
    min: -10,
    max: 50,
    step: 0.1,
    isPercentage: true,
  },
  {
    field: "unemploymentRate",
    label: "Unemployment rate (%)",
    description: "Percentage of the labor force that is jobless and looking for jobs",
    min: 0,
    max: 50,
    step: 0.1,
    isPercentage: true,
  },
  {
    field: "interestRate",
    label: "Interest rate (%)",
    description: "The cost of borrowing money, set by the central bank or market forces",
    min: -5,
    max: 30,
    step: 0.05,
    isPercentage: true,
  },
  {
    field: "exchangeRate",
    label: "Exchange rate (to USD)",
    description: "Value of the national currency against a benchmark (e.g., USD)",
    min: 0,
    max: 1000,
    step: 0.01,
    isPercentage: false,
  },
  {
    field: "populationGrowthRate",
    label: "Population growth rate (%)",
    description: "Annual percentage change in population size",
    min: -5,
    max: 10,
    step: 0.01,
    isPercentage: true,
  },
  {
    field: "investmentRate",
    label: "Investment rate (% of GDP)",
    description: "Percentage of GDP allocated to investment",
    min: 0,
    max: 50,
    step: 0.5,
    isPercentage: true,
  },
  {
    field: "fiscalBalance",
    label: "Fiscal balance (% of GDP)",
    description: "Difference between government revenue and expenditure, as % of GDP",
    min: -20,
    max: 20,
    step: 0.1,
    isPercentage: true,
  },
  {
    field: "tradeBalance",
    label: "Trade balance (% of GDP)",
    description: "Difference between exports and imports, as % of GDP",
    min: -20,
    max: 20,
    step: 0.1,
    isPercentage: true,
  },
];

const HEALTH_DISPLAY: Record<
  ModelHealth["status"],
  { label: string; color: string; border: string }
> = {
  excellent: { label: "Excellent", color: "text-green", border: "border-l-green" },
  good: { label: "Good", color: "text-blue", border: "border-l-blue" },
  fair: { label: "Fair", color: "text-yellow", border: "border-l-yellow" },
  poor: { label: "Needs attention", color: "text-red", border: "border-l-red" },
};

const SECTOR_COLUMNS = [
  { field: "agriculture", label: "Agriculture" },
  { field: "industry", label: "Industry" },
  { field: "services", label: "Services" },
  { field: "government", label: "Government" },
] as const;

const SECTOR_TABLE_COLUMNS: Array<{ field: keyof SectorData; className?: string }> = [
  { field: "year", className: "w-24" },
  ...SECTOR_COLUMNS,
];

const POLICY_FIELDS: {
  field: keyof PolicyData;
  label: string;
  numeric: boolean;
  step?: string;
}[] = [
  { field: "description", label: "Description", numeric: false },
  { field: "yearImplemented", label: "Year implemented", numeric: true },
  { field: "durationYears", label: "Duration (Years)", numeric: true },
  { field: "gdpEffectPercentage", label: "GDP Effect (%)", numeric: true, step: "0.1" },
  { field: "inflationEffectPercentage", label: "Inflation effect (%)", numeric: true, step: "0.1" },
  {
    field: "employmentEffectPercentage",
    label: "Employment effect (%)",
    numeric: true,
    step: "0.1",
  },
];

const PROJECTION_COLUMNS: {
  label: string;
  cell: (row: YearProjection) => React.ReactNode;
  className?: string;
}[] = [
  { label: "Year", cell: (d) => d.year, className: "font-medium" },
  { label: "GDP (Total)", cell: (d) => formatCurrency(d.gdp) },
  { label: "GDP per capita", cell: (d) => formatCurrency(d.gdpPerCapita) },
  { label: "Inflation (%)", cell: (d) => formatPercentage(d.inflation) },
  { label: "Unemployment (%)", cell: (d) => formatPercentage(d.unemployment) },
  { label: "Population", cell: (d) => formatPopulation(d.population) },
];

type Model = UseEconomicModelReturn;

function ParameterInput({
  def,
  value,
  onChange,
}: {
  def: ParameterDefinition;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-body font-medium">{def.label}</Label>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="text-label-secondary h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{def.description}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="text-body font-medium">
          {value.toFixed(def.step < 1 ? 1 : 0)}
          {def.isPercentage ? "%" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={def.step}
          min={def.min}
          max={def.max}
          className="md:col-span-1"
        />

        <div className="flex items-center gap-2 md:col-span-2">
          <Slider
            value={[value]}
            onValueChange={(val) => onChange(val[0] ?? 0)}
            max={def.max}
            min={def.min}
            step={def.step}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}

/** One tab: a titled card around `children`. */
function TabCard({
  value,
  icon: Icon,
  title,
  contentClassName,
  children,
}: {
  value: string;
  icon: typeof Settings;
  title: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsContent value={value} className="space-y-4">
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    </TabsContent>
  );
}

function SectorsTab({ model }: { model: Model }) {
  const { sectoralOutputs, editMode, updateSectoralOutput } = model;
  return (
    <TabCard value="sectors" icon={BarChart3} title="Sectoral GDP components">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              {SECTOR_COLUMNS.map(({ field, label }) => (
                <TableHead key={field}>{label}</TableHead>
              ))}
              <TableHead>Total GDP</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectoralOutputs.map((output: SectorData, index) => (
              <TableRow key={index}>
                {SECTOR_TABLE_COLUMNS.map((column) => (
                  <TableCell key={column.field}>
                    <Input
                      type="number"
                      value={output[column.field]}
                      onChange={(e) => updateSectoralOutput(index, column.field, e.target.value)}
                      className={column.className}
                      disabled={!editMode}
                    />
                  </TableCell>
                ))}
                <TableCell className="font-medium">{formatCurrency(output.totalGDP)}</TableCell>
                <TableCell>
                  {editMode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => model.removeSectoralOutputYear(index)}
                      disabled={sectoralOutputs.length <= 1}
                    >
                      <Minus className="text-red h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editMode && (
        <Button onClick={model.addSectoralOutputYear} variant="outline" className="mt-4">
          <Plus className="mr-2 h-4 w-4" /> Add year
        </Button>
      )}
    </TabCard>
  );
}

function PoliciesTab({ model }: { model: Model }) {
  const { editMode, updatePolicyEffect } = model;
  return (
    <TabCard value="policies" icon={Zap} title="Policy effects" contentClassName="space-y-4">
      {model.policyEffects.map((policy: PolicyData, index) => (
        <Card
          key={policy.id ? `policy-${policy.id}` : `policy-fallback-${index}`}
          className="flex flex-col gap-6 p-4 py-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <Input
              value={policy.name}
              onChange={(e) => updatePolicyEffect(index, "name", e.target.value)}
              className="text-md w-1/2 font-semibold"
              disabled={!editMode}
            />
            {editMode && (
              <Button variant="ghost" size="sm" onClick={() => model.removePolicyEffect(index)}>
                <Minus className="text-red h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {POLICY_FIELDS.map(({ field, label, numeric, step }) => (
              <div key={field}>
                <Label className="text-body font-medium">{label}</Label>
                <Input
                  type={numeric ? "number" : undefined}
                  value={policy[field]}
                  onChange={(e) => updatePolicyEffect(index, field, e.target.value)}
                  step={step}
                  disabled={!editMode}
                />
              </div>
            ))}
          </div>
        </Card>
      ))}

      {editMode && (
        <Button onClick={model.addPolicyEffect} variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Add policy scenario
        </Button>
      )}
    </TabCard>
  );
}

function ProjectionsTab({ data }: { data: YearProjection[] }) {
  return (
    <TabCard value="projections" icon={TrendingUp} title="Projections">
      <div className="h-[400px] w-full">
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <RechartsTooltip
              formatter={(value: any, name: any) => [
                formatPercentage(value),
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
              {PROJECTION_COLUMNS.map(({ label }) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.year}>
                {PROJECTION_COLUMNS.map(({ label, cell, className }) => (
                  <TableCell key={label} className={className}>
                    {cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TabCard>
  );
}

export function EconomicModelingEngine({ country, onModelUpdate }: EconomicModelingEngineProps) {
  const model = useEconomicModel(country, onModelUpdate);
  const { parameters } = model;
  const health = { score: model.modelHealth.score, ...HEALTH_DISPLAY[model.modelHealth.status] };

  const headlineStats = [
    { label: "GDP growth", value: formatPercentage(parameters.gdpGrowthRate) },
    { label: "Inflation", value: formatPercentage(parameters.inflationRate) },
    { label: "Unemployment", value: formatPercentage(parameters.unemploymentRate) },
    { label: "Years forecast", value: parameters.projectionYears },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-end">
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
              {model.isSimulating ? "Simulating" : "Run simulation"}
            </Button>
          </div>
        </div>

        <Alert className={`border-l-4 ${health.border}`}>
          <Activity className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Model health: <span className={`font-semibold ${health.color}`}>{health.label}</span>
              <span className="ml-4">Score: {health.score}/100</span>
            </span>
            <Badge
              variant={
                health.score >= 85 ? "secondary" : health.score >= 70 ? "default" : "destructive"
              }
            >
              {model.projectedData.length}-year forecast
            </Badge>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {headlineStats.map(({ label, value }) => (
            <Card key={label} className="flex flex-col gap-6 py-6">
              <CardContent className="p-4">
                <div className="space-y-1 text-center">
                  <div className="text-title-1 text-label">{value}</div>
                  <div className="text-label-secondary text-footnote">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="parameters" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="sectors">Sectors</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="projections">Projections</TabsTrigger>
          </TabsList>

          <TabCard
            value="parameters"
            icon={Settings}
            title="Core parameters"
            contentClassName="space-y-6"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {PARAMETERS.map((def) => (
                <ParameterInput
                  key={def.field}
                  def={def}
                  value={parameters[def.field]}
                  onChange={(value) => model.updateParameter(def.field, value)}
                />
              ))}
            </div>
          </TabCard>
          <SectorsTab model={model} />
          <PoliciesTab model={model} />
          <ProjectionsTab data={model.projectedData} />
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button onClick={model.saveModel} disabled={model.isLoading} size="lg">
            {model.isLoading ? (
              <SystemRestart aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save model
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Model summary</div>
            <p className="text-body mt-1">
              {parameters.projectionYears}-year economic model with{" "}
              {formatPercentage(parameters.gdpGrowthRate)} GDP growth,
              {formatPercentage(parameters.inflationRate)} inflation, and{" "}
              {model.policyEffects.length} policy scenarios. Model health score: {health.score}/100
              ({health.label}).
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}
