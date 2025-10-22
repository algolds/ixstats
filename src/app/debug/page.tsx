"use client";

import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { usePermissions } from "~/hooks/usePermissions";
import { SYSTEM_OWNER_IDS, isSystemOwner } from "~/lib/system-owner-constants";

export default function DebugPage() {
  const { user, isLoaded } = useUser();
  const { user: permissionUser, isLoading: permissionsLoading } = usePermissions();
  
  const utils = api.useUtils();
  
  const { data: userProfile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = api.users.getProfile.useQuery(undefined, {
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: userWithRole, refetch: refetchRole } = api.users.getCurrentUserWithRole.useQuery(undefined, {
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  const isSystemOwnerUser = user ? isSystemOwner(user.id) : false;
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug</h1>
      
      <div className="space-y-6">
        <div className="bg-blue-100 p-4 rounded space-y-2">
          <div className="flex gap-2">
            <button 
              onClick={() => refetchProfile()} 
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              🔄 Refresh Profile Data
            </button>
            <button 
              onClick={() => {
                refetchRole();
                // Also invalidate all tRPC cache
                utils.invalidate();
              }} 
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              🔄 Refresh Role Data
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Direct role query result: {userWithRole?.user?.role?.name || 'Loading...'} (Level: {userWithRole?.user?.role?.level ?? 'N/A'})
          </p>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Clerk User</h2>
          <p><strong>User ID:</strong> {user?.id || 'Not loaded'}</p>
          <p><strong>Is Loaded:</strong> {isLoaded ? 'Yes' : 'No'}</p>
          <p><strong>Is System Owner:</strong> {isSystemOwnerUser ? 'YES' : 'NO'}</p>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Database User Profile</h2>
          <p><strong>Loading:</strong> {profileLoading ? 'Yes' : 'No'}</p>
          <p><strong>Error:</strong> {profileError?.message || 'None'}</p>
          <p><strong>User ID:</strong> {userProfile?.userId || 'None'}</p>
          <p><strong>Country ID:</strong> {userProfile?.countryId || 'None'}</p>
          <p><strong>Has Completed Setup:</strong> {userProfile?.hasCompletedSetup ? 'Yes' : 'No'}</p>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Permissions</h2>
          <p><strong>Loading:</strong> {permissionsLoading ? 'Yes' : 'No'}</p>
          <p><strong>Role:</strong> {permissionUser?.role?.name || 'None'}</p>
          <p><strong>Role Level:</strong> {permissionUser?.role?.level ?? 'None'}</p>
          <p><strong>Is Admin:</strong> {(permissionUser?.role?.level ?? 999) <= 1 ? 'YES' : 'NO'}</p>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">System Owner Check</h2>
          <p><strong>Expected DEV ID:</strong> user_2zqmDdZvhpNQWGLdAIj2YwH8MLo</p>
          <p><strong>Expected PROD ID:</strong> user_3078Ja62W7yJDlBjjwNppfzceEz</p>
          <p><strong>Current User ID:</strong> {user?.id || 'Not loaded'}</p>
          <p><strong>Matches DEV:</strong> {user?.id === 'user_2zqmDdZvhpNQWGLdAIj2YwH8MLo' ? 'YES' : 'NO'}</p>
          <p><strong>Matches PROD:</strong> {user?.id === 'user_3078Ja62W7yJDlBjjwNppfzceEz' ? 'YES' : 'NO'}</p>
        </div>
      </div>
    </div>
  );
}
