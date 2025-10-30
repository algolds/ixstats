"use client";

import React from "react";
import {
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions,
  useHasRoleLevel,
} from "~/hooks/usePermissions";

interface PermissionGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface SinglePermissionGateProps extends PermissionGateProps {
  permission: string;
}

interface MultiplePermissionGateProps extends PermissionGateProps {
  permissions: string[];
  requireAll?: boolean; // If true, requires ALL permissions; if false, requires ANY
}

interface RoleLevelGateProps extends PermissionGateProps {
  level: number; // Required role level (user level must be <= this value)
}

// Component to check single permission
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: SinglePermissionGateProps) {
  const hasPermission = useHasPermission(permission);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Component to check multiple permissions
export function MultiPermissionGate({
  permissions,
  requireAll = false,
  children,
  fallback = null,
}: MultiplePermissionGateProps) {
  const hasPermission = requireAll
    ? useHasAllPermissions(permissions)
    : useHasAnyPermission(permissions);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Component to check role level
export function RoleLevelGate({ level, children, fallback = null }: RoleLevelGateProps) {
  const hasLevel = useHasRoleLevel(level);

  if (!hasLevel) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Convenience components for common role checks
export function AdminOnly({ children, fallback = null }: PermissionGateProps) {
  return (
    <RoleLevelGate level={10} fallback={fallback}>
      {children}
    </RoleLevelGate>
  );
}

export function StaffOnly({ children, fallback = null }: PermissionGateProps) {
  return (
    <RoleLevelGate level={20} fallback={fallback}>
      {children}
    </RoleLevelGate>
  );
}

export function ModeratorOnly({ children, fallback = null }: PermissionGateProps) {
  return (
    <RoleLevelGate level={30} fallback={fallback}>
      {children}
    </RoleLevelGate>
  );
}

// Component for unauthorized fallback UI
export function UnauthorizedMessage({
  message = "You don't have permission to access this feature.",
}: {
  message?: string;
}) {
  return (
    <div className="flex items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-red-800">Access Denied</h3>
        <p className="text-red-600">{message}</p>
      </div>
    </div>
  );
}

// Component for loading state while checking permissions
export function PermissionLoader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      {children && <span className="ml-3 text-gray-600">{children}</span>}
    </div>
  );
}
