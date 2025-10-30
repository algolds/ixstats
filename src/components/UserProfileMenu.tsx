"use client";

import Link from "next/link";
import { useState } from "react";
import { User, Crown, Home, ChevronDown, LogOut, AlertCircle, Settings } from "lucide-react";
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

export function UserProfileMenu({
  user,
  userProfile,
  setupStatus,
  userCountryFlag,
  flagsLoading,
}: UserProfileMenuProps) {
  const [showUserPopover, setShowUserPopover] = useState(false);

  if (!user) {
    return (
      <SignInButton mode="modal">
        <button className="bg-accent/10 hover:bg-accent/20 text-foreground flex items-center gap-2 rounded-lg px-3 py-2 transition-all duration-200">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden text-sm md:block">Sign In</span>
          </div>
        </button>
      </SignInButton>
    );
  }

  return (
    <Popover open={showUserPopover} onOpenChange={setShowUserPopover}>
      <PopoverTrigger className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-200 hover:bg-white/10">
        {setupStatus === "complete" && userProfile?.country && userCountryFlag ? (
          <img
            src={userCountryFlag}
            alt={`Flag of ${userProfile.country.name}`}
            className="border-border h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="border-border flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-medium text-white">
            {user?.firstName?.[0] || (user as any)?.username?.[0] || "U"}
          </div>
        )}
        <div className="hidden text-left md:block">
          <div className="text-foreground text-sm font-medium">
            {user?.firstName || (user as any)?.username || "User"}
          </div>
          {setupStatus === "complete" && userProfile?.country && (
            <div className="text-muted-foreground text-xs">{userProfile.country.name}</div>
          )}
        </div>
        <ChevronDown className="text-muted-foreground h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="py-2">
          {/* User Info */}
          <div className="border-border-white/10 border-b px-4 py-3">
            <div className="flex items-center gap-3">
              {setupStatus === "complete" && userProfile?.country && userCountryFlag ? (
                <img
                  src={userCountryFlag}
                  alt={`Flag of ${userProfile.country.name}`}
                  className="border-border h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="border-border flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-medium text-white">
                  {user?.firstName?.[0] || (user as any)?.username?.[0] || "U"}
                </div>
              )}
              <div>
                <div className="text-foreground font-medium">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-muted-foreground text-sm">
                  {setupStatus === "complete" && userProfile?.country
                    ? userProfile.country.name
                    : "Not linked to country"}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {setupStatus === "complete" && userProfile?.country && (
              <Link
                href={`/countries/${userProfile.country.slug}`}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center gap-3 px-4 py-2 text-sm transition-colors"
              >
                <Crown className="h-4 w-4" />
                My Country Dashboard
              </Link>
            )}
            {setupStatus === "needs-setup" && (
              <Link
                href="/setup"
                className="flex items-center gap-3 px-4 py-2 text-sm text-amber-600 transition-colors hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
              >
                <AlertCircle className="h-4 w-4" />
                Complete Setup
              </Link>
            )}
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-3 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <User className="h-4 w-4" />
              Profile Settings
            </Link>
            <a
              href="https://accounts.ixwiki.com/user"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              Account Management
            </a>
          </div>

          {/* Divider */}
          <div className="border-border my-1 border-t" />

          {/* Sign Out */}
          <div className="px-4 py-2">
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = createAbsoluteUrl("/sign-out");
                }
              }}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex w-full items-center gap-3 rounded-md px-0 py-2 text-sm transition-colors"
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
