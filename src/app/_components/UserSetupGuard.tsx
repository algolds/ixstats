"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { navigateTo } from "~/lib/url-utils";
import { usePermissions, ROLE_LEVELS } from "~/hooks/usePermissions";
import { isSystemOwner } from "~/lib/system-owner-constants";

/**
 * UserSetupGuard - Ensures users complete setup before accessing the app
 * 
 * This component handles:
 * - Redirecting users without countries to /setup
 * - Skipping redirect for system owners and admins
 * - Preventing multiple redirects
 * - Proper loading states
 */
export function UserSetupGuard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);
  const { user: permissionUser, isLoading: permissionsLoading } = usePermissions();

  const isSystemOwnerUser = user ? isSystemOwner(user.id) : false;
  const isAdminOrHigher = permissionUser?.role ? permissionUser.role.level <= ROLE_LEVELS.ADMIN : false;

  // Skip setup redirect for these paths
  const skipSetupPaths = [
    '/setup', 
    '/sign-in', 
    '/sign-up', 
    '/api', 
    '/trpc',
    '/_next',
    '/favicon.ico',
    '/admin',
    '/test-user-creation' // Add test pages
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
      console.log('[UserSetupGuard] Checking setup status for user:', user.id);

      // Wait for permission data to load before making decisions
      if (permissionsLoading) {
        console.log('[UserSetupGuard] Permissions still loading, waiting...');
        return;
      }

      // System owners or admins may not need a linked country—skip redirect
      if (isSystemOwnerUser || isAdminOrHigher) {
        console.log('[UserSetupGuard] System owner or admin detected, skipping setup redirect');
        return;
      }

      // If profile is still loading, wait
      if (profileLoading) {
        console.log('[UserSetupGuard] Profile still loading, waiting...');
        return;
      }

      // Note: User creation is now handled automatically by tRPC context
      // No need to manually create user records here

      // If user has no country linked, redirect to setup
      if (userProfile && !userProfile.countryId) {
        console.log('[UserSetupGuard] User has no country linked, redirecting to setup');
        hasRedirected.current = true;
        navigateTo(router, '/setup');
        return;
      }

      console.log('[UserSetupGuard] User has country linked, no redirect needed');
    }
  }, [
    isLoaded, 
    user, 
    profileLoading, 
    userProfile, 
    profileError, 
    router, 
    shouldSkipSetup, 
    permissionsLoading, 
    isSystemOwner, 
    isAdminOrHigher
  ]);

  // Reset redirect flag when user changes
  useEffect(() => {
    hasRedirected.current = false;
  }, [user?.id]);

  // Don't render anything - this is just for side effects
  return null;
}
