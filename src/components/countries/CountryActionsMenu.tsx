"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  UserMinus,
  MessageSquare,
  Building2,
  Heart,
  X,
  Loader2,
  Sparkles
} from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import { createUrl } from "~/lib/url-utils";

interface CountryActionsMenuProps {
  targetCountryId: string;
  targetCountryName: string;
  viewerCountryId?: string;
  isOpen: boolean;
  onClose: () => void;
  isOwnCountry?: boolean;
}

export function CountryActionsMenu({
  targetCountryId,
  targetCountryName,
  viewerCountryId,
  isOpen,
  onClose,
  isOwnCountry = false
}: CountryActionsMenuProps) {
  const router = useRouter();
  const [selectedAchievement, setSelectedAchievement] = useState<string>("");

  // Check if viewer is following target country
  const { data: followStatus, refetch: refetchFollowStatus } = api.diplomatic.getFollowStatus.useQuery(
    {
      viewerCountryId: viewerCountryId || "",
      targetCountryId
    },
    {
      enabled: !!viewerCountryId
    }
  );

  // Get recent achievements for congratulate dropdown
  const { data: recentAchievements } = api.achievements.getRecentByCountry.useQuery(
    { countryId: targetCountryId, limit: 5 },
    { enabled: isOpen }
  );

  // Get viewer's ThinkPages account for congratulations
  const { data: viewerAccounts } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: viewerCountryId || "" },
    { enabled: !!viewerCountryId && isOpen }
  );

  // Follow/Unfollow mutation
  const followMutation = api.diplomatic.followCountry.useMutation({
    onSuccess: () => {
      toast.success(`Now following ${targetCountryName}`);
      void refetchFollowStatus();
    },
    onError: (error) => {
      toast.error(`Failed to follow: ${error.message}`);
    }
  });

  const unfollowMutation = api.diplomatic.unfollowCountry.useMutation({
    onSuccess: () => {
      toast.success(`Unfollowed ${targetCountryName}`);
      void refetchFollowStatus();
    },
    onError: (error) => {
      toast.error(`Failed to unfollow: ${error.message}`);
    }
  });



  // Embassy establishment mutation
  const establishEmbassyMutation = api.diplomatic.establishEmbassy.useMutation({
    onSuccess: () => {
      toast.success(`Embassy construction initiated with ${targetCountryName}`);
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to establish embassy: ${error.message}`);
    }
  });

  // Congratulate via ThinkShare mutation
  const congratulateMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      toast.success(`Congratulations sent to ${targetCountryName}!`);
      setSelectedAchievement("");
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to send congratulations: ${error.message}`);
    }
  });

  // Handle follow/unfollow toggle
  const handleFollowToggle = useCallback(() => {
    if (!viewerCountryId) {
      toast.error("You must be logged in to follow countries");
      return;
    }

    if (followStatus?.isFollowing) {
      unfollowMutation.mutate({
        followerCountryId: viewerCountryId,
        followedCountryId: targetCountryId
      });
    } else {
      followMutation.mutate({
        followerCountryId: viewerCountryId,
        followedCountryId: targetCountryId
      });
    }
  }, [viewerCountryId, followStatus, targetCountryId, followMutation, unfollowMutation]);

  // Handle diplomatic message - redirect to ThinkShare
  const handleDiplomaticMessage = useCallback(() => {
    // Simply redirect to ThinkPages messaging with country context
    router.push(createUrl(`/thinkpages?view=messages&country=${targetCountryId}`));
    onClose();
  }, [router, targetCountryId, onClose]);

  // Handle embassy establishment
  const handleEstablishEmbassy = useCallback(() => {
    if (!viewerCountryId) {
      toast.error("You must be logged in to establish embassies");
      return;
    }

    establishEmbassyMutation.mutate({
      hostCountryId: viewerCountryId,
      guestCountryId: targetCountryId,
      name: `Embassy of ${targetCountryName}`,
      location: "Capital District"
    });
  }, [viewerCountryId, targetCountryId, targetCountryName, establishEmbassyMutation]);

  // Handle congratulate
  const handleCongratulate = useCallback(() => {
    if (!viewerCountryId || !viewerAccounts || viewerAccounts.length === 0) {
      toast.error("You need a ThinkPages account to send congratulations");
      return;
    }

    if (!selectedAchievement) {
      toast.error("Please select an achievement to congratulate");
      return;
    }

    const achievement = recentAchievements?.find((a: { id: string }) => a.id === selectedAchievement);
    if (!achievement) return;

    const viewerAccount = viewerAccounts[0];

    congratulateMutation.mutate({
      userId: viewerAccount.clerkUserId,
      content: `🎉 Congratulations to ${targetCountryName} on achieving: ${achievement.title}! ${achievement.description || "A remarkable accomplishment!"}`,
      visibility: "public" as const,
      hashtags: ["achievement", targetCountryName.replace(/\s/g, "")]
    });
  }, [viewerCountryId, viewerAccounts, targetCountryId, targetCountryName, selectedAchievement, recentAchievements, congratulateMutation]);

  const isLoading = followMutation.isPending ||
                    unfollowMutation.isPending ||
                    establishEmbassyMutation.isPending ||
                    congratulateMutation.isPending;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50"
          />

          {/* Menu Panel - Glassmorphic Design */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm mx-4"
          >
            <div className="relative rounded-2xl p-6 shadow-2xl border border-white/20 backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/40 dark:via-black/20 dark:to-transparent">
              {/* Glass reflection effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

              {/* Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-400" />
                      Country Actions
                    </h3>
                    <p className="text-sm text-white/60 mt-1">
                      {targetCountryName}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all duration-200 group"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5 text-white/60 group-hover:text-white transition-colors" />
                  </button>
                </div>

                {/* Actions */}
                <div className="space-y-2.5">
                  {/* MyCountry Dashboard (Own Country Only) */}
                  {isOwnCountry && (
                    <button
                      onClick={() => {
                        router.push(createUrl("/mycountry"));
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 rounded-xl transition-all duration-200 backdrop-blur-sm border border-amber-500/20"
                    >
                      <Building2 className="h-4 w-4" />
                      MyCountry Dashboard
                    </button>
                  )}

                  {/* Follow/Unfollow */}
                  {!isOwnCountry && (
                    <button
                      onClick={handleFollowToggle}
                      disabled={!viewerCountryId || isLoading}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 backdrop-blur-sm border disabled:opacity-50",
                        followStatus?.isFollowing
                          ? "bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500/30 hover:to-pink-500/30 text-red-300 border-red-500/20"
                          : "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 text-blue-300 border-blue-500/20"
                      )}
                    >
                      {followMutation.isPending || unfollowMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : followStatus?.isFollowing ? (
                        <UserMinus className="h-4 w-4" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      {followStatus?.isFollowing ? "Unfollow Nation" : "Follow Nation"}
                    </button>
                  )}

                  {/* Diplomatic Message */}
                  {!isOwnCountry && (
                    <button
                      onClick={handleDiplomaticMessage}
                      disabled={!viewerCountryId}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 hover:from-purple-500/30 hover:to-fuchsia-500/30 text-purple-300 rounded-xl transition-all duration-200 backdrop-blur-sm border border-purple-500/20 disabled:opacity-50"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Secure Message
                    </button>
                  )}

                  {/* Construct Embassy */}
                  {!isOwnCountry && (
                    <button
                      onClick={handleEstablishEmbassy}
                      disabled={!viewerCountryId || isLoading}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-300 rounded-xl transition-all duration-200 backdrop-blur-sm border border-amber-500/20 disabled:opacity-50"
                    >
                      {establishEmbassyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      Construct Embassy
                    </button>
                  )}

                  {/* Congratulate */}
                  {!isOwnCountry && recentAchievements && recentAchievements.length > 0 && (
                    <div className="relative group">
                      <button
                        onClick={handleCongratulate}
                        disabled={!viewerCountryId || isLoading || !selectedAchievement}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 text-green-300 rounded-xl transition-all duration-200 backdrop-blur-sm border border-green-500/20 disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          {congratulateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Heart className="h-4 w-4" />
                          )}
                          <span>Congratulate</span>
                        </div>
                        <select
                          value={selectedAchievement}
                          onChange={(e) => setSelectedAchievement(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white/90 focus:outline-none focus:ring-2 focus:ring-green-500/50 backdrop-blur-sm hover:bg-white/20 transition-colors cursor-pointer min-w-[140px]"
                        >
                          <option value="" className="bg-gray-800 text-white">Select achievement...</option>
                          {recentAchievements.map((achievement: { id: string; icon?: string | null; title: string }) => (
                            <option key={achievement.id} value={achievement.id} className="bg-gray-800 text-white">
                              {achievement.icon} {achievement.title}
                            </option>
                          ))}
                        </select>
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {!viewerCountryId && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-white/50 text-center">
                      Login required to perform actions
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
