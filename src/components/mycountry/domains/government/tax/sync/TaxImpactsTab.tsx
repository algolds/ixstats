"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  ScaleFrameEnlarge as Scale,
  City as Building2,
  Cart as ShoppingCart,
  Group as Users,
  Activity,
} from "iconoir-react";
import type { EconomicImpact } from "./taxSyncTypes";

interface TaxImpactsTabProps {
  economicImpact: EconomicImpact;
  formatPercentage: (rate: number) => string;
}

function getImpactIcon(impact: "positive" | "neutral" | "negative") {
  if (impact === "positive") return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (impact === "negative") return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Activity className="h-4 w-4 text-gray-600" />;
}

function getImpactColor(impact: "positive" | "neutral" | "negative") {
  if (impact === "positive") return "text-green-600 dark:text-green-400";
  if (impact === "negative") return "text-red-600 dark:text-red-400";
  return "text-gray-600 dark:text-gray-400";
}

export function TaxImpactsTab({
  economicImpact,
  formatPercentage,
}: TaxImpactsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* GDP Impact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              GDP Growth Projection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div
                className={`mb-2 text-3xl font-bold ${economicImpact.gdpGrowthImpact >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {economicImpact.gdpGrowthImpact >= 0 ? "+" : ""}
                {formatPercentage(economicImpact.gdpGrowthImpact)}
              </div>
              <p className="text-muted-foreground text-sm">
                Estimated impact on annual GDP growth from current tax policy
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inequality Impact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Income Inequality Effect
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div
                className={`mb-2 text-3xl font-bold ${economicImpact.giniCoefficientChange <= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {economicImpact.giniCoefficientChange >= 0 ? "+" : ""}
                {economicImpact.giniCoefficientChange.toFixed(1)}
              </div>
              <p className="text-muted-foreground text-sm">
                Change in Gini coefficient (lower is better)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Business Investment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Business Investment Climate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                {getImpactIcon(economicImpact.businessInvestmentImpact)}
                <span
                  className={`text-2xl font-bold capitalize ${getImpactColor(economicImpact.businessInvestmentImpact)}`}
                >
                  {economicImpact.businessInvestmentImpact}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                Impact on business investment and expansion
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Consumer Spending */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Consumer Spending Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                {getImpactIcon(economicImpact.consumerSpendingImpact)}
                <span
                  className={`text-2xl font-bold capitalize ${getImpactColor(economicImpact.consumerSpendingImpact)}`}
                >
                  {economicImpact.consumerSpendingImpact}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                Impact on household consumption and demand
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employment Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employment Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-white/50 to-gray-50/50 p-4 dark:from-gray-800/50 dark:to-gray-900/50">
            <div>
              <div className="mb-1 font-semibold">Overall Employment Outlook</div>
              <p className="text-muted-foreground text-sm">
                Based on corporate tax rates and business climate
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getImpactIcon(economicImpact.employmentImpact)}
              <span
                className={`text-2xl font-bold capitalize ${getImpactColor(economicImpact.employmentImpact)}`}
              >
                {economicImpact.employmentImpact}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
