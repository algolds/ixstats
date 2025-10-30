import React, { useMemo } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";

export interface UserRole {
  id: string;
  name: string;
  displayName: string;
  level: number;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  displayName: string;
  category: string;
}

export interface UserPermissionData {
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
    user: userData?.user || null,
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
export function useHasAnyPermission(permissionList: string[]): boolean {
  const { permissions, isLoading } = usePermissions();

  if (isLoading) return false;
  return permissionList.some((permission) => permissions.includes(permission));
}

// Hook to check if user has all specified permissions
export function useHasAllPermissions(permissionList: string[]): boolean {
  const { permissions, isLoading } = usePermissions();

  if (isLoading) return false;
  return permissionList.every((permission) => permissions.includes(permission));
}

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
export function useIsModerator(): boolean {
  return useHasRoleLevel(30); // Moderator level or higher
}

// Utility functions for server-side permission checking
export const PermissionUtils = {
  // Check if user has specific permission
  hasPermission(userPermissions: string[], permission: string): boolean {
    return userPermissions.includes(permission);
  },

  // Check if user has any of the permissions
  hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
    return permissions.some((permission) => userPermissions.includes(permission));
  },

  // Check if user has all permissions
  hasAllPermissions(userPermissions: string[], permissions: string[]): boolean {
    return permissions.every((permission) => userPermissions.includes(permission));
  },

  // Check role level
  hasRoleLevel(userLevel: number | null, minimumLevel: number): boolean {
    if (userLevel === null) return false;
    return userLevel <= minimumLevel;
  },

  // Get permissions from role
  extractPermissions(role: UserRole | null): string[] {
    if (!role) return [];
    return role.permissions.map((p) => p.name);
  },
};

// Permission constants for easy reference
export const PERMISSIONS = {
  // System
  SYSTEM_CONFIG: "system.config",
  SYSTEM_MAINTENANCE: "system.maintenance",
  SYSTEM_LOGS: "system.logs",

  // User Management
  USER_VIEW: "user.view",
  USER_MANAGE: "user.manage",
  USER_BAN: "user.ban",
  USER_DELETE: "user.delete",

  // Content Management
  CONTENT_VIEW: "content.view",
  CONTENT_EDIT: "content.edit",
  CONTENT_DELETE: "content.delete",
  CONTENT_PUBLISH: "content.publish",

  // Moderation
  MODERATION_REPORTS: "moderation.reports",
  MODERATION_ACTIONS: "moderation.actions",

  // Analytics
  ANALYTICS_VIEW: "analytics.view",
  ANALYTICS_EXPORT: "analytics.export",

  // Role Management
  ROLE_VIEW: "role.view",
  ROLE_CREATE: "role.create",
  ROLE_EDIT: "role.edit",
  ROLE_DELETE: "role.delete",
  ROLE_ASSIGN: "role.assign",
} as const;

// Role level constants
export const ROLE_LEVELS = {
  OWNER: 0,
  ADMIN: 10,
  STAFF: 20,
  MODERATOR: 30,
  USER: 100,
} as const;
