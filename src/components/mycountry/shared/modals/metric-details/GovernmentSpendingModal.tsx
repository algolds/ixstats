"use client";

import React from "react";
import {
  Building,
  Dollar as DollarSign,
  StatsReport as BarChart3,
  Reports as PieChart,
  Wallet,
  ScaleFrameEnlarge as Scale,
  Bank as Landmark,
  InfoCircle as Info,
} from "iconoir-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
import { api } from "~/trpc/react";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import { CHART_TOOLTIP_STYLE } from "./types";

interface GovernmentSpendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName?: string;
}

const TABS: MetricModalTab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "breakdown", label: "Breakdown", icon: PieChart },
];

const SPENDING_COLORS = [
  "var(--color-blue-500)", // blue - education
  "var(--color-destructive)", // red - healthcare
  "var(--chart-3)", // green - defense
  "var(--color-amber-500)", // amber - social
  "var(--chart-5)", // indigo - infrastructure
  "var(--chart-2)", // cyan - other
];

type EconomicData = ReturnType<typeof useCountryEconomicData>;
type SpendingViewProps = Pick<EconomicData, "countryData" | "economyData">;

const billions = (amount: number) => `$${(amount / 1e9).toFixed(1)}B`;

function SpendingOverview({
  countryData,
  economyData,
  governmentBudget,
}: SpendingViewProps & { governmentBudget: number | null | undefined }) {
  const fiscal = economyData?.fiscal;
  const spending = economyData?.spending;
  const gdp = countryData?.currentTotalGdp || 0;
  const totalBudget = governmentBudget || spending?.totalSpending || 0;
  const spendingGdpPercent = spending?.spendingGDPPercent || (totalBudget / (gdp || 1)) * 100;
  const debtRatio = fiscal?.totalDebtGDPRatio || 0;

  return (
    <MetricModalLayout variant="economy">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          icon={Landmark}
          title="Budget summary"
          subtitle="Government fiscal allocation and spending summary."
          contentClassName="flex flex-1 flex-col justify-center"
        >
          <MetricModalLayout.TileGrid>
            <MetricModalLayout.Tile
              value={billions(fiscal?.governmentRevenueTotal || 0)}
              label="Tax revenue"
            />
            <MetricModalLayout.Tile
              tone="text-green"
              value={`${(fiscal?.taxRevenueGDPPercent || 0).toFixed(1)}%`}
              label="Revenue % GDP"
            />
            <MetricModalLayout.Tile value={billions((debtRatio / 100) * gdp)} label="Public debt" />
            <MetricModalLayout.Tile
              tone="text-destructive"
              value={`${debtRatio.toFixed(1)}%`}
              label="Debt to GDP"
            />
          </MetricModalLayout.TileGrid>

          <MetricModalLayout.Note icon={Info}>
            Budget dynamics balance societal infrastructure investments with revenue collections.
            Stable surpluses build cash reserves, while persistent deficits expand public debt
            limits and require careful interest rate servicing.
          </MetricModalLayout.Note>
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.StatCard
          label="Total budget"
          value={totalBudget / 1e9}
          prefix="$"
          suffix="B"
          decimalPlaces={1}
          icon={Wallet}
          variant="economy"
        />
        <MetricModalLayout.StatCard
          label="Budget % GDP"
          value={spendingGdpPercent}
          suffix="%"
          decimalPlaces={1}
          icon={PieChart}
          variant="economy"
        />
        <MetricModalLayout.StatCard
          label="Budget balance"
          value={(fiscal?.budgetDeficitSurplus || 0) / 1e9}
          prefix="$"
          suffix="B"
          decimalPlaces={1}
          icon={Scale}
          variant="economy"
        />
        <MetricModalLayout.StatCard
          label="Per capita spending"
          value={totalBudget / (countryData?.currentPopulation || 1)}
          prefix="$"
          decimalPlaces={0}
          icon={DollarSign}
          variant="economy"
        />
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

function SpendingBreakdown({ economyData }: Pick<SpendingViewProps, "economyData">) {
  const spendingCategories = (economyData?.spending?.spendingCategories ?? []) as Array<{
    category: string;
    percent?: number;
    gdpPercent?: number;
  }>;
  const categories = spendingCategories.slice(0, 6).map((cat, i) => ({
    name: cat.category,
    value: cat.percent || cat.gdpPercent || 0,
    color: SPENDING_COLORS[i % SPENDING_COLORS.length] ?? "var(--color-blue-500)",
  }));

  // No recorded split (or a visitor: the allocation split is served to the owner only).
  if (categories.length === 0) {
    return <MetricModalLayout.Empty icon={PieChart} message="No spending breakdown available" />;
  }

  return (
    <MetricModalLayout variant="economy">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          title="Spending by category"
          subtitle="Budget allocation across government sectors"
          contentClassName="flex flex-1 flex-col items-center gap-6 md:flex-row"
        >
          <div className="flex h-44 w-44 shrink-0 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          <div className="max-h-[220px] w-full flex-1 space-y-2 overflow-y-auto pr-1">
            {categories.map((category) => (
              <div
                key={category.name}
                className="bg-fill-3 rounded-row text-footnote flex items-center justify-between p-2"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-label-secondary font-medium">{category.name}</span>
                </div>
                <span className="text-label font-semibold tabular-nums">
                  {category.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>
    </MetricModalLayout>
  );
}

export function GovernmentSpendingModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: GovernmentSpendingModalProps) {
  const {
    countryData,
    economyData,
    isLoading: countryLoading,
  } = useCountryEconomicData(countryId, isOpen);

  const { data: governmentData, isLoading: govLoading } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId && isOpen }
  );

  const isLoading = countryLoading || govLoading;

  const tabs = {
    overview: (
      <SpendingOverview
        countryData={countryData}
        economyData={economyData}
        governmentBudget={governmentData?.totalBudget}
      />
    ),
    breakdown: <SpendingBreakdown economyData={economyData} />,
  };

  return (
    <BaseMetricDetailsModal
      isOpen={isOpen}
      onClose={onClose}
      countryId={countryId}
      countryName={countryName}
      title="Government spending analysis"
      description="Budget allocation and fiscal metrics"
      icon={Building}
      iconColor="text-yellow"
      tabs={TABS}
      isLoading={isLoading}
      variant="economy"
    >
      {(tab) =>
        isLoading ? (
          <MetricModalLayout.Loading
            variant="economy"
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
