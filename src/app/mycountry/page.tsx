"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "~/components/mycountry";
import { EnhancedMyCountryContent } from "~/components/mycountry/EnhancedMyCountryContent";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";
import { MobileOptimized } from "./components/MobileOptimizations";

export const dynamic = 'force-dynamic';

// Inner component that has access to country data
function MyCountryWithAtomicState() {
  const { user } = useUser();
  const { country } = useCountryData();

  useEffect(() => {
    document.title = country?.name ? `${country.name} - MyCountry` : "MyCountry - IxStats";
  }, [country?.name]);

  if (!country?.id) {
    return (
      <EnhancedMyCountryContent 
        variant="unified" 
        title="MyCountry® - IxStats"
      />
    );
  }

  return (
    <AtomicStateProvider countryId={country.id} userId={user?.id}>
      <EnhancedMyCountryContent 
        variant="unified" 
        title="MyCountry® - IxStats"
      />
    </AtomicStateProvider>
  );
}

export default function MyCountryPage() {
  const { user } = useUser();

  return (
    <MobileOptimized enableTouchGestures={true} className="min-h-screen">
      <AuthenticationGuard redirectPath="/mycountry">
        <CountryDataProvider userId={user?.id || 'placeholder-disabled'}>
          <MyCountryWithAtomicState />
        </CountryDataProvider>
      </AuthenticationGuard>
    </MobileOptimized>
  );
}