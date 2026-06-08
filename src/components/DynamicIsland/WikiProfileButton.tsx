import React, { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { navigateWithBasePath } from "~/lib/base-path";
import { useRouter } from "next/navigation";
import { Crown, History, Trophy, Flame, User } from "lucide-react";
import { CountryActionsMenu } from "~/components/countries/CountryActionsMenu";
import type { ViewMode } from "./types";

interface WikiProfileButtonProps {}

export function WikiProfileButton({}: WikiProfileButtonProps) {
  const { user } = useUser();
  const { recentArticles, restoreSession } = useWikiContext();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const router = useRouter();

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: (popoverOpen || actionsMenuOpen) && !!user?.id,
  });

  // Loreward stats use wiki username (matches country name in the system)
  const countryName = userProfile?.country?.name ?? "";
  const { data: lorewardStats } = api.lorewards.getUserStats.useQuery(
    { username: countryName },
    { enabled: popoverOpen && !!countryName, staleTime: 60_000 }
  );

  const wikiUsername =
    userProfile?.wikiUsername ??
    (user?.username
      ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
      : (user?.firstName ?? ""));

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <span className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-white/10 select-none">
            <span className="text-foreground/80 text-xs font-medium">WikiOS</span>
          </span>
        }
      />
      <PopoverContent
        side="bottom"
        align="center"
        className="bg-card/95 border-border z-[10002] mt-2 w-72 rounded-xl p-0 shadow-2xl backdrop-blur-xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
          <span className="text-sm font-semibold">Wiki Profile</span>
        </div>

        <div className="space-y-3 p-3">
          {/* Loreward stats */}
          {lorewardStats && (
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3 w-3 text-amber-400" />
                <span className="text-foreground/80 text-xs">
                  {lorewardStats.stats?.totalScore ?? 0}
                </span>
                <span className="text-muted-foreground text-[10px]">score</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="h-3 w-3 text-orange-400" />
                <span className="text-foreground/80 text-xs">
                  {lorewardStats.stats?.currentStreak ?? 0}
                </span>
                <span className="text-muted-foreground text-[10px]">streak</span>
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="space-y-0.5">
            {wikiUsername && (
              <button
                onClick={() => {
                  setPopoverOpen(false);
                  navigateWithBasePath(
                    `/w/special/user/${encodeURIComponent(wikiUsername)}`,
                    router
                  );
                }}
                className="text-foreground/70 hover:bg-accent/10 hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
              >
                <User className="h-3 w-3" />
                <span>My Profile</span>
              </button>
            )}
            {userProfile?.countryId && (
              <button
                onClick={() => {
                  setPopoverOpen(false);
                  setActionsMenuOpen(true);
                }}
                className="text-foreground/70 hover:bg-accent/10 hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
              >
                <Crown className="h-3 w-3" />
                <span>Country Actions</span>
              </button>
            )}
          </div>

          {/* Recent articles */}
          {recentArticles.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-1 px-2 text-[10px] font-semibold tracking-wider uppercase">
                Recent Pages
              </div>
              <div className="space-y-0.5">
                {recentArticles.map((title) => (
                  <button
                    key={title}
                    onClick={() => {
                      setPopoverOpen(false);
                      restoreSession(title);
                    }}
                    className="text-foreground/70 hover:bg-accent/10 hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
                  >
                    <History className="h-3 w-3 shrink-0 text-blue-400" />
                    <span className="truncate">{title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>

    {userProfile?.countryId && userProfile?.country?.name && (
      <CountryActionsMenu
        targetCountryId={userProfile.countryId}
        targetCountryName={userProfile.country.name}
        viewerCountryId={userProfile.countryId}
        isOpen={actionsMenuOpen}
        onClose={() => setActionsMenuOpen(false)}
        isOwnCountry={true}
      />
    )}
  </>
);
}
