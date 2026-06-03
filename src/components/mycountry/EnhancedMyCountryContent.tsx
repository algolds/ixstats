"use client";

import dynamic from "next/dynamic";
import { useCountryData, HeroSection } from "./primitives";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { useOverviewHealthRings } from "~/hooks/useOverviewHealthRings";
import { PillarCards } from "./PillarCards";

// Dynamic import — MyCountryTabSystem is heavy with recharts/modal imports.
// Only load when rendered below the PillarCards hub.
const MyCountryTabSystem = dynamic(
  () => import("./MyCountryTabSystem").then((m) => ({ default: m.MyCountryTabSystem })),
  { ssr: false }
);
import { api } from "~/trpc/react";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import type { MyCountrySection } from "./MyCountrySidebarNav";

const CountryMapWidget = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapWidget").then((m) => ({
      default: m.CountryMapWidget,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-48 animate-pulse rounded-xl" /> }
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

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  return (
    <MyCountrySidebarLayout
      heroSection={
        <HeroSection
          country={{
            id: country.id,
            name: country.name,
            currentTotalGdp:
              (country as any).currentTotalGdp ??
              (country.currentPopulation && country.currentGdpPerCapita
                ? country.currentPopulation * country.currentGdpPerCapita
                : 0),
            currentPopulation: country.currentPopulation,
            adjustedGdpGrowth: country.adjustedGdpGrowth,
            currentGdpPerCapita: country.currentGdpPerCapita,
            economicTier: country.economicTier,
            populationTier: country.populationTier,
            continent: country.continent,
            landArea: country.landArea,
            officialName: (country as any).nationalIdentity?.officialName ?? null,
          }}
          flagUrl={flagUrl}
          showMetrics={true}
          showEditButton={true}
          healthRings={healthRings}
        />
      }
      sidebarExtra={
        variant === "unified" ? (
          <>
            <CountryMapWidget
              countryId={country.id}
              countryName={country.name}
              borderColor="border-amber-500/15"
              fullMapUrl={`/maps?country=${country.id}`}
            />
          </>
        ) : undefined
      }
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {/* Gameplay Pillar Cards — the command center hub */}
      {onNavigate && <PillarCards countryId={country.id} onNavigate={onNavigate} />}

      {/* Economy & Government tabs (slimmed down from original 6-tab system) */}
      <div id="tabs">
        <MyCountryTabSystem variant={variant} />
      </div>
    </MyCountrySidebarLayout>
  );
}
