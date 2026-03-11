"use client";

import { use, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { createUrl } from "~/lib/url-utils";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { useUserCountry } from "~/hooks/useUserCountry";
import { IxTime } from "~/lib/ixtime";
import { CountryActionsMenu } from "~/components/countries/CountryActionsMenu";

import { CountryHeader } from "./_components/CountryHeader";
import { CountryTabs } from "./_components/CountryTabs";
import { CountryOverviewPanel } from "./_components/CountryOverviewPanel";
import { CountryEconomicPanel } from "./_components/CountryEconomicPanel";
import { CountryActivityPanel } from "./_components/CountryActivityPanel";
import { CountryDiplomaticPanel } from "./_components/CountryDiplomaticPanel";
import { WikiIntelligenceTab } from "~/components/countries/WikiIntelligenceTab";

import { useCountryPageState } from "./_hooks/useCountryPageState";

import {
  transformCountryEconomicsData,
  calculateVitalityData,
} from "./_utils/countryDataTransformers";

interface PublicCountryPageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicCountryPage({ params }: PublicCountryPageProps) {
  const { slug } = use(params);
  const { user, userProfile } = useUserCountry();

  const {
    data: country,
    isLoading,
    error,
  } = api.countries.getByIdWithEconomicData.useQuery({
    id: slug,
  });
  const { data: governmentStructure } = api.government.getByCountryId.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );

  usePageTitle({
    title: country ? `${country.name.replace(/_/g, " ")}` : "Country Profile",
  });

  const { flagUrl, isLoading: flagLoading } = useFlag(country?.name || "");

  const {
    activeTab,
    setActiveTab,
    isMounted,
    showGdpPerCapita,
    showFullPopulation,
    showCountryActions,
    setShowCountryActions,
    toggleGdpDisplay,
    togglePopulationDisplay,
    wikiInfobox,
    wikiIntro,
    unsplashImageUrl,
    bannerMode,
    customBannerUrl,
    setBannerMode,
  } = useCountryPageState(country);

  const currentIxTime = IxTime.getCurrentIxTime();
  const isOwnCountry =
    userProfile?.countryId && country?.id && userProfile.countryId === country.id;

  const economicsData = useMemo(() => {
    if (!country) return null;
    return transformCountryEconomicsData(country);
  }, [country]);

  const vitalityData = useMemo(() => {
    if (!country) return null;
    return calculateVitalityData({
      economicTier: country.economicTier,
      adjustedGdpGrowth: country.adjustedGdpGrowth,
      populationGrowthRate: country.populationGrowthRate,
      populationDensity: country.populationDensity ?? null,
    });
  }, [country]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-4 h-8 w-1/2" />
        <Skeleton className="mb-8 h-4 w-1/4" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 rounded-xl lg:col-span-2" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive/50 p-8">
          <div className="text-destructive flex items-center gap-3">
            <AlertTriangle className="h-6 w-6" />
            <div>
              <h3 className="font-semibold">Error Loading Country Data</h3>
              <p className="text-muted-foreground text-sm">{error.message}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <AlertTriangle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-xl font-semibold">Country Not Found</h3>
          <p className="text-muted-foreground">The requested country could not be found.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br">
      <CountryHeader
        country={{
          name: country.name,
          currentPopulation: country.currentPopulation,
          currentGdpPerCapita: country.currentGdpPerCapita,
          currentTotalGdp: country.currentTotalGdp,
          landArea: country.landArea ?? null,
          adjustedGdpGrowth: country.adjustedGdpGrowth,
          continent: country.continent,
        }}
        flagUrl={flagUrl}
        flagLoading={flagLoading}
        unsplashImageUrl={unsplashImageUrl}
        isOwnCountry={!!isOwnCountry}
        showGdpPerCapita={showGdpPerCapita}
        showFullPopulation={showFullPopulation}
        bannerMode={bannerMode}
        customBannerUrl={customBannerUrl}
        onToggleGdpDisplay={toggleGdpDisplay}
        onTogglePopulationDisplay={togglePopulationDisplay}
        onCountryActionsClick={() => setShowCountryActions(true)}
        onBannerModeChange={setBannerMode}
      />

      <div className="container mx-auto space-y-6 px-4 py-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={createUrl("/countries")}>Countries</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{country.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <CountryTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "overview" && vitalityData && (
          <CountryOverviewPanel
            country={country}
            wikiIntro={wikiIntro}
            wikiInfobox={wikiInfobox}
            vitalityData={vitalityData}
            governmentStructure={governmentStructure}
            onTabChange={(tab: string) => setActiveTab(tab as typeof activeTab)}
          />
        )}

        {activeTab === "mycountry" && country && economicsData && (
          <CountryEconomicPanel
            country={country}
            economicsData={economicsData}
            governmentStructure={governmentStructure}
            wikiInfobox={wikiInfobox}
            currentIxTime={currentIxTime}
            isOwnCountry={!!isOwnCountry}
            isMounted={isMounted}
          />
        )}

        {activeTab === "lore" && country && (
          <WikiIntelligenceTab
            countryName={country.name}
            countryData={{
              currentPopulation: country.currentPopulation,
              currentGdpPerCapita: country.currentGdpPerCapita,
              currentTotalGdp: country.currentTotalGdp,
              economicTier: country.economicTier,
              continent: country.continent ?? undefined,
              governmentType: country.governmentType ?? undefined,
            }}
            viewerClearanceLevel="PUBLIC"
          />
        )}

        {activeTab === "activity" && country && (
          <CountryActivityPanel
            countryId={country.id}
            countryName={country.name}
          />
        )}

        {activeTab === "diplomacy" && country && (
          <CountryDiplomaticPanel
            country={country}
            flagUrl={flagUrl}
            isOwnCountry={!!isOwnCountry}
            viewerCountryId={userProfile?.countryId}
            viewerCountryName={userProfile?.country?.name}
          />
        )}
      </div>

      {country && (
        <CountryActionsMenu
          targetCountryId={country.id}
          targetCountryName={country.name}
          viewerCountryId={userProfile?.countryId ?? undefined}
          isOpen={showCountryActions}
          onClose={() => setShowCountryActions(false)}
          isOwnCountry={!!isOwnCountry}
        />
      )}
    </div>
  );
}
