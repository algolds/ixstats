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

const HEALTH_LEVELS = [
  { atLeast: 78, label: "Excellent", color: "text-green" },
  { atLeast: 72, label: "Good", color: "text-label" },
  { atLeast: 65, label: "Average", color: "text-yellow" },
  { atLeast: -Infinity, label: "Below average", color: "text-destructive" },
];

const NOT_RECORDED = { label: "Not recorded", color: "text-label-secondary" };

function getHealthLevel(lifeExpectancy: number) {
  if (!lifeExpectancy) return NOT_RECORDED;
  return HEALTH_LEVELS.find((level) => lifeExpectancy >= level.atLeast) ?? NOT_RECORDED;
}

/** A percentage with one decimal, or an em dash when the value is missing or zero. */
const percentOrDash = (value: number | undefined | null, digits: number) =>
  value ? `${value.toFixed(digits)}%` : "—";

type EconomicData = ReturnType<typeof useCountryEconomicData>;
type DemographicsViewProps = Pick<EconomicData, "countryData"> & {
  demographics: NonNullable<EconomicData["economyData"]>["demographics"];
};

function DemographicsOverview({ demographics, countryData }: DemographicsViewProps) {
  const lifeExpectancy = demographics?.lifeExpectancy || countryData?.lifeExpectancy || 0;
  const healthLevel = getHealthLevel(lifeExpectancy);
  const perThousand = (rate: number | undefined) => `${(rate || 0).toFixed(1)}/1k`;

  return (
    <MetricModalLayout variant="demographics">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          icon={Activity}
          title="Health & vitality"
          subtitle="Population health indicators and quality of life metrics."
          contentClassName="flex flex-1 flex-col justify-center"
        >
          <MetricModalLayout.TileGrid>
            <MetricModalLayout.Tile
              tone="text-destructive"
              valueClassName="tabular-nums"
              value={perThousand(demographics?.deathRate)}
              label="Death rate"
            />
            <MetricModalLayout.Tile
              tone="text-green"
              valueClassName="tabular-nums"
              value={perThousand((demographics?.birthRate || 0) - (demographics?.deathRate || 0))}
              label="Natural growth"
            />
            <MetricModalLayout.Tile
              valueClassName="tabular-nums"
              value={perThousand(demographics?.migrationRate)}
              label="Migration rate"
            />
            <MetricModalLayout.Tile
              valueClassName="tabular-nums"
              value={
                demographics?.dependencyRatio ? `${demographics.dependencyRatio.toFixed(0)}%` : "—"
              }
              label="Dependency ratio"
            />
          </MetricModalLayout.TileGrid>

          <MetricModalLayout.Note icon={Info}>
            Health and Demographics track the biological vitality of your citizens. Balanced median
            age supports stable labor pipelines, while natural population growth sustains
            resource-consumption curves and tax bases.
          </MetricModalLayout.Note>
        </MetricModalLayout.Panel>
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
        <MetricModalLayout.Classification
          label="Health status"
          value={healthLevel.label}
          tone={healthLevel.color}
          icon={Stethoscope}
          description="General wellness index and public health quality level."
        />
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

interface EducationLevel {
  level?: string;
  percentage?: number;
  percent?: number;
  color?: string;
}

function EducationAttainment({ levels }: { levels: EducationLevel[] }) {
  return (
    <div className="mt-8">
      <h4 className="text-label text-headline mb-3">Education attainment</h4>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {levels.slice(0, 8).map((level, i) => (
          <div key={level.level || i} className="bg-fill-3 rounded-row p-3 text-center">
            <div className="text-title-3" style={{ color: level.color || "var(--color-chart-2)" }}>
              {(level.percentage || level.percent || 0).toFixed(0)}%
            </div>
            <div className="text-label-secondary text-footnote mt-1">{level.level}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemographicsDetails({ demographics }: Pick<DemographicsViewProps, "demographics">) {
  const ageGroups = Array.isArray(demographics?.ageDistribution)
    ? (demographics.ageDistribution as Array<{ group?: string; percent?: number }>)
    : [];
  const agePct = (match: (group: string) => boolean): string => {
    const percent = ageGroups.find((a) => a.group && match(a.group))?.percent;
    return percent ? `${percent.toFixed(0)}%` : "—";
  };
  const educationLevels = Array.isArray(demographics?.educationLevels)
    ? (demographics.educationLevels as EducationLevel[])
    : [];

  return (
    <MetricModalLayout variant="demographics">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          title="Age distribution"
          subtitle="Population breakdown by age group"
        >
          <MetricModalLayout.TileGrid>
            <MetricModalLayout.Tile
              value={agePct((g) => g.includes("0-14"))}
              label="0-14 Years"
              labelStyle="footnote"
            />
            <MetricModalLayout.Tile
              tone="text-green"
              value={agePct((g) => g.includes("15-64") || g.includes("15-"))}
              label="15-64 Years"
              labelStyle="footnote"
            />
            <MetricModalLayout.Tile
              value={agePct((g) => g.includes("65"))}
              label="65+ Years"
              labelStyle="footnote"
            />
            <MetricModalLayout.Tile
              value={percentOrDash(demographics?.dependencyRatio, 0)}
              label="Dependency ratio"
              labelStyle="footnote"
            />
          </MetricModalLayout.TileGrid>

          {educationLevels.length > 0 && <EducationAttainment levels={educationLevels} />}
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.SidePanel
          title="Societal structure"
          subtitle="Education & urbanization benchmarks"
        >
          <MetricModalLayout.Metric
            label="Literacy rate"
            tone="text-green"
            value={percentOrDash(demographics?.literacyRate, 1)}
          />
          <MetricModalLayout.Metric
            label="Urban population"
            value={percentOrDash(demographics?.urbanRuralSplit?.urban, 1)}
          />
          <MetricModalLayout.Metric
            label="Rural population"
            tone="text-green"
            value={percentOrDash(demographics?.urbanRuralSplit?.rural, 1)}
          />
        </MetricModalLayout.SidePanel>
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

export function DemographicsHealthModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: DemographicsHealthModalProps) {
  const {
    countryData,
    economyData,
    isLoading: countryLoading,
  } = useCountryEconomicData(countryId, isOpen);
  const demographics = economyData?.demographics;

  const tabs = {
    overview: <DemographicsOverview demographics={demographics} countryData={countryData} />,
    details: <DemographicsDetails demographics={demographics} />,
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
      {(tab) =>
        countryLoading ? (
          <MetricModalLayout.Loading
            variant="demographics"
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
