"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "~/lib/utils";
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
  NavArrowRight,
  Crown,
  Calendar,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ProposeSummitForm } from "./ProposeSummitForm";
import { wikiReaderPath } from "~/lib/wiki-os/config";
import { type CountryCardData } from "./CountryFocusCard";
import { useCountryDiplomacyActions, type ForeignPolicyType } from "./useCountryDiplomacyActions";

interface ExpandedCardContentProps {
  country: CountryCardData;
  viewerCountryId?: string;
  isOwnCountry: boolean;
  onCountryClick?: (countryId: string, countryName: string) => void;
}

export const ExpandedCardContent = React.memo<ExpandedCardContentProps>(
  ({ country, viewerCountryId, isOwnCountry }) => {
    const router = useRouter();
    const targetCountryId = country.id;
    const targetCountryName = country.name;
    const [summitOpen, setSummitOpen] = useState(false);

    const diplomacy = useCountryDiplomacyActions({
      viewerCountryId,
      targetCountryId,
      targetCountryName,
      followStatusEnabled: !!viewerCountryId && !isOwnCountry,
    });

    const handleFollowToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        diplomacy.toggleFollow();
      },
      [diplomacy.toggleFollow]
    );

    const handleSendMessage = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(`/messages?country=${targetCountryId}`);
      },
      [router, targetCountryId]
    );

    const handleEstablishEmbassy = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        diplomacy.establishEmbassy();
      },
      [diplomacy.establishEmbassy]
    );

    const handleForeignPolicy = useCallback(
      (e: React.MouseEvent, actionType: ForeignPolicyType) => {
        e.stopPropagation();
        diplomacy.proposeForeignPolicy(actionType);
      },
      [diplomacy.proposeForeignPolicy]
    );

    const handleGoToMyCountry = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push("/mycountry");
      },
      [router]
    );

    const isLoading = diplomacy.isPending;

    // Action rows: Facet `Button`s at the large (44px) size, label-aligned.
    const actionClass = "w-full justify-start";

    return (
      <div className="bg-surface text-label relative min-h-[320px] w-full p-4 sm:p-5">
        <div className="relative z-10 space-y-4">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-footnote text-label-secondary font-medium">
                Country actions
              </span>
              {country.continent && <Badge variant="default">{country.continent}</Badge>}
              {country.region && <Badge variant="outline">{country.region}</Badge>}
            </div>
          </div>

          {/* Own Country Action */}
          {isOwnCountry && (
            <div>
              <Button
                type="button"
                onClick={handleGoToMyCountry}
                variant="default"
                size="lg"
                className={actionClass}
              >
                <Crown className="h-4 w-4" />
                Go to MyCountry dashboard
              </Button>
            </div>
          )}

          {/* Other Country Actions */}
          {!isOwnCountry && (
            <div className="space-y-4">
              {/* Social */}
              <div className="space-y-2">
                <p className="text-footnote text-label-secondary px-1 font-medium">Social</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={!viewerCountryId || isLoading}
                    variant="outline"
                    size="lg"
                    className={cn(actionClass, diplomacy.isFollowing && "text-destructive")}
                  >
                    {diplomacy.isFollowPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : diplomacy.isFollowing ? (
                      <UserMinus className="text-destructive h-3.5 w-3.5" />
                    ) : (
                      <UserPlus className="text-label-secondary h-3.5 w-3.5" />
                    )}
                    {diplomacy.isFollowing ? "Unfollow" : "Follow"}
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
                <p className="text-footnote text-label-secondary px-1 font-medium">Diplomacy</p>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={handleEstablishEmbassy}
                    disabled={!viewerCountryId || isLoading}
                    variant="outline"
                    size="lg"
                    className={actionClass}
                  >
                    {diplomacy.isEmbassyPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Building2 className="text-label-secondary h-3.5 w-3.5" />
                    )}
                    Construct embassy
                  </Button>

                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSummitOpen((open) => !open);
                    }}
                    disabled={!viewerCountryId || isLoading}
                    aria-pressed={summitOpen}
                    variant="outline"
                    size="lg"
                    className={actionClass}
                  >
                    <Calendar className="text-label-secondary h-3.5 w-3.5" />
                    Propose summit
                  </Button>
                  {summitOpen && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <ProposeSummitForm
                        targetCountryId={targetCountryId}
                        targetCountryName={targetCountryName}
                        onDone={() => setSummitOpen(false)}
                      />
                    </div>
                  )}

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
                      Free trade
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
                <p className="text-footnote text-label-secondary px-1 font-medium">
                  Foreign policy
                </p>
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
                <p className="text-footnote text-label-secondary px-1 font-medium">Quick links</p>
                <Button asChild variant="outline" size="lg" className={actionClass}>
                  <Link href={wikiReaderPath(country.name)} onClick={(e) => e.stopPropagation()}>
                    <Globe className="text-label-secondary h-3.5 w-3.5" />
                    View on the wiki
                    <NavArrowRight className="text-label-secondary ml-auto h-3 w-3" />
                  </Link>
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
        </div>
      </div>
    );
  }
);

ExpandedCardContent.displayName = "ExpandedCardContent";
