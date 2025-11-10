/**
 * Relationship Distribution Chart Component
 *
 * Displays relationship strength distribution as a donut chart.
 *
 * @module RelationshipDistributionChart
 */

import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, FileSpreadsheet, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { RelationshipDistribution } from "~/lib/analytics-data-transformers";

interface RelationshipDistributionChartProps {
  data: RelationshipDistribution[];
  GlassTooltip: React.ComponentType<any>;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const RelationshipDistributionChart = React.memo<RelationshipDistributionChartProps>(
  ({ data, GlassTooltip, onExportCSV, onExportPDF }) => {
    return (
      <Card className="glass-surface glass-refraction" id="relationship-distribution-chart">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Relationship Strength Distribution
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={onExportCSV} title="Export to CSV">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onExportPDF} title="Export to PDF">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
          <CardDescription>Quality of diplomatic relationships</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[280px] lg:h-[300px]">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<GlassTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }
);

RelationshipDistributionChart.displayName = "RelationshipDistributionChart";
