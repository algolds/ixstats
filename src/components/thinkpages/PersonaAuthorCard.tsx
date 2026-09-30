"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  HoverCardArrow,
} from "~/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { PersonaFollowButton } from "./PersonaFollowButton";

export interface PersonaAuthorCardProps {
  username: string;
  children: React.ReactNode;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Post author card: hover (or tap) a persona's name to see who they are, their real
 * follower/following counts, and follow them. The profile is fetched only when opened.
 */
export function PersonaAuthorCard({ username, children }: PersonaAuthorCardProps) {
  const [open, setOpen] = useState(false);
  const {
    data: profile,
    isLoading,
    isError,
  } = api.thinkpages.getAccountProfile.useQuery(
    { username },
    { enabled: open && !!username, staleTime: 30_000, retry: false }
  );

  if (!username) return <>{children}</>;

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild onClick={() => setOpen((o) => !o)}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" sideOffset={4} className="w-72 p-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className="bg-muted h-4 w-32 animate-pulse rounded" />
            <div className="bg-muted/60 h-3 w-40 animate-pulse rounded" />
          </div>
        ) : isError || !profile ? (
          <p className="text-muted-foreground text-xs">This account is unavailable.</p>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.profileImageUrl ?? ""} />
                <AvatarFallback className="text-xs font-semibold">
                  {initials(profile.displayName)}
                </AvatarFallback>
              </Avatar>
              <PersonaFollowButton
                accountId={profile.id}
                username={profile.username}
                isFollowing={profile.isFollowing}
                isOwnAccount={profile.isOwnAccount}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-sm font-semibold">
                <span className="truncate">{profile.displayName}</span>
                {profile.verified && (
                  <span className="text-xs" title="Verified">
                    ✅
                  </span>
                )}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                @{profile.username} ·{" "}
                {profile.country
                  ? `${profile.accountType} · ${profile.country.name}`
                  : "personal account"}
              </div>
            </div>
            {profile.bio && (
              <p className="text-foreground/80 line-clamp-3 text-xs">{profile.bio}</p>
            )}
            <div className="text-muted-foreground flex gap-3 text-xs">
              <span>
                <strong className="text-foreground">{profile.followerCount}</strong> followers
              </span>
              <span>
                <strong className="text-foreground">{profile.followingCount}</strong> following
              </span>
              <span>
                <strong className="text-foreground">{profile.postCount}</strong> posts
              </span>
            </div>
            <Link
              href={withBasePath(`/thinkpages/profile/${profile.username}`)}
              className="text-xs font-medium text-blue-500 hover:underline"
            >
              View profile →
            </Link>
          </div>
        )}
        <HoverCardArrow className="fill-popover" />
      </HoverCardContent>
    </HoverCard>
  );
}
