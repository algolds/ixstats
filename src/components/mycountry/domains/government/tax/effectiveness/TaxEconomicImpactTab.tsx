"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import {
  Activity,
  ScaleFrameEnlarge as Scale,
  Dollar as DollarSign,
  Reports as PieChart,
} from "iconoir-react";
import type { EconomicImpact } from "./taxEffectivenessTypes";

interface TaxEconomicImpactTabProps {
  economicImpact: EconomicImpact;
}

export function TaxEconomicImpactTab({ economicImpact }: TaxEconomicImpactTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* GDP Growth Effect */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 dark:border-blue-800 dark:from-blue-900/20 dark:to-blue-800/20">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-blue-900 dark:text-blue-100">GDP Growth</span>
              </div>
              <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50">
                {economicImpact.gdpGrowthEffect > 0 ? "+" : ""}
                {(economicImpact.gdpGrowthEffect * 100).toFixed(2)}%
              </Badge>
            </div>
            <Progress
              value={Math.min(100, Math.abs((economicImpact.gdpGrowthEffect * 100) / 0.05))}
              className="h-2"
            />
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
              Tax effectiveness contributes to economic growth
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">
            Effective tax collection enables government investment in infrastructure and services,
            promoting GDP growth.
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Inequality Effect */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-4 dark:border-green-800 dark:from-green-900/20 dark:to-green-800/20">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Scale className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-900 dark:text-green-100">
                  Inequality (Gini)
                </span>
              </div>
              <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50">
                {economicImpact.inequalityEffect.toFixed(1)}
              </Badge>
            </div>
            <Progress
              value={Math.min(100, 100 - economicImpact.inequalityEffect)}
              className="h-2"
            />
            <p className="mt-2 text-xs text-green-700 dark:text-green-300">
              High compliance reduces inequality through redistribution
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">
            Progressive taxation with high compliance reduces income inequality (lower Gini
            coefficient is better).
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Investment Effect */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-foreground font-medium">
                  Investment Climate
                </span>
              </div>
              <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50">
                {economicImpact.investmentEffect.toFixed(1)}%
              </Badge>
            </div>
            <Progress
              value={Math.min(100, economicImpact.investmentEffect * 5)}
              className="h-2"
            />
            <p className="text-muted-foreground mt-2 text-xs">
              Efficient tax collection improves investor confidence
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">
            Predictable and efficient tax systems attract domestic and foreign investment.
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Spending Capacity */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-4 dark:border-amber-800 dark:from-amber-900/20 dark:to-amber-800/20">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PieChart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-amber-900 dark:text-amber-100">
                  Spending Capacity
                </span>
              </div>
              <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50">
                {economicImpact.spendingEffect.toFixed(1)}%
              </Badge>
            </div>
            <Progress
              value={Math.min(100, economicImpact.spendingEffect * 5)}
              className="h-2"
            />
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Revenue enables government service delivery
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">
            Higher tax effectiveness directly increases government spending capacity for public
            services.
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
