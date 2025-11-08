"use client";

import { useEffect } from "react";
import { useUser } from "~/context/auth-context";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "~/components/mycountry";
import { EnhancedExecutiveContent } from "~/components/mycountry/EnhancedExecutiveContent";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";
import { MobileOptimized } from "../components/MobileOptimizations";

export const dynamic = "force-dynamic";

// Inner component that has access to country data
function ExecutiveWithAtomicState() {
  const { user } = useUser();
  const { country } = useCountryData();

  useEffect(() => {
    document.title = country?.name
      ? `${country.name} - Executive Command`
      : "Executive Command - IxStats";
  }, [country?.name]);

  if (!country?.id) {
    return <EnhancedExecutiveContent variant="unified" title="Executive Command - IxStats" />;
  }

  return (
    <AtomicStateProvider countryId={country.id} userId={user?.id}>
      <EnhancedExecutiveContent variant="unified" title="Executive Command - IxStats" />
    </AtomicStateProvider>
  );
}

export default function ExecutivePage() {
  const { user } = useUser();

  return (
    <MobileOptimized enableTouchGestures={true} className="min-h-screen">
      <AuthenticationGuard redirectPath="/mycountry/executive">
        <CountryDataProvider userId={user?.id || "placeholder-disabled"}>
          <ExecutiveWithAtomicState />
        </CountryDataProvider>
      </AuthenticationGuard>
    </MobileOptimized>
  );
}
