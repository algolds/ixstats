"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { CountryEditor, EditorSkeleton } from "./_components/CountryEditor";

export const dynamic = "force-dynamic";

/** Where a player without a nation goes instead: founding one. */
const NO_NATION_REDIRECT = "/builder";

/**
 * The country editor for the active nation. Keyed by the nation's id, so switching nation mounts
 * a fresh editor and no section can ever save one nation's values into another.
 */
export default function MyCountryEditorPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const profile = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });
  const countryId = profile.data?.countryId ?? null;

  const redirectTo =
    isLoaded && !user
      ? "/sign-in"
      : isLoaded && profile.isSuccess && !countryId
        ? NO_NATION_REDIRECT
        : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (!countryId || redirectTo) return <EditorSkeleton />;
  return <CountryEditor key={countryId} countryId={countryId} />;
}
