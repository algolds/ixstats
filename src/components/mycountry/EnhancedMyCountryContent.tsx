"use client";

import dynamic from "next/dynamic";
import { CountryMetricsGrid, VitalityRings, useCountryData, HeroSection } from "./primitives";
import { useFlag } from "~/hooks/useFlag";
import { useOverviewHealthRings } from "~/hooks/useOverviewHealthRings";

// Dynamic import — MyCountryTabSystem is 2,496 lines with heavy recharts/modal imports.
// Lazy-loading it saves ~200KB from the initial bundle and reduces dev memory pressure.
const MyCountryTabSystem = dynamic(
  () => import("./MyCountryTabSystem").then((m) => ({ default: m.MyCountryTabSystem })),
  { ssr: false }
);
const OverviewIssuesBanner = dynamic(
  () => import("./MyCountryTabSystem").then((m) => ({ default: m.OverviewIssuesBanner })),
  { ssr: false }
);
import { api } from "~/trpc/react";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { VaultWidget } from "./VaultWidget";
import type { MyCountrySection } from "./MyCountrySidebarNav";

const CountryMapWidget = dynamic(
  () => import("~/components/maps/widgets/CountryMapWidget").then((m) => ({ default: m.CountryMapWidget })),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-xl bg-muted" /> }
);

interface EnhancedMyCountryContentProps {
  variant?: "unified" | "standard" | "premium";
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

export function EnhancedMyCountryContent({
  variant = "unified",
  activeSection,
  onNavigate,
  notifications,
}: EnhancedMyCountryContentProps) {
  const { country, isLoading } = useCountryData();
  const { flagUrl } = useFlag(country?.name || "");
  const { rings: healthRings } = useOverviewHealthRings({
    countryId: country?.id,
    onNavigate,
  });

  // Fetch existing government components
  const { data: existingComponents } = api.government.getComponents.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );

  // Fetch Defense overview metrics
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  // Prepare metrics for the grid
  const metrics = [
    {
      label: "Population",
      value: `${Math.round((country.currentPopulation || 0) / 1000000)}M`,
      subtext: `${(country.currentPopulation || 0).toLocaleString()} citizens`,
      colorClass: "bg-blue-50 dark:bg-blue-950/50 text-blue-600",
      tooltip: {
        title: "Current Population",
        details: [
          `Total: ${(country.currentPopulation || 0).toLocaleString()} citizens`,
          `Population Tier: ${country.populationTier || "Unknown"}`,
        ],
      },
    },
    {
      label: "GDP/Capita",
      value: `$${((country.currentGdpPerCapita || 0) / 1000).toFixed(0)}k`,
      subtext: `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
      colorClass: "bg-green-50 dark:bg-green-950/50 text-green-600",
      tooltip: {
        title: "GDP per Capita",
        details: [
          `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
          "Economic strength indicator",
        ],
      },
    },
    {
      label: "Growth",
      value: `${((country.adjustedGdpGrowth || 0) * 100).toFixed(2)}%`,
      subtext: "Adjusted GDP growth rate",
      colorClass: "bg-purple-50 dark:bg-purple-950/50 text-purple-600",
      tooltip: {
        title: "Economic Growth Rate",
        details: [
          "Adjusted GDP growth rate after global factors",
          (country.adjustedGdpGrowth || 0) > 0.05
            ? "Strong growth"
            : (country.adjustedGdpGrowth || 0) > 0.02
              ? "Moderate growth"
              : (country.adjustedGdpGrowth || 0) > 0
                ? "Slow growth"
                : "Declining",
        ],
      },
    },
    {
      label: "Economic Tier",
      value: country.economicTier || "Unknown",
      subtext: "Development classification",
      colorClass: "bg-orange-50 dark:bg-orange-950/50 text-orange-600",
      tooltip: {
        title: "Economic Development Tier",
        details: [
          "Based on GDP per capita and economic indicators",
          `Current classification: ${country.economicTier || "Unknown"}`,
        ],
      },
    },
  ];

  // Add atomic governance metrics
  if (existingComponents && existingComponents.length > 0) {
    const avgEffectiveness =
      existingComponents.reduce((sum, c) => sum + c.effectivenessScore, 0) /
      existingComponents.length;
    const totalComponents = existingComponents.length;

    metrics.push({
      label: "Gov Score",
      value: `${avgEffectiveness.toFixed(0)}%`,
      subtext: `${totalComponents} atomic components`,
      colorClass: "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600",
      tooltip: {
        title: "Government Effectiveness",
        details: [
          `Average effectiveness: ${avgEffectiveness.toFixed(1)}%`,
          `${totalComponents} government components active`,
          "Based on atomic component analysis",
        ],
      },
    });
  }

  // Add Defense metrics
  if (defenseOverview) {
    metrics.push({
      label: "Security",
      value: `${defenseOverview.overallScore}`,
      subtext: defenseOverview.securityLevel.replace("_", " "),
      colorClass:
        defenseOverview.overallScore >= 75
          ? "bg-green-50 dark:bg-green-950/50 text-green-600"
          : defenseOverview.overallScore >= 50
            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600"
            : defenseOverview.overallScore >= 25
              ? "bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600"
              : "bg-red-50 dark:bg-red-950/50 text-red-600",
      tooltip: {
        title: "National Security Status",
        details: [
          `Overall Score: ${defenseOverview.overallScore}/100`,
          `Security Level: ${defenseOverview.securityLevel.replace("_", " ").toUpperCase()}`,
          `Military Strength: ${defenseOverview.militaryStrength}%`,
          `${defenseOverview.branchCount} military branches`,
          `${defenseOverview.activeThreats} active threats`,
        ],
      },
    });
  }

  return (
    <MyCountrySidebarLayout
      heroSection={
        <HeroSection
          country={{
            id: country.id,
            name: country.name,
            currentGdp: country.currentGdp,
            currentPopulation: country.currentPopulation,
            adjustedGdpGrowth: country.adjustedGdpGrowth,
            currentGdpPerCapita: country.currentGdpPerCapita,
            economicTier: country.economicTier,
            populationTier: country.populationTier,
            continent: country.continent,
            landArea: country.landArea,
          }}
          flagUrl={flagUrl}
          showMetrics={true}
          showEditButton={true}
        />
      }
      sidebarExtra={variant === "unified" ? (
        <>
          <VaultWidget />
          <CountryMapWidget
            countryId={country.id}
            countryName={country.name}
            borderColor="border-amber-500/15"
            fullMapUrl={`/maps?country=${country.id}`}
          />
        </>
      ) : undefined}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {/* Section Health Rings + Pending Issues */}
      {variant === "unified" && (
        <>
          <VitalityRings rings={healthRings} title="Country Health" variant="grid" />
          <OverviewIssuesBanner countryId={country.id} />
        </>
      )}

      {/* Metrics Grid for non-unified variants */}
      {variant !== "unified" && (
        <CountryMetricsGrid
          metrics={metrics}
          variant={variant === "premium" ? "executive" : "standard"}
        />
      )}

      {/* Vitality Rings for non-unified variants */}
      {variant !== "unified" && (
        <VitalityRings rings={healthRings} title="Section Health" variant="grid" />
      )}

      {/* Tab System */}
      <div id="tabs">
        <MyCountryTabSystem variant={variant} />
      </div>
    </MyCountrySidebarLayout>
  );
}
