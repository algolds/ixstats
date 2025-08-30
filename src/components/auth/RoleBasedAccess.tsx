"use client";

import React from 'react';
import { usePermissions, useHasPermission, useHasRoleLevel, useIsAdmin, useIsStaff, useIsModerator } from '~/hooks/usePermissions';

// Basic permission-based wrapper
interface PermissionWrapperProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequiresPermission({ permission, children, fallback = null }: PermissionWrapperProps) {
  const hasPermission = useHasPermission(permission);
  
  if (!hasPermission) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Role level based wrapper
interface RoleLevelWrapperProps {
  level: number;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequiresRoleLevel({ level, children, fallback = null }: RoleLevelWrapperProps) {
  const hasLevel = useHasRoleLevel(level);
  
  if (!hasLevel) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Convenience components for common roles
interface RoleWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminOnly({ children, fallback = null }: RoleWrapperProps) {
  const isAdmin = useIsAdmin();
  
  if (!isAdmin) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

export function StaffOnly({ children, fallback = null }: RoleWrapperProps) {
  const isStaff = useIsStaff();
  
  if (!isStaff) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

export function ModeratorOnly({ children, fallback = null }: RoleWrapperProps) {
  const isModerator = useIsModerator();
  
  if (!isModerator) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Feature flag component - enable/disable features based on roles
interface FeatureGateProps {
  feature: string;
  requiredPermission?: string;
  requiredRoleLevel?: number;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ 
  feature, 
  requiredPermission, 
  requiredRoleLevel, 
  children, 
  fallback = null 
}: FeatureGateProps) {
  const hasPermission = requiredPermission ? useHasPermission(requiredPermission) : true;
  const hasRoleLevel = requiredRoleLevel !== undefined ? useHasRoleLevel(requiredRoleLevel) : true;
  
  // Feature can be controlled by environment variable or other feature flags
  const isFeatureEnabled = process.env.NODE_ENV === 'development' || 
    process.env[`NEXT_PUBLIC_FEATURE_${feature.toUpperCase()}`] === 'true';
  
  if (!isFeatureEnabled || !hasPermission || !hasRoleLevel) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Hook for checking multiple conditions
export function useCanAccess(conditions: {
  permissions?: string[];
  roleLevel?: number;
  requireAll?: boolean; // Default: false (OR logic), true (AND logic)
}): boolean {
  const { permissions: userPermissions } = usePermissions();
  const hasRoleLevel = conditions.roleLevel !== undefined ? useHasRoleLevel(conditions.roleLevel) : true;
  
  if (!hasRoleLevel) return false;
  
  if (!conditions.permissions || conditions.permissions.length === 0) {
    return hasRoleLevel;
  }
  
  const requireAll = conditions.requireAll ?? false;
  
  if (requireAll) {
    return conditions.permissions.every(permission => userPermissions.includes(permission));
  } else {
    return conditions.permissions.some(permission => userPermissions.includes(permission));
  }
}

// Component for complex access control
interface AccessControlProps {
  conditions: {
    permissions?: string[];
    roleLevel?: number;
    requireAll?: boolean;
  };
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AccessControl({ conditions, children, fallback = null }: AccessControlProps) {
  const canAccess = useCanAccess(conditions);
  
  if (!canAccess) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}