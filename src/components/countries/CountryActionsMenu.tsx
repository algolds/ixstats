"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UserPlus,
  UserMinus,
  MessageSquare,
  Building2,
  Heart,
  X,
  Loader2,
  Sparkles,
  Handshake,
  Shield,
  Scale,
  BarChart3,
  Globe,
  ExternalLink,
  Share2,
  Copy,
  Check,
  ScrollText,
  Swords,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wikios/url-compat";
import { createUrl } from "~/lib/url-utils";
import { WikiLinkPreview } from "~/components/wiki/WikiLinkPreview";

interface CountryActionsMenuProps {
  targetCountryId: string;
  targetCountryName: string;
  viewerCountryId?: string;
  isOpen: boolean;
  onClose: () => void;
  isOwnCountry?: boolean;
}

type ForeignPolicyType = "free_trade" | "military_alliance" | "sanction" | "embargo";

export function CountryActionsMenu({
  targetCountryId,
  targetCountryName,
  viewerCountryId,
  isOpen,
  onClose,
  isOwnCountry = false,
}: CountryActionsMenuProps) {
  const notify = useNotify();
  const router = useRouter();
  const [selectedAchievement, setSelectedAchievement] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: followStatus, refetch: refetchFollowStatus } =
    api.diplomaticCore.getFollowStatus.useQuery(
      { viewerCountryId: viewerCountryId || "", targetCountryId },
      { enabled: !!viewerCountryId }
    );

  const { data: recentAchievements } = api.achievements.getRecentByCountry.useQuery(
    { countryId: targetCountryId, limit: 5 },
    { enabled: isOpen }
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
      notify.success(`Embassy construction initiated with ${targetCountryName}`);
      onClose();
    },
    onError: (error) => notify.error(`Failed to establish embassy: ${error.message}`),
  });

  const foreignPolicyMutation = api.diplomaticPolicies.proposeForeignPolicyAction.useMutation({
    onSuccess: (_, variables) => {
      const labels: Record<string, string> = {
        free_trade: "Free trade agreement",
        military_alliance: "Military alliance",
        sanction: "Sanctions",
        embargo: "Trade embargo",
      };
      notify.success(
        `${labels[variables.actionType] ?? "Action"} proposed to ${targetCountryName}`
      );
      onClose();
    },
    onError: (error) => notify.error(`Failed: ${error.message}`),
  });

  const congratulateMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success(`Congratulations sent to ${targetCountryName}!`);
      setSelectedAchievement("");
      onClose();
    },
    onError: (error) => notify.error(`Failed to send congratulations: ${error.message}`),
  });

  const handleFollowToggle = useCallback(() => {
    if (!viewerCountryId) {
      notify.error("You must be logged in to follow countries");
      return;
    }
    if (followStatus?.isFollowing) {
      unfollowMutation.mutate({
        followerCountryId: viewerCountryId,
        followedCountryId: targetCountryId,
      });
    } else {
      followMutation.mutate({
        followerCountryId: viewerCountryId,
        followedCountryId: targetCountryId,
      });
    }
  }, [viewerCountryId, followStatus, targetCountryId, followMutation, unfollowMutation, notify]);

  const handleDiplomaticMessage = useCallback(() => {
    router.push(createUrl(`/messages?country=${targetCountryId}`));
    onClose();
  }, [router, targetCountryId, onClose]);

  const handleEstablishEmbassy = useCallback(() => {
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

  const handleForeignPolicy = useCallback(
    (actionType: ForeignPolicyType) => {
      if (!viewerCountryId) {
        notify.error("You must be logged in to propose foreign policy");
        return;
      }
      foreignPolicyMutation.mutate({ targetId: targetCountryId, actionType, severity: "moderate" });
    },
    [viewerCountryId, targetCountryId, foreignPolicyMutation, notify]
  );

  const handleCongratulate = useCallback(() => {
    if (!viewerCountryId) {
      notify.error("You need to sign in to send congratulations");
      return;
    }
    if (!selectedAchievement) {
      notify.error("Please select an achievement to congratulate");
      return;
    }
    const achievement = recentAchievements?.find(
      (a: { id: string }) => a.id === selectedAchievement
    );
    if (!achievement) return;

    congratulateMutation.mutate({
      accountId: viewerCountryId,
      content: `🎉 Congratulations to ${targetCountryName} on achieving: ${achievement.title}! ${achievement.description || "A remarkable accomplishment!"}`,
      visibility: "public" as const,
      hashtags: ["achievement", targetCountryName.replace(/\s/g, "")],
    });
  }, [
    viewerCountryId,
    targetCountryName,
    selectedAchievement,
    recentAchievements,
    congratulateMutation,
    notify,
  ]);

  const handleCopyLink = useCallback(() => {
    const slug = targetCountryName.replace(/\s/g, "_");
    const url = `${window.location.origin}${createUrl(`/countries/${slug}`)}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      notify.success("Link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }, [targetCountryName, notify]);

  const isLoading =
    followMutation.isPending ||
    unfollowMutation.isPending ||
    establishEmbassyMutation.isPending ||
    congratulateMutation.isPending ||
    foreignPolicyMutation.isPending;

  const actionButtonClass = (colors: string) =>
    `flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium backdrop-blur-sm transition-all duration-200 disabled:opacity-50 ${colors}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100010] bg-black/60 backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 z-[100011] mx-4 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative max-h-[85vh] overflow-y-auto rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-2xl backdrop-blur-2xl dark:from-black/40 dark:via-black/20 dark:to-transparent">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 dark:to-transparent" />

              <div className="relative z-10">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-bold text-white">
                      <Sparkles className="h-5 w-5 text-blue-400" />
                      {isOwnCountry ? "Country Management" : "Country Actions"}
                    </h3>
                    <p className="mt-1 text-sm text-white/60">{targetCountryName}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="group rounded-xl p-2 transition-all duration-200 hover:bg-white/10"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5 text-white/60 transition-colors group-hover:text-white" />
                  </button>
                </div>

                {/* Own Country Actions */}
                {isOwnCountry && (
                  <div className="space-y-2.5">
                    <p className="px-1 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                      Management
                    </p>

                    <button
                      onClick={() => {
                        router.push(createUrl("/mycountry"));
                        onClose();
                      }}
                      className={actionButtonClass(
                        "border-amber-500/20 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30"
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                      MyCountry Dashboard
                    </button>

                    <button
                      onClick={() => {
                        router.push(createUrl("/mycountry/executive"));
                        onClose();
                      }}
                      className={actionButtonClass(
                        "border-indigo-500/20 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-300 hover:from-indigo-500/30 hover:to-violet-500/30"
                      )}
                    >
                      <ScrollText className="h-4 w-4" />
                      Executive Actions
                    </button>

                    <button
                      onClick={() => {
                        router.push(createUrl("/mycountry/diplomacy"));
                        onClose();
                      }}
                      className={actionButtonClass(
                        "border-purple-500/20 bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 text-purple-300 hover:from-purple-500/30 hover:to-fuchsia-500/30"
                      )}
                    >
                      <Handshake className="h-4 w-4" />
                      Manage Diplomacy
                    </button>

                    <button
                      onClick={() => {
                        router.push(createUrl("/mycountry/intelligence"));
                        onClose();
                      }}
                      className={actionButtonClass(
                        "border-cyan-500/20 bg-gradient-to-r from-cyan-500/20 to-sky-500/20 text-cyan-300 hover:from-cyan-500/30 hover:to-sky-500/30"
                      )}
                    >
                      <BarChart3 className="h-4 w-4" />
                      Intelligence Center
                    </button>

                    <button
                      onClick={() => {
                        router.push(createUrl("/mycountry/defense"));
                        onClose();
                      }}
                      className={actionButtonClass(
                        "border-red-500/20 bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-300 hover:from-red-500/30 hover:to-rose-500/30"
                      )}
                    >
                      <Shield className="h-4 w-4" />
                      Defense Operations
                    </button>

                    <button
                      onClick={() => {
                        router.push(createUrl("/mycountry/politics"));
                        onClose();
                      }}
                      className={actionButtonClass(
                        "border-teal-500/20 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 text-teal-300 hover:from-teal-500/30 hover:to-emerald-500/30"
                      )}
                    >
                      <Scale className="h-4 w-4" />
                      Politics & Elections
                    </button>
                  </div>
                )}

                {/* Other Country: Social Actions */}
                {!isOwnCountry && (
                  <>
                    <div className="space-y-2.5">
                      <p className="px-1 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                        Social
                      </p>

                      <button
                        onClick={handleFollowToggle}
                        disabled={!viewerCountryId || isLoading}
                        className={cn(
                          actionButtonClass(""),
                          followStatus?.isFollowing
                            ? "border-red-500/20 bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 hover:from-red-500/30 hover:to-pink-500/30"
                            : "border-blue-500/20 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 hover:from-blue-500/30 hover:to-cyan-500/30"
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

                      <button
                        onClick={handleDiplomaticMessage}
                        disabled={!viewerCountryId}
                        className={actionButtonClass(
                          "border-purple-500/20 bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 text-purple-300 hover:from-purple-500/30 hover:to-fuchsia-500/30"
                        )}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Secure Message
                      </button>

                      {recentAchievements && recentAchievements.length > 0 && (
                        <div className="group relative">
                          <button
                            onClick={handleCongratulate}
                            disabled={!viewerCountryId || isLoading || !selectedAchievement}
                            className={actionButtonClass(
                              "border-green-500/20 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 hover:from-green-500/30 hover:to-emerald-500/30"
                            )}
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
                              className="min-w-[140px] cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20 focus:ring-2 focus:ring-green-500/50 focus:outline-none"
                            >
                              <option value="" className="bg-gray-800 text-white">
                                Select achievement...
                              </option>
                              {recentAchievements.map(
                                (achievement: {
                                  id: string;
                                  icon?: string | null;
                                  title: string;
                                }) => (
                                  <option
                                    key={achievement.id}
                                    value={achievement.id}
                                    className="bg-gray-800 text-white"
                                  >
                                    {achievement.icon} {achievement.title}
                                  </option>
                                )
                              )}
                            </select>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Diplomatic Actions */}
                    <div className="mt-4 space-y-2.5">
                      <p className="px-1 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                        Diplomacy
                      </p>

                      <button
                        onClick={handleEstablishEmbassy}
                        disabled={!viewerCountryId || isLoading}
                        className={actionButtonClass(
                          "border-amber-500/20 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 hover:from-amber-500/30 hover:to-yellow-500/30"
                        )}
                      >
                        {establishEmbassyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Building2 className="h-4 w-4" />
                        )}
                        Construct Embassy
                      </button>

                      <button
                        onClick={() => handleForeignPolicy("free_trade")}
                        disabled={!viewerCountryId || isLoading}
                        className={actionButtonClass(
                          "border-emerald-500/20 bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 hover:from-emerald-500/30 hover:to-green-500/30"
                        )}
                      >
                        {foreignPolicyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Handshake className="h-4 w-4" />
                        )}
                        Propose Free Trade
                      </button>

                      <button
                        onClick={() => handleForeignPolicy("military_alliance")}
                        disabled={!viewerCountryId || isLoading}
                        className={actionButtonClass(
                          "border-sky-500/20 bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-300 hover:from-sky-500/30 hover:to-blue-500/30"
                        )}
                      >
                        <Shield className="h-4 w-4" />
                        Propose Military Alliance
                      </button>
                    </div>

                    {/* Foreign Policy (Adversarial) */}
                    <div className="mt-4 space-y-2.5">
                      <p className="px-1 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                        Foreign Policy
                      </p>

                      <button
                        onClick={() => handleForeignPolicy("sanction")}
                        disabled={!viewerCountryId || isLoading}
                        className={actionButtonClass(
                          "border-orange-500/20 bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-300 hover:from-orange-500/30 hover:to-amber-500/30"
                        )}
                      >
                        <Scale className="h-4 w-4" />
                        Impose Sanctions
                      </button>

                      <button
                        onClick={() => handleForeignPolicy("embargo")}
                        disabled={!viewerCountryId || isLoading}
                        className={actionButtonClass(
                          "border-red-500/20 bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-300 hover:from-red-500/30 hover:to-rose-500/30"
                        )}
                      >
                        <Swords className="h-4 w-4" />
                        Declare Embargo
                      </button>
                    </div>
                  </>
                )}

                {/* Quick Links (always shown) */}
                <div className="mt-4 space-y-2.5">
                  <p className="px-1 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                    Quick Links
                  </p>

                  <button
                    onClick={() => {
                      router.push(createUrl(`/countries?compare=${targetCountryId}`));
                      onClose();
                    }}
                    className={actionButtonClass(
                      "border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-300 hover:from-indigo-500/20 hover:to-violet-500/20"
                    )}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Compare Countries
                  </button>

                   <WikiLinkPreview title={targetCountryName}>
                    <Link
                      href={titleToWikiOSPath(targetCountryName)}
                      className={actionButtonClass(
                        "border-white/10 bg-gradient-to-r from-white/5 to-white/5 text-white/70 hover:from-white/10 hover:to-white/10"
                      )}
                      onClick={onClose}
                    >
                      <Globe className="h-4 w-4" />
                      View on IxWiki
                      <ExternalLink className="ml-auto h-3.5 w-3.5 text-white/40" />
                    </Link>
                  </WikiLinkPreview>

                  <button
                    onClick={handleCopyLink}
                    className={actionButtonClass(
                      "border-white/10 bg-gradient-to-r from-white/5 to-white/5 text-white/70 hover:from-white/10 hover:to-white/10"
                    )}
                  >
                    {copiedLink ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedLink ? "Link Copied!" : "Copy Profile Link"}
                  </button>

                  <button
                    onClick={() => {
                      const slug = targetCountryName.replace(/\s/g, "_");
                      const url = `${window.location.origin}${createUrl(`/countries/${slug}`)}`;
                      if (navigator.share) {
                        void navigator.share({ title: targetCountryName, url });
                      } else {
                        void navigator.clipboard.writeText(url);
                        notify.success("Link copied");
                      }
                      onClose();
                    }}
                    className={actionButtonClass(
                      "border-white/10 bg-gradient-to-r from-white/5 to-white/5 text-white/70 hover:from-white/10 hover:to-white/10"
                    )}
                  >
                    <Share2 className="h-4 w-4" />
                    Share Profile
                  </button>
                </div>

                {/* Footer */}
                {!viewerCountryId && !isOwnCountry && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-center text-xs text-white/50">
                      Login required to perform diplomatic actions
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
