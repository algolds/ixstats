"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useRouter } from "next/navigation";
import { createUrl, createAbsoluteUrl } from "~/lib/url-utils";
import {
  RiEyeLine,
  RiArrowRightLine,
  RiStarLine,
  RiStarFill,
  RiChat1Line,
  RiShieldLine,
  RiHome4Line,
} from "react-icons/ri";
import { Loader2 } from "lucide-react";

interface ExpandedCardActionsProps {
  countryId: string;
  countryName: string;
  countrySlug: string;
  viewerCountryId?: string;
  isOwnCountry: boolean;
  onCountryClick?: (countryId: string, countryName: string) => void;
}

export const ExpandedCardActions = React.memo<ExpandedCardActionsProps>(
  ({ countryId, countryName, countrySlug, viewerCountryId, isOwnCountry, onCountryClick }) => {
    const notify = useNotify();
    const router = useRouter();

    // Follow status query - only when viewer has a country and it's not their own
    const { data: followStatus, refetch: refetchFollowStatus } =
      api.diplomaticCore.getFollowStatus.useQuery(
        {
          viewerCountryId: viewerCountryId || "",
          targetCountryId: countryId,
        },
        {
          enabled: !!viewerCountryId && !isOwnCountry,
        }
      );

    const followMutation = api.diplomaticCore.followCountry.useMutation({
      onSuccess: () => {
        notify.success(`Now following ${countryName}`);
        void refetchFollowStatus();
      },
      onError: (error) => {
        notify.error(`Failed to follow: ${error.message}`);
      },
    });

    const unfollowMutation = api.diplomaticCore.unfollowCountry.useMutation({
      onSuccess: () => {
        notify.success(`Unfollowed ${countryName}`);
        void refetchFollowStatus();
      },
      onError: (error) => {
        notify.error(`Failed to unfollow: ${error.message}`);
      },
    });

    const handleCountryVisit = (e: React.MouseEvent) => {
      e.stopPropagation();
      onCountryClick?.(countryId, countryName);
    };

    const handleFollowToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!viewerCountryId) {
        notify.error("Login required to follow countries");
        return;
      }
      if (followStatus?.isFollowing) {
        unfollowMutation.mutate({
          followerCountryId: viewerCountryId,
          followedCountryId: countryId,
        });
      } else {
        followMutation.mutate({
          followerCountryId: viewerCountryId,
          followedCountryId: countryId,
        });
      }
    };

    const handleSendMessage = (e: React.MouseEvent) => {
      e.stopPropagation();
      router.push(createUrl(`/messages?country=${countryId}`));
    };

    const handleDiplomacy = (e: React.MouseEvent) => {
      e.stopPropagation();
      window.location.href = createAbsoluteUrl(`/countries/${countrySlug}`);
    };

    const handleGoToMyCountry = (e: React.MouseEvent) => {
      e.stopPropagation();
      router.push(createUrl("/mycountry"));
    };

    const isFollowLoading = followMutation.isPending || unfollowMutation.isPending;

    if (isOwnCountry) {
      return (
        <div className="flex gap-3">
          <motion.button
            onClick={handleGoToMyCountry}
            className="glass-floating glass-interactive flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500/20 px-4 py-3 font-medium text-amber-300 antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)] hover:bg-amber-500/30"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RiHome4Line className="h-4 w-4" />
            Go to MyCountry
            <RiArrowRightLine className="h-4 w-4" />
          </motion.button>
        </div>
      );
    }

    return (
      <div className="flex gap-3">
        {/* View Details */}
        <motion.button
          onClick={handleCountryVisit}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-400/20 bg-blue-500/20 px-4 py-3 font-medium text-white antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)] hover:bg-blue-500/30"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RiEyeLine className="h-4 w-4" />
          View Details
          <RiArrowRightLine className="h-4 w-4" />
        </motion.button>

        {/* Follow/Unfollow */}
        <motion.button
          onClick={handleFollowToggle}
          className={cn(
            "flex items-center justify-center rounded-lg border px-4 py-3 transition-colors",
            followStatus?.isFollowing
              ? "border-amber-400/30 bg-amber-500/25 text-amber-300 hover:bg-amber-500/35"
              : "border-white/15 bg-white/10 text-white/90 hover:bg-white/20"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={followStatus?.isFollowing ? "Unfollow" : "Follow"}
        >
          {isFollowLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : followStatus?.isFollowing ? (
            <RiStarFill className="h-4 w-4" />
          ) : (
            <RiStarLine className="h-4 w-4" />
          )}
        </motion.button>

        {/* Send Message */}
        <motion.button
          onClick={handleSendMessage}
          className="flex items-center justify-center rounded-lg border border-purple-400/20 bg-purple-500/20 px-4 py-3 text-purple-300 transition-colors hover:bg-purple-500/30"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Send Message"
        >
          <RiChat1Line className="h-4 w-4" />
        </motion.button>

        {/* Diplomacy */}
        <motion.button
          onClick={handleDiplomacy}
          className="flex items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-500/20 px-4 py-3 text-cyan-300 transition-colors hover:bg-cyan-500/30"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="View Diplomacy"
        >
          <RiShieldLine className="h-4 w-4" />
        </motion.button>
      </div>
    );
  }
);

ExpandedCardActions.displayName = "ExpandedCardActions";
