// src/components/defense/CommandPanel.tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { api } from "~/trpc/react";
import {
  Command,
  DollarSign,
  PieChart,
  TrendingUp,
  Shield,
  Users,
  Wrench,
  Package,
  Microscope,
  Building,
  Target,
  Activity,
  Edit,
  Save,
  HelpCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { Slider } from "~/components/ui/slider";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

interface CommandPanelProps {
  countryId: string;
}

const BUDGET_CATEGORIES = [
  {
    key: "personnelCosts",
    label: "Personnel",
    icon: Users,
    color: "text-blue-600",
    defaultPercent: 40,
  },
  {
    key: "operationsMaintenance",
    label: "Operations & Maintenance",
    icon: Wrench,
    color: "text-green-600",
    defaultPercent: 30,
  },
  {
    key: "procurement",
    label: "Procurement",
    icon: Package,
    color: "text-purple-600",
    defaultPercent: 15,
  },
  {
    key: "rdteCosts",
    label: "Research & Development",
    icon: Microscope,
    color: "text-orange-600",
    defaultPercent: 10,
  },
  {
    key: "militaryConstruction",
    label: "Military Construction",
    icon: Building,
    color: "text-cyan-600",
    defaultPercent: 5,
  },
] as const;

export function CommandPanel({ countryId }: CommandPanelProps) {
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetData, setBudgetData] = useState({
    totalBudget: 0,
    gdpPercent: 0,
    personnelCosts: 0,
    operationsMaintenance: 0,
    procurement: 0,
    rdteCosts: 0,
    militaryConstruction: 0,
  });

  const currentYear = new Date().getFullYear();

  // Get country data for GDP calculation
  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  // Fetch defense budget
  const { data: defenseBudget, refetch: refetchBudget } = api.security.getDefenseBudget.useQuery(
    { countryId, fiscalYear: currentYear },
    { enabled: !!countryId }
  );

  // Get military branches for readiness overview
  const { data: branches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Update budget mutation
  const updateBudget = api.security.updateDefenseBudget.useMutation({
    onSuccess: () => {
      toast.success("Defense budget updated");
      setEditingBudget(false);
      refetchBudget();
    },
    onError: (error) => {
      const message = error.message || "An unknown error occurred.";
      toast.error(`Failed to update budget: ${message}`);
    },
  });

  React.useEffect(() => {
    if (defenseBudget) {
      setBudgetData({
        totalBudget: defenseBudget.totalBudget ?? 0,
        gdpPercent: defenseBudget.gdpPercent ?? 0,
        personnelCosts: defenseBudget.personnelCosts ?? 0,
        operationsMaintenance: defenseBudget.operationsMaintenance ?? 0,
        procurement: defenseBudget.procurement ?? 0,
        rdteCosts: defenseBudget.rdteCosts ?? 0,
        militaryConstruction: defenseBudget.militaryConstruction ?? 0,
      });
    } else if (country) {
      // Initialize with defaults
      const defaultBudget = (country.calculatedStats.currentTotalGdp ?? 0) * 0.02; // 2% of GDP
      setBudgetData({
        totalBudget: defaultBudget,
        gdpPercent: country.calculatedStats.currentTotalGdp ? 2.0 : 0,
        personnelCosts: defaultBudget * 0.4,
        operationsMaintenance: defaultBudget * 0.3,
        procurement: defaultBudget * 0.15,
        rdteCosts: defaultBudget * 0.1,
        militaryConstruction: defaultBudget * 0.05,
      });
    }
  }, [defenseBudget, country]);

  const handleSaveBudget = () => {
    if (!countryId) {
      toast.error("Cannot update budget: missing countryId.");
      return;
    }
    if (!budgetData) {
      toast.error("Cannot update budget: missing budget data.");
      return;
    }

    const {
      totalBudget,
      gdpPercent,
      personnelCosts,
      operationsMaintenance,
      procurement,
      rdteCosts,
      militaryConstruction,
    } = budgetData;

    const payload = {
      countryId,
      fiscalYear: currentYear,
      totalBudget: totalBudget || 0,
      gdpPercent: gdpPercent || 0,
      personnelCosts: personnelCosts || 0,
      operationsMaintenance: operationsMaintenance || 0,
      procurement: procurement || 0,
      rdteCosts: rdteCosts || 0,
      militaryConstruction: militaryConstruction || 0,
    };

    for (const key in payload) {
      if (typeof (payload as any)[key] === "number" && isNaN((payload as any)[key])) {
        toast.error(`Invalid budget data: ${key} is not a number.`);
        return;
      }
    }

    updateBudget.mutate(payload);
  };

  const handleTotalBudgetChange = (value: number) => {
    // Maintain proportions when changing total budget
    const ratio = value / (budgetData.totalBudget || 1);
    setBudgetData({
      ...budgetData,
      totalBudget: value,
      personnelCosts: budgetData.personnelCosts * ratio,
      operationsMaintenance: budgetData.operationsMaintenance * ratio,
      procurement: budgetData.procurement * ratio,
      rdteCosts: budgetData.rdteCosts * ratio,
      militaryConstruction: budgetData.militaryConstruction * ratio,
      gdpPercent:
        country && country.calculatedStats.currentTotalGdp
          ? (value / country.calculatedStats.currentTotalGdp) * 100
          : budgetData.gdpPercent,
    });
  };

  const handleCategoryChange = (key: string, value: number) => {
    setBudgetData({ ...budgetData, [key]: value });
  };

  const totalAllocated =
    budgetData.personnelCosts +
    budgetData.operationsMaintenance +
    budgetData.procurement +
    budgetData.rdteCosts +
    budgetData.militaryConstruction;

  const allocationPercent =
    budgetData.totalBudget > 0 ? (totalAllocated / budgetData.totalBudget) * 100 : 0;

  // Calculate readiness metrics
  const averageReadiness =
    branches && branches.length > 0
      ? branches.reduce((sum, b) => sum + b.readinessLevel, 0) / branches.length
      : 0;

  const averageTechnology =
    branches && branches.length > 0
      ? branches.reduce((sum, b) => sum + b.technologyLevel, 0) / branches.length
      : 0;

  const averageMorale =
    branches && branches.length > 0
      ? branches.reduce((sum, b) => sum + b.morale, 0) / branches.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Defense Budget Management */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Defense Budget - FY {currentYear}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <HelpCircle className="text-muted-foreground hover:text-primary h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-green-600" />
                        Defense Budget Guide
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="mb-2 font-semibold">Budget Allocation</h4>
                        <p className="text-muted-foreground">
                          Your defense budget should total 100% allocated across all categories. The
                          system will warn you if you're over or under budget.
                        </p>
                      </div>
                      <div>
                        <h4 className="mb-2 font-semibold">Budget Categories Explained</h4>
                        <ul className="text-muted-foreground list-inside list-disc space-y-1">
                          <li>
                            <strong>Personnel (typically 35-45%):</strong> Salaries, benefits,
                            pensions for military and civilian staff
                          </li>
                          <li>
                            <strong>Operations & Maintenance (25-35%):</strong> Day-to-day
                            operations, training exercises, facility upkeep
                          </li>
                          <li>
                            <strong>Procurement (10-20%):</strong> Purchase of new equipment,
                            vehicles, ships, aircraft, and weapons
                          </li>
                          <li>
                            <strong>R&D (5-15%):</strong> Research and development of
                            next-generation military technology
                          </li>
                          <li>
                            <strong>Military Construction (3-8%):</strong> Building and upgrading
                            bases, installations, and infrastructure
                          </li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-2 font-semibold">GDP Percentage</h4>
                        <p className="text-muted-foreground">
                          Typical defense spending ranges from 1-4% of GDP. Higher percentages
                          indicate a strong military focus, while lower percentages suggest
                          prioritizing other sectors.
                        </p>
                      </div>
                      <div>
                        <h4 className="mb-2 font-semibold">Tips</h4>
                        <ul className="text-muted-foreground list-inside list-disc space-y-1">
                          <li>
                            Balance current needs (personnel, operations) with future capabilities
                            (procurement, R&D)
                          </li>
                          <li>
                            Changing total budget maintains proportional allocations automatically
                          </li>
                          <li>
                            Monitor branch budgets to ensure they sum to your total defense budget
                          </li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
              <CardDescription>Allocate resources across defense categories</CardDescription>
            </div>
            {editingBudget ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingBudget(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveBudget}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Budget
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setEditingBudget(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Budget
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Total Budget */}
          <div className="bg-muted/50 rounded-lg border p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm">Total Defense Budget</Label>
                {editingBudget ? (
                  <Input
                    type="number"
                    value={budgetData.totalBudget}
                    onChange={(e) => handleTotalBudgetChange(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-2xl font-bold">
                    $<NumberFlowDisplay value={budgetData.totalBudget} format="compact" />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">% of GDP</Label>
                <div className="mt-1 text-2xl font-bold">
                  <NumberFlowDisplay
                    value={budgetData.gdpPercent}
                    format="percentage"
                    decimalPlaces={2}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Budget Allocation Progress */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm">Budget Allocation</Label>
              <span
                className={cn(
                  "text-sm font-medium",
                  allocationPercent > 100
                    ? "text-red-600"
                    : allocationPercent < 95
                      ? "text-orange-600"
                      : "text-green-600"
                )}
              >
                <NumberFlowDisplay
                  value={allocationPercent}
                  format="percentage"
                  decimalPlaces={1}
                />{" "}
                Allocated
              </span>
            </div>
            <Progress value={Math.min(allocationPercent, 100)} className="h-2" />
            {allocationPercent > 100 && (
              <p className="mt-1 text-xs text-red-600">Over budget! Reduce allocations.</p>
            )}
          </div>

          <Separator />

          {/* Category Allocations */}
          <div className="space-y-4">
            {BUDGET_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const value = budgetData[category.key as keyof typeof budgetData] as number;
              const percent =
                budgetData.totalBudget > 0 ? (value / budgetData.totalBudget) * 100 : 0;

              return (
                <div key={category.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", category.color)} />
                      <Label className="text-sm">{category.label}</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground w-12 text-right text-xs">
                        <NumberFlowDisplay value={percent} format="percentage" decimalPlaces={1} />
                      </span>
                      {editingBudget ? (
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) =>
                            handleCategoryChange(category.key, parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-32 text-sm"
                        />
                      ) : (
                        <span className="w-32 text-right text-sm font-medium">
                          $<NumberFlowDisplay value={value} format="compact" />
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress value={percent} className="h-1" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Strategic Readiness Overview */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-red-600" />
            Strategic Readiness Overview
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <HelpCircle className="text-muted-foreground hover:text-primary h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-red-600" />
                    Strategic Readiness Metrics
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="mb-2 font-semibold">Overall Readiness</h4>
                    <p className="text-muted-foreground">
                      Measures the ability of your forces to deploy and conduct operations
                      immediately. Factors include equipment availability, personnel training, and
                      supply stockpiles.
                    </p>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">Technology Level</h4>
                    <p className="text-muted-foreground">
                      Reflects the sophistication of your military equipment and systems. Higher
                      technology levels provide tactical advantages but require more maintenance and
                      training.
                    </p>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">Force Morale</h4>
                    <p className="text-muted-foreground">
                      Indicates the motivation and esprit de corps of your military personnel. High
                      morale improves combat effectiveness and reduces desertion rates.
                    </p>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">Improving Readiness</h4>
                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                      <li>Increase operations & maintenance budget for better equipment upkeep</li>
                      <li>Invest in training programs to improve personnel competency</li>
                      <li>Modernize equipment through procurement to boost technology levels</li>
                      <li>Maintain competitive salaries and benefits to sustain morale</li>
                      <li>Conduct regular exercises to maintain operational readiness</li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>Aggregate readiness metrics across all branches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4" />
                Overall Readiness
              </div>
              <div className="text-3xl font-bold">
                <NumberFlowDisplay value={averageReadiness} format="percentage" decimalPlaces={0} />
              </div>
              <Progress value={averageReadiness} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4" />
                Technology Level
              </div>
              <div className="text-3xl font-bold">
                <NumberFlowDisplay
                  value={averageTechnology}
                  format="percentage"
                  decimalPlaces={0}
                />
              </div>
              <Progress value={averageTechnology} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                Force Morale
              </div>
              <div className="text-3xl font-bold">
                <NumberFlowDisplay value={averageMorale} format="percentage" decimalPlaces={0} />
              </div>
              <Progress value={averageMorale} className="h-2" />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Branch Summary */}
          {branches && branches.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold">Branch Status</h4>
              <div className="space-y-2">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="hover:bg-accent/50 flex items-center justify-between rounded-lg p-2"
                  >
                    <span className="text-sm">{branch.name}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground">
                        Readiness: <span className="font-medium">{branch.readinessLevel}%</span>
                      </span>
                      <span className="text-muted-foreground">
                        Budget:{" "}
                        <span className="font-medium">
                          ${(branch.annualBudget / 1000000).toFixed(0)}M
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
