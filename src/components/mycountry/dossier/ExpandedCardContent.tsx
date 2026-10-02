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
import { Button } from "~/components/ui/button";
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

    // Action rows: Facet `Button`s at the large (44px) size, label-aligned.
    const actionClass = "w-full justify-start";

    return (
      <div className="bg-surface text-label relative min-h-[320px] w-full p-4 sm:p-5">
        <div className="relative z-10 space-y-4">
          {/* Header */}
          <FadeIn direction="up" delay={0.1}>
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>Country Actions</Eyebrow>
              {country.continent && <Badge variant="default">{country.continent}</Badge>}
              {country.region && <Badge variant="outline">{country.region}</Badge>}
            </div>
          </FadeIn>

          {/* Own Country Action */}
          {isOwnCountry && (
            <FadeIn direction="up" delay={0.15}>
              <Button
                type="button"
                onClick={handleGoToMyCountry}
                variant="default"
                size="lg"
                className={actionClass}
              >
                <Crown className="h-4 w-4" />
                Go to MyCountry Dashboard
              </Button>
            </FadeIn>
          )}

          {/* Other Country Actions */}
          {!isOwnCountry && (
            <div className="space-y-4">
              {/* Social */}
              <div className="space-y-2">
                <Eyebrow className="block px-1">Social</Eyebrow>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={!viewerCountryId || isLoading}
                    variant="outline"
                    size="lg"
                    className={cn(actionClass, followStatus?.isFollowing && "text-destructive")}
                  >
                    {followMutation.isPending || unfollowMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : followStatus?.isFollowing ? (
                      <UserMinus className="text-destructive h-3.5 w-3.5" />
                    ) : (
                      <UserPlus className="text-label-secondary h-3.5 w-3.5" />
                    )}
                    {followStatus?.isFollowing ? "Unfollow" : "Follow"}
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!viewerCountryId}
                    variant="outline"
                    size="lg"
                    className={actionClass}
                  >
                    <MessageSquare className="text-label-secondary h-3.5 w-3.5" />
                    Message
                  </Button>
                </div>
              </div>

              {/* Diplomacy */}
              <div className="space-y-2">
                <Eyebrow className="block px-1">Diplomacy</Eyebrow>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={handleEstablishEmbassy}
                    disabled={!viewerCountryId || isLoading}
                    variant="outline"
                    size="lg"
                    className={actionClass}
                  >
                    {establishEmbassyMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Building2 className="text-label-secondary h-3.5 w-3.5" />
                    )}
                    Construct Embassy
                  </Button>

                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!viewerCountryId) {
                        notify.error("You must be logged in to request a meeting");
                        return;
                      }
                      setSchedulerOpen(true);
                    }}
                    disabled={!viewerCountryId || isLoading}
                    variant="outline"
                    size="lg"
                    className={actionClass}
                  >
                    <Calendar className="text-label-secondary h-3.5 w-3.5" />
                    Request Meeting
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={(e) => handleForeignPolicy(e, "free_trade")}
                      disabled={!viewerCountryId || isLoading}
                      variant="outline"
                      size="lg"
                      className={actionClass}
                    >
                      <Handshake className="text-label-secondary h-3.5 w-3.5" />
                      Free Trade
                    </Button>

                    <Button
                      type="button"
                      onClick={(e) => handleForeignPolicy(e, "military_alliance")}
                      disabled={!viewerCountryId || isLoading}
                      variant="outline"
                      size="lg"
                      className={actionClass}
                    >
                      <Shield className="text-label-secondary h-3.5 w-3.5" />
                      Alliance
                    </Button>
                  </div>
                </div>
              </div>

              {/* Foreign Policy (Sanctions & Embargo) */}
              <div className="space-y-2">
                <Eyebrow className="block px-1">Foreign Policy</Eyebrow>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={(e) => handleForeignPolicy(e, "sanction")}
                    disabled={!viewerCountryId || isLoading}
                    variant="outline"
                    size="lg"
                    className={cn(actionClass, "text-destructive")}
                  >
                    <Scale className="text-label-secondary h-3.5 w-3.5" />
                    Sanctions
                  </Button>

                  <Button
                    type="button"
                    onClick={(e) => handleForeignPolicy(e, "embargo")}
                    disabled={!viewerCountryId || isLoading}
                    variant="outline"
                    size="lg"
                    className={cn(actionClass, "text-destructive")}
                  >
                    <Swords className="text-label-secondary h-3.5 w-3.5" />
                    Embargo
                  </Button>
                </div>
              </div>

              {/* Quick Links */}
              <div className="space-y-2">
                <Eyebrow className="block px-1">Quick Links</Eyebrow>
                <Button asChild variant="outline" size="lg" className={actionClass}>
                  <a
                    href={`/wiki/${encodeURIComponent(country.name.replace(/ /g, "_"))}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Globe className="text-label-secondary h-3.5 w-3.5" />
                    View on IxWiki
                    <ExternalLink className="text-label-secondary ml-auto h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Login warning */}
          {!viewerCountryId && !isOwnCountry && (
            <div className="border-separator mt-3 border-t pt-3">
              <p className="text-label-secondary text-caption text-center">
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
