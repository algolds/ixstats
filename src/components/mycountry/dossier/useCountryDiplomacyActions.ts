"use client";

import { useCallback } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

export type ForeignPolicyType = "free_trade" | "military_alliance" | "sanction" | "embargo";

/** Cooperative actions wait for the other nation's consent; hostile ones take effect at once. */
const isCooperative = (type: ForeignPolicyType) => type === "free_trade" || type === "military_alliance";

const POLICY_LABELS: Record<ForeignPolicyType, string> = {
  free_trade: "Free trade agreement",
  military_alliance: "Military alliance",
  sanction: "Sanctions",
  embargo: "Trade embargo",
};

interface Options {
  viewerCountryId?: string;
  targetCountryId: string;
  targetCountryName: string;
  /** Whether the follow status is looked up (off for the viewer's own country). */
  followStatusEnabled: boolean;
  /** Called after an embassy or foreign-policy proposal succeeds. */
  onProposed?: () => void;
}

/** Follow / embassy / foreign-policy actions a viewer can take toward another country. */
export function useCountryDiplomacyActions({
  viewerCountryId,
  targetCountryId,
  targetCountryName,
  followStatusEnabled,
  onProposed,
}: Options) {
  const notify = useNotify();

  const { data: followStatus, refetch: refetchFollowStatus } =
    api.diplomaticCore.getFollowStatus.useQuery(
      { viewerCountryId: viewerCountryId || "", targetCountryId },
      { enabled: followStatusEnabled }
    );

  const followMutation = api.diplomaticCore.followCountry.useMutation({
    onSuccess: () => {
      notify.success(`Now following ${targetCountryName}`);
      void refetchFollowStatus();
    },
    onError: (error) => notify.error(`Failed to follow: ${error.message}`),
  });

  const unfollowMutation = api.diplomaticCore.unfollowCountry.useMutation({
    onSuccess: () => {
      notify.success(`Unfollowed ${targetCountryName}`);
      void refetchFollowStatus();
    },
    onError: (error) => notify.error(`Failed to unfollow: ${error.message}`),
  });

  const establishEmbassyMutation = api.diplomaticEmbassies.establishEmbassy.useMutation({
    onSuccess: () => {
      notify.success(`Embassy opened in ${targetCountryName}`);
      onProposed?.();
    },
    onError: (error) => notify.error(`Failed to establish embassy: ${error.message}`),
  });

  const foreignPolicyMutation = api.diplomaticPolicies.proposeForeignPolicyAction.useMutation({
    onSuccess: (_, variables) => {
      const type = variables.actionType as ForeignPolicyType;
      const label = POLICY_LABELS[type] ?? "Action";
      notify.success(
        isCooperative(type)
          ? `${label} proposed to ${targetCountryName}`
          : `${label} imposed on ${targetCountryName}`
      );
      onProposed?.();
    },
    onError: (error) => notify.error(`Failed: ${error.message}`),
  });

  const toggleFollow = useCallback(() => {
    if (!viewerCountryId) {
      notify.error("You must be logged in to follow countries");
      return;
    }
    const ids = { followerCountryId: viewerCountryId, followedCountryId: targetCountryId };
    if (followStatus?.isFollowing) unfollowMutation.mutate(ids);
    else followMutation.mutate(ids);
  }, [viewerCountryId, followStatus, targetCountryId, followMutation, unfollowMutation, notify]);

  const establishEmbassy = useCallback(() => {
    if (!viewerCountryId) {
      notify.error("You must be logged in to establish embassies");
      return;
    }
    establishEmbassyMutation.mutate({
      hostCountryId: targetCountryId,
      guestCountryId: viewerCountryId,
      name: `Embassy in ${targetCountryName}`,
      location: "Capital District",
    });
  }, [viewerCountryId, targetCountryId, targetCountryName, establishEmbassyMutation, notify]);

  const proposeForeignPolicy = useCallback(
    (actionType: ForeignPolicyType) => {
      if (!viewerCountryId) {
        notify.error("You must be logged in to propose foreign policy");
        return;
      }
      foreignPolicyMutation.mutate({ targetId: targetCountryId, actionType, severity: "moderate" });
    },
    [viewerCountryId, targetCountryId, foreignPolicyMutation, notify]
  );

  const isFollowPending = followMutation.isPending || unfollowMutation.isPending;
  const isPending =
    isFollowPending || establishEmbassyMutation.isPending || foreignPolicyMutation.isPending;

  return {
    isFollowing: followStatus?.isFollowing === true,
    isFollowPending,
    isEmbassyPending: establishEmbassyMutation.isPending,
    isPending,
    toggleFollow,
    establishEmbassy,
    proposeForeignPolicy,
  };
}
