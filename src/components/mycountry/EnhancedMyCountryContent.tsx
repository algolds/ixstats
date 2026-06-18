"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import { useState } from "react";
import dynamic from "next/dynamic";
import { useCountryData, SectionShell, InlineWiki } from "./primitives";
// eslint-disable-next-line unused-imports/no-unused-imports
import { OverviewHero } from "./OverviewHero";
import { OverviewSidebarWidget } from "./sidebar-widgets/OverviewSidebarWidget";
import { SetupChecklist } from "./SetupChecklist";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import { useMyCountryNavigation } from "~/hooks/useMyCountryNavigation";
import { CountryWireframe } from "./CountryWireframe";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";

// Dynamic import — MyCountryTabSystem is heavy with recharts/modal imports.
const MyCountryTabSystem = dynamic(
  () => import("./MyCountryTabSystem").then((m) => ({ default: m.MyCountryTabSystem })),
  { ssr: false }
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
  const { activeTab } = useMyCountryNavigation();

  const { data: geoBundle, isLoading: isGeoLoading } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id && activeTab === "geography", staleTime: 30_000 }
  );

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  const geographyHero = (
    <div className="border-border bg-card/40 relative h-72 w-full overflow-hidden rounded-xl border shadow-lg sm:h-96">
      {isGeoLoading ? (
        <div className="flex h-full w-full items-center justify-center bg-[#0a1628]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <CountryWireframe
          geometry={(geoBundle?.geometry as import("geojson").Geometry | null) ?? null}
          cities={geoBundle?.cities ?? []}
          label="Country Outline"
        />
      )}
    </div>
  );

  return (
    <SectionShell
      section="overview"
      contextWidget={<OverviewSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
      hero={activeTab === "geography" ? geographyHero : undefined}
    >
      {/* New-player onboarding — self-hides once established */}
      {country?.id && <SetupChecklist countryId={country.id} onNavigate={onNavigate} />}

      {/* Economy, Labor, Government, Geography tabs */}
      <div id="tabs">
        <MyCountryTabSystem variant={variant} />
      </div>

      {/* Inline Wiki woven at the bottom */}
      <InlineWiki context="overview" accent="amber" maxSections={1} />
    </SectionShell>
  );
}
