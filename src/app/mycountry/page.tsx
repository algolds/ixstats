"use client";

import { useUser } from "@clerk/nextjs";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "~/components/mycountry";
import { EnhancedMyCountryContent } from "~/components/mycountry/EnhancedMyCountryContent";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";

export const dynamic = 'force-dynamic';

// Inner component that has access to country data
function MyCountryWithAtomicState() {
  const { user } = useUser();
  const { country } = useCountryData();

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
    <AuthenticationGuard redirectPath="/mycountry">
      <CountryDataProvider userId={user?.id || ''}>
        <MyCountryWithAtomicState />
      </CountryDataProvider>
    </AuthenticationGuard>
  );
}