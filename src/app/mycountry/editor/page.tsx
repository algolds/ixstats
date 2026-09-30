"use client";

import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { createUrl } from "~/lib/utils";
import { useUserCountry } from "~/hooks/useUserCountry";
import { BuilderRouter } from "~/app/builder/components/BuilderRouter";
import { GlobalBuilderLoading } from "~/app/builder/components/GlobalBuilderLoading";

export const dynamic = "force-dynamic";

export default function MyCountryEditor() {
  usePageTitle({ title: "Country Editor" });

  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { country, profileLoading, countryLoading, userProfile } = useUserCountry();

  if (!isLoaded || profileLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <GlobalBuilderLoading message="Loading profile..." variant="compact" />
      </div>
    );
  }

  if (!user) {
    router.push(createUrl("/sign-in"));
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <GlobalBuilderLoading message="Redirecting to sign in..." variant="compact" />
      </div>
    );
  }

  if (!userProfile?.countryId) {
    router.push(createUrl("/mycountry/builder"));
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <GlobalBuilderLoading message="No country found. Redirecting to builder..." variant="compact" />
      </div>
    );
  }

  if (countryLoading || !country) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <GlobalBuilderLoading message="Loading country data..." variant="compact" />
      </div>
    );
  }

  return <BuilderRouter mode="edit" countryId={country.id} />;
}

