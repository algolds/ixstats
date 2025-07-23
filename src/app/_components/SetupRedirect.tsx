"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { navigateTo } from "~/lib/url-utils";

export function SetupRedirect() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  // Skip setup redirect for these paths
  const skipSetupPaths = [
    '/setup', 
    '/sign-in', 
    '/sign-up', 
    '/api', 
    '/trpc',
    '/_next',
    '/favicon.ico',
    '/admin' // <-- Add this line to always skip setup redirect for admin page
  ];
  
  const shouldSkipSetup = skipSetupPaths.some(path => 
    pathname.startsWith(path)
  );

  // Query user profile to check if setup is needed
  const { data: userProfile, isLoading: profileLoading, error: profileError } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { 
      enabled: !!user?.id && !shouldSkipSetup && isLoaded,
      retry: false,
      staleTime: 30000, // Cache for 30 seconds to prevent excessive queries
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirected.current) return;

    // Only proceed if user is loaded and we're not on a skip path
    if (isLoaded && user && !shouldSkipSetup) {
      // If profile is still loading, wait
      if (profileLoading) return;

      // If there was an error loading profile, don't redirect
      if (profileError) {
        console.warn('Profile loading error, skipping setup redirect:', profileError);
        return;
      }

      // If user has no country linked, redirect to setup
      if (userProfile && !userProfile.countryId) {
        hasRedirected.current = true;
        navigateTo(router, '/setup');
      }
    }
  }, [isLoaded, user, profileLoading, userProfile, profileError, router, shouldSkipSetup]);

  // Reset redirect flag when user changes
  useEffect(() => {
    hasRedirected.current = false;
  }, [user?.id]);

  // Don't render anything - this is just for side effects
  return null;
} 