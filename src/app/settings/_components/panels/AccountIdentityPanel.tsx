"use client";

import { useState } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Key,
  Link as LinkIcon,
  NavArrowDown,
  ChatBubble as MessageSquare,
  OpenBook as BookOpen,
  CompactDisc as Disc,
  Eye,
  EyeClosed as EyeOff,
  Check,
  Copy,
  OpenNewWindow as ExternalLink,
  ShieldCheck,
  Crown,
} from "iconoir-react";
import type { UserResource } from "@clerk/types";
import { UserButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useUserCountry } from "~/hooks/useUserCountry";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow } from "../primitives";
import { WikiAccountVerifyRow } from "~/components/settings/WikiAccountVerifyRow";
import { ForumAccountVerify } from "~/components/settings/ForumAccountVerify";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { formatMembershipTier } from "~/lib/tier-utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";

interface AccountIdentityPanelProps {
  user: UserResource | null | undefined;
}

export function AccountIdentityPanel({ user }: AccountIdentityPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { userProfile } = useUserCountry();
  const { data: status } = api.ixnayid.getStatus.useQuery();
  const wikiLinks = api.ixnayid.listWikiLinks.useQuery();
  const linkFor = (source: string) => wikiLinks.data?.find((l) => l.source === source);

  const [showSensitive, setShowSensitive] = useState(false);
  const [showLinkedAccounts, setShowLinkedAccounts] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);

  // Forum link state
  const [showForumInput, setShowForumInput] = useState(false);

  // Mutations

  const unlinkForum = api.ixnayid.unlinkForum.useMutation({
    onSuccess: () => {
      notify.success("Forum unlinked");
      void utils.ixnayid.getStatus.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to unlink Forum"),
  });

  const unlinkDiscord = api.ixnayid.unlinkDiscord.useMutation({
    onSuccess: () => {
      notify.success("Discord unlinked");
      void utils.ixnayid.getStatus.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to unlink Discord"),
  });

  const passportHandle =
    status?.passportHandle ||
    status?.forum?.username ||
    status?.wiki?.username ||
    (user?.username ? user.username.replace(/_$/, "") : null) ||
    user?.username ||
    "me";
  const passportUrl = `/@${passportHandle}`;
  const countryFactbookUrl = userProfile?.country?.slug
    ? `/countries/${userProfile.country.slug}`
    : null;

  const handleCopyPassport = (e: React.MouseEvent) => {
    e.preventDefault();
    const fullUrl = `${window.location.origin}${passportUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedHandle(true);
    notify.success("Profile link copied");
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  // Connected accounts counter
  const linkedServicesCount =
    (status?.forum.linked ? 1 : 0) +
    (status?.wiki.linked || wikiLinks.data?.some((l) => l.verified) ? 1 : 0) +
    (status?.discord.linked ? 1 : 0);

  const totalConnectedCount = linkedServicesCount + (userProfile?.countryId ? 1 : 0);

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="IxnayID & Digital Passport"
        category="Profile & Identity"
        description="Public passport presentation and connected community accounts."
        actions={
          <Button asChild variant="tinted" size="sm">
            <Link href={passportUrl}>
              <ExternalLink aria-hidden />
              <span>View Public Passport</span>
            </Link>
          </Button>
        }
      />

      {/* Identity card */}
      <FacetCard padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="border-separator bg-fill-3 rounded-row relative size-14 shrink-0 overflow-hidden border">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.username || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-label-secondary flex h-full w-full items-center justify-center">
                  <User aria-hidden className="size-6" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label text-title-3">@{passportHandle}</span>
                <Badge variant="tinted">
                  <ShieldCheck aria-hidden />
                  Verified
                </Badge>
                <Badge variant="success" className="tabular-nums">
                  {totalConnectedCount}/4 Connected
                </Badge>
              </div>

              <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-2">
                {userProfile?.country ? (
                  <Link
                    href={countryFactbookUrl || "/mycountry"}
                    className="text-label flex items-center gap-1.5 font-medium hover:underline"
                  >
                    <div className="border-separator h-3.5 w-5 overflow-hidden rounded-xs border">
                      <UnifiedCountryFlag
                        countryName={userProfile.country.name}
                        flagUrl={userProfile.country.flagUrl}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span>{userProfile.country.name}</span>
                  </Link>
                ) : (
                  <Link href="/setup" className="text-tint font-medium hover:underline">
                    + Link Country
                  </Link>
                )}
                {userProfile?.membershipTier &&
                  (() => {
                    const tierInfo = formatMembershipTier(userProfile.membershipTier);
                    return (
                      <Badge variant={tierInfo.isPremium ? "caution" : "neutral"}>
                        {tierInfo.isPremium && <Crown aria-hidden />}
                        {tierInfo.label}
                      </Badge>
                    );
                  })()}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="gray" size="sm" onClick={handleCopyPassport}>
              {copiedHandle ? (
                <>
                  <Check aria-hidden className="text-success" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy aria-hidden />
                  <span>Copy Link</span>
                </>
              )}
            </Button>
            <div className="border-separator bg-surface rounded-row border p-0.5">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7 rounded-control",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </FacetCard>

      {/* Account credentials & linked accounts */}
      <SettingsGroup
        title="Account Credentials"
        description="Login details, security settings, and connected community accounts."
        action={
          <Button
            type="button"
            variant="gray"
            size="sm"
            aria-pressed={showSensitive}
            onClick={() => setShowSensitive((prev) => !prev)}
          >
            {showSensitive ? (
              <>
                <EyeOff aria-hidden />
                <span>Hide</span>
              </>
            ) : (
              <>
                <Eye aria-hidden />
                <span>Show</span>
              </>
            )}
          </Button>
        }
        footer="Click your avatar to change your password, turn on two-step verification, or manage active sessions."
      >
        <SettingsRow label="Username" icon={Key} glyphClass="bg-purple/15 text-purple">
          <span
            className={cn(
              "text-label text-body duration-fast transition-[filter,opacity]",
              showSensitive ? "opacity-100 blur-none" : "opacity-60 blur-[4px] select-none"
            )}
          >
            {user?.username || (showSensitive ? "—" : "••••••••")}
          </span>
        </SettingsRow>

        <SettingsRow label="Primary Email" icon={Mail} glyphClass="bg-yellow/15 text-yellow">
          <span
            className={cn(
              "text-label text-body duration-fast transition-[filter,opacity]",
              showSensitive ? "opacity-100 blur-none" : "opacity-60 blur-[4px] select-none"
            )}
          >
            {user?.emailAddresses?.[0]?.emailAddress ||
              (showSensitive ? "—" : "••••••••••••••••••••")}
          </span>
        </SettingsRow>

        {/* Linked accounts (collapsible) */}
        <SettingsRow
          label="Linked Accounts"
          description={
            status
              ? `${linkedServicesCount} of 3 connected (Forum, wikis, Discord)`
              : "Connect your Forum, wikis, and Discord accounts"
          }
          icon={LinkIcon}
          glyphClass="bg-indigo/15 text-indigo"
        >
          <Button
            type="button"
            variant="gray"
            size="sm"
            aria-expanded={showLinkedAccounts}
            onClick={() => setShowLinkedAccounts((prev) => !prev)}
          >
            <span>{showLinkedAccounts ? "Hide" : "Manage"}</span>
            <NavArrowDown
              aria-hidden
              className={cn(
                "duration-fast ease-out-facet transition-transform",
                showLinkedAccounts ? "rotate-180" : ""
              )}
            />
          </Button>
        </SettingsRow>

        {/* Expanded linked accounts */}
        {showLinkedAccounts && (
          <div className="divide-separator bg-surface-secondary border-separator divide-y border-t">
            {/* Forum */}
            <SettingsRow
              label="Community Forum"
              description={
                status?.forum.linked
                  ? `Connected as @${status.forum.username}`
                  : "Connect your XenForo account to sync forum activity"
              }
              icon={MessageSquare}
              glyphClass="bg-orange/15 text-orange"
            >
              {status?.forum.linked ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success">Connected</Badge>
                  <Button
                    type="button"
                    variant="plain"
                    size="sm"
                    className="text-destructive"
                    onClick={() => unlinkForum.mutate()}
                    disabled={unlinkForum.isPending}
                  >
                    {unlinkForum.isPending ? "Unlinking..." : "Unlink"}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="gray"
                  size="sm"
                  aria-expanded={showForumInput}
                  onClick={() => setShowForumInput((prev) => !prev)}
                >
                  {showForumInput ? "Cancel" : "Connect"}
                </Button>
              )}
            </SettingsRow>

            {showForumInput && !status?.forum.linked && (
              <div className="space-y-3 p-4">
                {/* A code on the forum profile proves the account (WK-1) */}
                <ForumAccountVerify onLinked={() => setShowForumInput(false)} />
              </div>
            )}

            {/* Wiki accounts (verified by user-page token) */}
            <div className="flex items-start gap-3 p-4">
              <div className="bg-blue/15 text-blue rounded-control-sm flex size-7 shrink-0 items-center justify-center">
                <BookOpen aria-hidden className="size-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="text-label text-headline">Wikis</div>
                <WikiAccountVerifyRow source="ixwiki" label="IxWiki" link={linkFor("ixwiki")} />
                <WikiAccountVerifyRow source="iiwiki" label="IIWiki" link={linkFor("iiwiki")} />
                <WikiAccountVerifyRow
                  source="althistory"
                  label="AltHistory"
                  link={linkFor("althistory")}
                />
              </div>
            </div>

            {/* Discord */}
            <SettingsRow
              label="Discord"
              description={
                status?.discord.linked
                  ? "Connected to Discord community server"
                  : "Connect your Discord account to receive bot alerts"
              }
              icon={Disc}
              glyphClass="bg-indigo/15 text-indigo"
            >
              {status?.discord.linked ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success">Connected</Badge>
                  <Button
                    type="button"
                    variant="plain"
                    size="sm"
                    className="text-destructive"
                    onClick={() => unlinkDiscord.mutate()}
                    disabled={unlinkDiscord.isPending}
                  >
                    {unlinkDiscord.isPending ? "Unlinking..." : "Unlink"}
                  </Button>
                </div>
              ) : (
                <span className="text-label-secondary text-footnote">
                  Sign in with Discord on Clerk
                </span>
              )}
            </SettingsRow>
          </div>
        )}
      </SettingsGroup>
    </div>
  );
}
