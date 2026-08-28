"use client";

import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { createUrl } from "~/lib/utils";
import { IOSActivityIndicator } from "~/components/ui/loader";
import { useUserCountry } from "~/hooks/useUserCountry";
import { BuilderRouter } from "~/app/builder/components/BuilderRouter";

export const dynamic = "force-dynamic";

function LoadingFallback({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <IOSActivityIndicator size="md" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

export default function MyCountryEditor() {
  usePageTitle({ title: "Country Editor" });

  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { country, profileLoading, countryLoading, userProfile } = useUserCountry();

  if (!isLoaded || profileLoading) {
    return <LoadingFallback message="Loading profile..." />;
  }

  if (!user) {
    router.push(createUrl("/sign-in"));
    return <LoadingFallback message="Redirecting to sign in..." />;
  }

  if (!userProfile?.countryId) {
    router.push(createUrl("/builder"));
    return <LoadingFallback message="No country found. Redirecting to builder..." />;
  }

  if (countryLoading || !country) {
    return <LoadingFallback message="Loading country data..." />;
  }

  return <BuilderRouter mode="edit" countryId={country.id} />;
}
