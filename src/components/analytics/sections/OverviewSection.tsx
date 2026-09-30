/**
 * Overview Section Component
 *
 * Displays summary metrics and key charts for the overview tab.
 *
 * @module OverviewSection
 */

import React from "react";
import { SummaryMetricsCard } from "../metrics/SummaryMetricsCard";
import { EconomicOverviewChart } from "../charts/EconomicOverviewChart";
import { EconomicHealthRadar } from "../charts/EconomicHealthRadar";
import { GlassTooltip } from "../charts/GlassTooltip";
import { FacetDataTable as DataTable } from "~/components/ui/data-table";
import type { SummaryMetric, EconomicChartDataPoint, EconomicHealthIndicator } from "~/lib/utils";

interface OverviewSectionProps {
  summaryMetrics: SummaryMetric[];
  economicChartData: EconomicChartDataPoint[];
  economicHealthIndicators: EconomicHealthIndicator[];
  formatCurrency: (value: number) => string;
  formatPercent: (value: number) => string;
  exportToCSV: (data: any[], filename: string, headerMap?: Record<string, string>) => void;
  exportToPDF: (chartId: string, chartName: string) => Promise<void>;
  showDataTable?: boolean;
}

export const OverviewSection = React.memo<OverviewSectionProps>(
  ({
    summaryMetrics,
    economicChartData,
    economicHealthIndicators,
    formatCurrency,
    formatPercent,
    exportToCSV,
    exportToPDF,
    showDataTable = false,
  }) => {
    // Table view data preparation
    const economicTableData = economicChartData.map((point, index) => ({
      id: index,
      date: new Date(point.date).toLocaleDateString(),
      totalGdp: formatCurrency(point.gdp),
      gdpPerCapita: formatCurrency(point.gdpPerCapita),
      population: point.population?.toLocaleString() || "N/A",
      growth: point.growth ? `${point.growth.toFixed(1)}%` : "N/A",
    }));

    const healthTableData = economicHealthIndicators.map((indicator, index) => ({
      id: index,
      indicator: indicator.indicator,
      score: `${indicator.value.toFixed(1)}%`,
      trend: indicator.trend || "stable",
      status:
        indicator.value >= 80
          ? "Excellent"
          : indicator.value >= 60
            ? "Good"
            : indicator.value >= 40
              ? "Fair"
              : "Poor",
    }));

    if (showDataTable) {
      return (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {summaryMetrics.map((metric, index) => (
              <SummaryMetricsCard key={metric.title} metric={metric} index={index} />
            ))}
          </div>

          {/* Data Tables */}
          <div className="space-y-6">
            <DataTable
              data={economicTableData}
              columns={[
                { key: "date", header: "Date", align: "left" },
                { key: "totalGdp", header: "Total GDP", align: "right" },
                { key: "gdpPerCapita", header: "GDP Per Capita", align: "right" },
                { key: "population", header: "Population", align: "right" },
                { key: "growth", header: "Growth Rate", align: "right" },
              ]}
              title="Economic Data"
              description="Historical economic performance data"
              searchable
              searchKeys={["date"]}
              paginated
              pageSize={10}
            />

            <DataTable
              data={healthTableData}
              columns={[
                { key: "indicator", header: "Indicator", align: "left" },
                { key: "score", header: "Score", align: "right" },
                { key: "trend", header: "Trend", align: "center" },
                { key: "status", header: "Status", align: "center" },
              ]}
              title="Economic Health Indicators"
              description="Multi-dimensional health metrics"
              searchable
              searchKeys={["indicator", "status"]}
              paginated
              pageSize={10}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summaryMetrics.map((metric, index) => (
            <SummaryMetricsCard key={metric.title} metric={metric} index={index} />
          ))}
        </div>

        {/* Quick Charts Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <EconomicOverviewChart
            data={economicChartData}
            formatCurrency={formatCurrency}
            GlassTooltip={GlassTooltip}
            onExportCSV={() =>
              exportToCSV(economicChartData, "gdp-per-capita-trend", {
                date: "Date",
                gdp: "Total GDP",
                gdpPerCapita: "GDP Per Capita",
                population: "Population",
              })
            }
            onExportPDF={() => exportToPDF("gdp-trend-chart", "GDP Per Capita Trend")}
          />

          <EconomicHealthRadar
            data={economicHealthIndicators}
            formatPercent={formatPercent}
            GlassTooltip={GlassTooltip}
            onExportCSV={() =>
              exportToCSV(economicHealthIndicators, "economic-health-indicators", {
                indicator: "Indicator",
                value: "Score",
              })
            }
            onExportPDF={() => exportToPDF("economic-health-chart", "Economic Health Indicators")}
          />
        </div>
      </div>
    );
  }
);

OverviewSection.displayName = "OverviewSection";
