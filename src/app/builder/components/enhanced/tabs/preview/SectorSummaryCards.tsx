"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PieChart, BarChart3, Users } from "lucide-react";
import { GlassBarChart, GlassPieChart } from "~/components/charts/RechartsIntegration";
import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";
import type { EconomyBuilderState } from "~/types/economy-builder";
import { getSectorColor, getEmploymentTypeColor } from "../utils/previewCalculations";

interface SectorSummaryCardsProps {
  economyBuilder: EconomyBuilderState;
}

export function SectorSummaryCards({ economyBuilder }: SectorSummaryCardsProps) {
  const sectorChartData = useMemo(() => {
    return economyBuilder.sectors.map((sector) => ({
      name: sector.name,
      value: sector.gdpContribution,
      color: getSectorColor(sector.id),
    }));
  }, [economyBuilder.sectors]);

  const employmentTypeData = useMemo(() => {
    const types = economyBuilder.laborMarket.employmentType;
    return Object.entries(types).map(([type, value]) => ({
      name: type.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
      value,
      color: getEmploymentTypeColor(type),
    }));
  }, [economyBuilder.laborMarket.employmentType]);

  const ageDistributionData = useMemo(() => {
    const ageDist = economyBuilder.demographics.ageDistribution;
    return [
      { name: "Under 15", value: ageDist.under15, color: "blue" },
      { name: "15-64", value: ageDist.age15to64, color: "green" },
      { name: "65+", value: ageDist.over65, color: "orange" },
    ];
  }, [economyBuilder.demographics.ageDistribution]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Sector Composition */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="h-5 w-5" />
            <span>Sector Composition</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassPieChart
            data={sectorChartData}
            dataKey="value"
            nameKey="name"
            height={250}
            colors={DEFAULT_CHART_COLORS}
          />
        </CardContent>
      </Card>

      {/* Employment Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Employment Types</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassBarChart
            data={employmentTypeData}
            xKey="name"
            yKey="value"
            height={250}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
            colors={DEFAULT_CHART_COLORS}
          />
        </CardContent>
      </Card>

      {/* Age Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Age Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassPieChart
            data={ageDistributionData}
            dataKey="value"
            nameKey="name"
            height={250}
            colors={DEFAULT_CHART_COLORS}
          />
        </CardContent>
      </Card>
    </div>
  );
}
