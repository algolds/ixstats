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
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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

export function GovernmentSpendingModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: GovernmentSpendingModalProps) {
  // Fetch country data + mapped economyData
  const {
    countryData,
    economyData,
    isLoading: countryLoading,
  } = useCountryEconomicData(countryId, isOpen);

  // Fetch government structure
  const { data: governmentData, isLoading: govLoading } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId && isOpen }
  );

  const isLoading = countryLoading || govLoading;

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
    if (isLoading) {
      return <MetricModalLayout.Loading variant="economy" mainHeight={300} sidebarCards={4} />;
    }

    const fiscal = economyData?.fiscal;
    const spending = economyData?.spending;
    const totalBudget = governmentData?.totalBudget || spending?.totalSpending || 0;
    const gdp = countryData?.currentTotalGdp || 1;
    const spendingGdpPercent = spending?.spendingGDPPercent || (totalBudget / gdp) * 100;
    const budgetBalance = fiscal?.budgetDeficitSurplus || 0;

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Landmark className="text-label-secondary h-5 w-5" />
                Budget summary
              </h3>
              <p className="text-label-secondary text-body">
                Government fiscal allocation and spending summary.
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    ${((fiscal?.governmentRevenueTotal || 0) / 1e9).toFixed(1)}B
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Tax revenue
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">
                    {(fiscal?.taxRevenueGDPPercent || 0).toFixed(1)}%
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Revenue % GDP
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    $
                    {(
                      (((fiscal?.totalDebtGDPRatio || 0) / 100) *
                        (countryData?.currentTotalGdp || 0)) /
                      1e9
                    ).toFixed(1)}
                    B
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Public debt
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-destructive text-title-3">
                    {(fiscal?.totalDebtGDPRatio || 0).toFixed(1)}%
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Debt to GDP
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
                  Budget dynamics balance societal infrastructure investments with revenue
                  collections. Stable surpluses build cash reserves, while persistent deficits
                  expand public debt limits and require careful interest rate servicing.
                </p>
              </Card>
            </CardContent>
          </Card>
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
            value={budgetBalance / 1e9}
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
  };

  const renderBreakdownTab = () => {
    if (isLoading) {
      return <MetricModalLayout.Loading variant="economy" mainHeight={350} sidebarCards={0} />;
    }

    const spending = economyData?.spending;
    const spendingCategories = spending?.spendingCategories;
    const categories: Array<{ name: string; value: number; color: string }> =
      spendingCategories && spendingCategories.length > 0
        ? (spendingCategories as Array<{ category: string; percent?: number; gdpPercent?: number }>)
            .slice(0, 6)
            .map((cat, i) => ({
              name: cat.category,
              value: cat.percent || cat.gdpPercent || 0,
              color: SPENDING_COLORS[i % SPENDING_COLORS.length] ?? "var(--color-blue-500)",
            }))
        : [];

    // No recorded split (or a visitor: the allocation split is served to the owner only).
    if (categories.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <PieChart className="text-label-secondary mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-label-secondary">No spending breakdown available</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Spending by category</h3>
              <p className="text-label-secondary text-body">
                Budget allocation across government sectors
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center gap-6 p-0 md:flex-row">
              {/* Pie Chart */}
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
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-elevated)",
                        color: "var(--color-label)",
                        borderColor: "var(--color-separator)",
                        borderRadius: "8px",
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Category List */}
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
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>
      </MetricModalLayout>
    );
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
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default GovernmentSpendingModal;
