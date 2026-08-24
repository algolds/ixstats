"use client";

import { use, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { WarningTriangle as AlertTriangle } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { useUserCountry } from "~/hooks/useUserCountry";
import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";
import { CountryDataProvider, useCountryData } from "~/components/mycountry/primitives";
import { CountryHeader } from "../_components/CountryHeader";
import { CountryTabs } from "../_components/CountryTabs";
import { CountryRightPillNav } from "../_components/CountryRightPillNav";
import { useCountryPageState } from "../_hooks/useCountryPageState";
import { toCountrySlug } from "../_types";
import { CountryProfileProvider } from "../_context/CountryProfileContext";

export default function CountryProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = use(params);
  const slug = toCountrySlug(rawSlug);

  return (
    <CountryDataProvider userId="" countryId={slug} isPublicReadOnly>
      <CountryProfileShell slug={slug}>{children}</CountryProfileShell>
    </CountryDataProvider>
  );
}

function CountryProfileShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { country, isLoading, error } = useCountryData();
  const { userProfile } = useUserCountry();
  const { flagUrl, isLoading: flagLoading } = useFlag(country?.name || "");

  usePageTitle({
    title: country ? `${country.name.replace(/_/g, " ")}` : "Country Profile",
  });

  const {
    activeTab,
    setActiveTab,
    showGdpPerCapita,
    showFullPopulation,
    showCountryActions,
    setShowCountryActions,
    toggleGdpDisplay,
    togglePopulationDisplay,
    unsplashImageUrl,
    bannerMode,
    customBannerUrl,
    setBannerMode,
  } = useCountryPageState(country);

  const isOwnCountry = useMemo(
    () => Boolean(userProfile?.countryId && country?.id && userProfile.countryId === country.id),
    [userProfile?.countryId, country?.id]
  );

  const { data: unifiedProfile, isLoading: isUnifiedProfileLoading } =
    api.ixnayid.getUnifiedProfile.useQuery(
      { identifier: slug || country?.name || "" },
      { enabled: Boolean(slug || country?.name) }
    );

  const delegate = useMemo(() => {
    const handle = unifiedProfile?.forum?.username || unifiedProfile?.wiki?.username;
    if (!handle) return null;
    return {
      username: handle,
      roleName: unifiedProfile.account.roleName,
      forumAvatarUrl: unifiedProfile.forum.avatarUrl,
      isStaff: unifiedProfile.forum.isStaff,
      membershipTier: unifiedProfile.account.membershipTier,
    };
  }, [unifiedProfile]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-60 w-full rounded-3xl" />
        <Skeleton className="h-12 w-96 rounded-2xl" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <Skeleton className="h-96 rounded-3xl lg:col-span-8" />
          <Skeleton className="h-96 rounded-3xl lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <Card className="border-destructive/50 rounded-3xl p-8 backdrop-blur-xl">
          <div className="text-destructive flex items-center gap-3">
            <AlertTriangle className="h-6 w-6" />
            <div>
              <h3 className="font-semibold">Error Loading Country Data</h3>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-3xl p-8 text-center backdrop-blur-xl">
          <AlertTriangle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-xl font-semibold">Country Not Found</h3>
          <p className="text-muted-foreground">The requested country could not be found.</p>
        </Card>
      </div>
    );
  }

  return (
    <CountryProfileProvider
      slug={slug}
      isOwnCountry={isOwnCountry}
      unifiedProfile={unifiedProfile}
      delegate={delegate}
      isLoading={isUnifiedProfileLoading}
    >
      <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br">
        <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {/* 1. Sovereign Bento Masthead Hero */}
          <CountryHeader
            country={country}
            delegate={delegate}
            flagUrl={flagUrl}
            flagLoading={flagLoading}
            unsplashImageUrl={unsplashImageUrl}
            isOwnCountry={isOwnCountry}
            showGdpPerCapita={showGdpPerCapita}
            showFullPopulation={showFullPopulation}
            bannerMode={bannerMode}
            customBannerUrl={customBannerUrl}
            onToggleGdpDisplay={toggleGdpDisplay}
            onTogglePopulationDisplay={togglePopulationDisplay}
            onCountryActionsClick={() => setShowCountryActions(true)}
            onBannerModeChange={setBannerMode}
          />

          {/* 2. Apple-Grade Mirrored Frosted Pill Bar (MyCountry Symmetry) */}
          <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3">
            <CountryTabs activeTab={activeTab} onTabChange={setActiveTab} countrySlug={slug} />
            <CountryRightPillNav
              countryName={country.name}
              countryId={country.id}
              isOwnCountry={isOwnCountry}
              onOpenActions={() => setShowCountryActions(true)}
            />
          </div>

          {/* 3. Full-Width 12-Column Canvas (Edge-to-edge space, clean and predictable) */}
          <main className="w-full min-w-0 space-y-6">{children}</main>
        </div>

        <CountryActionsMenu
          targetCountryId={country.id}
          targetCountryName={country.name}
          viewerCountryId={userProfile?.countryId ?? undefined}
          isOpen={showCountryActions}
          onClose={() => setShowCountryActions(false)}
          isOwnCountry={isOwnCountry}
        />
      </div>
    </CountryProfileProvider>
  );
}

