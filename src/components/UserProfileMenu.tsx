"use client";

import Link from "next/link";
import { useState } from "react";
import { 
  User,
  Crown,
  Home,
  ChevronDown,
  LogOut,
  AlertCircle,
  Settings
} from "lucide-react";
import { SignInButton } from "~/context/auth-context";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { createAbsoluteUrl } from "~/lib/url-utils";

interface UserProfileMenuProps {
  user: any;
  userProfile: any;
  setupStatus: string;
  userCountryFlag: string | null;
  flagsLoading: boolean;
}

export function UserProfileMenu({ user, userProfile, setupStatus, userCountryFlag, flagsLoading }: UserProfileMenuProps) {
  const [showUserPopover, setShowUserPopover] = useState(false);

  if (!user) {
    return (
      <SignInButton className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-foreground transition-all duration-200">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="hidden md:block text-sm">Sign In</span>
        </div>
      </SignInButton>
    );
  }

  return (
    <Popover open={showUserPopover} onOpenChange={setShowUserPopover}>
      <PopoverTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200">
          {setupStatus === 'complete' && userProfile?.country && userCountryFlag ? (
            <img
              src={userCountryFlag}
              alt={`Flag of ${userProfile.country.name}`}
              className="w-8 h-8 rounded-full border-border object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium border-border">
              {user?.firstName?.[0] || (user as any)?.username?.[0] || 'U'}
            </div>
          )}
          <div className="hidden md:block text-left">
            <div className="text-foreground text-sm font-medium">
              {user?.firstName || (user as any)?.username || 'User'}
            </div>
            {setupStatus === 'complete' && userProfile?.country && (
              <div className="text-muted-foreground text-xs">
                {userProfile.country.name}
              </div>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="py-2">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-border-white/10">
            <div className="flex items-center gap-3">
              {setupStatus === 'complete' && userProfile?.country && userCountryFlag ? (
                <img
                  src={userCountryFlag}
                  alt={`Flag of ${userProfile.country.name}`}
                  className="w-12 h-12 rounded-full border-border object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-lg border-border">
                  {user?.firstName?.[0] || (user as any)?.username?.[0] || 'U'}
                </div>
              )}
              <div>
                <div className="font-medium text-foreground">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-sm text-muted-foreground">
                  {setupStatus === 'complete' && userProfile?.country ? userProfile.country.name : 'Not linked to country'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="py-1">
            {setupStatus === 'complete' && userProfile?.country && (
              <Link
                href={`/nation/${userProfile.country.slug || userProfile.country.id}`}
                className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
              >
                <Crown className="h-4 w-4" />
                My Country Dashboard
              </Link>
            )}
            {setupStatus === 'needs-setup' && (
              <Link
                href="/setup"
                className="flex items-center gap-3 px-4 py-2 text-sm text-amber-600 dark:text-amber-300 hover:text-amber-700 dark:hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
              >
                <AlertCircle className="h-4 w-4" />
                Complete Setup
              </Link>
            )}
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-3 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <User className="h-4 w-4" />
              Profile Settings
            </Link>
            <a
              href="https://accounts.ixwiki.com/user"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Account Management
            </a>
          </div>
          
          {/* Divider */}
          <div className="border-t border-border my-1" />
          
          {/* Sign Out */}
          <div className="px-4 py-2">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = createAbsoluteUrl('/sign-out');
                }
              }}
              className="w-full flex items-center gap-3 px-0 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}