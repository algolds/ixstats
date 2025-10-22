"use client";

import { useUser } from "~/context/auth-context";
import { User, LogOut } from "lucide-react";

/**
 * AuthenticationStatus - Shows current authentication state
 * Useful for debugging authentication issues
 */
export function AuthenticationStatus() {
  const { user, isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-xs text-gray-500">
        Auth: Loading...
      </div>
    );
  }

  if (isSignedIn && user) {
    return (
      <div className="text-xs text-green-600 flex items-center gap-1">
        <User className="h-3 w-3" />
        Signed in as {user.firstName || user.emailAddresses?.[0]?.emailAddress || 'User'}
      </div>
    );
  }

  return (
    <div className="text-xs text-red-600 flex items-center gap-1">
      <LogOut className="h-3 w-3" />
      Not signed in
    </div>
  );
}
