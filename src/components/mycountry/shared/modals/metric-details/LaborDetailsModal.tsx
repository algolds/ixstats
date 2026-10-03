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
import { CHART_TOOLTIP_STYLE } from "./types";

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

type EconomicData = ReturnType<typeof useCountryEconomicData>;
type LaborViewProps = Pick<EconomicData, "countryData"> & {
  labor: NonNullable<EconomicData["economyData"]>["labor"];
};

function LaborOverview({ labor, countryData }: LaborViewProps) {
  const workforce = labor?.totalWorkforce || 0;
  const peopleAt = (ratePercent: number | undefined) =>
    (((ratePercent || 0) * workforce) / 100).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });

  return (
    <MetricModalLayout variant="labor">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          icon={Briefcase}
          title="Labor force composition"
          subtitle="Workforce composition and national employment statistics."
          contentClassName="flex flex-1 flex-col justify-center"
        >
          <MetricModalLayout.TileGrid>
            <MetricModalLayout.Tile
              value={`${((workforce / (countryData?.currentPopulation || 1)) * 100).toFixed(1)}%`}
              label="Of population"
            />
            <MetricModalLayout.Tile
              tone="text-green"
              value={peopleAt(labor?.employmentRate)}
              label="Employed"
            />
            <MetricModalLayout.Tile
              tone="text-destructive"
              value={peopleAt(labor?.unemploymentRate)}
              label="Unemployed"
            />
            <MetricModalLayout.Tile
              tone="text-green"
              value={`$${(labor?.averageAnnualIncome || 0).toLocaleString()}`}
              label="Avg. Income"
            />
          </MetricModalLayout.TileGrid>

          <MetricModalLayout.Note icon={Info}>
            Workforce dynamics play a critical role in determining overall production efficiency and
            industrial stability. High employment rates support higher consumer demand and
            stability, while the average income influences domestic market velocity.
          </MetricModalLayout.Note>
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.StatCard
          label="Total workforce"
          value={workforce}
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
}

function LaborBreakdown({ labor, countryData }: LaborViewProps) {
  const sectors: Record<string, number> = labor?.employmentBySector ?? {};
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
        <MetricModalLayout.Panel
          title="Employment by sector"
          subtitle="Workforce distribution across key industrial sectors"
        >
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
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
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
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.SidePanel
          title="Productivity metrics"
          subtitle="Workforce efficiency and output"
        >
          <MetricModalLayout.Metric
            label="GDP per worker"
            value={`$${((countryData?.currentTotalGdp || 0) / (labor?.totalWorkforce || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <MetricModalLayout.Metric
            label="Productivity index"
            tone="text-green"
            value={labor?.skillsAndProductivity?.laborProductivityIndex?.toFixed(2) ?? "—"}
          />
          <MetricModalLayout.Metric
            label="Avg. Education"
            value={
              labor?.skillsAndProductivity?.averageEducationYears
                ? `${labor.skillsAndProductivity.averageEducationYears.toFixed(1)} years`
                : "—"
            }
          />
        </MetricModalLayout.SidePanel>
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

export function LaborDetailsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: LaborDetailsModalProps) {
  const {
    countryData,
    economyData,
    isLoading: countryLoading,
  } = useCountryEconomicData(countryId, isOpen);
  const labor = economyData?.labor;

  const tabs = {
    overview: <LaborOverview labor={labor} countryData={countryData} />,
    breakdown: <LaborBreakdown labor={labor} countryData={countryData} />,
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
      {(tab) =>
        countryLoading ? (
          <MetricModalLayout.Loading
            variant="labor"
            mainHeight={tab === "overview" ? 300 : 350}
            sidebarCards={tab === "overview" ? 4 : 0}
          />
        ) : (
          (tabs[tab as keyof typeof tabs] ?? null)
        )
      }
    </BaseMetricDetailsModal>
  );
}
