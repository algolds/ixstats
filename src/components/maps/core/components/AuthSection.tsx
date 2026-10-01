"use client";

import { LogIn, User, Dashboard as LayoutDashboard, Crown } from "iconoir-react";
import { SignInButton } from "~/context/auth-context";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { getNationUrl } from "~/lib/utils";
import { useRouter } from "next/navigation";

interface AuthSectionProps {
  user: any;
  isLoaded: boolean;
  greeting: string;
  countryName?: string;
  router: ReturnType<typeof useRouter>;
}

export function AuthSection({ user, isLoaded, greeting, countryName, router }: AuthSectionProps) {
  if (!isLoaded) {
    return <span className="text-label-secondary text-footnote">…</span>;
  }

  if (!user) {
    return (
      <SignInButton mode="modal">
        <Button variant="ghost" size="sm" className="text-label-secondary hover:text-label px-2">
          <LogIn className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Sign in</span>
          <span className="sr-only sm:hidden">Sign in</span>
        </Button>
      </SignInButton>
    );
  }

  return (
    <Popover>
      <PopoverTrigger className="text-label-secondary hover:bg-fill-3 hover:text-label rounded-control-sm text-caption flex cursor-pointer items-center gap-2 px-2 py-0.5 transition-colors">
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="ring-separator h-4 w-4 rounded-full object-cover ring-1"
          />
        ) : (
          <User className="h-3 w-3" />
        )}
        <span className="hidden whitespace-nowrap sm:inline">
          {greeting}
          {user.firstName ? `, ${user.firstName}` : ""}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        className="rounded-card mt-2 w-64 p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="border-separator flex items-center gap-3 border-b px-4 py-3">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="ring-separator h-8 w-8 rounded-full object-cover ring-2"
            />
          ) : (
            <User className="text-label-secondary h-5 w-5" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-label text-headline truncate">
              {user.firstName || user.emailAddresses?.[0]?.emailAddress || "User"}
            </div>
            {countryName && (
              <div className="text-label-secondary text-footnote truncate">{countryName}</div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-0.5 p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="text-label-secondary w-full justify-start"
          >
            <LayoutDashboard aria-hidden />
            Dashboard
          </Button>

          {countryName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(getNationUrl(countryName))}
              className="text-label-secondary w-full justify-start"
            >
              <Crown aria-hidden />
              MyCountry
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
