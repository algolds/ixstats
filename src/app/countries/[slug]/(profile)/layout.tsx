"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { WarningTriangle as AlertTriangle, Group as Users } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { useUserCountry } from "~/hooks/useUserCountry";
import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";
import { CountryDataProvider, useCountryData } from "~/components/mycountry/primitives";
import { CountryHeader } from "../_components/CountryHeader";
import { CountryTabs } from "../_components/CountryTabs";
import { useCountryPageState } from "../_hooks/useCountryPageState";
import { toCountrySlug } from "../_types";
import { createUrl } from "~/lib/utils";
import {
  CountryConceptSwitcher,
  isProfileConcept,
  type ProfileConcept,
} from "../_components/switcher/CountryConceptSwitcher";
import { ChronicleProfileView } from "../_components/prototypes/ChronicleProfileView";
import { CommandProfileView } from "../_components/prototypes/CommandProfileView";

/**
 * v3: the sample-data concepts (command/editorial/atlas) were replaced by the two real-data
 * prototypes, so earlier saved choices are ignored.
 */
const CONCEPT_STORAGE_KEY = "ixstates_profile_concept_v3";
const DEFAULT_CONCEPT: ProfileConcept = "chronicle";

/**
 * CountryProfileLayout — persistent country shell (route group `(profile)`).
 * Owns the country query via `CountryDataProvider`, header, breadcrumbs,
 * concept switcher, and the prominent sovereign views.
 */
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
  const { country, isLoading, error, currentIxTime } = useCountryData();
  const { user, userProfile } = useUserCountry();
  const { flagUrl, isLoading: flagLoading } = useFlag(country?.name || "");

  // Layout under comparison: `?concept=` wins, then the saved choice, then Chronicle.
  const router = useRouter();
  const [concept, setConceptState] = useState<ProfileConcept>(DEFAULT_CONCEPT);

  useEffect(() => {
    const paramConcept = new URLSearchParams(window.location.search).get("concept");
    if (isProfileConcept(paramConcept)) {
      setConceptState(paramConcept);
      return;
    }
    try {
      const saved = localStorage.getItem(CONCEPT_STORAGE_KEY);
      if (isProfileConcept(saved)) setConceptState(saved);
    } catch {
      /* storage unavailable (private mode) */
    }
  }, []);

  /** Switch layout; `persist: false` changes only this visit's URL (the Factbook deep-dive). */
  const setConcept = useCallback((next: ProfileConcept, { persist = true } = {}) => {
    setConceptState(next);
    try {
      if (persist) localStorage.setItem(CONCEPT_STORAGE_KEY, next);
      const url = new URL(window.location.href);
      url.searchParams.set("concept", next);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      /* ignore */
    }
  }, []);

  const handleConceptChange = useCallback((next: ProfileConcept) => setConcept(next), [setConcept]);

  const openFactbook = useCallback(() => {
    setConcept("standard", { persist: false });
    router.push(createUrl(`/countries/${slug}/factbook?concept=standard`));
    window.scrollTo({ top: 0 });
  }, [router, setConcept, slug]);

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
    () => userProfile?.countryId && country?.id && userProfile.countryId === country.id,
    [userProfile?.countryId, country?.id]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-4 h-8 w-1/2 rounded-lg" />
        <Skeleton className="mb-8 h-4 w-1/4 rounded-lg" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive/50 rounded-2xl p-8 backdrop-blur-xl">
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
      <div className="container mx-auto px-4 py-8">
        <Card className="rounded-2xl p-8 text-center backdrop-blur-xl">
          <AlertTriangle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-xl font-semibold">Country Not Found</h3>
          <p className="text-muted-foreground">The requested country could not be found.</p>
        </Card>
      </div>
    );
  }

  const sovereignUser = country.owner
    ? {
        username: country.owner.forumUsername || country.owner.wikiUsername || null,
        roleName: country.owner.role?.displayName || country.owner.role?.name || null,
      }
    : null;

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br">
      {/* The prototypes open with their own hero; the Factbook keeps the banner header. */}
      {concept === "standard" && (
        <CountryHeader
          country={{
            name: country.name,
            slug: country.slug ?? country.name.replace(/\s+/g, "_"),
            currentPopulation: country.currentPopulation,
            currentGdpPerCapita: country.currentGdpPerCapita,
            currentTotalGdp: country.currentTotalGdp,
            landArea: country.landArea ?? null,
            adjustedGdpGrowth: country.adjustedGdpGrowth,
            continent: country.continent,
            realm: country.realm ?? null,
            sovereignUser,
          }}
          flagUrl={country.flag || flagUrl}
          flagLoading={country.flag ? false : flagLoading}
          unsplashImageUrl={unsplashImageUrl}
          isOwnCountry={!!isOwnCountry}
          showGdpPerCapita={showGdpPerCapita}
          showFullPopulation={showFullPopulation}
          bannerMode={bannerMode}
          customBannerUrl={customBannerUrl}
          onToggleGdpDisplay={toggleGdpDisplay}
          onTogglePopulationDisplay={togglePopulationDisplay}
          onBannerModeChange={setBannerMode}
        />
      )}

      <div className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href={"/countries"}>Countries</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{country.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Button
            size="sm"
            onClick={() => setShowCountryActions(true)}
            className="group flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black shadow-md backdrop-blur-xl transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-100 ease-out hover:scale-105 active:scale-95"
            style={{
              borderColor: "var(--flag-border-primary)",
              color: "var(--flag-primary)",
              backgroundColor: "color-mix(in srgb, var(--flag-primary) 15%, transparent)",
            }}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{isOwnCountry ? "Country Management" : "Country Actions"}</span>
          </Button>
        </div>

        {concept === "chronicle" && (
          <ChronicleProfileView
            country={country}
            flagUrl={country.flag || flagUrl || null}
            isOwner={!!isOwnCountry}
            isSignedIn={!!user}
            currentIxTime={currentIxTime}
            onOpenFactbook={openFactbook}
          />
        )}
        {concept === "command" && (
          <CommandProfileView
            country={country}
            flagUrl={country.flag || flagUrl || null}
            isOwner={!!isOwnCountry}
            isSignedIn={!!user}
            currentIxTime={currentIxTime}
            onOpenFactbook={openFactbook}
          />
        )}
        {concept === "standard" && (
          <>
            <CountryTabs activeTab={activeTab} onTabChange={setActiveTab} countrySlug={slug} />
            {children}
          </>
        )}
      </div>

      {/* Layout switcher for comparing the prototypes */}
      <CountryConceptSwitcher
        activeConcept={concept}
        onSelectConcept={handleConceptChange}
      />

      <CountryActionsMenu
        targetCountryId={country.id}
        targetCountryName={country.name}
        viewerCountryId={userProfile?.countryId ?? undefined}
        isOpen={showCountryActions}
        onClose={() => setShowCountryActions(false)}
        isOwnCountry={!!isOwnCountry}
      />
    </div>
  );
}
