/**
 * Example file showing how to use the role-based access control system
 * throughout the application. Remove this file when no longer needed.
 */

"use client";

import React from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { 
  AdminOnly, 
  StaffOnly, 
  ModeratorOnly, 
  RequiresPermission, 
  RequiresRoleLevel, 
  FeatureGate, 
  AccessControl, 
  useCanAccess 
} from '~/components/auth/RoleBasedAccess';
import { usePermissions, PERMISSIONS, ROLE_LEVELS } from '~/hooks/usePermissions';
import { Settings, Users, Shield, BarChart3, FileText, Trash2 } from 'lucide-react';

export function RoleBasedFeatures() {
  const { user, permissions, isLoading } = usePermissions();
  
  // Example of using the useCanAccess hook for complex conditions
  const canManageSystem = useCanAccess({
    permissions: [PERMISSIONS.SYSTEM_CONFIG, PERMISSIONS.USER_MANAGE],
    roleLevel: ROLE_LEVELS.ADMIN,
    requireAll: true // Requires ALL permissions AND admin role level
  });
  
  const canModerateContent = useCanAccess({
    permissions: [PERMISSIONS.CONTENT_EDIT, PERMISSIONS.MODERATION_ACTIONS],
    requireAll: false // Requires ANY of these permissions
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">Loading role information...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Role Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Access Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Current Role</div>
              {user?.role ? (
                <Badge className={`${
                  user.role.level <= 0 ? 'bg-purple-100 text-purple-800' :
                  user.role.level <= 10 ? 'bg-red-100 text-red-800' :
                  user.role.level <= 20 ? 'bg-blue-100 text-blue-800' :
                  user.role.level <= 30 ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {user.role.displayName} (Level {user.role.level})
                </Badge>
              ) : (
                <Badge variant="outline">Standard User</Badge>
              )}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Active Permissions</div>
              <div className="text-sm font-medium">{permissions.length} permissions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-Based Content Examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Admin Only Features */}
        <AdminOnly fallback={
          <Card className="opacity-50">
            <CardContent className="p-4 text-center">
              <Settings className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Admin Only</div>
              <div className="text-xs text-muted-foreground">System Administration</div>
            </CardContent>
          </Card>
        }>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4">
              <Settings className="h-8 w-8 mb-2 text-red-600" />
              <div className="font-medium">System Admin</div>
              <div className="text-sm text-muted-foreground mb-3">Full system access</div>
              <Button size="sm" className="w-full bg-red-600 hover:bg-red-700">
                Access Admin Panel
              </Button>
            </CardContent>
          </Card>
        </AdminOnly>

        {/* Staff Only Features */}
        <StaffOnly fallback={
          <Card className="opacity-50">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Staff Only</div>
              <div className="text-xs text-muted-foreground">Content Management</div>
            </CardContent>
          </Card>
        }>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <Users className="h-8 w-8 mb-2 text-blue-600" />
              <div className="font-medium">Staff Tools</div>
              <div className="text-sm text-muted-foreground mb-3">Content & user support</div>
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                Manage Content
              </Button>
            </CardContent>
          </Card>
        </StaffOnly>

        {/* Moderator Only Features */}
        <ModeratorOnly fallback={
          <Card className="opacity-50">
            <CardContent className="p-4 text-center">
              <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Moderator Only</div>
              <div className="text-xs text-muted-foreground">Content Moderation</div>
            </CardContent>
          </Card>
        }>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4">
              <Shield className="h-8 w-8 mb-2 text-green-600" />
              <div className="font-medium">Moderation</div>
              <div className="text-sm text-muted-foreground mb-3">Content oversight</div>
              <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                Review Content
              </Button>
            </CardContent>
          </Card>
        </ModeratorOnly>
      </div>

      {/* Permission-Based Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Analytics Access */}
        <RequiresPermission 
          permission={PERMISSIONS.ANALYTICS_VIEW}
          fallback={
            <Card className="opacity-50">
              <CardContent className="p-4 text-center text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                <div className="text-sm">Analytics access required</div>
              </CardContent>
            </Card>
          }
        >
          <Card>
            <CardContent className="p-4">
              <BarChart3 className="h-8 w-8 mb-2 text-purple-600" />
              <div className="font-medium">Analytics Dashboard</div>
              <div className="text-sm text-muted-foreground mb-3">View system metrics</div>
              <Button size="sm" variant="outline" className="w-full">
                View Analytics
              </Button>
            </CardContent>
          </Card>
        </RequiresPermission>

        {/* Content Management */}
        <RequiresPermission 
          permission={PERMISSIONS.CONTENT_EDIT}
          fallback={
            <Card className="opacity-50">
              <CardContent className="p-4 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <div className="text-sm">Content editing access required</div>
              </CardContent>
            </Card>
          }
        >
          <Card>
            <CardContent className="p-4">
              <FileText className="h-8 w-8 mb-2 text-indigo-600" />
              <div className="font-medium">Content Editor</div>
              <div className="text-sm text-muted-foreground mb-3">Edit and publish content</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1">
                  Edit
                </Button>
                <RequiresPermission permission={PERMISSIONS.CONTENT_DELETE}>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </RequiresPermission>
              </div>
            </CardContent>
          </Card>
        </RequiresPermission>
      </div>

      {/* Complex Access Control Example */}
      <Card>
        <CardHeader>
          <CardTitle>Complex Access Control Example</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <AccessControl
              conditions={{
                permissions: [PERMISSIONS.SYSTEM_CONFIG, PERMISSIONS.USER_MANAGE],
                roleLevel: ROLE_LEVELS.ADMIN,
                requireAll: true
              }}
              fallback={
                <div className="p-4 bg-muted/30 rounded-lg text-center text-muted-foreground">
                  <div className="text-sm">System Management requires:</div>
                  <div className="text-xs mt-1">
                    • Admin role (Level 10+)<br/>
                    • System Configuration permission<br/>
                    • User Management permission
                  </div>
                </div>
              }
            >
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="font-medium text-red-800">🔥 System Management Panel</div>
                <div className="text-sm text-red-600 mt-1">
                  You have full system management access. Use with caution!
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700">
                    System Settings
                  </Button>
                  <Button size="sm" variant="outline">
                    User Management
                  </Button>
                </div>
              </div>
            </AccessControl>

            {/* Feature Gate Example */}
            <FeatureGate
              feature="ADVANCED_ANALYTICS"
              requiredRoleLevel={ROLE_LEVELS.STAFF}
              fallback={
                <div className="p-3 bg-muted/20 rounded text-sm text-muted-foreground">
                  Advanced Analytics feature is disabled or requires higher permissions.
                </div>
              }
            >
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="font-medium text-blue-800">📊 Advanced Analytics</div>
                <div className="text-sm text-blue-600">
                  Feature-gated analytics with role requirements.
                </div>
              </div>
            </FeatureGate>

            {/* Dynamic Permission Check Results */}
            <div className="p-3 bg-gray-50 rounded text-sm">
              <div className="font-medium mb-2">Dynamic Permission Checks:</div>
              <div className="space-y-1 text-xs font-mono">
                <div>canManageSystem: {canManageSystem ? '✅ true' : '❌ false'}</div>
                <div>canModerateContent: {canModerateContent ? '✅ true' : '❌ false'}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Active Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {permissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {permissions.map((permission) => (
                <Badge key={permission} variant="outline" className="text-xs">
                  {permission}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No special permissions assigned</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}