"use client";

/**
 * /mycountry/v2 — gated preview of the v2 command surface (design-bible v2).
 * Renders the shared MyCountryV2 shell locked to the signed-in user's own country
 * (no picker), behind the auth guard. See plans/mycountry-v2-migration.md.
 */

import { AuthenticationGuard } from "~/components/mycountry/primitives/AuthenticationGuard";
import { useUserCountry } from "~/hooks/useUserCountry";
import { MyCountryV2 } from "~/app/labs/mycountry-v2/page";

export default function MyCountryV2Route() {
  const { country, isLoading } = useUserCountry();

  return (
    <AuthenticationGuard redirectPath="/mycountry/v2">
      {isLoading && !country ? (
        <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
          Loading your nation…
        </div>
      ) : (
        <MyCountryV2
          lockedCountryId={(country as any)?.id}
          showPicker={false}
          previewLabel="v2 preview"
        />
      )}
    </AuthenticationGuard>
  );
}
