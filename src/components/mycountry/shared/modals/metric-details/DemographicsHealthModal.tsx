"use client";

import React from "react";
import {
  Heart,
  StatsReport as BarChart3,
  InfoCircle as Info,
  Activity,
  Lullaby as Baby,
  Clock,
  Healthcare as Stethoscope,
} from "iconoir-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface DemographicsHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName?: string;
}

const TABS: MetricModalTab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "details", label: "Details", icon: Info },
];

export function DemographicsHealthModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: DemographicsHealthModalProps) {
  // Fetch country data + mapped economyData
  const {
    countryData,
    economyData,
    isLoading: countryLoading,
  } = useCountryEconomicData(countryId, isOpen);

  const getHealthLevel = (
    lifeExpectancy: number
  ): {
    label: string;
    color: string;
    bg: string;
    border: string;
    variant: "default" | "secondary" | "destructive";
  } => {
    if (!lifeExpectancy)
      return {
        label: "Not recorded",
        color: "text-label-secondary",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "secondary",
      };
    if (lifeExpectancy >= 78)
      return {
        label: "Excellent",
        color: "text-green",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "default",
      };
    if (lifeExpectancy >= 72)
      return {
        label: "Good",
        color: "text-label",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "default",
      };
    if (lifeExpectancy >= 65)
      return {
        label: "Average",
        color: "text-yellow",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "secondary",
      };
    return {
      label: "Below average",
      color: "text-destructive",
      bg: "bg-fill-3",
      border: "border-separator",
      variant: "destructive",
    };
  };

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case "overview":
        return renderOverviewTab();
      case "details":
        return renderDetailsTab();
      default:
        return null;
    }
  };

  const renderOverviewTab = () => {
    if (countryLoading) {
      return <MetricModalLayout.Loading variant="demographics" mainHeight={300} sidebarCards={4} />;
    }

    const demographics = economyData?.demographics;
    const lifeExpectancy = demographics?.lifeExpectancy || countryData?.lifeExpectancy || 0;
    const healthLevel = getHealthLevel(lifeExpectancy);

    return (
      <MetricModalLayout variant="demographics">
        <MetricModalLayout.MainArea>
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Activity className="text-label-secondary h-5 w-5" />
                Health & vitality
              </h3>
              <p className="text-label-secondary text-body">
                Population health indicators and quality of life metrics.
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-destructive text-title-3 tabular-nums">
                    {(demographics?.deathRate || 0).toFixed(1)}/1k
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Death rate
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green tabular-nums">
                    {((demographics?.birthRate || 0) - (demographics?.deathRate || 0)).toFixed(1)}
                    /1k
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Natural growth
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3 tabular-nums">
                    {(demographics?.migrationRate || 0).toFixed(1)}/1k
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Migration rate
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3 tabular-nums">
                    {demographics?.dependencyRatio
                      ? `${demographics.dependencyRatio.toFixed(0)}%`
                      : "—"}
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Dependency ratio
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
                  Health and Demographics track the biological vitality of your citizens. Balanced
                  median age supports stable labor pipelines, while natural population growth
                  sustains resource-consumption curves and tax bases.
                </p>
              </Card>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Life expectancy"
            value={lifeExpectancy}
            suffix=" yrs"
            decimalPlaces={1}
            icon={Heart}
            variant="demographics"
          />
          <MetricModalLayout.StatCard
            label="Birth rate"
            value={demographics?.birthRate || 0}
            suffix=" /1k"
            decimalPlaces={1}
            icon={Baby}
            variant="demographics"
          />
          <MetricModalLayout.StatCard
            label="Median age"
            value={demographics?.medianAge || countryData?.medianAge || 0}
            suffix=" yrs"
            decimalPlaces={1}
            icon={Clock}
            variant="demographics"
          />

          <div
            className={`rounded-row relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden border p-4 ${healthLevel.bg} ${healthLevel.border}`}
          >
            <div>
              <span className="text-stat-label text-label-secondary block">Health status</span>
              <div className="mt-2">
                <span className={`text-title-3 ${healthLevel.color}`}>{healthLevel.label}</span>
              </div>
            </div>
            <p className="text-label-secondary text-footnote mt-4 flex items-center gap-2 leading-relaxed">
              <Stethoscope className="h-3 w-3 shrink-0" />
              General wellness index and public health quality level.
            </p>
          </div>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderDetailsTab = () => {
    if (countryLoading) {
      return <MetricModalLayout.Loading variant="demographics" mainHeight={350} sidebarCards={0} />;
    }

    const demographics = economyData?.demographics;
    const ageDistribution = demographics?.ageDistribution;
    const ageGroups = Array.isArray(ageDistribution)
      ? (ageDistribution as Array<{ group?: string; percent?: number }>)
      : [];
    const agePct = (match: (group: string) => boolean): string => {
      const percent = ageGroups.find((a) => a.group && match(a.group))?.percent;
      return percent ? `${percent.toFixed(0)}%` : "—";
    };
    const youthPct = agePct((g) => g.includes("0-14"));
    const workingPct = agePct((g) => g.includes("15-64") || g.includes("15-"));
    const elderlyPct = agePct((g) => g.includes("65"));
    const dash = (value: number | undefined | null, digits: number) =>
      value ? `${value.toFixed(digits)}%` : "—";

    return (
      <MetricModalLayout variant="demographics">
        <MetricModalLayout.MainArea>
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Age distribution</h3>
              <p className="text-label-secondary text-body">Population breakdown by age group</p>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">{youthPct}</div>
                  <div className="text-label-secondary text-footnote mt-1">0-14 Years</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">{workingPct}</div>
                  <div className="text-label-secondary text-footnote mt-1">15-64 Years</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">{elderlyPct}</div>
                  <div className="text-label-secondary text-footnote mt-1">65+ Years</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    {dash(demographics?.dependencyRatio, 0)}
                  </div>
                  <div className="text-label-secondary text-footnote mt-1">Dependency ratio</div>
                </Card>
              </div>

              {demographics?.educationLevels &&
                Array.isArray(demographics.educationLevels) &&
                demographics.educationLevels.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-label text-headline mb-3">Education attainment</h4>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {(
                        demographics.educationLevels as Array<{
                          level?: string;
                          percentage?: number;
                          percent?: number;
                          color?: string;
                        }>
                      )
                        .slice(0, 8)
                        .map((level, i) => (
                          <div
                            key={level.level || i}
                            className="bg-fill-3 rounded-row p-3 text-center"
                          >
                            <div
                              className="text-title-3"
                              style={{ color: level.color || "var(--color-chart-2)" }}
                            >
                              {(level.percentage || level.percent || 0).toFixed(0)}%
                            </div>
                            <div className="text-label-secondary text-footnote mt-1">
                              {level.level}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <Card className="flex flex-1 flex-col justify-between p-4">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 text-headline">Societal structure</h3>
              <p className="text-label-secondary text-footnote">
                Education & urbanization benchmarks
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Literacy rate</span>
                <div className="text-title-3 text-green mt-1">
                  {dash(demographics?.literacyRate, 1)}
                </div>
              </Card>

              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Urban population</span>
                <div className="text-label text-title-3 mt-1">
                  {dash(demographics?.urbanRuralSplit?.urban, 1)}
                </div>
              </Card>

              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Rural population</span>
                <div className="text-title-3 text-green mt-1">
                  {dash(demographics?.urbanRuralSplit?.rural, 1)}
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
      title="Demographics & health"
      description="Population health and quality of life metrics"
      icon={Heart}
      iconColor="text-green"
      tabs={TABS}
      isLoading={countryLoading}
      variant="demographics"
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}
