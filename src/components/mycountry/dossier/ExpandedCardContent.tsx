"use client";

import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FadeIn } from "~/components/ui/text-reveal";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useRouter } from "next/navigation";
import { cn, createUrl } from "~/lib/utils";
import {
  UserPlus,
  UserXmark as UserMinus,
  ChatBubble as MessageSquare,
  City as Building2,
  Community as Handshake,
  Shield,
  ScaleFrameEnlarge as Scale,
  Tournament as Swords,
  SystemRestart as Loader2,
  Globe,
  OpenNewWindow as ExternalLink,
  Crown,
  Calendar,
} from "iconoir-react";
import { MeetingScheduler } from "~/components/executive/actions/MeetingScheduler";
import { type CountryCardData } from "./CountryFocusCard";

interface ExpandedCardContentProps {
  country: CountryCardData;
  viewerCountryId?: string;
  isOwnCountry: boolean;
  onCountryClick?: (countryId: string, countryName: string) => void;
}

type ForeignPolicyType = "free_trade" | "military_alliance" | "sanction" | "embargo";

export const ExpandedCardContent = React.memo<ExpandedCardContentProps>(
  // oxlint-disable-next-line eslint/no-unused-vars
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

    const buttonClass = (extra = "") =>
      cn(
        "flex w-full items-center gap-2.5 rounded-xl border border-border/70 bg-muted/40 px-3.5 py-2.5 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md transition-all duration-150 hover:bg-muted/80 hover:border-border active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        extra
      );

    return (
      <div className="relative min-h-[320px] w-full bg-card/95 p-4 text-card-foreground backdrop-blur-2xl dark:bg-slate-950/95 sm:p-5">
        <div className="relative z-10 space-y-4">
          {/* Header */}
          <FadeIn direction="up" delay={0.1}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Country Actions
              </span>
              {country.continent && (
                <span className="rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold text-foreground">
                  {country.continent}
                </span>
              )}
              {country.region && (
                <span className="rounded-full border border-border/80 bg-muted/30 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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
                data-cuelume-press="tick"
                className={buttonClass(
                  "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                )}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <Crown className="h-4 w-4" />
                Go to MyCountry Dashboard
              </motion.button>
            </FadeIn>
          )}

          {/* Other Country Actions */}
          {!isOwnCountry && (
            <div className="space-y-4">
              {/* Social */}
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Social
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleFollowToggle}
                    disabled={!viewerCountryId || isLoading}
                    data-cuelume-press="tick"
                    className={buttonClass(
                      followStatus?.isFollowing
                        ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20"
                    )}
                  >
                    {followMutation.isPending || unfollowMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : followStatus?.isFollowing ? (
                      <UserMinus className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                    )}
                    {followStatus?.isFollowing ? "Unfollow" : "Follow"}
                  </button>

                  <button
                    onClick={handleSendMessage}
                    disabled={!viewerCountryId}
                    data-cuelume-press="tick"
                    className={buttonClass()}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Message
                  </button>
                </div>
              </div>

              {/* Diplomacy */}
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Diplomacy
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleEstablishEmbassy}
                    disabled={!viewerCountryId || isLoading}
                    data-cuelume-press="tick"
                    className={buttonClass()}
                  >
                    {establishEmbassyMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
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
                    data-cuelume-press="tick"
                    className={buttonClass()}
                  >
                    <Calendar className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Request Meeting
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => handleForeignPolicy(e, "free_trade")}
                      disabled={!viewerCountryId || isLoading}
                      data-cuelume-press="tick"
                      className={buttonClass()}
                    >
                      <Handshake className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Free Trade
                    </button>

                    <button
                      onClick={(e) => handleForeignPolicy(e, "military_alliance")}
                      disabled={!viewerCountryId || isLoading}
                      data-cuelume-press="tick"
                      className={buttonClass()}
                    >
                      <Shield className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                      Alliance
                    </button>
                  </div>
                </div>
              </div>

              {/* Foreign Policy (Sanctions & Embargo) */}
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Foreign Policy
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={(e) => handleForeignPolicy(e, "sanction")}
                    disabled={!viewerCountryId || isLoading}
                    data-cuelume-press="tick"
                    className={buttonClass(
                      "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/40"
                    )}
                  >
                    <Scale className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    Sanctions
                  </button>

                  <button
                    onClick={(e) => handleForeignPolicy(e, "embargo")}
                    disabled={!viewerCountryId || isLoading}
                    data-cuelume-press="tick"
                    className={buttonClass(
                      "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/40"
                    )}
                  >
                    <Swords className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    Embargo
                  </button>
                </div>
              </div>

              {/* Quick Links */}
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Quick Links
                </p>
                <a
                  href={`/wiki/${encodeURIComponent(country.name.replace(/ /g, "_"))}`}
                  onClick={(e) => e.stopPropagation()}
                  data-cuelume-press="tick"
                  className={buttonClass()}
                >
                  <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  View on IxWiki
                  <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                </a>
              </div>
            </div>
          )}

          {/* Login warning */}
          {!viewerCountryId && !isOwnCountry && (
            <div className="mt-3 border-t border-border/60 pt-3">
              <p className="text-center text-xs font-medium text-muted-foreground">
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
