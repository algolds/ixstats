"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

export interface PersonaFollowButtonProps {
  accountId: string;
  username: string;
  isFollowing: boolean;
  isOwnAccount: boolean;
  className?: string;
}

/**
 * Follow / unfollow a ThinkPages persona as yourself (your personal persona, created on the
 * first follow). Hidden for signed-out viewers and on your own personas.
 */
export function PersonaFollowButton({
  accountId,
  username,
  isFollowing,
  isOwnAccount,
  className,
}: PersonaFollowButtonProps) {
  const { isSignedIn } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  const refresh = () => {
    void utils.thinkpages.getAccountProfile.invalidate({ username });
    void utils.thinkpages.getMyAccounts.invalidate();
    void utils.activities.getFollowingFeed.invalidate();
  };

  const follow = api.activities.followPersona.useMutation({
    onSuccess: refresh,
    onError: (err) => notify.error(err.message || "Could not follow this account"),
  });
  const unfollow = api.activities.unfollowPersona.useMutation({
    onSuccess: refresh,
    onError: (err) => notify.error(err.message || "Could not unfollow this account"),
  });

  if (!isSignedIn || isOwnAccount) return null;

  const pending = follow.isPending || unfollow.isPending;
  return (
    <Button
      size="sm"
      variant={isFollowing ? "outline" : "default"}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        if (isFollowing) unfollow.mutate({ accountId });
        else follow.mutate({ accountId });
      }}
      className={cn("text-footnote h-7 cursor-pointer px-3", className)}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}
