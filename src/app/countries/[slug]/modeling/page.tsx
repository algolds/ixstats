"use client";
export const dynamic = "force-dynamic";
import { use } from "react";
import { api } from "~/trpc/react";
import { EconomicModelingEngine } from "~/app/countries/_components/economy";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/shell/PageHeader";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { Skeleton } from "~/components/ui/skeleton";
import { WarningTriangle as AlertTriangle } from "iconoir-react";
import type { EconomicYearData, StorytellerEffect } from "~/types/economics";

interface ModelingPageProps {
  params: Promise<{ slug?: string; id?: string }>;
}

export default function ModelingPage({ params }: ModelingPageProps) {
  const resolvedParams = use(params);
  const countryId = resolvedParams.slug || resolvedParams.id;
  const {
    data: country,
    isLoading,
    error,
  } = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId ?? "" },
    { enabled: !!countryId }
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-4 h-8 w-1/2" />
        <Skeleton className="mb-8 h-4 w-1/4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive container mx-auto px-4 py-8">
        <AlertTriangle className="mr-2 inline-block" />
        Could not load country data: {error.message}
      </div>
    );
  }

  if (!country) {
    return <div className="container mx-auto px-4 py-8">Country not found.</div>;
  }

  return (
    <>
      <SignedIn>
        <div className="container mx-auto space-y-6 px-4 py-8">
          <PageHeader
            title={`Economic modeling for ${country.name}`}
            back={{ href: `/countries/${country.slug}`, label: country.name }}
            bleed
          />
          <Card padding="md">
            <EconomicModelingEngine
              country={{
                ...country,
                economicYears: Array.isArray(country.historical)
                  ? (country.historical.map((h: Record<string, any>) => ({
                      year: h.year,
                      gdp: h.gdp,
                      inflation: undefined, // Map if available
                      unemployment: undefined, // Map if available
                    })) as EconomicYearData[])
                  : [],
                storytellerEffects:
                  country.storytellerEffects?.[0]?.id && country.storytellerEffects[0].countryId
                    ? ({
                        id: country.storytellerEffects[0].id,
                        countryId: country.storytellerEffects[0].countryId,
                      } as StorytellerEffect)
                    : undefined,
              }}
            />
          </Card>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center">
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
    </>
  );
}
