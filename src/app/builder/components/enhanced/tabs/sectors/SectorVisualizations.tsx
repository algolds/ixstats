"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { PieChart, BarChart3, Zap } from 'lucide-react';
import { GlassBarChart, GlassPieChart } from '~/components/charts/RechartsIntegration';
import { getColorsFromData } from '~/lib/chart-colors';
import { SECTOR_TEMPLATES } from '../utils/sectorCalculations';
import type { SectorConfiguration } from '~/types/economy-builder';

interface SectorVisualizationsProps {
  sectors: SectorConfiguration[];
  sectorImpacts: Record<string, number>;
}

export function SectorVisualizations({ sectors, sectorImpacts }: SectorVisualizationsProps) {
  // Prepare GDP chart data
  const sectorChartData = useMemo(() => {
    return sectors.map((sector) => {
      const sectorType = sector.id.split('_')[0] as keyof typeof SECTOR_TEMPLATES;
      return {
        name: sector.name,
        value: sector.gdpContribution,
        color: SECTOR_TEMPLATES[sectorType]?.color || 'gray'
      };
    });
  }, [sectors]);

  // Prepare employment chart data
  const employmentChartData = useMemo(() => {
    return sectors.map((sector) => {
      const sectorType = sector.id.split('_')[0] as keyof typeof SECTOR_TEMPLATES;
      return {
        name: sector.name,
        value: sector.employmentShare,
        color: SECTOR_TEMPLATES[sectorType]?.color || 'gray'
      };
    });
  }, [sectors]);

  return (
    <div className="space-y-6">
      {/* GDP Composition */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="h-5 w-5" />
            <span>GDP Composition</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sectorChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Add sectors to see GDP composition
            </div>
          ) : (
            <GlassPieChart
              data={sectorChartData}
              dataKey="value"
              nameKey="name"
              height={300}
              colors={getColorsFromData(sectorChartData)}
            />
          )}
        </CardContent>
      </Card>

      {/* Employment Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Employment Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employmentChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              Add sectors to see employment distribution
            </div>
          ) : (
            <GlassBarChart
              data={employmentChartData}
              xKey="name"
              yKey="value"
              height={250}
              valueFormatter={(value) => `${value.toFixed(1)}%`}
              colors={getColorsFromData(employmentChartData)}
            />
          )}
        </CardContent>
      </Card>

      {/* Component Impact Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Atomic Component Impact</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(sectorImpacts).map(([sectorId, impact]) => {
              const template = SECTOR_TEMPLATES[sectorId as keyof typeof SECTOR_TEMPLATES];
              if (!template || impact === 1) return null;

              return (
                <div
                  key={sectorId}
                  className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex items-center space-x-2">
                    <template.icon className="h-4 w-4" />
                    <span className="text-sm">{template.name}</span>
                  </div>
                  <Badge variant={impact > 1 ? 'default' : 'secondary'}>
                    {impact > 1 ? '+' : ''}
                    {((impact - 1) * 100).toFixed(1)}%
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
