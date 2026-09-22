"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Button } from "~/components/ui/button";
import {
  ScaleFrameEnlarge as Scale,
  Refresh as RefreshCw,
} from "iconoir-react";
import type {
  EconomicTierRecommendation,
  EconomicImpact,
} from "./taxSyncTypes";

interface TaxSyncHeaderProps {
  economicTier: EconomicTierRecommendation["tier"];
  tierRecommendation: EconomicTierRecommendation;
  economicImpact: EconomicImpact;
  gdpPerCapita: number;
  formatCurrency: (amount: number) => string;
  formatPercentage: (rate: number) => string;
  onOptimize: () => void;
}

export function TaxSyncHeader({
  economicTier,
  tierRecommendation,
  economicImpact,
  gdpPerCapita,
  formatCurrency,
  formatPercentage,
  onOptimize,
}: TaxSyncHeaderProps) {
  return (
    <Card className="border-indigo-500/20 bg-indigo-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-indigo-500/10 p-2">
              <Scale className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">Tax System Economic Impact</CardTitle>
              <p className="text-muted-foreground text-sm">
                Analysis for {economicTier} economy (GDP/capita: {formatCurrency(gdpPerCapita)})
              </p>
            </div>
          </div>

          <Button onClick={onOptimize} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Optimize
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Overall Economic Health Score</span>
              <span className="text-2xl font-bold" style={{ color: tierRecommendation.color }}>
                {economicImpact.overallScore.toFixed(0)}/100
              </span>
            </div>
            <Progress
              value={economicImpact.overallScore}
              className="h-3"
              style={{
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore - Custom CSS variable
                "--progress-background": tierRecommendation.color,
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white/50 p-3 text-center dark:bg-gray-800/50">
              <div className="text-muted-foreground mb-1 text-xs">Economic Tier</div>
              <Badge style={{ backgroundColor: tierRecommendation.color }}>{economicTier}</Badge>
            </div>
            <div className="rounded-lg bg-white/50 p-3 text-center dark:bg-gray-800/50">
              <div className="text-muted-foreground mb-1 text-xs">Tax Alignment</div>
              <Badge
                variant={
                  tierRecommendation.currentAlignment === "aligned"
                    ? "default"
                    : tierRecommendation.currentAlignment === "overtaxed"
                      ? "destructive"
                      : "secondary"
                }
              >
                {tierRecommendation.currentAlignment}
              </Badge>
            </div>
            <div className="rounded-lg bg-white/50 p-3 text-center dark:bg-gray-800/50">
              <div className="text-muted-foreground mb-1 text-xs">GDP Impact</div>
              <div
                className={`font-semibold ${economicImpact.gdpGrowthImpact >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {economicImpact.gdpGrowthImpact >= 0 ? "+" : ""}
                {formatPercentage(economicImpact.gdpGrowthImpact)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
