"use client";

/**
 * MyCountry Editor - Edit your existing country using the unified builder system
 *
 * This page uses the AtomicBuilderPage from /builder with mode="edit" to provide
 * a consistent experience between creating and editing countries. Key differences:
 * - Pre-populated with existing country data
 * - Calculated fields are locked (GDP, population, etc.)
 * - Includes scheduled changes system for gradual updates
 * - Skip foundation step (already have a country)
 */

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { createUrl } from "~/lib/url-utils";
import { LoadingState } from "~/components/shared/feedback/LoadingState";
import { useUserCountry } from "~/hooks/useUserCountry";

// Import the unified builder system
import { AtomicBuilderPage } from "~/app/builder/components/enhanced/AtomicBuilderPage";

export const dynamic = "force-dynamic";

/**
 * MyCountry Editor Page
 *
 * Wrapper around AtomicBuilderPage that:
 * - Loads user's existing country
 * - Sets mode to "edit" for field locks
 * - Handles authentication and country ownership
 * - Redirects to builder if no country exists
 */
export default function MyCountryEditor() {
  usePageTitle({ title: "Country Editor" });
  
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { country, profileLoading, countryLoading, userProfile } = useUserCountry();

  // Authentication guard
  if (!isLoaded || profileLoading) {
    return <LoadingState message="Loading profile..." />;
  }

  if (!user) {
    router.push(createUrl('/sign-in'));
    return <LoadingState message="Redirecting to sign in..." />;
  }

  // Country ownership guard
  if (!userProfile?.countryId) {
    router.push(createUrl('/builder'));
    return <LoadingState message="No country found. Redirecting to builder..." />;
  }

  if (countryLoading || !country) {
    return <LoadingState message="Loading country data..." />;
  }

  // Render the unified builder in edit mode
  return (
    <div className="min-h-screen">
      <AtomicBuilderPage
        mode="edit"
        countryId={country.id}
        onBackToIntro={() => router.push(createUrl('/mycountry'))}
      />
    </div>
  );
}
