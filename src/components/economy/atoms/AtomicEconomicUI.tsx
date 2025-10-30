"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Target,
  DollarSign,
  Users,
  Building2,
  Globe,
  Lightbulb,
  Leaf,
} from "lucide-react";
import { EconomicComponentType } from "./AtomicEconomicComponents";
import type { AtomicEconomicComponent } from "~/lib/atomic-economic-data";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";

// ============================================
// ECONOMIC COMPONENT CARD
// ============================================

interface EconomicComponentCardProps {
  component: AtomicEconomicComponent;
  isSelected: boolean;
  onToggle: () => void;
  isDisabled?: boolean;
  showDetails?: boolean;
  className?: string;
}

export const EconomicComponentCard: React.FC<EconomicComponentCardProps> = ({
  component,
  isSelected,
  onToggle,
  isDisabled = false,
  showDetails = false,
  className = "",
}) => {
  const getEffectivenessColor = (effectiveness: number) => {
    if (effectiveness >= 85) return "text-green-600 dark:text-green-400";
    if (effectiveness >= 70) return "text-blue-600 dark:text-blue-400";
    if (effectiveness >= 55) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getEffectivenessBg = (effectiveness: number) => {
    if (effectiveness >= 85) return "bg-green-100 dark:bg-green-900/20";
    if (effectiveness >= 70) return "bg-blue-100 dark:bg-blue-900/20";
    if (effectiveness >= 55) return "bg-yellow-100 dark:bg-yellow-900/20";
    return "bg-red-100 dark:bg-red-900/20";
  };

  return (
    <motion.div
      whileHover={{ scale: isDisabled ? 1 : 1.02 }}
      whileTap={{ scale: isDisabled ? 1 : 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={`cursor-pointer transition-all duration-200 ${
          isSelected
            ? "bg-blue-50 shadow-lg ring-2 ring-blue-500 dark:bg-blue-900/20"
            : isDisabled
              ? "cursor-not-allowed opacity-50"
              : "hover:shadow-md hover:ring-2 hover:ring-gray-300"
        } ${className}`}
        onClick={isDisabled ? undefined : onToggle}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className={`rounded-lg p-2 ${getEffectivenessBg(component.effectiveness)}`}>
              <component.icon
                className={`h-5 w-5 ${getEffectivenessColor(component.effectiveness)}`}
              />
            </div>
            <div className="flex items-center space-x-2">
              {isSelected && <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
              <Badge variant={isSelected ? "default" : "secondary"} className="text-xs">
                {component.effectiveness}%
              </Badge>
            </div>
          </div>
          <CardTitle className="text-sm leading-tight">{component.name}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          <p className="text-muted-foreground text-xs leading-relaxed">{component.description}</p>

          {/* Effectiveness Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Effectiveness</span>
              <span className={getEffectivenessColor(component.effectiveness)}>
                {component.effectiveness}%
              </span>
            </div>
            <Progress
              value={component.effectiveness}
              className="h-2"
              style={{
                background: `linear-gradient(to right, ${
                  component.effectiveness >= 85
                    ? "#22c55e"
                    : component.effectiveness >= 70
                      ? "#3b82f6"
                      : component.effectiveness >= 55
                        ? "#eab308"
                        : "#ef4444"
                }, transparent)`,
              }}
            />
          </div>

          {showDetails && (
            <div className="space-y-2 border-t pt-2">
              {/* Synergies */}
              {component.synergies.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center space-x-1">
                    <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      Synergies ({component.synergies.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {component.synergies.slice(0, 3).map((synergy) => (
                      <Badge key={synergy} variant="outline" className="text-xs">
                        {ATOMIC_ECONOMIC_COMPONENTS[synergy]?.name || synergy}
                      </Badge>
                    ))}
                    {component.synergies.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{component.synergies.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Conflicts */}
              {component.conflicts.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center space-x-1">
                    <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      Conflicts ({component.conflicts.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {component.conflicts.slice(0, 3).map((conflict) => (
                      <Badge key={conflict} variant="outline" className="text-xs">
                        {ATOMIC_ECONOMIC_COMPONENTS[conflict]?.name || conflict}
                      </Badge>
                    ))}
                    {component.conflicts.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{component.conflicts.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Tax Impact */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Corp Tax:</span>
                  <span className="ml-1 font-medium">
                    {component.taxImpact.optimalCorporateRate}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Income Tax:</span>
                  <span className="ml-1 font-medium">{component.taxImpact.optimalIncomeRate}%</span>
                </div>
              </div>

              {/* Employment Impact */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Unemployment:</span>
                  <span
                    className={`ml-1 font-medium ${
                      component.employmentImpact.unemploymentModifier < 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {component.employmentImpact.unemploymentModifier > 0 ? "+" : ""}
                    {component.employmentImpact.unemploymentModifier.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Participation:</span>
                  <span
                    className={`ml-1 font-medium ${
                      component.employmentImpact.participationModifier > 1
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {component.employmentImpact.participationModifier > 1 ? "+" : ""}
                    {((component.employmentImpact.participationModifier - 1) * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Wage Growth:</span>
                  <span
                    className={`ml-1 font-medium ${
                      component.employmentImpact.wageGrowthModifier > 1
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {component.employmentImpact.wageGrowthModifier > 1 ? "+" : ""}
                    {((component.employmentImpact.wageGrowthModifier - 1) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ============================================
// ECONOMIC EFFECTIVENESS METER
// ============================================

interface EconomicEffectivenessProps {
  selectedComponents: EconomicComponentType[];
  maxComponents?: number;
  className?: string;
}

export const EconomicEffectiveness: React.FC<EconomicEffectivenessProps> = ({
  selectedComponents,
  maxComponents = 12,
  className = "",
}) => {
  const calculateEffectiveness = () => {
    if (selectedComponents.length === 0) return 0;

    const totalEffectiveness = selectedComponents.reduce(
      (sum, comp) => sum + (ATOMIC_ECONOMIC_COMPONENTS[comp]?.effectiveness || 0),
      0
    );

    const baseEffectiveness = totalEffectiveness / selectedComponents.length;

    // Calculate synergy bonuses
    let synergyBonus = 0;
    let conflictPenalty = 0;

    selectedComponents.forEach((comp1) => {
      selectedComponents.forEach((comp2) => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
          if (component1?.synergies.includes(comp2)) {
            synergyBonus += 2; // 2% bonus per synergy
          }
          if (component1?.conflicts.includes(comp2)) {
            conflictPenalty += 5; // 5% penalty per conflict
          }
        }
      });
    });

    return Math.max(0, Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty));
  };

  const calculateSynergies = () => {
    let synergyCount = 0;
    let conflictCount = 0;

    selectedComponents.forEach((comp1) => {
      selectedComponents.forEach((comp2) => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
          if (component1?.synergies.includes(comp2)) synergyCount++;
          if (component1?.conflicts.includes(comp2)) conflictCount++;
        }
      });
    });

    return { synergyCount, conflictCount };
  };

  const effectiveness = calculateEffectiveness();
  const { synergyCount, conflictCount } = calculateSynergies();
  const utilizationPercent = (selectedComponents.length / maxComponents) * 100;

  const getEffectivenessColor = (value: number) => {
    if (value >= 85) return "text-green-600 dark:text-green-400";
    if (value >= 70) return "text-blue-600 dark:text-blue-400";
    if (value >= 55) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getEffectivenessBg = (value: number) => {
    if (value >= 85) return "from-green-500 to-green-600";
    if (value >= 70) return "from-blue-500 to-blue-600";
    if (value >= 55) return "from-yellow-500 to-yellow-600";
    return "from-red-500 to-red-600";
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        {/* Main Effectiveness Display */}
        <div className="text-center">
          <div className="relative inline-block">
            <div className={`text-4xl font-bold ${getEffectivenessColor(effectiveness)}`}>
              {effectiveness.toFixed(0)}%
            </div>
            <div className="text-muted-foreground mt-1 text-sm">Overall Effectiveness</div>
          </div>
        </div>

        {/* Effectiveness Progress Ring */}
        <div className="flex justify-center">
          <div className="relative h-24 w-24">
            <svg className="h-24 w-24 -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${effectiveness * 2.51} 251`}
                className={`transition-all duration-500 ${getEffectivenessColor(effectiveness)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-lg font-bold ${getEffectivenessColor(effectiveness)}`}>
                  {selectedComponents.length}
                </div>
                <div className="text-muted-foreground text-xs">Components</div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {synergyCount}
              </span>
            </div>
            <div className="text-muted-foreground text-xs">Synergies</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-lg font-bold text-red-600 dark:text-red-400">
                {conflictCount}
              </span>
            </div>
            <div className="text-muted-foreground text-xs">Conflicts</div>
          </div>
        </div>

        {/* Utilization Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Component Utilization</span>
            <span className="text-muted-foreground">
              {selectedComponents.length}/{maxComponents}
            </span>
          </div>
          <Progress value={utilizationPercent} className="h-2" />
        </div>

        {/* Status Indicators */}
        <div className="flex justify-center space-x-4">
          {effectiveness >= 80 && (
            <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Optimal</span>
            </div>
          )}
          {effectiveness >= 60 && effectiveness < 80 && (
            <div className="flex items-center space-x-1 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Good</span>
            </div>
          )}
          {effectiveness < 60 && (
            <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Needs Work</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// ============================================
// ECONOMIC SYNERGY INDICATOR
// ============================================

interface EconomicSynergyIndicatorProps {
  component1: EconomicComponentType;
  component2: EconomicComponentType;
  type: "synergy" | "conflict";
  className?: string;
}

export const EconomicSynergyIndicator: React.FC<EconomicSynergyIndicatorProps> = ({
  component1,
  component2,
  type,
  className = "",
}) => {
  const comp1 = ATOMIC_ECONOMIC_COMPONENTS[component1];
  const comp2 = ATOMIC_ECONOMIC_COMPONENTS[component2];

  if (!comp1 || !comp2) return null;

  const isSynergy = type === "synergy";
  const Icon = isSynergy ? TrendingUp : TrendingDown;
  const color = isSynergy ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  const bgColor = isSynergy ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center space-x-2 rounded-lg p-2 ${bgColor} ${className}`}
    >
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="flex items-center space-x-1">
        <comp1.icon className="text-muted-foreground h-3 w-3" />
        <span className="text-muted-foreground text-xs">+</span>
        <comp2.icon className="text-muted-foreground h-3 w-3" />
      </div>
      <span className={`text-xs font-medium ${color}`}>{isSynergy ? "Synergy" : "Conflict"}</span>
    </motion.div>
  );
};

// ============================================
// ECONOMIC IMPACT PREVIEW
// ============================================

interface EconomicImpactPreviewProps {
  selectedComponents: EconomicComponentType[];
  className?: string;
}

export const EconomicImpactPreview: React.FC<EconomicImpactPreviewProps> = ({
  selectedComponents,
  className = "",
}) => {
  const calculateSectorImpact = () => {
    const sectors = [
      "agriculture",
      "manufacturing",
      "services",
      "technology",
      "finance",
      "government",
    ];
    const impacts: Record<string, number> = {};

    sectors.forEach((sector) => {
      impacts[sector] =
        selectedComponents.reduce((sum, compType) => {
          const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
          return sum + (component?.sectorImpact[sector] || 1);
        }, 0) / selectedComponents.length || 1;
    });

    return impacts;
  };

  const calculateEmploymentImpact = () => {
    return selectedComponents.reduce(
      (sum, compType) => {
        const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
        return {
          unemployment: sum.unemployment + (component?.employmentImpact.unemploymentModifier || 0),
          participation:
            sum.participation + (component?.employmentImpact.participationModifier || 1),
          wageGrowth: sum.wageGrowth + (component?.employmentImpact.wageGrowthModifier || 1),
        };
      },
      { unemployment: 0, participation: 1, wageGrowth: 1 }
    );
  };

  const calculateTaxImpact = () => {
    const corporateRates = selectedComponents.map((compType) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      return component?.taxImpact.optimalCorporateRate || 25;
    });

    const incomeRates = selectedComponents.map((compType) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      return component?.taxImpact.optimalIncomeRate || 30;
    });

    return {
      corporate: corporateRates.reduce((a, b) => a + b, 0) / corporateRates.length,
      income: incomeRates.reduce((a, b) => a + b, 0) / incomeRates.length,
    };
  };

  const sectorImpacts = calculateSectorImpact();
  const employmentImpacts = calculateEmploymentImpact();
  const taxImpacts = calculateTaxImpact();

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Economic Impact Preview</h3>

        {/* Sector Impacts */}
        <div>
          <h4 className="mb-2 text-sm font-medium">Sector Performance</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(sectorImpacts).map(([sector, impact]) => (
              <div key={sector} className="flex items-center justify-between text-xs">
                <span className="capitalize">{sector}</span>
                <span
                  className={`font-medium ${
                    impact > 1.1
                      ? "text-green-600 dark:text-green-400"
                      : impact > 0.9
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {((impact - 1) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Employment Impacts */}
        <div>
          <h4 className="mb-2 text-sm font-medium">Employment Impact</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div
                className={`font-medium ${
                  employmentImpacts.unemployment < 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {employmentImpacts.unemployment > 0 ? "+" : ""}
                {employmentImpacts.unemployment.toFixed(1)}%
              </div>
              <div className="text-muted-foreground">Unemployment</div>
            </div>
            <div className="text-center">
              <div
                className={`font-medium ${
                  employmentImpacts.participation > 1
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {((employmentImpacts.participation - 1) * 100).toFixed(1)}%
              </div>
              <div className="text-muted-foreground">Participation</div>
            </div>
            <div className="text-center">
              <div
                className={`font-medium ${
                  employmentImpacts.wageGrowth > 1
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {((employmentImpacts.wageGrowth - 1) * 100).toFixed(1)}%
              </div>
              <div className="text-muted-foreground">Wage Growth</div>
            </div>
          </div>
        </div>

        {/* Tax Recommendations */}
        <div>
          <h4 className="mb-2 text-sm font-medium">Optimal Tax Rates</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Corporate Tax:</span>
              <span className="font-medium">{taxImpacts.corporate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Income Tax:</span>
              <span className="font-medium">{taxImpacts.income.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
