"use client";

import React from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Factory, PieChart, Users, TrendingUp, Target, AlertTriangle } from "lucide-react";
import { MetricCard } from "../../../../primitives/enhanced";
import type { SectorConfiguration } from "~/types/economy-builder";
import { calculateSectorTotals } from "../utils/sectorCalculations";

interface SectorMetricsProps {
  sectors: SectorConfiguration[];
  onNormalize: () => void;
}

export function SectorMetrics({ sectors, onNormalize }: SectorMetricsProps) {
  const { totalGDP, totalEmployment, averageProductivity } = calculateSectorTotals(sectors);

  const gdpValid = Math.abs(totalGDP - 100) < 1;
  const employmentValid = Math.abs(totalEmployment - 100) < 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Economic Sectors Configuration</h2>
          <p className="text-muted-foreground">
            Configure your economy's sector composition and characteristics
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onNormalize}
          disabled={gdpValid && employmentValid}
        >
          <Target className="mr-2 h-4 w-4" />
          Normalize
        </Button>
      </div>

      {/* Validation Alerts */}
      {!gdpValid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sector GDP contributions must sum to 100%. Currently: {totalGDP.toFixed(1)}%
          </AlertDescription>
        </Alert>
      )}

      {!employmentValid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Employment shares must sum to 100%. Currently: {totalEmployment.toFixed(1)}%
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="GDP Distribution"
          value={`${totalGDP.toFixed(1)}%`}
          icon={PieChart}
          sectionId="sectors"
          trend={gdpValid ? "up" : "down"}
        />
        <MetricCard
          label="Employment Distribution"
          value={`${totalEmployment.toFixed(1)}%`}
          icon={Users}
          sectionId="sectors"
          trend={employmentValid ? "up" : "down"}
        />
        <MetricCard
          label="Active Sectors"
          value={sectors.length}
          icon={Factory}
          sectionId="sectors"
          trend="neutral"
        />
        <MetricCard
          label="Avg Productivity"
          value={averageProductivity.toFixed(0)}
          icon={TrendingUp}
          sectionId="sectors"
          trend="neutral"
        />
      </div>
    </div>
  );
}
