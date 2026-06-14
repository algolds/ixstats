// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Briefcase,
  Users,
  Clock,
  BarChart2,
  Factory,
  Wheat,
  Building2,
  TrendingUp,
  GraduationCap,
  ShieldCheck,
  MapPin,
  Eye,
  Pencil,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const cardHover = {
  scale: 1.02,
  transition: { type: "spring" as const, stiffness: 400, damping: 10 },
};
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatPopulation, formatPercentage, formatCurrency } from "./utils";
import type { LaborEmploymentData } from "~/types/economics";

type ExtendedLaborEmploymentData = LaborEmploymentData & {
  employmentBySector: {
    agriculture: number;
    industry: number;
    services: number;
  };
  employmentByType: {
    fullTime: number;
    partTime: number;
    temporary: number;
    selfEmployed: number;
    informal: number;
  };
  regionalEmployment: {
    urban: { participationRate: number; unemploymentRate: number; averageIncome: number };
    rural: { participationRate: number; unemploymentRate: number; averageIncome: number };
  };
  skillsAndProductivity: {
    laborProductivityIndex: number;
    averageEducationYears: number;
    tertiaryEducationRate: number;
    vocationalTrainingRate: number;
    skillsGapIndex: number;
    productivityGrowthRate: number;
  };
  demographicsAndConditions: {
    youthUnemploymentRate: number;
    femaleParticipationRate: number;
    genderPayGap: number;
    unionizationRate: number;
    workplaceSafetyIndex: number;
    averageCommutingTime: number;
  };
  socialProtection: {
    unemploymentBenefitCoverage: number;
    pensionCoverage: number;
    healthInsuranceCoverage: number;
    paidSickLeaveDays: number;
    paidVacationDays: number;
    parentalLeaveWeeks: number;
  };
};

export interface RealCountryData {
  name: string;
  unemploymentRate: number;
}

interface LaborEmploymentProps {
  laborData: LaborEmploymentData;
  referenceCountry?: RealCountryData;
  totalPopulation: number;
  /** SERVER ACTION */
  onLaborDataChangeAction: (d: LaborEmploymentData) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

export function LaborEmployment({
  laborData,
  referenceCountry,
  totalPopulation,
  onLaborDataChangeAction,
  isReadOnly = false,
  showComparison = true,
}: LaborEmploymentProps) {
  const [view, setView] = useState<"overview" | "detailed">("overview");
  const [editMode, setEditMode] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("sectors");
  const data = laborData as ExtendedLaborEmploymentData;

  function handleField<K extends keyof LaborEmploymentData>(field: K, value: number | any) {
    const next = { ...laborData, [field]: value };
    if (field === "laborForceParticipationRate") {
      const wap = totalPopulation * 0.65;
      next.totalWorkforce = Math.round((value / 100) * wap);
    } else if (field === "unemploymentRate") {
      next.employmentRate = 100 - value;
    } else if (field === "employmentRate") {
      next.unemploymentRate = 100 - value;
    }
    onLaborDataChangeAction(next);
  }

  function handleNestedField(
    section: keyof ExtendedLaborEmploymentData,
    field: string,
    value: number
  ) {
    const next = { ...laborData };
    if (typeof next[section] === "object" && next[section] !== null) {
      (next[section] as any)[field] = value;
    }
    onLaborDataChangeAction(next);
  }

  // Derived calculations
  const wap = Math.round(totalPopulation * 0.65); // Working age population
  const lf = Math.round((data.laborForceParticipationRate / 100) * wap);
  const employed = Math.round((data.employmentRate / 100) * lf);
  const unemployed = lf - employed;

  function getEmploymentHealth() {
    if (data.unemploymentRate === null || data.unemploymentRate === undefined) {
      return { label: "No Data", color: "text-gray-500", variant: "outline" as const };
    }
    if (data.unemploymentRate <= 4) {
      return { label: "Full Employment", color: "text-green-600", variant: "default" as const };
    }
    if (data.unemploymentRate <= 7) {
      return { label: "Healthy", color: "text-blue-600", variant: "secondary" as const };
    }
    if (data.unemploymentRate <= 12) {
      return {
        label: "Moderate Concern",
        color: "text-yellow-600",
        variant: "destructive" as const,
      };
    }
    return { label: "High Unemployment", color: "text-red-600", variant: "destructive" as const };
  }

  function getLaborProductivityHealth() {
    const index = data.skillsAndProductivity?.laborProductivityIndex || 100;
    if (index >= 120) return { label: "Excellent", color: "text-green-600" };
    if (index >= 105) return { label: "Good", color: "text-blue-600" };
    if (index >= 95) return { label: "Average", color: "text-yellow-600" };
    return { label: "Below Average", color: "text-red-600" };
  }

  const health = getEmploymentHealth();
  const productivityHealth = getLaborProductivityHealth();

  // Chart data
  const sectorData = data.employmentBySector
    ? [
        { name: "Agriculture", value: data.employmentBySector.agriculture, fill: "#10b981" },
        { name: "Industry", value: data.employmentBySector.industry, fill: "#3b82f6" },
        { name: "Services", value: data.employmentBySector.services, fill: "#8b5cf6" },
      ]
    : [];

  const employmentTypeData = data.employmentByType
    ? [
        { name: "Full-time", value: data.employmentByType.fullTime, fill: "#059669" },
        { name: "Part-time", value: data.employmentByType.partTime, fill: "#0891b2" },
        { name: "Temporary", value: data.employmentByType.temporary, fill: "#7c3aed" },
        { name: "Self-employed", value: data.employmentByType.selfEmployed, fill: "#dc2626" },
        { name: "Informal", value: data.employmentByType.informal, fill: "#ea580c" },
      ]
    : [];

  const regionalComparisonData = data.regionalEmployment
    ? [
        {
          region: "Urban",
          participation: data.regionalEmployment.urban.participationRate,
          unemployment: data.regionalEmployment.urban.unemploymentRate,
          income: data.regionalEmployment.urban.averageIncome / 1000,
        },
        {
          region: "Rural",
          participation: data.regionalEmployment.rural.participationRate,
          unemployment: data.regionalEmployment.rural.unemploymentRate,
          income: data.regionalEmployment.rural.averageIncome / 1000,
        },
      ]
    : [];

  const basicMetrics = [
    {
      label: "Participation Rate",
      field: "laborForceParticipationRate" as const,
      value: data.laborForceParticipationRate,
      target: 65,
      reverse: false,
      description: "% of working-age population",
      icon: Users,
    },
    {
      label: "Employment Rate",
      field: "employmentRate" as const,
      value: data.employmentRate,
      target: 95,
      reverse: false,
      description: "% of labor force employed",
      icon: Briefcase,
    },
    {
      label: "Unemployment Rate",
      field: "unemploymentRate" as const,
      value: data.unemploymentRate,
      target: 5,
      reverse: true,
      description: "% seeking work",
      icon: AlertTriangle,
    },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Briefcase className="text-primary h-5 w-5" />
              Labor & Employment
            </h3>
            <p className="text-muted-foreground text-sm">
              Comprehensive workforce and employment analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? <Eye className="mr-1 h-4 w-4" /> : <Pencil className="mr-1 h-4 w-4" />}
                {editMode ? "View" : "Edit"}
              </Button>
            )}
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList className="grid w-[200px] grid-cols-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="detailed">Detailed</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Health Status */}
        <Alert
          className={`border-l-4 ${
            health.color === "text-green-600"
              ? "border-l-green-500"
              : health.color === "text-blue-600"
                ? "border-l-blue-500"
                : health.color === "text-yellow-600"
                  ? "border-l-yellow-500"
                  : "border-l-red-500"
          }`}
        >
          <Briefcase className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Labor Market Health:{" "}
              <span className={`font-semibold ${health.color}`}>{health.label}</span>
              {data.skillsAndProductivity && (
                <span className="ml-4">
                  Productivity:{" "}
                  <span className={`font-semibold ${productivityHealth.color}`}>
                    {productivityHealth.label}
                  </span>
                </span>
              )}
            </span>
            <Badge variant={health.variant}>
              {data.unemploymentRate !== null && data.unemploymentRate !== undefined
                ? `${formatPercentage(data.unemploymentRate)} Unemployed`
                : "Missing data"}
            </Badge>
          </AlertDescription>
        </Alert>

        {/* Labor Force Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="text-primary h-4 w-4" />
              Labor Force Breakdown
            </CardTitle>
            <CardDescription>Population and workforce distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{formatPopulation(totalPopulation)}</div>
                <div className="text-muted-foreground text-xs">Total Population</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">{formatPopulation(wap)}</div>
                <div className="text-muted-foreground text-xs">Working Age (65%)</div>
              </div>
              <div className="space-y-1">
                <div className="text-primary text-2xl font-bold">{formatPopulation(lf)}</div>
                <div className="text-muted-foreground text-xs">
                  Labor Force ({formatPercentage(data.laborForceParticipationRate)})
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <div className="text-lg font-bold text-green-600">
                    {formatPopulation(employed)}
                  </div>
                  <div className="text-muted-foreground text-xs">Employed</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-red-600">
                    {formatPopulation(unemployed)}
                  </div>
                  <div className="text-muted-foreground text-xs">Unemployed</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overview Tab */}
        {view === "overview" && (
          <motion.div
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {/* Key Metrics */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {basicMetrics.map((metric, index) => {
                const Icon = metric.icon;
                const progress = metric.reverse
                  ? Math.max(0, 100 - (metric.value / metric.target) * 100)
                  : Math.min(100, (metric.value / metric.target) * 100);

                const cardColors = [
                  "from-red-50/80 to-rose-50/80 dark:from-red-900/20 dark:to-rose-900/20 border-red-200/50 dark:border-red-700/30",
                  "from-emerald-50/80 to-green-50/80 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200/50 dark:border-emerald-700/30",
                  "from-blue-50/80 to-cyan-50/80 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200/50 dark:border-blue-700/30",
                ];
                const textColors = [
                  "text-red-700 dark:text-red-400",
                  "text-emerald-700 dark:text-emerald-400",
                  "text-blue-700 dark:text-blue-400",
                ];

                return (
                  <motion.div key={metric.field} variants={itemVariants} whileHover={cardHover}>
                    <Card className={`bg-gradient-to-br ${cardColors[index % 3]} border shadow-sm`}>
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${textColors[index % 3]}`} />
                            <span className="text-sm font-medium">{metric.label}</span>
                          </div>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="text-muted-foreground h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{metric.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-2xl font-bold ${textColors[index % 3]}`}>
                              {formatPercentage(metric.value)}
                            </span>
                            {editMode ? (
                              <Input
                                type="number"
                                value={metric.value}
                                onChange={(e) =>
                                  handleField(metric.field, parseFloat(e.target.value) || 0)
                                }
                                className="h-8 w-20 text-right"
                                step="0.1"
                                min="0"
                                max="100"
                              />
                            ) : (
                              <Badge
                                variant={
                                  progress >= 80
                                    ? "default"
                                    : progress >= 60
                                      ? "secondary"
                                      : "destructive"
                                }
                              >
                                {progress >= 80 ? "Good" : progress >= 60 ? "Fair" : "Poor"}
                              </Badge>
                            )}
                          </div>
                          <Progress value={progress} className="h-2" />
                          <div className="text-muted-foreground text-xs">
                            Target: {formatPercentage(metric.target)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Additional Key Metrics */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Card className="h-full border border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-yellow-50/80 shadow-sm dark:border-amber-700/30 dark:from-amber-900/20 dark:to-yellow-900/20">
                  <CardContent className="p-4 text-center">
                    <Clock className="mx-auto mb-2 h-6 w-6 text-amber-600" />
                    <div className="text-xl font-bold text-amber-700 dark:text-amber-400">
                      {data.averageWorkweekHours}h
                    </div>
                    <div className="text-muted-foreground text-xs">Avg Work Week</div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Card className="h-full border border-green-200/50 bg-gradient-to-br from-green-50/80 to-emerald-50/80 shadow-sm dark:border-green-700/30 dark:from-green-900/20 dark:to-emerald-900/20">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="mx-auto mb-2 h-6 w-6 text-green-600" />
                    <div className="text-xl font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(data.minimumWage)}
                    </div>
                    <div className="text-muted-foreground text-xs">Minimum Wage</div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Card className="h-full border border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-cyan-50/80 shadow-sm dark:border-blue-700/30 dark:from-blue-900/20 dark:to-cyan-900/20">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="mx-auto mb-2 h-6 w-6 text-blue-600" />
                    <div className="text-xl font-bold text-blue-700 dark:text-blue-400">
                      {formatCurrency(data.averageAnnualIncome)}
                    </div>
                    <div className="text-muted-foreground text-xs">Avg Annual Income</div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Card className="h-full border border-purple-200/50 bg-gradient-to-br from-purple-50/80 to-violet-50/80 shadow-sm dark:border-purple-700/30 dark:from-purple-900/20 dark:to-violet-900/20">
                  <CardContent className="p-4 text-center">
                    <Users className="mx-auto mb-2 h-6 w-6 text-purple-600" />
                    <div className="text-xl font-bold text-purple-700 dark:text-purple-400">
                      {formatPopulation(data.totalWorkforce)}
                    </div>
                    <div className="text-muted-foreground text-xs">Total Workforce</div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {showComparison && referenceCountry && (
              <motion.div variants={itemVariants}>
                <Card className="border border-slate-200/50 bg-gradient-to-br from-slate-50/80 to-gray-50/80 shadow-sm dark:border-slate-700/30 dark:from-slate-900/20 dark:to-gray-900/20">
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Comparison with {referenceCountry.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Unemployment Rate:</span>
                        <div className="space-x-2">
                          <span className="font-medium">
                            {data.unemploymentRate !== null && data.unemploymentRate !== undefined
                              ? formatPercentage(data.unemploymentRate)
                              : "Missing data"}
                          </span>
                          {referenceCountry && (
                            <>
                              <span className="text-muted-foreground">vs</span>
                              <span>{formatPercentage(referenceCountry.unemploymentRate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Detailed Tab */}
        {view === "detailed" && (
          <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
              <TabsTrigger value="sectors">Sectors</TabsTrigger>
              <TabsTrigger value="types">Employment</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="demographics">Demographics</TabsTrigger>
              <TabsTrigger value="regional">Regional</TabsTrigger>
              <TabsTrigger value="benefits">Benefits</TabsTrigger>
            </TabsList>

            {/* Employment by Sector */}
            <TabsContent value="sectors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Factory className="text-primary h-5 w-5" />
                    Employment by Economic Sector
                  </CardTitle>
                  <CardDescription>
                    Distribution of workforce across major economic sectors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      {sectorData.length > 0 &&
                        // eslint-disable-next-line unused-imports/no-unused-vars
                        sectorData.map((sector, idx) => (
                          <div key={sector.name} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {sector.name === "Agriculture" && (
                                  <Wheat className="h-4 w-4 text-green-600" />
                                )}
                                {sector.name === "Industry" && (
                                  <Factory className="h-4 w-4 text-blue-600" />
                                )}
                                {sector.name === "Services" && (
                                  <Building2 className="h-4 w-4 text-purple-600" />
                                )}
                                <span className="text-sm font-medium">{sector.name}</span>
                              </div>
                              {editMode ? (
                                <Input
                                  type="number"
                                  value={sector.value}
                                  onChange={(e) => {
                                    const field =
                                      sector.name.toLowerCase() as keyof typeof data.employmentBySector;
                                    handleNestedField(
                                      "employmentBySector",
                                      field as string,
                                      parseFloat(e.target.value) || 0
                                    );
                                  }}
                                  className="h-8 w-20 text-right"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                />
                              ) : (
                                <span className="text-sm font-bold">
                                  {formatPercentage(sector.value)}
                                </span>
                              )}
                            </div>
                            <Progress value={sector.value} className="h-2" />
                            <div className="text-muted-foreground text-xs">
                              {formatPopulation((sector.value / 100) * employed)} workers
                            </div>
                          </div>
                        ))}
                    </div>
                    {sectorData.length > 0 && (
                      <div className="h-64">
                        <ResponsiveContainer width={"100%" as any} height={"100%" as any}>
                          <PieChart>
                            <Pie
                              data={sectorData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value}%`}
                            >
                              {sectorData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Employment Types */}
            <TabsContent value="types" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="text-primary h-5 w-5" />
                    Employment Types
                  </CardTitle>
                  <CardDescription>
                    Breakdown by employment arrangement and contract type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      {employmentTypeData.length > 0 &&
                        employmentTypeData.map((type) => (
                          <div key={type.name} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{type.name}</span>
                              {editMode ? (
                                <Input
                                  type="number"
                                  value={type.value}
                                  onChange={(e) => {
                                    const field = type.name
                                      .toLowerCase()
                                      .replace("-", "") as keyof typeof data.employmentByType;
                                    handleNestedField(
                                      "employmentByType",
                                      field as string,
                                      parseFloat(e.target.value) || 0
                                    );
                                  }}
                                  className="h-8 w-20 text-right"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                />
                              ) : (
                                <span className="text-sm font-bold">
                                  {formatPercentage(type.value)}
                                </span>
                              )}
                            </div>
                            <Progress value={type.value} className="h-2" />
                          </div>
                        ))}
                    </div>
                    {employmentTypeData.length > 0 && (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={employmentTypeData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value}%`}
                            >
                              {employmentTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Skills & Productivity */}
            <TabsContent value="skills" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="text-primary h-5 w-5" />
                    Skills & Productivity
                  </CardTitle>
                  <CardDescription>
                    Education levels, skills development, and productivity metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.skillsAndProductivity && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Average Education Years</Label>
                        <div className="text-2xl font-bold">
                          {data.skillsAndProductivity.averageEducationYears} years
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Tertiary Education Rate</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(data.skillsAndProductivity.tertiaryEducationRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Vocational Training Rate</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(data.skillsAndProductivity.vocationalTrainingRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Skills Gap Index</Label>
                        <div className="text-2xl font-bold">
                          {data.skillsAndProductivity.skillsGapIndex}/100
                        </div>
                        <Progress
                          value={data.skillsAndProductivity.skillsGapIndex}
                          className="h-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Labor Productivity Index</Label>
                        <div className="text-2xl font-bold">
                          {data.skillsAndProductivity.laborProductivityIndex}
                        </div>
                        <div className="text-muted-foreground text-xs">Base: 100</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Productivity Growth</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(data.skillsAndProductivity.productivityGrowthRate)}
                        </div>
                        <div className="text-muted-foreground text-xs">Annual</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Demographics & Conditions */}
            <TabsContent value="demographics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="text-primary h-5 w-5" />
                    Demographics & Working Conditions
                  </CardTitle>
                  <CardDescription>Workforce demographics and workplace conditions</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.demographicsAndConditions && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Youth Unemployment (15-24)</Label>
                        <div className="text-2xl font-bold text-red-600">
                          {formatPercentage(data.demographicsAndConditions.youthUnemploymentRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Female Participation Rate</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(data.demographicsAndConditions.femaleParticipationRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Gender Pay Gap</Label>
                        <div className="text-2xl font-bold text-orange-600">
                          {formatPercentage(data.demographicsAndConditions.genderPayGap)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Unionization Rate</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(data.demographicsAndConditions.unionizationRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Workplace Safety Index</Label>
                        <div className="text-2xl font-bold">
                          {data.demographicsAndConditions.workplaceSafetyIndex}/100
                        </div>
                        <Progress
                          value={data.demographicsAndConditions.workplaceSafetyIndex}
                          className="h-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Avg Commuting Time</Label>
                        <div className="text-2xl font-bold">
                          {data.demographicsAndConditions.averageCommutingTime} min
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Regional Analysis */}
            <TabsContent value="regional" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="text-primary h-5 w-5" />
                    Regional Employment Analysis
                  </CardTitle>
                  <CardDescription>
                    Urban vs rural employment patterns and income distribution
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.regionalEmployment && (
                    <div className="space-y-6">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={regionalComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="region" />
                            <YAxis />
                            <Bar
                              dataKey="participation"
                              name="Participation Rate %"
                              fill="#3b82f6"
                            />
                            <Bar dataKey="unemployment" name="Unemployment Rate %" fill="#ef4444" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Urban Employment</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between">
                              <span>Participation Rate:</span>
                              <span className="font-bold">
                                {formatPercentage(data.regionalEmployment.urban.participationRate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Unemployment Rate:</span>
                              <span className="font-bold">
                                {formatPercentage(data.regionalEmployment.urban.unemploymentRate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Average Income:</span>
                              <span className="font-bold">
                                {formatCurrency(data.regionalEmployment.urban.averageIncome)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Rural Employment</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between">
                              <span>Participation Rate:</span>
                              <span className="font-bold">
                                {formatPercentage(data.regionalEmployment.rural.participationRate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Unemployment Rate:</span>
                              <span className="font-bold">
                                {formatPercentage(data.regionalEmployment.rural.unemploymentRate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Average Income:</span>
                              <span className="font-bold">
                                {formatCurrency(data.regionalEmployment.rural.averageIncome)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Social Protection & Benefits */}
            <TabsContent value="benefits" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="text-primary h-5 w-5" />
                    Social Protection & Benefits
                  </CardTitle>
                  <CardDescription>
                    Worker benefits, social insurance, and protection coverage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.socialProtection && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Unemployment Benefit Coverage</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(data.socialProtection.unemploymentBenefitCoverage)}
                        </div>
                        <div className="text-muted-foreground text-xs">of unemployed</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Pension Coverage</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(data.socialProtection.pensionCoverage)}
                        </div>
                        <div className="text-muted-foreground text-xs">of workforce</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Health Insurance Coverage</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(data.socialProtection.healthInsuranceCoverage)}
                        </div>
                        <div className="text-muted-foreground text-xs">of workforce</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Paid Sick Leave</Label>
                        <div className="text-2xl font-bold">
                          {data.socialProtection.paidSickLeaveDays} days
                        </div>
                        <div className="text-muted-foreground text-xs">average per year</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Paid Vacation</Label>
                        <div className="text-2xl font-bold">
                          {data.socialProtection.paidVacationDays} days
                        </div>
                        <div className="text-muted-foreground text-xs">average per year</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Parental Leave</Label>
                        <div className="text-2xl font-bold">
                          {data.socialProtection.parentalLeaveWeeks} weeks
                        </div>
                        <div className="text-muted-foreground text-xs">available</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </TooltipProvider>
  );
}
