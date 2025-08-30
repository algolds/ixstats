"use client";

import { useUser } from "@clerk/nextjs";
import { AuthenticationGuard, CountryDataProvider } from "~/components/mycountry";
import { EnhancedMyCountryContent } from "~/components/mycountry/EnhancedMyCountryContent";

export const dynamic = 'force-dynamic';

export default function MyCountryPage() {
  const { user } = useUser();

  return (
    <AuthenticationGuard redirectPath="/mycountry">
      <CountryDataProvider userId={user?.id || ''}>
        <EnhancedMyCountryContent 
          variant="unified" 
          title="MyCountry® - IxStats"
        />
      </CountryDataProvider>
    </AuthenticationGuard>
  );
}