"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  UserPlus,
  UserXmark as UserMinus,
  ChatBubble as MessageSquare,
  City as Building2,
  Heart,
  Xmark as X,
  SystemRestart as Loader2,
  Sparks as Sparkles,
  Community as Handshake,
  Shield,
  ScaleFrameEnlarge as Scale,
  Globe,
  OpenNewWindow as ExternalLink,
  ShareAndroid as Share2,
  Copy,
  Check,
  Page as ScrollText,
  Tournament as Swords,
  Map,
  Wallet,
  Trophy,
  Calendar,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { MeetingScheduler } from "~/components/executive/actions/MeetingScheduler";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import { createUrl } from "~/lib/utils";
import { WikiLinkPreview } from "~/components/wiki-os/reader/WikiLinkPreview";

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
  const [mounted, setMounted] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  return (
    <>
      {createPortal(
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
                <div className="relative max-h-[85vh] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent] overflow-y-auto rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-2xl backdrop-blur-2xl dark:from-black/40 dark:via-black/20 dark:to-transparent [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-track]:bg-transparent">
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
                            "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
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
                            "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
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
                            "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/20"
                          )}
                        >
                          <Handshake className="h-4 w-4" />
                          Manage Diplomacy
                        </button>

                        <button
                          onClick={() => {
                            router.push(createUrl("/mycountry/editor"));
                            onClose();
                          }}
                          className={actionButtonClass(
                            "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20"
                          )}
                        >
                          <Map className="h-4 w-4" />
                          Map & Territory Editor
                        </button>

                        <button
                          onClick={() => {
                            router.push(createUrl("/vault"));
                            onClose();
                          }}
                          className={actionButtonClass(
                            "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
                          )}
                        >
                          <Wallet className="h-4 w-4" />
                          IxVault Cards & Market
                        </button>

                        <button
                          onClick={() => {
                            router.push(createUrl("/mycountry/politics"));
                            onClose();
                          }}
                          className={actionButtonClass(
                            "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20"
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
                                ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/20"
                                : "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20"
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
                              "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20"
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
                                  "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20"
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
                                  className="border-border/60 bg-card/80 text-foreground hover:bg-card hover:border-border min-w-[140px] cursor-pointer rounded-lg border px-3 py-1.5 text-xs backdrop-blur-md transition-colors focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
                                >
                                  <option value="" className="bg-popover text-popover-foreground">
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
                                        className="bg-popover text-popover-foreground"
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
                              "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
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
                            onClick={() => {
                              if (!viewerCountryId) {
                                notify.error("You must be logged in to request a meeting");
                                return;
                              }
                              setSchedulerOpen(true);
                            }}
                            disabled={!viewerCountryId || isLoading}
                            className={actionButtonClass(
                              "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20"
                            )}
                          >
                            <Calendar className="h-4 w-4" />
                            Request Meeting
                          </button>

                          <button
                            onClick={() => handleForeignPolicy("free_trade")}
                            disabled={!viewerCountryId || isLoading}
                            className={actionButtonClass(
                              "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20"
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
                              "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/20"
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
                              "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
                            )}
                          >
                            <Scale className="h-4 w-4" />
                            Impose Sanctions
                          </button>

                          <button
                            onClick={() => handleForeignPolicy("embargo")}
                            disabled={!viewerCountryId || isLoading}
                            className={actionButtonClass(
                              "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/20"
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
                          router.push(createUrl("/leaderboards"));
                          onClose();
                        }}
                        className={actionButtonClass(
                          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
                        )}
                      >
                        <Trophy className="h-4 w-4" />
                        Global Leaderboard
                      </button>

                      <WikiLinkPreview title={targetCountryName}>
                        <Link
                          href={titleToWikiOSPath(targetCountryName)}
                          className={actionButtonClass(
                            "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
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
                          "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                        )}
                      >
                        {copiedLink ? (
                          <Check className="h-4 w-4 text-emerald-400" />
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
                          "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
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
        </AnimatePresence>,
        document.body
      )}
      {viewerCountryId && (
        <MeetingScheduler
          countryId={viewerCountryId}
          open={schedulerOpen}
          onOpenChange={setSchedulerOpen}
          defaultTargetCountryId={targetCountryId}
        />
      )}
    </>
  );
}
