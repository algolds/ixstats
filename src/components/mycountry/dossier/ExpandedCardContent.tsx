"use client";

import React, { useCallback, useState } from "react";
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
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
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
  ({ country, viewerCountryId, isOwnCountry }) => {
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
        "border-border bg-card text-foreground hover:bg-accent focus-visible:ring-ring flex min-h-10 w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        extra
      );

    return (
      <div className="bg-card text-card-foreground relative min-h-[320px] w-full p-4 sm:p-5">
        <div className="relative z-10 space-y-4">
          {/* Header */}
          <FadeIn direction="up" delay={0.1}>
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>Country Actions</Eyebrow>
              {country.continent && <Badge variant="secondary">{country.continent}</Badge>}
              {country.region && <Badge variant="outline">{country.region}</Badge>}
            </div>
          </FadeIn>

          {/* Own Country Action */}
          {isOwnCountry && (
            <FadeIn direction="up" delay={0.15}>
              <button
                type="button"
                onClick={handleGoToMyCountry}
                data-cuelume-press="tick"
                className={buttonClass(
                  "border-transparent bg-amber-500 text-amber-950 hover:bg-amber-500/90"
                )}
              >
                <Crown className="h-4 w-4" />
                Go to MyCountry Dashboard
              </button>
            </FadeIn>
          )}

          {/* Other Country Actions */}
          {!isOwnCountry && (
            <div className="space-y-4">
              {/* Social */}
              <div className="space-y-1.5">
                <Eyebrow className="block px-1">Social</Eyebrow>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleFollowToggle}
                    disabled={!viewerCountryId || isLoading}
                    data-cuelume-press="tick"
                    className={buttonClass(
                      followStatus?.isFollowing
                        ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                        : ""
                    )}
                  >
                    {followMutation.isPending || unfollowMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : followStatus?.isFollowing ? (
                      <UserMinus className="text-destructive h-3.5 w-3.5" />
                    ) : (
                      <UserPlus className="text-muted-foreground h-3.5 w-3.5" />
                    )}
                    {followStatus?.isFollowing ? "Unfollow" : "Follow"}
                  </button>

                  <button
                    onClick={handleSendMessage}
                    disabled={!viewerCountryId}
                    data-cuelume-press="tick"
                    className={buttonClass()}
                  >
                    <MessageSquare className="text-muted-foreground h-3.5 w-3.5" />
                    Message
                  </button>
                </div>
              </div>

              {/* Diplomacy */}
              <div className="space-y-1.5">
                <Eyebrow className="block px-1">Diplomacy</Eyebrow>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleEstablishEmbassy}
                    disabled={!viewerCountryId || isLoading}
                    data-cuelume-press="tick"
                    className={buttonClass()}
                  >
                    {establishEmbassyMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Building2 className="text-muted-foreground h-3.5 w-3.5" />
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
                    <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                    Request Meeting
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => handleForeignPolicy(e, "free_trade")}
                      disabled={!viewerCountryId || isLoading}
                      data-cuelume-press="tick"
                      className={buttonClass()}
                    >
                      <Handshake className="text-muted-foreground h-3.5 w-3.5" />
                      Free Trade
                    </button>

                    <button
                      onClick={(e) => handleForeignPolicy(e, "military_alliance")}
                      disabled={!viewerCountryId || isLoading}
                      data-cuelume-press="tick"
                      className={buttonClass()}
                    >
                      <Shield className="text-muted-foreground h-3.5 w-3.5" />
                      Alliance
                    </button>
                  </div>
                </div>
              </div>

              {/* Foreign Policy (Sanctions & Embargo) */}
              <div className="space-y-1.5">
                <Eyebrow className="block px-1">Foreign Policy</Eyebrow>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={(e) => handleForeignPolicy(e, "sanction")}
                    disabled={!viewerCountryId || isLoading}
                    data-cuelume-press="tick"
                    className={buttonClass(
                      "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/40"
                    )}
                  >
                    <Scale className="text-muted-foreground h-3.5 w-3.5" />
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
                    <Swords className="text-muted-foreground h-3.5 w-3.5" />
                    Embargo
                  </button>
                </div>
              </div>

              {/* Quick Links */}
              <div className="space-y-1.5">
                <Eyebrow className="block px-1">Quick Links</Eyebrow>
                <a
                  href={`/wiki/${encodeURIComponent(country.name.replace(/ /g, "_"))}`}
                  onClick={(e) => e.stopPropagation()}
                  data-cuelume-press="tick"
                  className={buttonClass()}
                >
                  <Globe className="text-muted-foreground h-3.5 w-3.5" />
                  View on IxWiki
                  <ExternalLink className="text-muted-foreground ml-auto h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Login warning */}
          {!viewerCountryId && !isOwnCountry && (
            <div className="border-border/60 mt-3 border-t pt-3">
              <p className="text-muted-foreground text-center text-xs font-medium">
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
