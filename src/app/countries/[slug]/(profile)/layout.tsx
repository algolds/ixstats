"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { WarningTriangle, Group as Users } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
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
import { createUrl } from "~/lib/utils";
import { CountryHeader } from "../_components/CountryHeader";
import { CountryTabs } from "../_components/CountryTabs";
import { ProfileShellProvider, type ProfileShellValue } from "../_components/ProfileShellContext";
import { useCountryPageState } from "../_hooks/useCountryPageState";
import { toCountrySlug } from "../_types";
import { Card } from "~/components/ui/card";

/** Breadcrumb labels for the deep-dive routes (the profile itself is the country's name). */
const SEGMENT_LABEL: Record<string, string> = {
  factbook: "Factbook",
  dossier: "Dossier",
  activity: "Activity",
};

/**
 * CountryProfileLayout — persistent country shell (route group `(profile)`). Owns the country
 * query (`CountryDataProvider`), the breadcrumb and Country Actions, and shares the resolved
 * country, flag, ownership and cover with the routes below (`ProfileShellProvider`).
 *
 * - `/countries/[slug]` (this layout's own page) is the Command profile, which brings its hero
 *   and tabs itself (`CommandProfileView`).
 * - `/factbook/**`, `/dossier` and `/activity` are the deep-dives: they get the country header
 *   and the tabs here, then render their own route pages.
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
  const { userProfile } = useUserCountry();
  const { flagUrl: serviceFlag } = useFlag(country?.name || "");
  // null on the profile itself; "factbook" | "dossier" | "activity" on a deep-dive.
  const segment = useSelectedLayoutSegment();
  const flagUrl: string | null = country?.flag || serviceFlag || null;

  usePageTitle({
    title: country ? `${country.name.replace(/_/g, " ")}` : "Country profile",
  });

  const {
    showCountryActions,
    setShowCountryActions,
    bannerMode,
    resolvedBannerUrl,
    setBannerMode,
  } = useCountryPageState(country, flagUrl);

  const isOwnCountry = !!(
    userProfile?.countryId &&
    country?.id &&
    userProfile.countryId === country.id
  );

  const shell = useMemo<ProfileShellValue | null>(
    () =>
      country
        ? {
            slug,
            country,
            flagUrl,
            isOwner: isOwnCountry,
            currentIxTime,
            cover: {
              mode: bannerMode,
              url: resolvedBannerUrl,
              onChange: isOwnCountry ? setBannerMode : undefined,
            },
          }
        : null,
    [
      slug,
      country,
      flagUrl,
      isOwnCountry,
      currentIxTime,
      bannerMode,
      resolvedBannerUrl,
      setBannerMode,
    ]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-6 px-4 py-8" role="status" aria-label="Loading">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="rounded-card h-72 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="rounded-card h-96 lg:col-span-2" />
          <Skeleton className="rounded-card h-96" />
        </div>
      </div>
    );
  }

  if (error || !country || !shell) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <EmptyState
            icon={<WarningTriangle />}
            title={error ? "This country could not be loaded" : "Country not found"}
            message={error ?? "No country matches this address."}
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href={createUrl("/countries")}>All countries</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const name = country.name.replace(/_/g, " ");
  const sectionLabel = segment ? SEGMENT_LABEL[segment] : undefined;

  return (
    <ProfileShellProvider value={shell}>
      <div className="container mx-auto space-y-6 px-4 py-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={createUrl("/countries")}>Countries</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {sectionLabel ? (
                  <BreadcrumbLink asChild>
                    <Link href={createUrl(`/countries/${slug}`)}>{name}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{name}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {sectionLabel && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{sectionLabel}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          <Button variant="default" size="sm" onClick={() => setShowCountryActions(true)}>
            <Users aria-hidden />
            {isOwnCountry ? "Country management" : "Country actions"}
          </Button>
        </div>

        {segment !== null && (
          <>
            <CountryHeader />
            <CountryTabs countrySlug={slug} />
          </>
        )}
        {children}
      </div>

      <CountryActionsMenu
        targetCountryId={country.id}
        targetCountryName={country.name}
        viewerCountryId={userProfile?.countryId ?? undefined}
        isOpen={showCountryActions}
        onClose={() => setShowCountryActions(false)}
        isOwnCountry={isOwnCountry}
      />
    </ProfileShellProvider>
  );
}
