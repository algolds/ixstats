"use client";

import { useEffect } from "react";
import { useUser } from "~/context/auth-context";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "~/components/mycountry";
import { EnhancedDiplomacyContent } from "~/components/mycountry/EnhancedDiplomacyContent";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";
import { MobileOptimized } from "../components/MobileOptimizations";

export const dynamic = "force-dynamic";

// Inner component that has access to country data
function DiplomacyWithAtomicState() {
  const { user } = useUser();
  const { country } = useCountryData();

  useEffect(() => {
    document.title = country?.name ? `${country.name} - Diplomacy` : "Diplomacy - IxStats";
  }, [country?.name]);

  if (!country?.id) {
    return (
      <EnhancedDiplomacyContent variant="unified" title="Diplomatic Operations - IxStats" />
    );
  }

  return (
    <AtomicStateProvider countryId={country.id} userId={user?.id}>
      <EnhancedDiplomacyContent variant="unified" title="Diplomatic Operations - IxStats" />
    </AtomicStateProvider>
  );
}

export default function DiplomacyPage() {
  const { user } = useUser();

  return (
    <MobileOptimized enableTouchGestures={true} className="min-h-screen">
      <AuthenticationGuard redirectPath="/mycountry/diplomacy">
        <CountryDataProvider userId={user?.id || "placeholder-disabled"}>
          <DiplomacyWithAtomicState />
        </CountryDataProvider>
      </AuthenticationGuard>
    </MobileOptimized>
  );
}
