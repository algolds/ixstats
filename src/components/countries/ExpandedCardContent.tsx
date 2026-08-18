"use client";

import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Spotlight } from "~/components/ui/spotlight-new";
import { FadeIn } from "~/components/ui/text-reveal";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useRouter } from "next/navigation";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/utils";
import {
  UserPlus,
  UserMinus,
  MessageSquare,
  Building2,
  Handshake,
  Shield,
  Scale,
  Swords,
  Loader2,
  Globe,
  ExternalLink,
  Crown,
  Calendar,
} from "lucide-react";
import { MeetingScheduler } from "~/components/quickactions/MeetingScheduler";
import { type CountryCardData } from "./CountryFocusCard";

interface ExpandedCardContentProps {
  country: CountryCardData;
  viewerCountryId?: string;
  isOwnCountry: boolean;
  onCountryClick?: (countryId: string, countryName: string) => void;
}

type ForeignPolicyType = "free_trade" | "military_alliance" | "sanction" | "embargo";

export const ExpandedCardContent = React.memo<ExpandedCardContentProps>(
  ({ country, viewerCountryId, isOwnCountry, onCountryClick }) => {
    const notify = useNotify();
    const router = useRouter();
    const targetCountryId = country.id;
    const targetCountryName = country.name;
    const [schedulerOpen, setSchedulerOpen] = useState(false);

    // Follow status query - only when viewer has a country and it's not their own
    const { data: followStatus, refetch: refetchFollowStatus } =
      api.diplomaticCore.getFollowStatus.useQuery(
        {
          viewerCountryId: viewerCountryId || "",
          targetCountryId,
        },
        {
          enabled: !!viewerCountryId && !isOwnCountry,
        }
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
      },
      onError: (error) => notify.error(`Failed: ${error.message}`),
    });

    const handleFollowToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
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
      },
      [viewerCountryId, followStatus, targetCountryId, followMutation, unfollowMutation, notify]
    );

    const handleSendMessage = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(createUrl(`/messages?country=${targetCountryId}`));
      },
      [router, targetCountryId]
    );

    const handleEstablishEmbassy = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
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
      },
      [viewerCountryId, targetCountryId, targetCountryName, establishEmbassyMutation, notify]
    );

    const handleForeignPolicy = useCallback(
      (e: React.MouseEvent, actionType: ForeignPolicyType) => {
        e.stopPropagation();
        if (!viewerCountryId) {
          notify.error("You must be logged in to propose foreign policy");
          return;
        }
        foreignPolicyMutation.mutate({
          targetId: targetCountryId,
          actionType,
          severity: "moderate",
        });
      },
      [viewerCountryId, targetCountryId, foreignPolicyMutation, notify]
    );

    const handleGoToMyCountry = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(createUrl("/mycountry"));
      },
      [router]
    );

    const isLoading =
      followMutation.isPending ||
      unfollowMutation.isPending ||
      establishEmbassyMutation.isPending ||
      foreignPolicyMutation.isPending;

    const buttonClass = (colors: string) =>
      `flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium backdrop-blur-sm transition-all duration-200 disabled:opacity-50 ${colors}`;

    return (
      <div className="relative overflow-hidden border-t border-white/20 bg-black/75 backdrop-blur-xl">
        <AnimatePresence>
          <Spotlight
            gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(220, 100%, 85%, .12) 0, hsla(220, 100%, 65%, .04) 50%, hsla(220, 100%, 55%, 0) 80%)"
            gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(200, 100%, 85%, .08) 0, hsla(200, 100%, 65%, .03) 80%, transparent 100%)"
            gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(240, 100%, 85%, .06) 0, hsla(240, 100%, 55%, .02) 80%, transparent 100%)"
            translateY={-200}
            width={300}
            height={600}
            smallWidth={120}
            duration={12}
            xOffset={50}
          />
        </AnimatePresence>

        <div className="relative z-10 space-y-4 px-4 py-4">
          {/* Header */}
          <FadeIn direction="up" delay={0.1}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wide text-white/50 uppercase">
                Country Actions
              </span>
              {country.continent && (
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-px text-[9px] font-medium text-white/75">
                  {country.continent}
                </span>
              )}
              {country.region && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-px text-[9px] text-white/55">
                  {country.region}
                </span>
              )}
            </div>
          </FadeIn>

          {/* Own Country Action */}
          {isOwnCountry && (
            <FadeIn direction="up" delay={0.15}>
              <motion.button
                onClick={handleGoToMyCountry}
                className={buttonClass(
                  "border-amber-500/20 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Crown className="h-4 w-4" />
                Go to MyCountry Dashboard
              </motion.button>
            </FadeIn>
          )}

          {/* Other Country Actions */}
          {!isOwnCountry && (
            <div className="space-y-3.5">
              {/* Social */}
              <div className="space-y-1.5">
                <p className="px-1 text-[9px] font-semibold tracking-widest text-white/30 uppercase">
                  Social
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleFollowToggle}
                    disabled={!viewerCountryId || isLoading}
                    className={buttonClass(
                      followStatus?.isFollowing
                        ? "border-red-500/20 bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 hover:from-red-500/30 hover:to-pink-500/30"
                        : "border-blue-500/20 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 hover:from-blue-500/30 hover:to-cyan-500/30"
                    )}
                  >
                    {followMutation.isPending || unfollowMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : followStatus?.isFollowing ? (
                      <UserMinus className="h-3.5 w-3.5" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    {followStatus?.isFollowing ? "Unfollow" : "Follow"}
                  </button>

                  <button
                    onClick={handleSendMessage}
                    disabled={!viewerCountryId}
                    className={buttonClass(
                      "border-purple-500/20 bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 text-purple-300 hover:from-purple-500/30 hover:to-fuchsia-500/30"
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Message
                  </button>
                </div>
              </div>

              {/* Diplomacy */}
              <div className="space-y-1.5">
                <p className="px-1 text-[9px] font-semibold tracking-widest text-white/30 uppercase">
                  Diplomacy
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleEstablishEmbassy}
                    disabled={!viewerCountryId || isLoading}
                    className={buttonClass(
                      "border-amber-500/20 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 hover:from-amber-500/30 hover:to-yellow-500/30"
                    )}
                  >
                    {establishEmbassyMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5" />
                    )}
                    Construct Embassy
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!viewerCountryId) {
                        notify.error("You must be logged in to request a meeting");
                        return;
                      }
                      setSchedulerOpen(true);
                    }}
                    disabled={!viewerCountryId || isLoading}
                    className={buttonClass(
                      "border-indigo-500/20 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-300 hover:from-indigo-500/30 hover:to-violet-500/30"
                    )}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Request Meeting
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => handleForeignPolicy(e, "free_trade")}
                      disabled={!viewerCountryId || isLoading}
                      className={buttonClass(
                        "border-emerald-500/20 bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 hover:from-emerald-500/30 hover:to-green-500/30"
                      )}
                    >
                      <Handshake className="h-3.5 w-3.5" />
                      Free Trade
                    </button>

                    <button
                      onClick={(e) => handleForeignPolicy(e, "military_alliance")}
                      disabled={!viewerCountryId || isLoading}
                      className={buttonClass(
                        "border-sky-500/20 bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-300 hover:from-sky-500/30 hover:to-blue-500/30"
                      )}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Alliance
                    </button>
                  </div>
                </div>
              </div>

              {/* Foreign Policy */}
              <div className="space-y-1.5">
                <p className="px-1 text-[9px] font-semibold tracking-widest text-white/30 uppercase">
                  Foreign Policy
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={(e) => handleForeignPolicy(e, "sanction")}
                    disabled={!viewerCountryId || isLoading}
                    className={buttonClass(
                      "border-orange-500/20 bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-300 hover:from-orange-500/30 hover:to-amber-500/30"
                    )}
                  >
                    <Scale className="h-3.5 w-3.5" />
                    Sanctions
                  </button>

                  <button
                    onClick={(e) => handleForeignPolicy(e, "embargo")}
                    disabled={!viewerCountryId || isLoading}
                    className={buttonClass(
                      "border-red-500/20 bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-300 hover:from-red-500/30 hover:to-rose-500/30"
                    )}
                  >
                    <Swords className="h-3.5 w-3.5" />
                    Embargo
                  </button>
                </div>
              </div>

              {/* Quick Links */}
              <div className="space-y-1.5">
                <p className="px-1 text-[9px] font-semibold tracking-widest text-white/30 uppercase">
                  Quick Links
                </p>
                <a
                  href={`/wiki/${encodeURIComponent(country.name.replace(/ /g, "_"))}`}
                  onClick={(e) => e.stopPropagation()}
                  className={buttonClass(
                    "border-white/10 bg-gradient-to-r from-white/5 to-white/5 text-white/70 hover:from-white/10 hover:to-white/10"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                  View on IxWiki
                  <ExternalLink className="ml-auto h-3 w-3 text-white/40" />
                </a>
              </div>
            </div>
          )}

          {/* Login warning */}
          {!viewerCountryId && !isOwnCountry && (
            <div className="mt-2 border-t border-white/15 pt-3">
              <p className="text-center text-[10px] text-white/40">
                Login required to perform actions
              </p>
            </div>
          )}
          {viewerCountryId && (
            <MeetingScheduler
              countryId={viewerCountryId}
              open={schedulerOpen}
              onOpenChange={setSchedulerOpen}
              defaultTargetCountryId={targetCountryId}
            />
          )}
        </div>
      </div>
    );
  }
);

ExpandedCardContent.displayName = "ExpandedCardContent";
