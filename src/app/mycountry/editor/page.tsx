"use client";

import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { createUrl } from "~/lib/utils";
import { LoadingState } from "~/components/shared/feedback/LoadingState";
import { useUserCountry } from "~/hooks/useUserCountry";
import { BuilderRouter } from "~/app/builder/components/BuilderRouter";

export const dynamic = "force-dynamic";

export default function MyCountryEditor() {
  usePageTitle({ title: "Country Editor" });

  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { country, profileLoading, countryLoading, userProfile } = useUserCountry();

  if (!isLoaded || profileLoading) {
    return <LoadingState message="Loading profile..." />;
  }

  if (!user) {
    router.push(createUrl("/sign-in"));
    return <LoadingState message="Redirecting to sign in..." />;
  }

  if (!userProfile?.countryId) {
    router.push(createUrl("/builder"));
    return <LoadingState message="No country found. Redirecting to builder..." />;
  }

  if (countryLoading || !country) {
    return <LoadingState message="Loading country data..." />;
  }

  return <BuilderRouter mode="edit" countryId={country.id} />;
}
