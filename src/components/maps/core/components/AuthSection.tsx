"use client";

import { LogIn, User, LayoutDashboard, Crown } from "lucide-react";
import { SignInButton } from "~/context/auth-context";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { getNationUrl } from "~/lib/slug-utils";
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
    return <span className="text-muted-foreground text-[11px]">…</span>;
  }

  if (!user) {
    return (
      <SignInButton mode="modal">
        <button className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors">
          <LogIn className="h-3 w-3" />
          <span className="hidden sm:inline">Sign in</span>
        </button>
      </SignInButton>
    );
  }

  return (
    <Popover>
      <PopoverTrigger className="text-foreground/80 hover:bg-accent hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors">
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="h-4 w-4 rounded-full object-cover ring-1 ring-white/20"
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
        className="glass-none border-border bg-popover mt-2 w-64 rounded-2xl border p-0 shadow-2xl"
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
            <div className="bg-accent flex h-8 w-8 items-center justify-center rounded-full">
              <User className="text-muted-foreground h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-foreground truncate text-sm font-semibold">
              {user.firstName || user.emailAddresses?.[0]?.emailAddress || "User"}
            </div>
            {countryName && (
              <div className="text-muted-foreground truncate text-[11px]">{countryName}</div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-0.5 p-1.5">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </button>

          {countryName && (
            <button
              onClick={() => router.push(getNationUrl(countryName))}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors"
            >
              <Crown className="h-3.5 w-3.5" />
              MyCountry
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
