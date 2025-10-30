"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Settings,
  TrendingUp,
  AlertTriangle,
  Info,
  CheckCircle,
  Zap,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  AtomicComponentSelector,
  ATOMIC_COMPONENTS,
  ComponentType,
  calculateGovernmentEffectiveness,
  checkGovernmentSynergy,
  checkGovernmentConflict,
} from "~/components/government/atoms/AtomicGovernmentComponents";
import { api } from "~/trpc/react";
import { usePendingLocks } from "../hooks/usePendingLocks";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";

interface GovernmentSectionEnhancedProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  showAdvanced?: boolean;
  countryId: string;
  onGovernmentChange?: (components: ComponentType[]) => void;
}

export function GovernmentSectionEnhanced({
  inputs,
  onInputsChange,
  showAdvanced = false,
  countryId,
  onGovernmentChange,
}: GovernmentSectionEnhancedProps) {
  const [activeTab, setActiveTab] = useState("components");
  const [selectedComponents, setSelectedComponents] = useState<ComponentType[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const { isLocked } = usePendingLocks();

  // Fetch existing government components
  const {
    data: existingComponents,
    isLoading: componentsLoading,
    refetch: refetchComponents,
  } = api.atomicGovernment.getComponents.useQuery(
    { countryId: countryId || "placeholder" },
    {
      enabled: !!countryId && countryId.length > 0,
      retry: false,
    }
  );

  // Fetch effectiveness analysis
  const { data: effectivenessData, refetch: refetchEffectiveness } =
    api.atomicGovernment.getEffectivenessAnalysis.useQuery(
      { countryId: countryId || "placeholder" },
      {
        enabled: !!countryId && countryId.length > 0,
        retry: false,
      }
    );

  // Mutations
  const createComponentMutation = api.atomicGovernment.createComponent.useMutation();
  const removeComponentMutation = api.atomicGovernment.removeComponent.useMutation();

  // Initialize selected components from database
  useEffect(() => {
    if (existingComponents && existingComponents.length > 0) {
      const componentTypes = existingComponents.map((c: any) => c.componentType);
      setSelectedComponents(componentTypes);
    }
  }, [existingComponents]);

  // Calculate effectiveness metrics
  const effectivenessMetrics = calculateGovernmentEffectiveness(selectedComponents);

  // Get synergies and conflicts
  const synergies: Array<{ comp1: ComponentType; comp2: ComponentType; bonus: number }> = [];
  const conflicts: Array<{ comp1: ComponentType; comp2: ComponentType }> = [];

  for (let i = 0; i < selectedComponents.length; i++) {
    for (let j = i + 1; j < selectedComponents.length; j++) {
      const comp1 = selectedComponents[i]!;
      const comp2 = selectedComponents[j]!;

      const synergyBonus = checkGovernmentSynergy(comp1, comp2);
      if (synergyBonus > 0) {
        synergies.push({ comp1, comp2, bonus: synergyBonus });
      }

      if (checkGovernmentConflict(comp1, comp2)) {
        conflicts.push({ comp1, comp2 });
      }
    }
  }

  // Handle component selection changes
  const handleComponentChange = (components: ComponentType[]) => {
    setSelectedComponents(components);
    setHasChanges(true);

    if (onGovernmentChange) {
      onGovernmentChange(components);
    }
  };

  // Save components to database
  const handleSave = async () => {
    if (!countryId) return;

    try {
      // Get existing component IDs to compare
      const existingComponentTypes = new Set(
        (existingComponents || []).map((c) => c.componentType)
      );
      const selectedComponentTypes = new Set(selectedComponents);

      // Find components to add (in selected but not in existing)
      const componentsToAdd = selectedComponents.filter(
        (type) => !existingComponentTypes.has(type)
      );

      // Find components to remove (in existing but not in selected)
      const componentsToRemove = (existingComponents || [])
        .filter((c: any) => !selectedComponentTypes.has(c.componentType))
        .map((c: any) => c.id);

      // Add new components
      for (const componentType of componentsToAdd) {
        const componentData = ATOMIC_COMPONENTS[componentType];
        if (componentData) {
          await createComponentMutation.mutateAsync({
            countryId,
            componentType,
            effectivenessScore: componentData.effectiveness,
            implementationCost: componentData.implementationCost,
            maintenanceCost: componentData.maintenanceCost,
            requiredCapacity: componentData.requiredCapacity,
          });
        }
      }

      // Remove deselected components
      for (const componentId of componentsToRemove) {
        await removeComponentMutation.mutateAsync({ id: componentId });
      }

      // Refetch data
      await refetchComponents();
      await refetchEffectiveness();

      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save government components:", error);
    }
  };

  // Get effectiveness status
  const getEffectivenessStatus = (score: number) => {
    if (score >= 85) return { color: "green", label: "Excellent", variant: "default" as const };
    if (score >= 70) return { color: "blue", label: "Good", variant: "default" as const };
    if (score >= 55) return { color: "amber", label: "Fair", variant: "default" as const };
    return { color: "red", label: "Poor", variant: "destructive" as const };
  };

  const effectivenessStatus = getEffectivenessStatus(effectivenessMetrics.totalEffectiveness);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="h-5 w-5" />
            Atomic Government Structure
          </h3>
          <p className="text-muted-foreground text-sm">
            Build your government from modular atomic components with synergy effects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={effectivenessStatus.variant} className="px-3 py-1">
            {effectivenessStatus.label}: {effectivenessMetrics.totalEffectiveness.toFixed(0)}%
          </Badge>
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={createComponentMutation.isPending || removeComponentMutation.isPending}
              size="sm"
            >
              {createComponentMutation.isPending || removeComponentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{selectedComponents.length}</p>
                <p className="text-muted-foreground text-xs">Active Components</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{synergies.length}</p>
                <p className="text-muted-foreground text-xs">Synergies</p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  +{effectivenessMetrics.synergyBonus.toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{conflicts.length}</p>
                <p className="text-muted-foreground text-xs">Conflicts</p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  -{effectivenessMetrics.conflictPenalty.toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2 bg-${effectivenessStatus.color}-100 dark:bg-${effectivenessStatus.color}-900/30`}
              >
                <TrendingUp
                  className={`h-5 w-5 text-${effectivenessStatus.color}-600 dark:text-${effectivenessStatus.color}-400`}
                />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {effectivenessMetrics.totalEffectiveness.toFixed(0)}%
                </p>
                <p className="text-muted-foreground text-xs">Effectiveness</p>
                <p className="text-muted-foreground text-xs">{effectivenessStatus.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="synergies">Synergies & Conflicts</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* Components Tab */}
        <TabsContent value="components" className="mt-6 space-y-6">
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5" />
                Select Government Components
              </CardTitle>
              <CardDescription>
                Choose 3-10 atomic components to build your government structure. Each component has
                unique effects, costs, and interactions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {componentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                </div>
              ) : (
                <AtomicComponentSelector
                  initialComponents={selectedComponents}
                  onChange={handleComponentChange}
                  maxComponents={10}
                  isReadOnly={isLocked("governmentComponents")}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Synergies & Conflicts Tab */}
        <TabsContent value="synergies" className="mt-6 space-y-6">
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-green-600" />
                Synergies
              </CardTitle>
              <CardDescription>
                Component combinations that increase government effectiveness (+10 each)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {synergies.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No synergies detected. Select complementary components to unlock synergy
                    bonuses.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {synergies.map((synergy, idx) => {
                    const comp1Data = ATOMIC_COMPONENTS[synergy.comp1];
                    const comp2Data = ATOMIC_COMPONENTS[synergy.comp2];
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
                      >
                        <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {comp1Data?.name} + {comp2Data?.name}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {comp1Data?.description}
                          </p>
                        </div>
                        <Badge variant="default" className="bg-green-600">
                          +{synergy.bonus}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <XCircle className="h-5 w-5 text-red-600" />
                Conflicts
              </CardTitle>
              <CardDescription>
                Component combinations that reduce government effectiveness (-15 each)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conflicts.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    No conflicts detected. Your government components work harmoniously together.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {conflicts.map((conflict, idx) => {
                    const comp1Data = ATOMIC_COMPONENTS[conflict.comp1];
                    const comp2Data = ATOMIC_COMPONENTS[conflict.comp2];
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
                      >
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {comp1Data?.name} + {comp2Data?.name}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            These components have conflicting implementation approaches
                          </p>
                        </div>
                        <Badge variant="destructive">-15</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="mt-6 space-y-6">
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">Government Effectiveness Analysis</CardTitle>
              <CardDescription>Comprehensive analysis of your government structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">Base Effectiveness</p>
                  <p className="text-2xl font-bold">
                    {effectivenessMetrics.baseEffectiveness.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Effectiveness</p>
                  <p className="text-2xl font-bold">
                    {effectivenessMetrics.totalEffectiveness.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Synergy Bonus</p>
                  <p className="text-2xl font-bold text-green-600">
                    +{effectivenessMetrics.synergyBonus.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Conflict Penalty</p>
                  <p className="text-2xl font-bold text-red-600">
                    -{effectivenessMetrics.conflictPenalty.toFixed(1)}%
                  </p>
                </div>
              </div>

              {effectivenessData && (
                <>
                  <div className="border-t pt-4">
                    <p className="mb-2 text-sm font-medium">Total Costs</p>
                    <p className="text-xl">
                      ${effectivenessData.totalCost?.toLocaleString() ?? "0"}
                    </p>
                  </div>

                  {effectivenessData.recommendations.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="mb-2 text-sm font-medium">Recommendations</p>
                      <ul className="space-y-2">
                        {effectivenessData.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {rec}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {effectivenessData?.categoryBreakdown &&
            Object.keys(effectivenessData.categoryBreakdown).length > 0 && (
              <Card className="glass-surface">
                <CardHeader>
                  <CardTitle className="text-base">Category Breakdown</CardTitle>
                  <CardDescription>Component distribution across categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(effectivenessData.categoryBreakdown).map(
                      ([category, data]: [string, any]) => (
                        <div
                          key={category}
                          className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50"
                        >
                          <div>
                            <p className="text-sm font-medium">{category}</p>
                            <p className="text-muted-foreground text-xs">
                              {data.count} component{data.count !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{data.avgEffectiveness.toFixed(0)}%</p>
                            <p className="text-muted-foreground text-xs">Avg. Effectiveness</p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
