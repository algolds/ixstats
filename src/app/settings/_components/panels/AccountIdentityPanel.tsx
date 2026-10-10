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
  AtSign,
} from "iconoir-react";
import type { UserResource } from "@clerk/types";
import { UserButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useUserCountry } from "~/hooks/useUserCountry";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow } from "../primitives";
import { WikiAccountVerifyRow } from "~/components/settings/WikiAccountVerifyRow";
import { oldForumAccountText } from "~/components/settings/OldForumAccount";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatMembershipTier } from "~/lib/tier-utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { Card } from "~/components/ui/card";

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

  const [handleDraft, setHandleDraft] = useState("");

  // Mutations

  const setHandle = api.ixnayid.setHandle.useMutation({
    onSuccess: ({ handle }) => {
      notify.success(`Your passport is now at @${handle}`);
      setHandleDraft("");
      void utils.ixnayid.getStatus.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to change handle"),
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
  const canChangeHandle = status?.canChangeHandle ?? false;
  const draftHandle = handleDraft.trim().replace(/^@/, "").toLowerCase();
  const canSaveHandle =
    canChangeHandle && !setHandle.isPending && draftHandle !== "" && draftHandle !== status?.handle;
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
        title="IxnayID & passport"
        category="Profile & identity"
        description="Your public passport and connected community accounts."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href={passportUrl}>
              <ExternalLink aria-hidden />
              <span>View public passport</span>
            </Link>
          </Button>
        }
      />

      <Card padding="md">
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
              <span
                aria-hidden
                className="bg-success ring-surface absolute right-1 bottom-1 size-3 rounded-full ring-2"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label text-title-3">@{passportHandle}</span>
                <Badge variant="secondary">
                  <ShieldCheck aria-hidden />
                  Verified
                </Badge>
                <Badge variant="success">
                  <span className="tabular-nums">{totalConnectedCount}/4</span> connected
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
                    + Link country
                  </Link>
                )}
                {userProfile?.membershipTier &&
                  (() => {
                    const tierInfo = formatMembershipTier(userProfile.membershipTier);
                    return (
                      <Badge variant={tierInfo.isPremium ? "warning" : "default"}>
                        {tierInfo.isPremium && <Crown aria-hidden />}
                        {tierInfo.label}
                      </Badge>
                    );
                  })()}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyPassport}
              disabled={!status?.passportHandle}
            >
              {copiedHandle ? (
                <>
                  <Check aria-hidden className="text-success" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy aria-hidden />
                  <span>Copy link</span>
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
      </Card>

      {/* Passport handle: one self-service change */}
      <SettingsGroup
        title="Passport handle"
        description="The address of your IxStates Passport."
        footer={
          status &&
          (canChangeHandle
            ? "You can change your handle once. Links to your old handle stop working."
            : "You have used your one handle change.")
        }
      >
        <SettingsRow
          label={status?.handle ? `@${status.handle}` : "No handle yet"}
          description="3 to 24 lowercase letters, numbers or underscores."
          icon={AtSign}
          glyphClass="bg-tint/15 text-tint"
        >
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSaveHandle) setHandle.mutate({ handle: draftHandle });
            }}
          >
            <Input
              value={handleDraft}
              onChange={(e) => setHandleDraft(e.target.value)}
              placeholder={status?.handle ?? "new_handle"}
              aria-label="New passport handle"
              maxLength={25}
              disabled={!canChangeHandle || setHandle.isPending}
              className="h-8 w-44"
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!canSaveHandle}>
              {setHandle.isPending ? "Saving..." : "Change"}
            </Button>
          </form>
        </SettingsRow>
      </SettingsGroup>

      {/* Account credentials & linked accounts */}
      <SettingsGroup
        title="Account credentials"
        description="Login details and connected community accounts."
        action={
          <Button
            type="button"
            variant="secondary"
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
        footer="Select your avatar to change your password, turn on two-step verification or manage sessions."
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

        <SettingsRow label="Primary email" icon={Mail} glyphClass="bg-yellow/15 text-yellow">
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
          label="Linked accounts"
          description={
            status
              ? `${linkedServicesCount} of 3 connected (old forum, wikis, Discord)`
              : "Connect your wiki and Discord accounts"
          }
          icon={LinkIcon}
          glyphClass="bg-indigo/15 text-indigo"
        >
          <Button
            type="button"
            variant="secondary"
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
            {/* Old forum: read-only since phase 4b (staff attribute imported posts) */}
            <SettingsRow
              label="Old forum"
              description={oldForumAccountText(status?.forum ?? { linked: false, username: null })}
              icon={MessageSquare}
              glyphClass="bg-fill-3 text-label-secondary"
            />

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
                  ? "Connected to Discord"
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
                    variant="ghost"
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
                  Sign in with Discord to connect
                </span>
              )}
            </SettingsRow>
          </div>
        )}
      </SettingsGroup>
    </div>
  );
}
