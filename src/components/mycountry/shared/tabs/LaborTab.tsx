"use client";

import React from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  type DataTabProps,
  MetricToggleGrid,
  StatGrid,
  TabShell,
  ToggleMetric,
  toggleView,
  useAccordion,
} from "./tabParts";
import { formatExactCurrency, formatPercent } from "~/lib/utils";
import {
  StatUp as TrendingUp,
  Suitcase as Briefcase,
  Group as Users,
  Dollar as DollarSign,
} from "iconoir-react";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";
import type { MetricType } from "~/hooks/useMetricDetailsModal";

const EMPLOYMENT_SECTORS = [
  {
    id: "agriculture",
    name: "Agriculture",
    color: "green",
    description: "Farming, forestry, fishing",
    imageKeyword: "labor_primary",
  },
  {
    id: "industry",
    name: "Industry",
    color: "blue",
    description: "Manufacturing, construction",
    imageKeyword: "labor_secondary",
  },
  {
    id: "services",
    name: "Services",
    color: "purple",
    description: "Trade, finance, healthcare",
    imageKeyword: "labor_tertiary",
  },
] as const;

const EMPLOYMENT_TYPES = [
  { id: "fulltime", key: "fullTime", name: "Full-Time", color: "emerald" },
  { id: "parttime", key: "partTime", name: "Part-Time", color: "blue" },
  { id: "selfemployed", key: "selfEmployed", name: "Self-Employed", color: "amber" },
  { id: "temporary", key: "temporary", name: "Temporary", color: "purple" },
  { id: "informal", key: "informal", name: "Informal", color: "red" },
] as const;

function UnemploymentBadge({ rate }: { rate: number }) {
  if (rate < 4) return <span className="text-caption text-green font-semibold">Low</span>;
  if (rate > 8) return <span className="text-destructive text-caption font-semibold">High</span>;
  return <span className="text-caption text-yellow font-semibold">Stable</span>;
}

type Labor = DataTabProps["economyData"]["labor"];
type SectionProps = { labor: Labor; section: ReturnType<typeof useAccordion> };

function LaborMetrics({
  country,
  labor,
  currency,
  metricView,
  setMetricViewAction,
  openMetricModalAction,
}: Pick<
  DataTabProps,
  "country" | "metricView" | "setMetricViewAction" | "openMetricModalAction"
> & { labor: Labor; currency: string }) {
  const participation = formatPercent(labor?.laborForceParticipationRate ?? 0);
  const unemploymentRate = labor?.unemploymentRate ?? 0;
  const openMetric = (metric: MetricType) => () => openMetricModalAction(metric, country.id);
  const isParticipation = metricView.workforce === "participation";
  const isEmployed = metricView.employment === "employed";
  const isMinimum = metricView.compensation === "minimum";

  return (
    <MetricToggleGrid>
      <ToggleMetric
        label={isParticipation ? "Participation Rate" : "Total Workforce"}
        valueKey={metricView.workforce}
        value={isParticipation ? participation : (labor?.totalWorkforce ?? 0).toLocaleString()}
        detail={isParticipation ? "Active workforce share" : `${participation} participation`}
        onToggle={() => toggleView(setMetricViewAction, "workforce", "participation", "count")}
        onValueClick={openMetric("labor-force")}
      />
      <ToggleMetric
        label={isEmployed ? "Employment Rate" : "Unemployment Rate"}
        valueKey={metricView.employment}
        value={formatPercent((isEmployed ? labor?.employmentRate : unemploymentRate) ?? 0)}
        aside={<UnemploymentBadge rate={unemploymentRate} />}
        detail={isEmployed ? "Active employment share" : "Seeking employment"}
        onToggle={() => toggleView(setMetricViewAction, "employment", "employed", "unemployed")}
        onValueClick={openMetric(isEmployed ? "employment" : "unemployment")}
      />
      <ToggleMetric
        label={isMinimum ? "Minimum Wage" : "Average Wage"}
        valueKey={metricView.compensation}
        value={formatExactCurrency(
          (isMinimum ? labor?.minimumWage : labor?.averageAnnualIncome) ?? 0,
          currency
        )}
        detail={isMinimum ? "Per year (mandatory)" : "Average annual salary"}
        onToggle={() => toggleView(setMetricViewAction, "compensation", "minimum", "average")}
        onValueClick={openMetric("labor-force")}
      />
    </MetricToggleGrid>
  );
}

function WorkforceSection({ labor, section }: SectionProps) {
  const totalWorkforce = labor?.totalWorkforce ?? 0;
  return (
    <CollapsibleSection icon={Users} title="Workforce overview" {...section("workforce")}>
      <StatGrid
        inset
        stats={[
          {
            label: "Labor force",
            value: totalWorkforce.toLocaleString(),
            detail: "Active workforce",
          },
          {
            label: "Participation",
            value: formatPercent(labor?.laborForceParticipationRate ?? 0),
            detail: "Working-age share",
          },
          {
            label: "Employment",
            value: formatPercent(labor?.employmentRate ?? 0),
            detail: "Employed portion",
          },
          {
            label: "Unemployment",
            value: formatPercent(labor?.unemploymentRate ?? 0),
            detail: "Actively seeking",
          },
        ]}
      />

      <SectorBreakdownCard
        title="Employment by sector"
        subtitle="Distribution of workforce across economic sectors"
        layout="grid"
        showTrends={false}
        showSectorImages={true}
        valueAsPeople={true}
        sectors={EMPLOYMENT_SECTORS.map(({ id, ...sector }) => {
          const percentage = labor?.employmentBySector?.[id] ?? 0;
          return { id, ...sector, value: totalWorkforce * (percentage / 100), percentage };
        })}
        totalValue={totalWorkforce}
      />
    </CollapsibleSection>
  );
}

function CompensationSection({ labor, section, currency }: SectionProps & { currency: string }) {
  return (
    <CollapsibleSection icon={DollarSign} title="Compensation & wages" {...section("compensation")}>
      <StatGrid
        inset
        stats={[
          {
            label: "Average annual income",
            value: formatExactCurrency(labor?.averageAnnualIncome ?? 0, currency),
            detail: "Mean earnings",
          },
          {
            label: "Minimum wage",
            value: formatExactCurrency(labor?.minimumWage ?? 0, currency),
            detail: "Per year",
          },
          {
            label: "Average work week",
            value: `${labor?.averageWorkweekHours ?? 0}h`,
            detail: "Hours per week",
          },
          {
            label: "Productivity index",
            value: (labor?.skillsAndProductivity?.laborProductivityIndex ?? 0).toFixed(0),
            detail: "Output efficiency",
          },
        ]}
      />

      <SectorBreakdownCard
        title="Employment types"
        subtitle="Breakdown by employment arrangement"
        layout="list"
        showProgressBars={true}
        sectors={EMPLOYMENT_TYPES.map(({ key, ...type }) => {
          const share = labor?.employmentByType?.[key] ?? 0;
          return { ...type, value: share, percentage: share };
        })}
      />
    </CollapsibleSection>
  );
}

function HumanCapitalSection({
  labor,
  literacyRate,
  section,
}: SectionProps & { literacyRate: number }) {
  const skills = labor?.skillsAndProductivity;
  return (
    <CollapsibleSection
      icon={TrendingUp}
      title="Human capital & skills"
      {...section("human-capital")}
    >
      <StatGrid
        inset
        stats={[
          {
            label: "Education years",
            value: `${(skills?.averageEducationYears ?? 0).toFixed(1)} years`,
            detail: "Schooling duration",
          },
          {
            label: "Tertiary ed rate",
            value: formatPercent(skills?.tertiaryEducationRate ?? 0),
            detail: "University graduates",
          },
          {
            label: "Vocational rate",
            value: formatPercent(skills?.vocationalTrainingRate ?? 0),
            detail: "Technical certified",
          },
          {
            label: "Youth Unemp.",
            value: formatPercent(labor?.youthUnemploymentRate ?? 0),
            detail: "Age 15-24 unemployed",
          },
        ]}
      />

      <SectorBreakdownCard
        title="Skills & capital metrics"
        subtitle="National human capital and education stats"
        layout="list"
        showProgressBars={true}
        sectors={[
          {
            id: "literacy",
            name: "Adult literacy rate",
            value: 0,
            percentage: literacyRate,
            color: "emerald",
          },
          {
            id: "tertiary",
            name: "Tertiary education rate",
            value: 0,
            percentage: skills?.tertiaryEducationRate ?? 0,
            color: "blue",
          },
          {
            id: "skills-gap",
            name: "Skills gap index",
            value: 0,
            percentage: skills?.skillsGapIndex ?? 0,
            color: "purple",
          },
        ]}
      />
    </CollapsibleSection>
  );
}

export function LaborTab({
  country,
  economyData,
  countryImageData,
  setImageUploadModalAction,
  openMetricModalAction,
  metricView,
  setMetricViewAction,
}: DataTabProps) {
  const section = useAccordion("workforce");
  const currency = country?.nationalIdentity?.currency || "USD";
  const labor = economyData?.labor;

  return (
    <TabShell
      country={country}
      countryImageData={countryImageData}
      setImageUploadModalAction={setImageUploadModalAction}
      cardType="labor"
      title="Labor & workforce"
      help="View national employment rates, labor participation, wages, and education levels. Click values to open historical charts and details."
      subtitle={`Employment, wages, and human capital for ${country.name}`}
      editorIcon={Briefcase}
      metrics={
        <LaborMetrics
          country={country}
          labor={labor}
          currency={currency}
          metricView={metricView}
          setMetricViewAction={setMetricViewAction}
          openMetricModalAction={openMetricModalAction}
        />
      }
    >
      <WorkforceSection labor={labor} section={section} />
      <CompensationSection labor={labor} section={section} currency={currency} />
      <HumanCapitalSection
        labor={labor}
        section={section}
        literacyRate={economyData?.demographics?.literacyRate ?? 0}
      />
    </TabShell>
  );
}
