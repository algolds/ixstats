"use client";

import React, { useMemo } from "react";
import { formatExactCurrency } from "~/lib/utils";
import { Card, CardContent } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  WarningTriangle as AlertTriangle,
  WarningCircle as AlertCircle,
  InfoCircle as Info,
} from "iconoir-react";
import {
  type TaxEconomySyncProps,
  determineEconomicTier,
  calculateTaxBurdenAnalysis,
  calculateTierRecommendation,
  calculateEconomicImpact,
  TaxSyncHeader,
  TaxBurdenTab,
  TaxRecommendationsTab,
  TaxImpactsTab,
  TaxBenchmarksTab,
} from "./sync";

export function TaxEconomySyncDisplay({
  taxSystem,
  economicData,
  onOptimize = () => {},
  className = "",
  currency = "USD",
}: TaxEconomySyncProps) {
  // Determine economic tier based on GDP per capita
  const economicTier = useMemo(() => {
    return determineEconomicTier(economicData?.core);
  }, [economicData?.core]);

  // Calculate tax burden by income class
  const taxBurdenAnalysis = useMemo(() => {
    return calculateTaxBurdenAnalysis(taxSystem, economicData?.labor);
  }, [taxSystem, economicData?.labor]);

  // Calculate tier-based recommendations
  const tierRecommendation = useMemo(() => {
    return calculateTierRecommendation(economicTier, taxSystem, taxBurdenAnalysis);
  }, [economicTier, taxSystem, taxBurdenAnalysis]);

  // Calculate economic impacts
  const economicImpact = useMemo(() => {
    return calculateEconomicImpact(
      taxSystem,
      economicData,
      taxBurdenAnalysis,
      tierRecommendation
    );
  }, [taxSystem, economicData, taxBurdenAnalysis, tierRecommendation]);

  // Format helpers
  const formatCurrency = (amount: number) => {
    return formatExactCurrency(amount, currency);
  };

  const formatPercentage = (rate: number) => {
    return `${rate.toFixed(1)}%`;
  };

  if (!taxSystem || !economicData?.core) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Info className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">
            Configure tax system and economic data to view economic impact analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Overall Score */}
      <TaxSyncHeader
        economicTier={economicTier}
        tierRecommendation={tierRecommendation}
        economicImpact={economicImpact}
        gdpPerCapita={economicData.core.gdpPerCapita}
        formatCurrency={formatCurrency}
        formatPercentage={formatPercentage}
        onOptimize={onOptimize}
      />

      {/* Alerts */}
      {tierRecommendation.currentAlignment === "overtaxed" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>High Tax Burden Warning:</strong> Current tax rates exceed recommended levels
            for {economicTier} economies, potentially limiting economic growth and competitiveness.
          </AlertDescription>
        </Alert>
      )}

      {taxBurdenAnalysis.some((t) => t.status === "excessive") && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Excessive Tax Burden:</strong> Some income classes face tax rates above 45%,
            which may drive tax evasion and capital flight.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="burden" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="burden">Tax Burden</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="impacts">Economic Impacts</TabsTrigger>
          <TabsTrigger value="benchmarks">Tier Benchmarks</TabsTrigger>
        </TabsList>

        {/* Tax Burden by Income Class */}
        <TabsContent value="burden" className="space-y-4">
          <TaxBurdenTab
            taxBurdenAnalysis={taxBurdenAnalysis}
            formatCurrency={formatCurrency}
            formatPercentage={formatPercentage}
          />
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations" className="space-y-4">
          <TaxRecommendationsTab tierRecommendation={tierRecommendation} />
        </TabsContent>

        {/* Economic Impacts */}
        <TabsContent value="impacts" className="space-y-4">
          <TaxImpactsTab
            economicImpact={economicImpact}
            formatPercentage={formatPercentage}
          />
        </TabsContent>

        {/* Tier Benchmarks */}
        <TabsContent value="benchmarks" className="space-y-4">
          <TaxBenchmarksTab
            economicTier={economicTier}
            tierRecommendation={tierRecommendation}
            taxSystem={taxSystem}
            formatPercentage={formatPercentage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
