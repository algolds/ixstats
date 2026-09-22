"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Archery as Target, InfoCircle as Info } from "iconoir-react";
import type { TaxSystem } from "~/types/tax-system";
import type { EconomicTierRecommendation } from "./taxSyncTypes";

interface TaxBenchmarksTabProps {
  economicTier: EconomicTierRecommendation["tier"];
  tierRecommendation: EconomicTierRecommendation;
  taxSystem: TaxSystem;
  formatPercentage: (rate: number) => string;
}

export function TaxBenchmarksTab({
  economicTier,
  tierRecommendation,
  taxSystem,
  formatPercentage,
}: TaxBenchmarksTabProps) {
  const incomeCategory = taxSystem.taxCategories?.find((cat) =>
    cat.categoryName.toLowerCase().includes("income")
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {economicTier} Economy Benchmarks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Income Tax Benchmark */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Personal Income Tax</span>
            <span className="text-muted-foreground text-sm">
              Recommended: {formatPercentage(tierRecommendation.recommendedIncomeTaxRange[0])} -{" "}
              {formatPercentage(tierRecommendation.recommendedIncomeTaxRange[1])}
            </span>
          </div>
          <div className="relative">
            <Progress
              value={
                (tierRecommendation.recommendedIncomeTaxRange[0] +
                  tierRecommendation.recommendedIncomeTaxRange[1]) /
                2
              }
              className="h-3"
            />
            {incomeCategory && (
              <div
                className="absolute top-0 h-3 w-1 bg-red-500"
                style={{
                  left: `${incomeCategory.baseRate || 0}%`,
                }}
              />
            )}
          </div>
        </div>

        {/* Corporate Tax Benchmark */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Corporate Income Tax</span>
            <span className="text-muted-foreground text-sm">
              Recommended: {formatPercentage(tierRecommendation.recommendedCorporateTaxRange[0])} -{" "}
              {formatPercentage(tierRecommendation.recommendedCorporateTaxRange[1])}
            </span>
          </div>
          <Progress
            value={
              (tierRecommendation.recommendedCorporateTaxRange[0] +
                tierRecommendation.recommendedCorporateTaxRange[1]) /
              2
            }
            className="h-3"
          />
        </div>

        {/* Sales Tax Benchmark */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Sales Tax / VAT</span>
            <span className="text-muted-foreground text-sm">
              Recommended: {formatPercentage(tierRecommendation.recommendedSalesTaxRange[0])} -{" "}
              {formatPercentage(tierRecommendation.recommendedSalesTaxRange[1])}
            </span>
          </div>
          <Progress
            value={
              (tierRecommendation.recommendedSalesTaxRange[0] +
                tierRecommendation.recommendedSalesTaxRange[1]) /
              2
            }
            className="h-3"
          />
        </div>

        {/* Max Tax Burden */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Maximum Recommended Tax Burden</span>
            <span className="text-2xl font-bold" style={{ color: tierRecommendation.color }}>
              {formatPercentage(tierRecommendation.maxTaxBurden)}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Total effective tax rate across all income levels should not exceed this threshold
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            These benchmarks are based on international best practices for {economicTier}{" "}
            economies. Adjust based on your country&apos;s specific circumstances, social
            priorities, and development goals.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
