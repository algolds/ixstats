"use client";

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { SAME_REALM_MESSAGE, sameRealm } from "~/lib/realms/same-realm";
import { pairStanding } from "~/lib/diplomacy/pair-standing";

export type ForeignPolicyType = "free_trade" | "military_alliance" | "sanction" | "embargo";

/** Cooperative actions wait for the other nation's consent; hostile ones take effect at once. */
const isCooperative = (type: ForeignPolicyType) =>
  type === "free_trade" || type === "military_alliance";

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
  /** The target's realm, when known: embassies and proposals need both nations in one realm. */
  targetRealmId?: string | null;
  /** Whether the follow status and the pair's standing are looked up (off for the viewer's own country). */
  followStatusEnabled: boolean;
  /** Called after an embassy or foreign-policy proposal succeeds. */
  onProposed?: () => void;
}

/** Follow / embassy / foreign-policy actions a viewer can take toward another country. */
export function useCountryDiplomacyActions({
  viewerCountryId,
  targetCountryId,
  targetCountryName,
  targetRealmId,
  followStatusEnabled,
  onProposed,
}: Options) {
  const notify = useNotify();
  const viewerRealmId = useViewerRealmId();
  const crossRealm =
    targetRealmId !== undefined &&
    viewerRealmId !== undefined &&
    !sameRealm(viewerRealmId, targetRealmId);

  const { data: followStatus, refetch: refetchFollowStatus } =
    api.diplomaticCore.getFollowStatus.useQuery(
      { viewerCountryId: viewerCountryId || "", targetCountryId },
      { enabled: followStatusEnabled }
    );

  // What already stands between the two nations, so a row shows it rather than offering a duplicate.
  const standingInput = { countryId: viewerCountryId || "" };
  const { data: policies } = api.diplomaticPolicies.getActiveForeignPolicies.useQuery(
    standingInput,
    { enabled: followStatusEnabled }
  );
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(standingInput, {
    enabled: followStatusEnabled,
  });
  const standing = pairStanding(
    viewerCountryId || "",
    targetCountryId,
    policies ?? [],
    embassies ?? []
  );

  // After an act: this menu's rows, MyCountry's diplomacy views and the vitality rings it moves.
  const utils = api.useUtils();
  const refresh = () =>
    Promise.all([
      utils.diplomaticPolicies.invalidate(),
      utils.diplomaticEmbassies.invalidate(),
      utils.countries.getActivityRingsData.invalidate(),
    ]);

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
      void refresh();
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
      void refresh();
      onProposed?.();
    },
    onError: (error) => notify.error(`Failed: ${error.message}`),
  });

  const toggleFollow = () => {
    if (!viewerCountryId) {
      notify.error("You must be logged in to follow countries");
      return;
    }
    const ids = { followerCountryId: viewerCountryId, followedCountryId: targetCountryId };
    if (followStatus?.isFollowing) unfollowMutation.mutate(ids);
    else followMutation.mutate(ids);
  };

  const establishEmbassy = () => {
    if (!viewerCountryId) {
      notify.error("You must be logged in to establish embassies");
      return;
    }
    if (crossRealm) {
      notify.error(SAME_REALM_MESSAGE);
      return;
    }
    establishEmbassyMutation.mutate({
      hostCountryId: targetCountryId,
      guestCountryId: viewerCountryId,
      name: `Embassy in ${targetCountryName}`,
      location: "Capital District",
    });
  };

  const proposeForeignPolicy = (actionType: ForeignPolicyType) => {
    if (!viewerCountryId) {
      notify.error("You must be logged in to propose foreign policy");
      return;
    }
    if (crossRealm) {
      notify.error(SAME_REALM_MESSAGE);
      return;
    }
    foreignPolicyMutation.mutate({ targetId: targetCountryId, actionType, severity: "moderate" });
  };

  const isFollowPending = followMutation.isPending || unfollowMutation.isPending;
  const isPending =
    isFollowPending || establishEmbassyMutation.isPending || foreignPolicyMutation.isPending;

  return {
    isFollowing: followStatus?.isFollowing === true,
    isFollowPending,
    isEmbassyPending: establishEmbassyMutation.isPending,
    isPending,
    /** The target is in another realm: embassies, summits and proposals are not offered. */
    crossRealm,
    /** The viewer's embassy in the target, and each act between them. */
    standing,
    toggleFollow,
    establishEmbassy,
    proposeForeignPolicy,
  };
}
