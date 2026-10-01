"use client";

import { LogIn, User, Dashboard as LayoutDashboard, Crown } from "iconoir-react";
import { SignInButton } from "~/context/auth-context";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { cn, getNationUrl } from "~/lib/utils";
import { useRouter } from "next/navigation";

/**
 * Controls on the map island (Halo's acrylic pill, which clips at its edge — `overflow-hidden`,
 * 4px of padding): the focus ring sits just inside the control, as MapDynamicIsland's buttons.
 */
const ISLAND_CONTROL = "text-label-secondary hover:text-label focus-visible:-outline-offset-2";

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
        <Button variant="ghost" size="sm" className={cn(ISLAND_CONTROL, "px-2")}>
          <LogIn className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Sign in</span>
          <span className="sr-only sm:hidden">Sign in</span>
        </Button>
      </SignInButton>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            ISLAND_CONTROL,
            "hover:bg-fill-3 rounded-control-sm text-caption gap-2 px-2 font-normal"
          )}
        >
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="ring-separator h-4 w-4 rounded-full object-cover ring-1"
            />
          ) : (
            <User aria-hidden className="h-3 w-3" />
          )}
          <span className="hidden whitespace-nowrap sm:inline">
            {greeting}
            {user.firstName ? `, ${user.firstName}` : ""}
          </span>
          {/* Phones hide the greeting: keep the trigger named. */}
          <span className="sr-only sm:hidden">Account</span>
        </Button>
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
