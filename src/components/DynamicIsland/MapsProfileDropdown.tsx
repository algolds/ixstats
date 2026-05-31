import React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { SignInButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { getNationUrl } from "~/lib/slug-utils";
import { useRouter } from "next/navigation";
import { Crown, LogIn, Map, User } from "lucide-react";

interface MapsProfileDropdownProps {
  user: any;
  isLoaded: boolean;
  userProfile: any;
  greeting: string;
}

export function MapsProfileDropdown({
  user,
  isLoaded,
  userProfile,
  greeting,
}: MapsProfileDropdownProps) {
  const router = useRouter();

  if (!isLoaded) {
    return (
      <span className="text-foreground/50 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap">
        Loading...
      </span>
    );
  }

  if (!user) {
    return (
      <SignInButton mode="modal">
        <button className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-white/10">
          <LogIn className="h-3 w-3 text-blue-400 opacity-70" />
          <span className="text-foreground/70 text-xs font-medium whitespace-nowrap">
            Sign in with IxnayID
          </span>
        </button>
      </SignInButton>
    );
  }

  const countryName = userProfile?.country?.name;

  return (
    <Popover>
      <PopoverTrigger>
        <span className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-white/10">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-4 w-4 rounded-full object-cover ring-1 ring-white/20"
            />
          ) : (
            <User className="h-3 w-3 text-blue-400 opacity-70" />
          )}
          <span className="text-foreground/70 text-xs font-medium whitespace-nowrap">
            {greeting}
            {user.firstName ? `, ${user.firstName}` : ""}
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        className="bg-card/95 border-border z-[10002] mt-2 w-72 rounded-xl p-0 shadow-2xl backdrop-blur-xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="border-border/50 flex items-center gap-3 border-b px-4 py-3">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover ring-2 ring-blue-400/30"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
              <User className="h-4 w-4 text-blue-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {user.firstName || user.emailAddresses?.[0]?.emailAddress || "User"}
            </div>
            {countryName && (
              <div className="text-muted-foreground truncate text-[11px]">{countryName}</div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-0.5 p-2">
          <button
            onClick={() => router.push("/settings")}
            className="text-foreground/70 hover:bg-accent/10 hover:text-foreground flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
          {countryName && (
            <button
              onClick={() => router.push(getNationUrl(countryName))}
              className="text-foreground/70 hover:bg-accent/10 hover:text-foreground flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors"
            >
              <Crown className="h-3.5 w-3.5" />
              <span>View {countryName}</span>
            </button>
          )}
          <button
            onClick={() => router.push("/maps")}
            className="text-foreground/70 hover:bg-accent/10 hover:text-foreground flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors"
          >
            <Map className="h-3.5 w-3.5" />
            <span>IxWorld Maps</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
