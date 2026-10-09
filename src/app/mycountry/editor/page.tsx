"use client";

import { useEffect } from "react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useUserCountry } from "~/hooks/useUserCountry";
import { BuilderRouter } from "~/app/builder/components/BuilderRouter";
import { EditorSkeleton } from "~/app/builder/components/editor/EditorSkeleton";

export const dynamic = "force-dynamic";

export default function MyCountryEditor() {
  usePageTitle({ title: "Country editor" });

  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { profileLoading, userProfile } = useUserCountry();
  const countryId = userProfile?.countryId;

  const redirectTo =
    isLoaded && !user
      ? "/sign-in"
      : isLoaded && !profileLoading && !countryId
        ? "/mycountry/builder"
        : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  // The editor loads the country itself (with its own skeleton and error state).
  if (!isLoaded || profileLoading || redirectTo || !countryId) {
    return <EditorSkeleton />;
  }

  return <BuilderRouter mode="edit" countryId={countryId} />;
}
