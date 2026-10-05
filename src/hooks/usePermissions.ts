import { useMemo } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";

import { isSystemOwner } from "~/lib/auth";
import { BETA_TESTER_ROLE_NAMES, isBetaTesterRole } from "~/lib/auth/premium";

interface UserRole {
  id: string;
  name: string;
  displayName: string;
  level: number;
  permissions: Permission[];
}

interface Permission {
  id: string;
  name: string;
  displayName: string;
  category: string;
}

interface UserPermissionData {
  user: {
    id: string;
    clerkUserId: string;
    role: UserRole | null;
    isActive: boolean;
  } | null;
  permissions: string[];
  isLoading: boolean;
  error: string | null;
}

// Hook to get current user's permissions
export function usePermissions(): UserPermissionData {
  // Use the native auth context which integrates with Clerk
  const { user: authUser, isSignedIn, isLoaded } = useUser();

  // Query user data including role and permissions
  const {
    data: userData,
    isLoading,
    error,
  } = api.users.getCurrentUserWithRole.useQuery(undefined, {
    enabled: isSignedIn && isLoaded && !!authUser,
    retry: false,
  });

  const permissions = useMemo(() => {
    if (!userData?.user?.role?.permissions) return [];
    return userData.user.role.permissions.map((p) => p.name);
  }, [userData]);

  return {
    user: (userData?.user as any) || null,
    permissions,
    isLoading: isLoading || !isLoaded,
    error: error?.message || null,
  };
}

// Hook to check if user has specific permission
export function useHasPermission(permission: string): boolean {
  const { permissions, isLoading } = usePermissions();

  if (isLoading) return false;
  return permissions.includes(permission);
}

// Hook to check if user has any of the specified permissions
// Hook to check if user has all specified permissions
// Hook to check role level (lower numbers = higher privilege)
export function useHasRoleLevel(minimumLevel: number): boolean {
  const { user, isLoading } = usePermissions();

  if (isLoading || !user?.role) return false;
  return user.role.level <= minimumLevel;
}

// Hook to check if user is admin or higher
export function useIsAdmin(): boolean {
  return useHasRoleLevel(10); // Admin level or higher
}

// Hook to check if user is staff or higher
export function useIsStaff(): boolean {
  return useHasRoleLevel(20); // Staff level or higher
}

// Hook to check if user is moderator or higher
// Hook to check if user has beta tester privileges or higher (system owner, admin, staff, beta_tester)
export function useIsBetaTester(): boolean {
  const { user: authUser } = useUser();
  const { user: permissionUser, isLoading } = usePermissions();

  if (!authUser) return false;
  if (isSystemOwner(authUser.id)) return true;

  const authRole = (authUser.publicMetadata as any)?.role;
  if (typeof authRole === "string" && BETA_TESTER_ROLE_NAMES.includes(authRole)) {
    return true;
  }

  if (isLoading || !permissionUser?.role) return false;
  return isBetaTesterRole(permissionUser.role.name, permissionUser.role.level);
}

// Hook to check if user has access to Narrator feature (system owners, admins, staff, beta testers)
export function useHasNarratorAccess(): boolean {
  return useIsBetaTester();
}

// Utility functions for server-side permission checking
// Permission constants for easy reference
// Role level constants
export const ROLE_LEVELS = {
  OWNER: 0,
  ADMIN: 10,
  STAFF: 20,
  MODERATOR: 30,
  USER: 100,
} as const;
