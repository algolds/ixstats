"use client";

import React from "react";
import { Landmark, DollarSign, Shield, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { GlassCard, GlassCardContent } from "../../../glass/GlassCard";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import { formatCurrency, formatPercent } from "~/lib/format-utils";
import type { EconomicInputs } from "../../../../lib/economy-data-service";

interface RevenueIntegration {
  totalRevenue: number;
  taxRevenue: number;
  nonTaxRevenue: number;
  taxBurdenRatio: number;
  revenueToGDPRatio: number;
  governmentSizeIndicator: "Small" | "Medium" | "Large";
}

interface FiscalTabProps {
  revenueIntegration: RevenueIntegration;
  economicInputs: EconomicInputs;
}

export function FiscalTab({ revenueIntegration, economicInputs }: FiscalTabProps) {
  const currency = economicInputs.nationalIdentity?.currency || "USD";

  return (
    <div className="space-y-6">
      {/* Fiscal Policy Configuration */}
      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
          <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
            <Landmark className="h-5 w-5 text-emerald-400" />
            Fiscal Policy Configuration
          </h3>
        </div>
        <GlassCardContent className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Budget Stance</Label>
              <div className="text-foreground text-sm font-medium">Balanced (0% of GDP)</div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Fiscal Strategy</Label>
              <div className="text-foreground text-sm font-medium">Neutral</div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Debt-to-GDP Target</Label>
              <div className="text-foreground text-sm font-medium">60% ceiling</div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Reserve Fund</Label>
              <div className="text-foreground text-sm font-medium">5% of budget</div>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Configure fiscal policy in the Fiscal System section.
          </p>
        </GlassCardContent>
      </GlassCard>

      {/* Government Revenue Integration Card */}
      {revenueIntegration.totalRevenue > 0 ? (
        <GlassCard
          depth="base"
          theme="emerald"
          className="border-emerald-500/20"
          texture="chevron"
          textureOpacity={0.04}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Government Revenue Integration
            </h3>
          </div>
          <GlassCardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Total Government Revenue</Label>
                <div className="text-foreground text-2xl font-bold">
                  {formatCurrency(revenueIntegration.totalRevenue, currency)}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      revenueIntegration.governmentSizeIndicator === "Large" &&
                        "border-blue-500/50 text-blue-500",
                      revenueIntegration.governmentSizeIndicator === "Medium" &&
                        "border-amber-500/50 text-amber-500",
                      revenueIntegration.governmentSizeIndicator === "Small" &&
                        "border-emerald-500/50 text-emerald-500"
                    )}
                  >
                    {revenueIntegration.governmentSizeIndicator} Government
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Tax Revenue Breakdown</Label>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tax Revenue</span>
                      <span className="font-semibold">
                        {formatCurrency(revenueIntegration.taxRevenue, currency)}
                      </span>
                    </div>
                    <Progress
                      value={
                        revenueIntegration.totalRevenue > 0
                          ? (revenueIntegration.taxRevenue / revenueIntegration.totalRevenue) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Non-Tax Revenue</span>
                      <span className="font-semibold">
                        {formatCurrency(revenueIntegration.nonTaxRevenue, currency)}
                      </span>
                    </div>
                    <Progress
                      value={
                        revenueIntegration.totalRevenue > 0
                          ? (revenueIntegration.nonTaxRevenue / revenueIntegration.totalRevenue) *
                            100
                          : 0
                      }
                      className="bg-muted h-2 [&>div]:bg-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Economic Impact Metrics</Label>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Revenue as % of GDP</span>
                      <Badge variant="outline" className="text-sm font-semibold">
                        {formatPercent(revenueIntegration.revenueToGDPRatio, 1)}
                      </Badge>
                    </div>
                    <Progress
                      value={Math.min(revenueIntegration.revenueToGDPRatio, 100)}
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Tax Burden Ratio</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-sm font-semibold",
                          revenueIntegration.taxBurdenRatio > 35 &&
                            "border-red-500/50 text-red-500",
                          revenueIntegration.taxBurdenRatio >= 20 &&
                            revenueIntegration.taxBurdenRatio <= 35 &&
                            "border-amber-500/50 text-amber-500",
                          revenueIntegration.taxBurdenRatio < 20 &&
                            "border-emerald-500/50 text-emerald-500"
                        )}
                      >
                        {formatPercent(revenueIntegration.taxBurdenRatio, 1)}
                      </Badge>
                    </div>
                    <Progress
                      value={Math.min(revenueIntegration.taxBurdenRatio, 100)}
                      className={cn(
                        "h-2",
                        revenueIntegration.taxBurdenRatio > 35 && "[&>div]:bg-red-500",
                        revenueIntegration.taxBurdenRatio >= 20 &&
                          revenueIntegration.taxBurdenRatio <= 35 &&
                          "[&>div]:bg-amber-500",
                        revenueIntegration.taxBurdenRatio < 20 && "[&>div]:bg-green-500"
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {revenueIntegration.taxBurdenRatio > 35 && (
              <Alert className="mt-4 border-amber-500/30 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-500/10">
                <Info className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm text-amber-700 dark:text-amber-200">
                  High tax burden ({formatPercent(revenueIntegration.taxBurdenRatio, 1)}) may reduce
                  private sector GDP growth. Consider balancing with economic components that
                  promote business development.
                </AlertDescription>
              </Alert>
            )}
          </GlassCardContent>
        </GlassCard>
      ) : (
        <GlassCard
          depth="base"
          theme="emerald"
          className="border-emerald-500/20"
          texture="chevron"
          textureOpacity={0.04}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Government Revenue Integration
            </h3>
          </div>
          <GlassCardContent className="text-muted-foreground p-6 text-center text-sm">
            <DollarSign className="mx-auto mb-2 h-8 w-8 text-zinc-500" />
            <p>No government revenue data available.</p>
            <p className="mt-1 text-xs">
              Configure government components to see revenue projections.
            </p>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Fiscal Verification Checkpoint */}
      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
          <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
            <Shield className="h-5 w-5 text-emerald-400" />
            Fiscal Verification
          </h3>
        </div>
        <GlassCardContent className="space-y-4 p-6">
          {revenueIntegration.revenueToGDPRatio > 40 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:bg-amber-500/5 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                Revenue-to-GDP ratio ({formatPercent(revenueIntegration.revenueToGDPRatio, 1)})
                exceeds 40%. Consider adjusting fiscal policy.
              </span>
            </div>
          )}
          {revenueIntegration.revenueToGDPRatio <= 40 && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:bg-emerald-500/5 dark:text-emerald-200">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>Fiscal metrics within safe boundaries.</span>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
