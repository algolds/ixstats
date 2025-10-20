"use client";
import { Button } from "~/components/ui/button";
import { useRouter } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { getUserInterfacePreferences } from "~/lib/interface-routing";
import { navigateTo } from "~/lib/url-utils";
import { createUserProfileQueryParams } from '~/lib/user-utils';

// Check if Clerk is configured
const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')
);

function InterfaceSwitcherContent({ currentInterface, countryId }: { currentInterface: 'sdi' | 'eci', countryId?: string }) {
  const router = useRouter();
  const { user } = useUser();
  const { data: profile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  if (!profile) return null;

  const permissions = getUserInterfacePreferences({
    id: (profile as any)?.userId || (profile as any)?.id || 'unknown',
    role: (profile as any)?.role || 'user',
    countryId: (profile as any)?.countryId || undefined
  });
  
  const switchToSDI = () => {
    if (countryId) {
      navigateTo(router, `/sdi?countryId=${countryId}`);
    } else {
      navigateTo(router, '/sdi');
    }
  };
  const switchToECI = () => navigateTo(router, '/eci');

  return (
    <div className="flex gap-2">
      {currentInterface === 'eci' && permissions.canAccessSDI && (
        <Button 
          onClick={switchToSDI}
          className="bg-blue-600/20 text-blue-300 border-blue-500/30 hover:bg-blue-600/30"
        >
          🌐 Global Overview
        </Button>
      )}
      
      {currentInterface === 'sdi' && permissions.canAccessECI && (
        <Button 
          onClick={switchToECI}
          className="bg-orange-600/20 text-orange-300 border-orange-500/30 hover:bg-orange-600/30"
        >
          🏛️ Executive Interface
        </Button>
      )}
    </div>
  );
}

export function InterfaceSwitcher({ currentInterface, countryId }: { currentInterface: 'sdi' | 'eci', countryId?: string }) {
  // Don't render anything when Clerk is not configured
  if (!isClerkConfigured) {
    return null;
  }

  return <InterfaceSwitcherContent currentInterface={currentInterface} countryId={countryId} />;
}
