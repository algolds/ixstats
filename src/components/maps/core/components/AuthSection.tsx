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
    return <span className="text-muted-foreground text-xs">…</span>;
  }

  if (!user) {
    return (
      <SignInButton mode="modal">
        <button className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors">
          <LogIn className="h-3 w-3" />
          <span className="hidden sm:inline">Sign in</span>
        </button>
      </SignInButton>
    );
  }

  return (
    <Popover>
      <PopoverTrigger className="text-foreground/80 hover:bg-accent hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors">
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="ring-border h-4 w-4 rounded-full object-cover ring-1"
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
        className="mt-2 w-64 rounded-2xl p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="border-border flex items-center gap-3 border-b px-4 py-3">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="ring-border h-8 w-8 rounded-full object-cover ring-2"
            />
          ) : (
            <User className="text-muted-foreground h-5 w-5" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-foreground truncate text-sm font-semibold">
              {user.firstName || user.emailAddresses?.[0]?.emailAddress || "User"}
            </div>
            {countryName && (
              <div className="text-muted-foreground truncate text-xs">{countryName}</div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-0.5 p-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="text-muted-foreground w-full justify-start"
          >
            <LayoutDashboard aria-hidden />
            Dashboard
          </Button>

          {countryName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(getNationUrl(countryName))}
              className="text-muted-foreground w-full justify-start"
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
