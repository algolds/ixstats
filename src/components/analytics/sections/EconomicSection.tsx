/**
 * Economic Section Component
 *
 * Displays economic analytics including sector performance and volatility.
 *
 * @module EconomicSection
 */

import React from "react";
import { SectorPerformanceChart } from "../charts/SectorPerformanceChart";
import { SectorGrowthChart } from "../charts/SectorGrowthChart";
import { VolatilityMetricsCard } from "../metrics/VolatilityMetricsCard";
import { ComparativeBenchmarkingCard } from "../metrics/ComparativeBenchmarkingCard";
import { GlassTooltip } from "../charts/GlassTooltip";
import { DataTable } from "~/components/shared/data-display/DataTable";
import type {
  SectorPerformance,
  VolatilityMetric,
  ComparativeBenchmark,
} from "~/lib/analytics-data-transformers";

interface EconomicSectionProps {
  sectorPerformanceData: SectorPerformance[];
  volatilityMetrics: VolatilityMetric[];
  comparativeBenchmarkingData: ComparativeBenchmark[];
  formatPercent: (value: number) => string;
  exportToCSV: (data: any[], filename: string, headerMap?: Record<string, string>) => void;
  exportToPDF: (chartId: string, chartName: string) => Promise<void>;
  showDataTable?: boolean;
}

export const EconomicSection = React.memo<EconomicSectionProps>(
  ({
    sectorPerformanceData,
    volatilityMetrics,
    comparativeBenchmarkingData,
    formatPercent,
    exportToCSV,
    exportToPDF,
    showDataTable = false,
  }) => {
    // Table view data preparation
    const sectorTableData = sectorPerformanceData.map((sector, index) => ({
      id: index,
      sector: sector.sector,
      performance: `${sector.performance.toFixed(1)}%`,
      growth: formatPercent(sector.growth),
      contribution: `${sector.contribution?.toFixed(1)}%` || "N/A",
      trend: sector.trend || "stable",
    }));

    const volatilityTableData = volatilityMetrics.map((metric, index) => ({
      id: index,
      metric: metric.metric,
      value: formatPercent(metric.value),
      volatility: metric.volatility || "N/A",
      risk: metric.risk || "Low",
      trend: metric.trend || "stable",
    }));

    if (showDataTable) {
      return (
        <div className="space-y-6">
          <DataTable
            data={sectorTableData}
            columns={[
              { key: "sector", label: "Sector", align: "left" },
              { key: "performance", label: "Performance", align: "right" },
              { key: "growth", label: "Growth Rate", align: "right" },
              { key: "contribution", label: "GDP Contribution", align: "right" },
              { key: "trend", label: "Trend", align: "center" },
            ]}
            title="Sector Performance"
            description="Economic sector performance metrics"
            searchable
            searchKeys={["sector"]}
            paginated
            pageSize={10}
          />

          <DataTable
            data={volatilityTableData}
            columns={[
              { key: "metric", label: "Metric", align: "left" },
              { key: "value", label: "Value", align: "right" },
              { key: "volatility", label: "Volatility", align: "right" },
              { key: "risk", label: "Risk Level", align: "center" },
              { key: "trend", label: "Trend", align: "center" },
            ]}
            title="Volatility Metrics"
            description="Economic volatility and risk indicators"
            searchable
            searchKeys={["metric", "risk"]}
            paginated
            pageSize={10}
          />

          <VolatilityMetricsCard metrics={volatilityMetrics} />
          <ComparativeBenchmarkingCard data={comparativeBenchmarkingData} />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectorPerformanceChart
            data={sectorPerformanceData}
            GlassTooltip={GlassTooltip}
            onExportCSV={() =>
              exportToCSV(sectorPerformanceData, "sector-performance", {
                sector: "Sector",
                performance: "Performance Score",
                growth: "Growth Rate (%)",
              })
            }
            onExportPDF={() => exportToPDF("sector-performance-chart", "Sector Performance")}
          />

          <SectorGrowthChart
            data={sectorPerformanceData}
            formatPercent={formatPercent}
            GlassTooltip={GlassTooltip}
            onExportCSV={() =>
              exportToCSV(sectorPerformanceData, "sector-growth-rates", {
                sector: "Sector",
                growth: "Growth Rate (%)",
              })
            }
            onExportPDF={() => exportToPDF("sector-growth-chart", "Sector Growth Rates")}
          />
        </div>

        <VolatilityMetricsCard metrics={volatilityMetrics} />

        <ComparativeBenchmarkingCard data={comparativeBenchmarkingData} />
      </div>
    );
  }
);

EconomicSection.displayName = "EconomicSection";
