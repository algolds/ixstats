"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
  Globe,
  StatUp as TrendingUp,
  LightBulb as Lightbulb,
  Group as Users,
  City as Building2,
  CheckCircle,
  WarningTriangle as AlertTriangle,
  InfoCircle as Info,
  ArrowRight,
  Refresh as RefreshCw,
  Coins,
} from "iconoir-react";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";

interface ArchetypeDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  archetype: EconomicArchetype | null;
  isGloballySelected: boolean;
  isLoading: boolean;
  onApply: (archetype: EconomicArchetype) => void;
}

export function ArchetypeDetailsModal({
  isOpen,
  onOpenChange,
  archetype,
  isGloballySelected,
  isLoading,
  onApply,
}: ArchetypeDetailsModalProps) {
  if (!archetype) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-background/95 text-foreground flex max-h-[85vh] w-full max-w-5xl flex-col gap-0 border p-0 shadow-2xl backdrop-blur-3xl dark:shadow-emerald-950/20">
        <DialogHeader className="border-border/40 shrink-0 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
          <DialogTitle className="text-foreground text-xl font-bold">
            {archetype.name} Preset Details
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="text-foreground space-y-6">
            <div className="border-border flex flex-col items-start justify-between gap-4 border-b pb-6 lg:flex-row">
              <div className="flex-1 space-y-2">
                <h2 className="text-foreground text-3xl font-bold tracking-tight">
                  {archetype.name}
                </h2>
                <p className="text-muted-foreground max-w-4xl text-sm leading-relaxed">
                  {archetype.description}
                </p>
                <div className="text-muted-foreground flex items-center gap-2 pt-1 text-sm">
                  <Globe className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium">{archetype.region}</span>
                </div>
              </div>
              <Button
                onClick={() => onApply(archetype)}
                disabled={isLoading || isGloballySelected}
                className={cn(
                  "flex h-11 w-full shrink-0 cursor-pointer items-center gap-2 self-center px-6 font-semibold shadow-lg transition-all lg:w-auto",
                  isGloballySelected
                    ? "cursor-default border border-emerald-500/30 bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "bg-emerald-600 text-white shadow-emerald-500/10 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                )}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Applying Preset...</span>
                  </>
                ) : isGloballySelected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span>Preset Applied</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span>Apply Archetype Preset</span>
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {/* Growth Metrics */}
              <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
                <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Growth Metrics
                </h3>
                <div className="space-y-3.5 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">GDP Growth</span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.growthMetrics.gdpGrowth}%
                      </span>
                    </div>
                    <Progress
                      value={archetype.growthMetrics.gdpGrowth * 10}
                      className="bg-secondary h-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Innovation Index
                      </span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.growthMetrics.innovationIndex}
                      </span>
                    </div>
                    <Progress
                      value={archetype.growthMetrics.innovationIndex}
                      className="bg-secondary h-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">Competitiveness</span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.growthMetrics.competitiveness}
                      </span>
                    </div>
                    <Progress
                      value={archetype.growthMetrics.competitiveness}
                      className="bg-secondary h-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">Stability</span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.growthMetrics.stability}
                      </span>
                    </div>
                    <Progress
                      value={archetype.growthMetrics.stability}
                      className="bg-secondary h-2"
                    />
                  </div>
                </div>
              </div>

              {/* Employment Profile */}
              <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
                <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  Employment Profile
                </h3>
                <div className="space-y-3.5 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Unemployment Rate
                      </span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.employmentProfile.unemploymentRate}%
                      </span>
                    </div>
                    <Progress
                      value={100 - archetype.employmentProfile.unemploymentRate * 10}
                      className="bg-secondary h-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Labor Participation
                      </span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.employmentProfile.laborParticipation}%
                      </span>
                    </div>
                    <Progress
                      value={archetype.employmentProfile.laborParticipation}
                      className="bg-secondary h-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">Wage Growth</span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.employmentProfile.wageGrowth}%
                      </span>
                    </div>
                    <Progress
                      value={archetype.employmentProfile.wageGrowth * 20}
                      className="bg-secondary h-2"
                    />
                  </div>
                </div>
              </div>

              {/* Tax Profile */}
              <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
                <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-2">
                    <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  Tax Profile
                </h3>
                <div className="space-y-3.5 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">Corporate Tax</span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.taxProfile.corporateRate}%
                      </span>
                    </div>
                    <Progress
                      value={archetype.taxProfile.corporateRate * 2}
                      className="bg-secondary h-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">Income Tax</span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.taxProfile.incomeRate}%
                      </span>
                    </div>
                    <Progress
                      value={archetype.taxProfile.incomeRate * 1.5}
                      className="bg-secondary h-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">Consumption Tax</span>
                      <span className="text-foreground text-sm font-semibold">
                        {archetype.taxProfile.consumptionRate}%
                      </span>
                    </div>
                    <Progress
                      value={archetype.taxProfile.consumptionRate * 3}
                      className="bg-secondary h-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Revenue Efficiency
                      </span>
                      <span className="text-foreground text-sm font-semibold">
                        {Math.round(archetype.taxProfile.revenueEfficiency * 100)}%
                      </span>
                    </div>
                    <Progress
                      value={archetype.taxProfile.revenueEfficiency * 100}
                      className="bg-secondary h-2"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Components (Government & Economy) */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Government Components */}
              <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
                <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  Government Components
                </h3>
                <div className="flex flex-wrap gap-2 pt-2">
                  {archetype.governmentComponents && archetype.governmentComponents.length > 0 ? (
                    archetype.governmentComponents.map((comp, idx) => {
                      const label =
                        typeof comp === "string"
                          ? comp.replace(/_/g, " ")
                          : (comp as { name?: string; componentType?: string })?.name ||
                            (comp as { name?: string; componentType?: string })?.componentType ||
                            "";
                      return (
                        <Badge
                          key={`gov-comp-${idx}`}
                          variant="outline"
                          className="border-blue-500/20 bg-blue-500/5 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                        >
                          {label}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground text-xs italic">
                      No default government components
                    </span>
                  )}
                </div>
              </div>

              {/* Economic Components */}
              <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
                <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                    <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Economic Components
                </h3>
                <div className="flex flex-wrap gap-2 pt-2">
                  {archetype.economicComponents && archetype.economicComponents.length > 0 ? (
                    archetype.economicComponents.map((comp, idx) => {
                      const label =
                        typeof comp === "string"
                          ? comp.replace(/_/g, " ")
                          : (comp as { name?: string; componentType?: string })?.name ||
                            (comp as { name?: string; componentType?: string })?.componentType ||
                            "";
                      return (
                        <Badge
                          key={`econ-comp-${idx}`}
                          variant="outline"
                          className="border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          {label}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground text-xs italic">
                      No default economic components
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Strengths */}
              <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
                <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Key Strengths
                </h3>
                <div className="pt-2">
                  <ul className="space-y-2.5">
                    {archetype.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-foreground text-sm leading-relaxed">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Challenges */}
              <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
                <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  Key Challenges
                </h3>
                <div className="pt-2">
                  <ul className="space-y-2.5">
                    {archetype.challenges.map((challenge, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span className="text-foreground text-sm leading-relaxed">{challenge}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
              <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2">
                  <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                Implementation Recommendations
              </h3>
              <div className="grid grid-cols-1 gap-3 pt-2 lg:grid-cols-2">
                {archetype.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 font-bold text-emerald-600 dark:text-emerald-400">
                      •
                    </span>
                    <span className="text-muted-foreground text-sm leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Context */}
            <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
              <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
                <div className="rounded-lg border border-teal-500/20 bg-teal-500/10 p-2">
                  <Info className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
                Historical Context & Real-world Examples
              </h3>
              <div className="space-y-5 pt-2">
                <div>
                  <h4 className="text-foreground mb-2 text-sm font-semibold">Historical Context</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {archetype.historicalContext}
                  </p>
                </div>
                <div className="border-border border-t pt-4">
                  <h4 className="text-foreground mb-2.5 text-sm font-semibold">
                    Modern Country Examples
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {archetype.modernExamples.map((example, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="border-border bg-muted/50 px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                      >
                        {example}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
