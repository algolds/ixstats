"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Settings, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CountryHeader, CountryMetricsGrid, VitalityRings, useCountryData } from "./primitives";
import { MyCountryTabSystem } from "./MyCountryTabSystem";
import { useFlag } from "~/hooks/useFlag";
import { AtomicComponentSelector } from "~/components/government/atoms/AtomicGovernmentComponents";
import { TaxBuilder } from "~/components/tax-system/TaxBuilder";
import { GovernmentBuilder } from "~/components/government/GovernmentBuilder";
import { api } from "~/trpc/react";
import { MyCountryCompactHeader } from "./MyCountryCompactHeader";
import { VaultWidget } from "./VaultWidget";

interface EnhancedMyCountryContentProps {
  variant?: "unified" | "standard" | "premium";
  title?: string;
}

export function EnhancedMyCountryContent({
  variant = "unified",
  title,
}: EnhancedMyCountryContentProps) {
  const { country, activityRingsData, isLoading } = useCountryData();
  const [vitalityCollapsed, setVitalityCollapsed] = useState(false);
  const { flagUrl } = useFlag(country?.name || "");

  // Fetch existing government components
  const { data: existingComponents } = api.government.getComponents.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );

  // Fetch Defense overview metrics
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  // Prepare metrics for the grid
  const metrics = [
    {
      label: "Population",
      value: `${((country.currentPopulation || 0) / 1000000).toFixed(1)}M`,
      subtext: `${(country.currentPopulation || 0).toLocaleString()} citizens`,
      colorClass: "bg-blue-50 dark:bg-blue-950/50 text-blue-600",
      tooltip: {
        title: "Current Population",
        details: [
          `Total: ${(country.currentPopulation || 0).toLocaleString()} citizens`,
          `Population Tier: ${country.populationTier || "Unknown"}`,
        ],
      },
    },
    {
      label: "GDP/Capita",
      value: `$${((country.currentGdpPerCapita || 0) / 1000).toFixed(0)}k`,
      subtext: `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
      colorClass: "bg-green-50 dark:bg-green-950/50 text-green-600",
      tooltip: {
        title: "GDP per Capita",
        details: [
          `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
          "Economic strength indicator",
        ],
      },
    },
    {
      label: "Growth",
      value: `${((country.adjustedGdpGrowth || 0) * 100).toFixed(2)}%`,
      subtext: "Adjusted GDP growth rate",
      colorClass: "bg-purple-50 dark:bg-purple-950/50 text-purple-600",
      tooltip: {
        title: "Economic Growth Rate",
        details: [
          "Adjusted GDP growth rate after global factors",
          (country.adjustedGdpGrowth || 0) > 0.05
            ? "Strong growth"
            : (country.adjustedGdpGrowth || 0) > 0.02
              ? "Moderate growth"
              : (country.adjustedGdpGrowth || 0) > 0
                ? "Slow growth"
                : "Declining",
        ],
      },
    },
    {
      label: "Economic Tier",
      value: country.economicTier || "Unknown",
      subtext: "Development classification",
      colorClass: "bg-orange-50 dark:bg-orange-950/50 text-orange-600",
      tooltip: {
        title: "Economic Development Tier",
        details: [
          "Based on GDP per capita and economic indicators",
          `Current classification: ${country.economicTier || "Unknown"}`,
        ],
      },
    },
  ];

  // Add atomic governance metrics
  if (existingComponents && existingComponents.length > 0) {
    const avgEffectiveness =
      existingComponents.reduce((sum, c) => sum + c.effectivenessScore, 0) /
      existingComponents.length;
    const totalComponents = existingComponents.length;

    metrics.push({
      label: "Gov Score",
      value: `${avgEffectiveness.toFixed(0)}%`,
      subtext: `${totalComponents} atomic components`,
      colorClass: "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600",
      tooltip: {
        title: "Government Effectiveness",
        details: [
          `Average effectiveness: ${avgEffectiveness.toFixed(1)}%`,
          `${totalComponents} government components active`,
          "Based on atomic component analysis",
        ],
      },
    });
  }

  // Add Defense metrics
  if (defenseOverview) {
    metrics.push({
      label: "Security",
      value: `${defenseOverview.overallScore}`,
      subtext: defenseOverview.securityLevel.replace("_", " "),
      colorClass:
        defenseOverview.overallScore >= 75
          ? "bg-green-50 dark:bg-green-950/50 text-green-600"
          : defenseOverview.overallScore >= 50
            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600"
            : defenseOverview.overallScore >= 25
              ? "bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600"
              : "bg-red-50 dark:bg-red-950/50 text-red-600",
      tooltip: {
        title: "National Security Status",
        details: [
          `Overall Score: ${defenseOverview.overallScore}/100`,
          `Security Level: ${defenseOverview.securityLevel.replace("_", " ").toUpperCase()}`,
          `Military Strength: ${defenseOverview.militaryStrength}%`,
          `${defenseOverview.branchCount} military branches`,
          `${defenseOverview.activeThreats} active threats`,
        ],
      },
    });
  }

  const vitalityData = activityRingsData || {
    economicVitality: 0,
    populationWellbeing: 0,
    diplomaticStanding: 0,
    governmentalEfficiency: 0,
  };

  return (
    <div className="space-y-0">
      {/* Compact Header with Inline Nav */}
      <MyCountryCompactHeader
        country={{
          name: country.name,
          id: country.id,
        }}
        flagUrl={flagUrl}
        currentPage="overview"
      />

      <div className="container mx-auto space-y-6 px-4 py-4 sm:py-6 md:py-8">
        {/* Main Layout */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-4 xl:gap-6">
        {/* Left Sidebar - National Vitality Index */}
        {variant === "unified" && (
          <div className="lg:col-span-1" id="vitality">
            <Card className="glass-hierarchy-parent lg:sticky lg:top-6 overflow-hidden border-indigo-200 dark:border-indigo-700/40 dark:shadow-indigo-900/10">
              {/* Flag Background with Subtle Depth */}
              <div className="absolute inset-0">
                {flagUrl ? (
                  <>
                    <div className="absolute inset-0 z-[1] bg-gradient-to-br from-black/10 via-transparent to-black/20" />
                    <div className="group ripple-effect relative h-full w-full overflow-hidden">
                      <img
                        src={flagUrl}
                        alt={`${country.name} flag`}
                        className="h-full w-full scale-125 object-cover opacity-35 shadow-inner transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          console.log("Flag failed to load:", flagUrl);
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-indigo-50/85 via-purple-50/85 to-pink-50/85 transition-opacity duration-300 group-hover:opacity-90 dark:from-indigo-900/15 dark:via-purple-900/10 dark:to-pink-800/8 dark:backdrop-blur-[2px]" />
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/12 dark:to-purple-800/8 dark:backdrop-blur-[1px]" />
                )}
              </div>

              <div className="relative z-20">
                <CardHeader className={vitalityCollapsed ? "px-4 py-2" : ""}>
                  <div className="flex items-center justify-between">
                    <CardTitle className={vitalityCollapsed ? "text-sm font-medium" : ""}>
                      {vitalityCollapsed ? "Vitality" : "National Vitality Index"}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVitalityCollapsed(!vitalityCollapsed)}
                      className={vitalityCollapsed ? "h-4 w-4 p-0" : "h-8 w-8 p-0"}
                    >
                      {vitalityCollapsed ? (
                        <ChevronDown className="h-2 w-2" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className={vitalityCollapsed ? "px-4 py-2" : ""}>
                  {!vitalityCollapsed && (
                    <div className="mt-6">
                      <VitalityRings data={vitalityData} variant="sidebar" />
                    </div>
                  )}
                </CardContent>
              </div>
            </Card>

            {/* VaultWidget - IxCards Integration */}
            <div className="mt-4 sm:mt-6">
              <VaultWidget />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className={variant === "unified" ? "lg:col-span-3 space-y-4 sm:space-y-6" : "col-span-full space-y-4 sm:space-y-6"}>
          {/* Atomic Government Integration Alert */}
          {existingComponents && existingComponents.length > 0 && (
            <Alert className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-3 sm:p-4">
              <Settings className="h-4 w-4 flex-shrink-0" />
              <AlertDescription>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <div className="text-xs sm:text-sm">
                    <strong>Atomic Government System Active:</strong> {existingComponents.length}{" "}
                    components deployed with{" "}
                    {(
                      existingComponents.reduce((sum, c) => sum + c.effectivenessScore, 0) /
                      existingComponents.length
                    ).toFixed(0)}
                    % average effectiveness.
                  </div>
                  <Badge variant="secondary" className="sm:ml-2 w-fit flex-shrink-0">
                    <Zap className="mr-1 h-3 w-3" />
                    <span className="text-xs">Enhanced Analytics</span>
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Metrics Grid for non-unified variants */}
          {variant !== "unified" && (
            <CountryMetricsGrid
              metrics={metrics}
              variant={variant === "premium" ? "executive" : "standard"}
            />
          )}

          {/* Vitality Rings for non-unified variants */}
          {variant !== "unified" && activityRingsData && (
            <VitalityRings data={vitalityData} variant="grid" />
          )}

          {/* Tab System */}
          <div id="tabs">
            <MyCountryTabSystem variant={variant} />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
