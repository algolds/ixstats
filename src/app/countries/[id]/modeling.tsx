import { use } from "react";
import { api } from "~/trpc/react";
import { EconomicModelingEngine } from "~/app/countries/_components/economy";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

interface ModelingPageProps {
  params: Promise<{ id: string }>;
}

export default function ModelingPage({ params }: ModelingPageProps) {
  const { id } = use(params);
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({ id });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-1/2 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-red-500">
        <AlertTriangle className="inline-block mr-2" />
        Error loading country data: {error.message}
      </div>
    );
  }

  if (!country) {
    return <div className="container mx-auto px-4 py-8">Country not found.</div>;
  }

  return (
    <>
      <SignedIn>
        <div className="container mx-auto px-4 py-8 space-y-6">
          <div className="mb-6">
            <Link href={`/countries/${country.id}`} className="text-primary hover:underline">&larr; Back to {country.name}</Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Economic Modeling for {country.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <EconomicModelingEngine country={country} />
            </CardContent>
          </Card>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
    </>
  );
} 