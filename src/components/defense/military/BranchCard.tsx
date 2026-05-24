// src/components/defense/military/BranchCard.tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  Users,
  Target,
  DollarSign,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { UnitManager } from "~/components/defense/UnitManager";
import { AssetManager } from "~/components/defense/AssetManager";
import type { BRANCH_CONFIGS } from "~/lib/military-config";

interface BranchCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  branch: any;
  config: (typeof BRANCH_CONFIGS)[keyof typeof BRANCH_CONFIGS] | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefetch: () => void;
}

/** Expandable card for a single military branch with personnel, readiness, budget, units, and assets. */
export const BranchCard = React.memo(function BranchCard({
  branch,
  config,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onRefetch,
}: BranchCardProps) {
  const Icon = config?.icon ?? Shield;

  return (
    <Card className="glass-hierarchy-child border-border border-2">
      <CardHeader
        className="hover:bg-accent/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="bg-muted border-border relative overflow-hidden rounded-lg border p-2">
              {branch.imageUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-30"
                  style={{ backgroundImage: `url(${branch.imageUrl})` }}
                />
              )}
              <Icon className={cn("relative z-10 h-6 w-6", config?.color)} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{branch.name}</h3>
                <Badge variant="outline">{config?.label ?? branch.branchType}</Badge>
              </div>
              {branch.motto && (
                <p className="text-muted-foreground text-sm italic">&ldquo;{branch.motto}&rdquo;</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            )}
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-4 pt-4">
              {/* Personnel Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Users className="mx-auto mb-1 h-3.5 w-3.5 text-blue-600" />
                  <div className="text-lg font-bold">
                    <NumberFlowDisplay value={branch.activeDuty} />
                  </div>
                  <div className="text-muted-foreground text-xs">Active Duty</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Users className="mx-auto mb-1 h-3.5 w-3.5 text-green-600" />
                  <div className="text-lg font-bold">
                    <NumberFlowDisplay value={branch.reserves} />
                  </div>
                  <div className="text-muted-foreground text-xs">Reserves</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Users className="mx-auto mb-1 h-3.5 w-3.5 text-purple-600" />
                  <div className="text-lg font-bold">
                    <NumberFlowDisplay value={branch.civilianStaff} />
                  </div>
                  <div className="text-muted-foreground text-xs">Civilian Staff</div>
                </div>
              </div>

              <Separator />

              {/* Readiness Metrics */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-3.5 w-3.5" />
                  Readiness &amp; Capability
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <ReadinessMetric label="Readiness Level" value={branch.readinessLevel} />
                  <ReadinessMetric label="Technology" value={branch.technologyLevel} />
                  <ReadinessMetric label="Training" value={branch.trainingLevel} />
                  <ReadinessMetric label="Morale" value={branch.morale} />
                </div>
              </div>

              <Separator />

              {/* Budget */}
              <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Annual Budget</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">
                    $<NumberFlowDisplay value={branch.annualBudget} format="compact" />
                  </div>
                  <div className="text-muted-foreground text-xs">
                    <NumberFlowDisplay
                      value={branch.budgetPercent}
                      format="percentage"
                      decimalPlaces={1}
                    />{" "}
                    of defense budget
                  </div>
                </div>
              </div>

              {/* Units & Assets Managers */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="bg-card rounded-lg border p-3">
                  <UnitManager
                    branchId={branch.id}
                    branchType={branch.branchType}
                    units={branch.units ?? []}
                    onRefetch={onRefetch}
                  />
                </div>
                <div className="bg-card rounded-lg border p-3">
                  <AssetManager
                    branchId={branch.id}
                    branchType={branch.branchType}
                    assets={branch.assets ?? []}
                    onRefetch={onRefetch}
                  />
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
});

/** Small helper for individual readiness metric rows */
const ReadinessMetric = React.memo(function ReadinessMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          <NumberFlowDisplay value={value} format="percentage" decimalPlaces={0} />
        </span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
});
