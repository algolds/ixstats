"use client";

import React, { useState, useCallback } from "react";
import {
  UserPlus,
  UserXmark as UserMinus,
  ChatBubble as MessageSquare,
  City as Building2,
  Heart,
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
import { useCountryDiplomacyActions } from "./useCountryDiplomacyActions";
import { MeetingScheduler } from "~/components/executive/actions/MeetingScheduler";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import { createUrl } from "~/lib/utils";
import { WikiLinkPreview } from "~/components/wiki-os/reader/WikiLinkPreview";
import { Button, buttonVariants } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";

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
  isOwnCountry = false,
}: CountryActionsMenuProps) {
  const notify = useNotify();
  const router = useRouter();
  const [selectedAchievement, setSelectedAchievement] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  const diplomacy = useCountryDiplomacyActions({
    viewerCountryId,
    targetCountryId,
    targetCountryName,
    followStatusEnabled: !!viewerCountryId,
    onProposed: onClose,
  });

  const { data: recentAchievements } = api.achievements.getRecentByCountry.useQuery(
    { countryId: targetCountryId, limit: 5 },
    { enabled: isOpen }
  );

  const congratulateMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success(`Congratulations sent to ${targetCountryName}`);
      setSelectedAchievement("");
      onClose();
    },
    onError: (error) => notify.error(`Failed to send congratulations: ${error.message}`),
  });

  const handleDiplomaticMessage = useCallback(() => {
    router.push(createUrl(`/messages?country=${targetCountryId}`));
    onClose();
  }, [router, targetCountryId, onClose]);

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
      content:
        `Congratulations to ${targetCountryName} on ${achievement.title}. ${achievement.description ?? ""}`.trim(),
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

  const isLoading = diplomacy.isPending || congratulateMutation.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isOwnCountry ? "Country Management" : "Country Actions"}</DialogTitle>
            <DialogDescription>{targetCountryName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Own Country Actions */}
            {isOwnCountry && (
              <ActionGroup label="Management">
                <ActionRow
                  icon={Building2}
                  label="MyCountry dashboard"
                  onClick={() => {
                    router.push(createUrl("/mycountry"));
                    onClose();
                  }}
                />
                <ActionRow
                  icon={ScrollText}
                  label="Executive actions"
                  onClick={() => {
                    router.push(createUrl("/mycountry/executive"));
                    onClose();
                  }}
                />
                <ActionRow
                  icon={Handshake}
                  label="Manage diplomacy"
                  onClick={() => {
                    router.push(createUrl("/mycountry/diplomacy"));
                    onClose();
                  }}
                />
                <ActionRow
                  icon={Map}
                  label="Map & territory editor"
                  onClick={() => {
                    router.push(createUrl("/mycountry/editor"));
                    onClose();
                  }}
                />
                <ActionRow
                  icon={Wallet}
                  label="IxVault cards & market"
                  onClick={() => {
                    router.push(createUrl("/vault"));
                    onClose();
                  }}
                />
                <ActionRow
                  icon={Scale}
                  label="Politics & elections"
                  onClick={() => {
                    router.push(createUrl("/mycountry/politics"));
                    onClose();
                  }}
                />
              </ActionGroup>
            )}

            {/* Other Country: Social Actions */}
            {!isOwnCountry && (
              <>
                <ActionGroup label="Social">
                  <ActionRow
                    icon={diplomacy.isFollowing ? UserMinus : UserPlus}
                    label={
                      diplomacy.isFollowPending
                        ? diplomacy.isFollowing
                          ? "Unfollowing…"
                          : "Following…"
                        : diplomacy.isFollowing
                          ? "Unfollow Nation"
                          : "Follow Nation"
                    }
                    onClick={diplomacy.toggleFollow}
                    disabled={!viewerCountryId || isLoading}
                  />
                  <ActionRow
                    icon={MessageSquare}
                    label="Secure message"
                    onClick={handleDiplomaticMessage}
                    disabled={!viewerCountryId}
                  />

                  {recentAchievements && recentAchievements.length > 0 && (
                    <Card
                      variant="inset"
                      padding="none"
                      className="flex flex-wrap items-center gap-2 p-2 pl-4"
                    >
                      <Heart className="text-label-secondary h-4 w-4 shrink-0" />
                      <Select value={selectedAchievement} onValueChange={setSelectedAchievement}>
                        <SelectTrigger
                          size="sm"
                          className="text-footnote min-w-[140px] flex-1"
                          aria-label="Achievement to congratulate"
                        >
                          <SelectValue placeholder="Select achievement…" />
                        </SelectTrigger>
                        <SelectContent>
                          {recentAchievements.map(
                            (achievement: { id: string; icon?: string | null; title: string }) => (
                              <SelectItem key={achievement.id} value={achievement.id}>
                                {achievement.title}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCongratulate}
                        disabled={!viewerCountryId || isLoading || !selectedAchievement}
                      >
                        {congratulateMutation.isPending ? "Sending…" : "Congratulate"}
                      </Button>
                    </Card>
                  )}
                </ActionGroup>

                <ActionGroup label="Diplomacy">
                  <ActionRow
                    icon={Building2}
                    label={diplomacy.isEmbassyPending ? "Constructing…" : "Construct Embassy"}
                    onClick={diplomacy.establishEmbassy}
                    disabled={!viewerCountryId || isLoading}
                  />
                  <ActionRow
                    icon={Calendar}
                    label="Request meeting"
                    onClick={() => {
                      if (!viewerCountryId) {
                        notify.error("You must be logged in to request a meeting");
                        return;
                      }
                      setSchedulerOpen(true);
                    }}
                    disabled={!viewerCountryId || isLoading}
                  />
                  <ActionRow
                    icon={Handshake}
                    label="Propose free trade"
                    onClick={() => diplomacy.proposeForeignPolicy("free_trade")}
                    disabled={!viewerCountryId || isLoading}
                  />
                  <ActionRow
                    icon={Shield}
                    label="Propose military alliance"
                    onClick={() => diplomacy.proposeForeignPolicy("military_alliance")}
                    disabled={!viewerCountryId || isLoading}
                  />
                </ActionGroup>

                <ActionGroup label="Foreign policy">
                  <ActionRow
                    icon={Scale}
                    label="Impose sanctions"
                    onClick={() => diplomacy.proposeForeignPolicy("sanction")}
                    disabled={!viewerCountryId || isLoading}
                    destructive
                  />
                  <ActionRow
                    icon={Swords}
                    label="Declare embargo"
                    onClick={() => diplomacy.proposeForeignPolicy("embargo")}
                    disabled={!viewerCountryId || isLoading}
                    destructive
                  />
                </ActionGroup>
              </>
            )}

            {/* Quick Links (always shown) */}
            <ActionGroup label="Quick links">
              <ActionRow
                icon={Trophy}
                label="Global leaderboard"
                onClick={() => {
                  router.push(createUrl("/leaderboards"));
                  onClose();
                }}
              />
              <WikiLinkPreview title={targetCountryName}>
                <Link
                  href={titleToWikiOSPath(targetCountryName)}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    ACTION_ROW_CLASS
                  )}
                  onClick={onClose}
                >
                  <Globe className="text-label-secondary h-4 w-4" />
                  View on IxWiki
                  <ExternalLink className="text-label-secondary ml-auto h-3.5 w-3.5" />
                </Link>
              </WikiLinkPreview>
              <ActionRow
                icon={copiedLink ? Check : Copy}
                label={copiedLink ? "Link Copied" : "Copy Profile Link"}
                onClick={handleCopyLink}
              />
              <ActionRow
                icon={Share2}
                label="Share profile"
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
              />
            </ActionGroup>

            {!viewerCountryId && !isOwnCountry && (
              <p className="border-separator text-label-secondary text-footnote border-t pt-4 text-center">
                Login required to perform diplomatic actions
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
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

/** Action rows: large (44px) bordered Facet buttons, label-aligned. */
const ACTION_ROW_CLASS = "w-full justify-start gap-3";

/** A titled group of action rows. */
function ActionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2" aria-label={label}>
      <Eyebrow className="block px-1">{label}</Eyebrow>
      {children}
    </section>
  );
}

/** One full-width action: a plain icon and label on an opaque row (the dialog already blurs). */
function ActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className={cn(ACTION_ROW_CLASS, destructive && "text-destructive")}
    >
      <Icon className={cn("h-4 w-4", destructive ? "text-destructive" : "text-label-secondary")} />
      {label}
    </Button>
  );
}
