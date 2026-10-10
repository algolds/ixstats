"use client";

import React, { useState } from "react";
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
import { api, type RouterInputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useCountryDiplomacyActions } from "./useCountryDiplomacyActions";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { createUrl } from "~/lib/utils";
import { WikiLinkPreview } from "~/components/wiki-os/reader/WikiLinkPreview";
import { Button, buttonVariants } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import dynamic from "next/dynamic";
import { useMountOnFirstOpen } from "~/components/wiki-os/shared/useMountOnFirstOpen";
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

// The scheduler is a dialog nobody has opened yet when the menu mounts: its chunk is fetched when it is first
// opened (plan 415, F19), not with every page that shows the menu (the wiki's sidebar widget does).
const MeetingScheduler = dynamic(
  () => import("~/components/executive/actions/MeetingScheduler").then((m) => m.MeetingScheduler),
  { ssr: false }
);

interface CountryActionsMenuProps {
  targetCountryId: string;
  targetCountryName: string;
  viewerCountryId?: string;
  isOpen: boolean;
  onClose: () => void;
  isOwnCountry?: boolean;
}

type IconType = React.ComponentType<{ className?: string }>;
type DiplomacyActions = ReturnType<typeof useCountryDiplomacyActions>;
type ForeignPolicy = Parameters<DiplomacyActions["proposeForeignPolicy"]>[0];
type CongratulationPost = RouterInputs["thinkpages"]["createPost"];

const MANAGEMENT_LINKS: Array<[icon: IconType, label: string, path: string]> = [
  [Building2, "MyCountry dashboard", "/mycountry"],
  [ScrollText, "Executive actions", "/mycountry/executive"],
  [Handshake, "Manage diplomacy", "/mycountry/diplomacy"],
  [Map, "Map & territory editor", "/mycountry/editor"],
  [Wallet, "IxVault cards & market", "/vault"],
  [Scale, "Politics & elections", "/mycountry/politics"],
];

const DIPLOMACY_PROPOSALS: Array<[icon: IconType, label: string, policy: ForeignPolicy]> = [
  [Handshake, "Propose free trade", "free_trade"],
  [Shield, "Propose military alliance", "military_alliance"],
];

const HOSTILE_PROPOSALS: Array<[icon: IconType, label: string, policy: ForeignPolicy]> = [
  [Scale, "Impose sanctions", "sanction"],
  [Swords, "Declare embargo", "embargo"],
];

const profileUrl = (countryName: string) =>
  `${window.location.origin}${createUrl(`/countries/${countryName.replace(/\s/g, "_")}`)}`;

function followLabel(diplomacy: DiplomacyActions): string {
  if (diplomacy.isFollowPending) return diplomacy.isFollowing ? "Unfollowing…" : "Following…";
  return diplomacy.isFollowing ? "Unfollow Nation" : "Follow Nation";
}

/** Pick a recent achievement and post a congratulation to the nation's feed. */
function CongratulateRow({
  targetCountryName,
  achievements,
  viewerCountryId,
  disabled,
  sending,
  onSend,
}: {
  targetCountryName: string;
  achievements: Array<{ id: string; title: string; description?: string | null }>;
  viewerCountryId: string | undefined;
  /** Another action in the menu is in flight (the row's own sending state is `sending`). */
  disabled: boolean;
  sending: boolean;
  onSend: (post: CongratulationPost) => void;
}) {
  const notify = useNotify();
  const [selected, setSelected] = useState("");

  const congratulate = () => {
    if (!viewerCountryId) {
      notify.error("You need to sign in to send congratulations");
      return;
    }
    if (!selected) {
      notify.error("Please select an achievement to congratulate");
      return;
    }
    const achievement = achievements.find((a) => a.id === selected);
    if (!achievement) return;

    onSend({
      accountId: viewerCountryId,
      content:
        `Congratulations to ${targetCountryName} on ${achievement.title}. ${achievement.description ?? ""}`.trim(),
      visibility: "public" as const,
      hashtags: ["achievement", targetCountryName.replace(/\s/g, "")],
    });
  };

  return (
    <Card variant="well" padding="none" className="flex flex-wrap items-center gap-2 p-2 pl-4">
      <Heart className="text-label-secondary h-4 w-4 shrink-0" />
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger
          size="sm"
          className="text-footnote min-w-[140px] flex-1"
          aria-label="Achievement to congratulate"
        >
          <SelectValue placeholder="Select achievement…" />
        </SelectTrigger>
        <SelectContent>
          {achievements.map((achievement) => (
            <SelectItem key={achievement.id} value={achievement.id}>
              {achievement.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="secondary"
        onClick={congratulate}
        disabled={!viewerCountryId || disabled || sending || !selected}
      >
        {sending ? "Sending…" : "Congratulate"}
      </Button>
    </Card>
  );
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const schedulerMounted = useMountOnFirstOpen(schedulerOpen);

  const diplomacy = useCountryDiplomacyActions({
    viewerCountryId,
    targetCountryId,
    targetCountryName,
    followStatusEnabled: !!viewerCountryId,
    onProposed: onClose,
  });

  const congratulation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success(`Congratulations sent to ${targetCountryName}`);
      onClose();
    },
    onError: (error) => notify.error(`Failed to send congratulations: ${error.message}`),
  });

  const { data: recentAchievements } = api.achievements.getRecentByCountry.useQuery(
    { countryId: targetCountryId, limit: 5 },
    { enabled: isOpen }
  );

  const go = (path: string) => {
    router.push(path);
    onClose();
  };

  const copyLink = () => {
    void navigator.clipboard.writeText(profileUrl(targetCountryName)).then(() => {
      setCopiedLink(true);
      notify.success("Link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const shareProfile = () => {
    const url = profileUrl(targetCountryName);
    if (navigator.share) {
      void navigator.share({ title: targetCountryName, url });
    } else {
      void navigator.clipboard.writeText(url);
      notify.success("Link copied");
    }
    onClose();
  };

  const requestMeeting = () => {
    if (!viewerCountryId) {
      notify.error("You must be logged in to request a meeting");
      return;
    }
    setSchedulerOpen(true);
  };

  // A sending congratulation also locks the diplomacy rows so nothing is double-submitted.
  const isBusy = diplomacy.isPending || congratulation.isPending;
  const needsViewer = !viewerCountryId || isBusy;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isOwnCountry ? "Country Management" : "Country Actions"}</DialogTitle>
            <DialogDescription>{targetCountryName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {isOwnCountry ? (
              <ActionGroup label="Management">
                {MANAGEMENT_LINKS.map(([icon, label, path]) => (
                  <ActionRow key={path} icon={icon} label={label} onClick={() => go(path)} />
                ))}
              </ActionGroup>
            ) : (
              <>
                <ActionGroup label="Social">
                  <ActionRow
                    icon={diplomacy.isFollowing ? UserMinus : UserPlus}
                    label={followLabel(diplomacy)}
                    onClick={diplomacy.toggleFollow}
                    disabled={needsViewer}
                  />
                  <ActionRow
                    icon={MessageSquare}
                    label="Secure message"
                    onClick={() => go(`/messages?country=${targetCountryId}`)}
                    disabled={!viewerCountryId}
                  />
                  {recentAchievements && recentAchievements.length > 0 && (
                    <CongratulateRow
                      targetCountryName={targetCountryName}
                      achievements={recentAchievements}
                      viewerCountryId={viewerCountryId}
                      disabled={isBusy}
                      sending={congratulation.isPending}
                      onSend={congratulation.mutate}
                    />
                  )}
                </ActionGroup>

                <ActionGroup label="Diplomacy">
                  <ActionRow
                    icon={Building2}
                    label={diplomacy.isEmbassyPending ? "Constructing…" : "Construct Embassy"}
                    onClick={diplomacy.establishEmbassy}
                    disabled={needsViewer}
                  />
                  <ActionRow
                    icon={Calendar}
                    label="Request meeting"
                    onClick={requestMeeting}
                    disabled={needsViewer}
                  />
                  {DIPLOMACY_PROPOSALS.map(([icon, label, policy]) => (
                    <ActionRow
                      key={policy}
                      icon={icon}
                      label={label}
                      onClick={() => diplomacy.proposeForeignPolicy(policy)}
                      disabled={needsViewer}
                    />
                  ))}
                </ActionGroup>

                <ActionGroup label="Foreign policy">
                  {HOSTILE_PROPOSALS.map(([icon, label, policy]) => (
                    <ActionRow
                      key={policy}
                      icon={icon}
                      label={label}
                      onClick={() => diplomacy.proposeForeignPolicy(policy)}
                      disabled={needsViewer}
                      destructive
                    />
                  ))}
                </ActionGroup>
              </>
            )}

            <ActionGroup label="Quick links">
              <ActionRow
                icon={Trophy}
                label="Global leaderboard"
                onClick={() => go("/leaderboards")}
              />
              <WikiLinkPreview title={targetCountryName}>
                <Link
                  href={titleToWikiOSRoute(targetCountryName)}
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
                onClick={copyLink}
              />
              <ActionRow icon={Share2} label="Share profile" onClick={shareProfile} />
            </ActionGroup>

            {!viewerCountryId && !isOwnCountry && (
              <p className="border-separator text-label-secondary text-footnote border-t pt-4 text-center">
                Login required to perform diplomatic actions
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {viewerCountryId && schedulerMounted && (
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
