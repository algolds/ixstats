"use client";

import React from "react";
import {
  Group as Users,
  Suitcase as Briefcase,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  StatsReport as BarChart3,
  InfoCircle as Info,
  Activity,
} from "iconoir-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
import { XAxis, YAxis, CartesianGrid, BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface LaborDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName?: string;
}

const TABS: MetricModalTab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "breakdown", label: "Breakdown", icon: Info },
];

export function LaborDetailsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: LaborDetailsModalProps) {
  // Fetch country data + mapped economyData
  const {
    countryData,
    economyData,
    isLoading: countryLoading,
  } = useCountryEconomicData(countryId, isOpen);

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case "overview":
        return renderOverviewTab();
      case "breakdown":
        return renderBreakdownTab();
      default:
        return null;
    }
  };

  const renderOverviewTab = () => {
    if (countryLoading) {
      return <MetricModalLayout.Loading variant="labor" mainHeight={300} sidebarCards={4} />;
    }

    const labor = economyData?.labor;

    return (
      <MetricModalLayout variant="labor">
        <MetricModalLayout.MainArea>
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Briefcase className="text-label-secondary h-5 w-5" />
                Labor force composition
              </h3>
              <p className="text-label-secondary text-body">
                Workforce composition and national employment statistics.
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    {(
                      ((labor?.totalWorkforce || 0) / (countryData?.currentPopulation || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Of population
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">
                    {(
                      ((labor?.employmentRate || 0) * (labor?.totalWorkforce || 0)) /
                      100
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">Employed</span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-destructive text-title-3">
                    {(
                      ((labor?.unemploymentRate || 0) * (labor?.totalWorkforce || 0)) /
                      100
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Unemployed
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">
                    ${(labor?.averageAnnualIncome || 0).toLocaleString()}
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Avg. Income
                  </span>
                </Card>
              </div>

              <Card
                variant="inset"
                padding="none"
                className="text-label-secondary text-footnote mt-6 flex items-start gap-3 p-4"
              >
                <Info className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-relaxed">
                  Workforce dynamics play a critical role in determining overall production
                  efficiency and industrial stability. High employment rates support higher consumer
                  demand and stability, while the average income influences domestic market
                  velocity.
                </p>
              </Card>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Total workforce"
            value={labor?.totalWorkforce || 0}
            decimalPlaces={0}
            icon={Users}
            variant="labor"
          />
          <MetricModalLayout.StatCard
            label="Participation rate"
            value={labor?.laborForceParticipationRate || 0}
            suffix="%"
            decimalPlaces={1}
            icon={Activity}
            variant="labor"
          />
          <MetricModalLayout.StatCard
            label="Employment rate"
            value={labor?.employmentRate || 0}
            suffix="%"
            decimalPlaces={1}
            icon={TrendingUp}
            variant="labor"
          />
          <MetricModalLayout.StatCard
            label="Unemployment rate"
            value={labor?.unemploymentRate || 0}
            suffix="%"
            decimalPlaces={1}
            icon={TrendingDown}
            variant="labor"
          />
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderBreakdownTab = () => {
    if (countryLoading) {
      return <MetricModalLayout.Loading variant="labor" mainHeight={350} sidebarCards={0} />;
    }

    const labor = economyData?.labor;
    const sectors: Record<string, number> = labor?.employmentBySector || {};

    const sectorData = Object.entries(sectors)
      .slice(0, 8)
      .map(([name, value]) => ({
        name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: parseFloat(value.toFixed(1)),
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <MetricModalLayout variant="labor">
        <MetricModalLayout.MainArea>
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Employment by sector</h3>
              <p className="text-label-secondary text-body">
                Workforce distribution across key industrial sectors
              </p>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {sectorData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                      <XAxis type="number" stroke="var(--color-label-secondary)" tickLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="var(--color-label-secondary)"
                        tickLine={false}
                        width={100}
                        tick={{ fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface-elevated)",
                          color: "var(--color-label)",
                          borderColor: "var(--color-separator)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="var(--color-blue-500)"
                        radius={[0, 4, 4, 0]}
                        name="Percentage %"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="text-label-secondary mb-2 h-8 w-8 opacity-40" />
                  <p className="text-label-secondary text-body">No sector data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <Card className="flex flex-1 flex-col justify-between p-4">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 text-headline">Productivity metrics</h3>
              <p className="text-label-secondary text-footnote">Workforce efficiency and output</p>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">GDP per worker</span>
                <div className="text-label text-title-3 mt-1">
                  $
                  {(
                    (countryData?.currentTotalGdp || 0) / (labor?.totalWorkforce || 1)
                  ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </Card>

              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Productivity index</span>
                <div className="text-title-3 text-green mt-1">
                  {labor?.skillsAndProductivity?.laborProductivityIndex?.toFixed(2) ?? "—"}
                </div>
              </Card>

              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Avg. Education</span>
                <div className="text-label text-title-3 mt-1">
                  {labor?.skillsAndProductivity?.averageEducationYears
                    ? `${labor.skillsAndProductivity.averageEducationYears.toFixed(1)} years`
                    : "—"}
                </div>
              </Card>
            </CardContent>
          </Card>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  return (
    <BaseMetricDetailsModal
      isOpen={isOpen}
      onClose={onClose}
      countryId={countryId}
      countryName={countryName}
      title="Labor force analysis"
      description="Detailed workforce and employment metrics"
      icon={Users}
      iconColor="text-label-secondary"
      tabs={TABS}
      isLoading={countryLoading}
      variant="labor"
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default LaborDetailsModal;
