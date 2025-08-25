"use client";

import { useUser } from "@clerk/nextjs";
import { AuthenticationGuard, CountryDataProvider, MyCountryContent } from "~/components/mycountry";

// Force dynamic rendering to avoid SSG issues with Clerk
export const dynamic = 'force-dynamic';

export default function MyCountryPage() {
  const { user } = useUser();

  return (
    <AuthenticationGuard redirectPath="/mycountry">
      <CountryDataProvider userId={user?.id || ''}>
        <MyCountryContent 
          variant="unified" 
          title="MyCountry® - IxStats"
        />
      </CountryDataProvider>
    </AuthenticationGuard>
  );
}