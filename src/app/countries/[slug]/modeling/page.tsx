"use client";
export const dynamic = "force-dynamic";
import { use } from "react";
import { api } from "~/trpc/react";
import { EconomicModelingEngine } from "~/app/countries/_components/economy";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import Link from "next/link";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { createUrl } from "~/lib/url-utils";
import type { EconomicYearData, DMInputs } from "~/server/db/schema";
import { getFlagColors, generateFlagThemeCSS } from "~/lib/flag-color-extractor";

interface ModelingPageProps {
  params: Promise<{ id: string }>;
}

export default function ModelingPage({ params }: ModelingPageProps) {
  const { id } = use(params);
  const {
    data: country,
    isLoading,
    error,
  } = api.countries.getByIdWithEconomicData.useQuery({ id });

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
      <div className="container mx-auto px-4 py-8 text-red-500">
        <AlertTriangle className="mr-2 inline-block" />
        Error loading country data: {error.message}
      </div>
    );
  }

  if (!country) {
    return <div className="container mx-auto px-4 py-8">Country not found.</div>;
  }

  // Create a country object with the required economicYears property
  const countryWithEconomicYears = {
    ...country,
    economicYears: [], // Empty array for now, can be populated later if needed
  };

  // Generate flag-based theme colors
  const flagColors = getFlagColors(country.name);
  const flagThemeCSS = generateFlagThemeCSS(flagColors);

  return (
    <>
      <SignedIn>
        <div className="country-themed container mx-auto space-y-6 px-4 py-8" style={flagThemeCSS}>
          <div className="mb-6">
            <Link
              href={createUrl(`/countries/${country.slug}`)}
              className="text-primary hover:underline"
            >
              &larr; Back to {country.name}
            </Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Economic Modeling for {country.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <EconomicModelingEngine
                country={{
                  ...country,
                  economicYears: Array.isArray(country.historical)
                    ? (country.historical.map((h) => ({
                        year: h.year,
                        gdp: h.gdp,
                        inflation: undefined, // Map if available
                        unemployment: undefined, // Map if available
                      })) as EconomicYearData[])
                    : [],
                  dmInputs:
                    country.dmInputs?.[0]?.id && country.dmInputs[0].countryId
                      ? ({
                          id: country.dmInputs[0].id,
                          countryId: country.dmInputs[0].countryId,
                        } as DMInputs)
                      : undefined,
                }}
              />
            </CardContent>
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
