"use client";

import { useEffect } from "react";
import { useUser } from "~/context/auth-context";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "~/components/mycountry";
import { EnhancedIntelligenceContent } from "~/components/mycountry/EnhancedIntelligenceContent";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";
import { MobileOptimized } from "../components/MobileOptimizations";

export const dynamic = "force-dynamic";

// Inner component that has access to country data
function IntelligenceWithAtomicState() {
  const { user } = useUser();
  const { country } = useCountryData();

  useEffect(() => {
    document.title = country?.name ? `${country.name} - Intelligence` : "Intelligence - IxStats";
  }, [country?.name]);

  if (!country?.id) {
    return (
      <EnhancedIntelligenceContent variant="unified" title="Intelligence Dashboard - IxStats" />
    );
  }

  return (
    <AtomicStateProvider countryId={country.id} userId={user?.id}>
      <EnhancedIntelligenceContent variant="unified" title="Intelligence Dashboard - IxStats" />
    </AtomicStateProvider>
  );
}

export default function IntelligencePage() {
  const { user } = useUser();

  return (
    <MobileOptimized enableTouchGestures={true} className="min-h-screen">
      <AuthenticationGuard redirectPath="/mycountry/intelligence">
        <CountryDataProvider userId={user?.id || "placeholder-disabled"}>
          <IntelligenceWithAtomicState />
        </CountryDataProvider>
      </AuthenticationGuard>
    </MobileOptimized>
  );
}
