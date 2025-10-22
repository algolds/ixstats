"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { navigateTo } from "~/lib/url-utils";
import { usePermissions, ROLE_LEVELS } from "~/hooks/usePermissions";
import { isSystemOwner } from "~/lib/system-owner-constants";

export function SetupRedirect() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);
  const { user: permissionUser, isLoading: permissionsLoading } = usePermissions();

  const isSystemOwnerUser = user ? isSystemOwner(user.id) : false;
  const isAdminOrHigher =
    permissionUser?.role ? permissionUser.role.level <= ROLE_LEVELS.ADMIN : false;

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
    pathname?.startsWith(path) ?? false
  );

  // Query user profile to check if setup is needed
  const { data: userProfile, isLoading: profileLoading, error: profileError } = api.users.getProfile.useQuery(
    undefined,
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
      console.log('[SetupRedirect] User loaded:', user.id, 'isSystemOwner:', isSystemOwner, 'isAdminOrHigher:', isAdminOrHigher);
      
      // Wait for permission data to load before making decisions
      if (permissionsLoading) return;

      // System owners or admins may not need a linked country—skip redirect
      if (isSystemOwnerUser || isAdminOrHigher) {
        console.log('[SetupRedirect] System owner or admin detected, checking for country redirect');
        console.log('[SetupRedirect] User profile:', userProfile);
        
        // If system owner has a country, redirect to it
        if (userProfile && userProfile.countryId) {
          console.log('[SetupRedirect] System owner has country, redirecting to MyCountry page');
          hasRedirected.current = true;
          // Redirect to MyCountry page which will handle the country-specific content
          navigateTo(router, '/mycountry');
          return;
        }
        
        console.log('[SetupRedirect] System owner has no country, skipping redirect');
        return;
      }

      // If profile is still loading, wait
      if (profileLoading) {
        console.log('[SetupRedirect] Profile still loading, waiting...');
        return;
      }

      // If there was an error loading profile, don't redirect
      if (profileError) {
        console.warn('[SetupRedirect] Profile loading error, skipping setup redirect:', profileError);
        return;
      }

      // If user has no country linked, redirect to setup
      if (userProfile && !userProfile.countryId) {
        console.log('[SetupRedirect] User has no country linked, redirecting to setup');
        hasRedirected.current = true;
        navigateTo(router, '/setup');
        return;
      }

      // If userProfile is null/undefined but user is loaded, they might not have a profile yet
      if (!userProfile && isLoaded && user) {
        console.log('[SetupRedirect] No user profile found, redirecting to setup');
        hasRedirected.current = true;
        navigateTo(router, '/setup');
        return;
      }

      console.log('[SetupRedirect] User has country linked, no redirect needed');
    }
  }, [isLoaded, user, profileLoading, userProfile, profileError, router, shouldSkipSetup, permissionsLoading, isSystemOwner, isAdminOrHigher]);

  // Reset redirect flag when user changes
  useEffect(() => {
    hasRedirected.current = false;
  }, [user?.id]);

  // Don't render anything - this is just for side effects
  return null;
} 
