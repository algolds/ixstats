"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "@/trpc/react";
import { getUserInterfacePreferences } from "@/lib/interface-routing";

export function InterfaceSwitcher({ currentInterface, countryId }: { currentInterface: 'sdi' | 'eci', countryId?: string }) {
  const router = useRouter();
  const { user } = useUser();
  const { data: profile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
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
      router.push(`/sdi?countryId=${countryId}`);
    } else {
      router.push('/sdi');
    }
  };
  const switchToECI = () => router.push('/eci');

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