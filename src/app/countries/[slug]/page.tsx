"use client";

// Refactored CountryPage - now uses modular panel components for better maintainability
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
import { useUser } from "~/context/auth-context";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { useUserCountry } from "~/hooks/useUserCountry";
import { IxTime } from "~/lib/ixtime";
import { WikiIntelligenceTab } from "~/components/countries/WikiIntelligenceTab";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
import { CountryActionsMenu } from "~/components/countries/CountryActionsMenu";

// Modular panel components
import { CountryHeader } from "./_components/CountryHeader";
import { CountryTabs } from "./_components/CountryTabs";
import { CountryOverviewPanel } from "./_components/CountryOverviewPanel";
import { CountryEconomicPanel } from "./_components/CountryEconomicPanel";
import { CountryDiplomaticPanel } from "./_components/CountryDiplomaticPanel";

// Custom hook for state management
import { useCountryPageState } from "./_hooks/useCountryPageState";

// Data transformation utilities
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

  // Data fetching - pass slug directly
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({
    id: slug,
  });
  const { data: governmentStructure } = api.government.getByCountryId.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );

  // Set page title based on country name
  usePageTitle({ 
    title: country ? `${country.name.replace(/_/g, ' ')}` : "Country Profile" 
  });

  // Flag loading
  const { flagUrl, isLoading: flagLoading } = useFlag(country?.name || "");

  // State management via custom hook
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
  } = useCountryPageState(country);

  const currentIxTime = IxTime.getCurrentIxTime();
  const isOwnCountry =
    userProfile?.countryId && country?.id && userProfile.countryId === country.id;

  // Transform country data for economics components
  const economicsData = useMemo(() => {
    if (!country) return null;
    return transformCountryEconomicsData(country);
  }, [country]);

  // Calculate vitality rings data
  const vitalityData = useMemo(() => {
    if (!country) return null;
    return calculateVitalityData({
      economicTier: country.economicTier,
      adjustedGdpGrowth: country.adjustedGdpGrowth,
      populationGrowthRate: country.populationGrowthRate,
      populationDensity: country.populationDensity ?? null,
    });
  }, [country]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-1/2 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 lg:col-span-2 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 border-destructive/50">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <div>
              <h3 className="font-semibold">Error Loading Country Data</h3>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Not found state
  if (!country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">Country Not Found</h3>
          <p className="text-muted-foreground">The requested country could not be found.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section with Country Header */}
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
        onToggleGdpDisplay={toggleGdpDisplay}
        onTogglePopulationDisplay={togglePopulationDisplay}
        onCountryActionsClick={() => setShowCountryActions(true)}
      />

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Breadcrumb */}
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

        {/* Tab Navigation */}
        <CountryTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content - Modular Panels */}
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
              region: country.region ?? undefined,
              governmentType: country.governmentType ?? undefined,
              leader: country.leader ?? undefined,
              religion: country.religion ?? undefined,
            }}
            viewerClearanceLevel={isOwnCountry ? "CONFIDENTIAL" : "PUBLIC"}
          />
        )}

        {activeTab === "diplomatic" && country && (
          <ThinkpagesSocialPlatform
            countryId={country.id}
            countryName={country.name}
            isOwner={!!isOwnCountry}
            profileMode={true}
            countryOwnerClerkUserId={(country as any).ownerClerkUserId}
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

      {/* Country Actions Menu Modal */}
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
