"use client";
import { useState, Suspense } from "react";
import { BentoGrid } from "@/components/ui/bento-grid";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { InterfaceSwitcher } from "@/components/shared/InterfaceSwitcher";
import { ExecutiveDashboard } from "@/components/eci/ExecutiveDashboard";
import { FocusCards } from "@/components/eci/FocusCards";
import { MyCountryPremium } from "@/components/eci/MyCountryPremium";
import { api } from "@/trpc/react";
import type { CountryWithEconomicData } from "@/types/ixstats";
import { useUser } from "@clerk/nextjs";
import { LoaderFour } from "@/components/ui/loader";
import { UnifiedSidebar } from '@/components/ui/UnifiedSidebar';
import { Globe, Shield, Star, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getUserInterfacePreferences } from '@/lib/interface-routing';

export default function ExecutiveCommandInterface() {
  const { user } = useUser();
  const [selectedModule, setSelectedModule] = useState('dashboard');
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  const router = useRouter();

  const { data: profile, isLoading: profileLoading, error: profileError } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: countryData, isLoading: countryLoading, error: countryError } = api.countries.getByIdWithEconomicData.useQuery(
    { id: profile?.countryId || '' },
    { enabled: !!profile?.countryId, refetchInterval: 30000 }
  );

  const permissions = profile ? getUserInterfacePreferences({
    id: profile.userId || 'unknown',
    role: (profile as any).role || 'user',
    countryId: profile.countryId || undefined
  }) : { canAccessSDI: false };

  if (profileLoading || countryLoading) {
    return <LoaderFour text="Loading Executive Command Interface..." />;
  }

  if (profileError || countryError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500 mb-2">Failed to load data</div>
          <div className="text-gray-400 mb-4">Please try again later or contact support if the problem persists.</div>
        </div>
      </div>
    );
  }

  if (!countryData) {
    return <LoaderFour text="Loading country data..." />;
  }

  // Sidebar links for all ECI submodules
  const eciLinks = [
    { key: 'dashboard', label: 'Dashboard', href: '/eci', icon: <Shield /> },
    { key: 'mycountry', label: 'MyCountry®', href: '/eci/mycountry', icon: <Star /> },
    { key: 'focus', label: 'Focus Areas', href: '/eci/focus', icon: <Target /> },
    // Add more ECI submodules as needed
  ];

  // Handle sidebar navigation
  const handleSidebarNav = (key: string) => {
    setSelectedModule(key);
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex-row h-screen w-full overflow-hidden">
      {/* Unified Sidebar */}
      <UnifiedSidebar
        current="eci"
        profile={{
          name: (profile as any)?.name,
          role: (profile as any)?.role,
          avatarUrl: (profile as any)?.avatarUrl,
          email: (profile as any)?.email,
        }}
        countryId={profile?.countryId || undefined}
        links={eciLinks}
        activeKey={selectedModule}
        onNav={handleSidebarNav}
      />
      {/* Main Content with scroll support */}
      <main className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto">
          <div className="container mx-auto px-4 py-8">
            {/* ECI Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-2xl medallion-glow">
                    ⭐
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold">Executive Command Interface</h1>
                    <p className="text-gray-400">
                      Personal Command Center • {countryData.name || 'Loading...'}
                    </p>
                  </div>
                </div>
                {/* InterfaceSwitcher is now in the sidebar */}
              </div>
            </div>

            {/* Dynamic Module Content */}
            {selectedModule === 'dashboard' && (
              <BentoGrid className="mb-8">
                <Suspense fallback={<div>Loading executive dashboard...</div>}>
                  <ExecutiveDashboard 
                    countryData={{
                      ...countryData,
                      populationTier: typeof countryData.populationTier === 'string' ? parseInt(countryData.populationTier, 10) : countryData.populationTier
                    }}
                    userId={user?.id}
                  />
                </Suspense>
                <Suspense fallback={<div>Loading MyCountry® suite...</div>}>
                  <MyCountryPremium 
                    profile={profile ? { id: profile.userId, role: 'user', countryId: profile.countryId ?? undefined } : undefined} 
                    userId={user?.id}
                  />
                </Suspense>
              </BentoGrid>
            )}
            {selectedModule === 'mycountry' && (
              <Suspense fallback={<div>Loading MyCountry® suite...</div>}>
                <MyCountryPremium 
                  profile={profile ? { id: profile.userId, role: 'user', countryId: profile.countryId ?? undefined } : undefined} 
                  userId={user?.id}
                />
              </Suspense>
            )}
            {selectedModule === 'focus' && (
              <Suspense fallback={<div>Loading focus areas...</div>}>
                <FocusCards
                  countryData={{
                    ...countryData,
                    populationTier: typeof countryData.populationTier === 'string' ? parseInt(countryData.populationTier, 10) : countryData.populationTier
                  }}
                  selectedFocus={selectedFocus}
                  setSelectedFocus={setSelectedFocus}
                />
              </Suspense>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}