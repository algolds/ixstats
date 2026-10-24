"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { WarningTriangle } from "iconoir-react";
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
import { CountryDataProvider, useCountryData } from "~/components/mycountry/primitives";
import { ProfileShellProvider, type ProfileShellValue } from "../_components/ProfileShellContext";
import { useCountryPageState } from "../_hooks/useCountryPageState";
import { toCountrySlug } from "../_types";
import { Card } from "~/components/ui/card";

/**
 * CountryProfileLayout — persistent country shell (route group `(profile)`). Owns the country
 * query (`CountryDataProvider`) and the breadcrumb, and shares the resolved country, flag,
 * ownership and cover with the routes below (`ProfileShellProvider`). Every tab page (`/`,
 * `/map`, `/lore`, `/history`) renders the same `CountryDocument`; the old addresses redirect.
 *
 * Every state shares `PAGE_COLUMN`: the page has no Inspector, so it gives the shell's reserved
 * Inspector gutter back and runs from the sidebar to the right edge, capped at 1600px.
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

/** Full-width page column (no Inspector gutter), capped at 1600px, `p-4` phone, `p-8` from md. */
const PAGE_COLUMN = {
  className: "mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-8",
} as const;

function ProfileShellSkeleton() {
  return (
    <div {...PAGE_COLUMN} role="status" aria-label="Loading">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="rounded-card h-72 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="rounded-card h-96 lg:col-span-2" />
        <Skeleton className="rounded-card h-96" />
      </div>
    </div>
  );
}

function ProfileBreadcrumb({ name }: { name: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={"/countries"}>Countries</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function CountryProfileShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { country, isLoading, error, currentIxTime } = useCountryData();
  const { userProfile } = useUserCountry();
  const { flagUrl: serviceFlag } = useFlag(country?.name || "");
  const flagUrl: string | null = country?.flag || serviceFlag || null;

  usePageTitle({
    title: country ? `${country.name.replace(/_/g, " ")}` : "Country profile",
  });

  const { bannerMode, resolvedBannerUrl, setBannerMode } = useCountryPageState(country, flagUrl);

  const isOwnCountry = !!country?.id && userProfile?.countryId === country.id;

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
    return <ProfileShellSkeleton />;
  }

  if (error || !country || !shell) {
    return (
      <div {...PAGE_COLUMN}>
        <Card>
          <EmptyState
            icon={<WarningTriangle />}
            title={error ? "This country could not be loaded" : "Country not found"}
            message={error ?? "No country matches this address."}
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href={"/countries"}>All countries</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const name = country.name.replace(/_/g, " ");

  return (
    <ProfileShellProvider value={shell}>
      <div {...PAGE_COLUMN}>
        <ProfileBreadcrumb name={name} />
        {children}
      </div>
    </ProfileShellProvider>
  );
}
