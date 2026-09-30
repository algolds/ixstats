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
          <Link
            href={passportUrl}
            data-cuelume-press="soft"
            className="facet-interactive flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-bold text-indigo-600 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-indigo-500/20 active:scale-[0.98] dark:text-indigo-400"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>View Public Passport</span>
          </Link>
        }
      />

      {/* Identity Card */}
      <div className="border-border/50 via-card/70 relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-500/[0.08] to-purple-500/[0.08] p-5 shadow-xs backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="border-border/60 bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border shadow-xs">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.username || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                  <User className="h-6 w-6" />
                </div>
              )}
              <div className="border-background absolute right-1 bottom-1 h-3 w-3 rounded-full border-2 bg-emerald-500 shadow-xs" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground text-base font-bold tracking-tight">
                  @{passportHandle}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
                <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {totalConnectedCount}/4 Connected
                </span>
              </div>

              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                {userProfile?.country ? (
                  <Link
                    href={countryFactbookUrl || "/mycountry"}
                    className="text-foreground flex items-center gap-1.5 font-medium hover:underline"
                  >
                    <div className="border-border/40 h-3.5 w-5 overflow-hidden rounded-[2px] border">
                      <UnifiedCountryFlag
                        countryName={userProfile.country.name}
                        flagUrl={userProfile.country.flagUrl}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span>{userProfile.country.name}</span>
                  </Link>
                ) : (
                  <Link
                    href="/setup"
                    className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
                  >
                    + Link Country
                  </Link>
                )}
                {userProfile?.membershipTier &&
                  (() => {
                    const tierInfo = formatMembershipTier(userProfile.membershipTier);
                    return (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold tracking-tight",
                          tierInfo.badgeClass
                        )}
                      >
                        {tierInfo.isPremium && <Crown className="h-2.5 w-2.5 shrink-0" />}
                        {tierInfo.label}
                      </span>
                    );
                  })()}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPassport}
              data-cuelume-press="soft"
              className="facet-interactive border-border/60 bg-card/60 text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold active:scale-[0.98]"
            >
              {copiedHandle ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="text-muted-foreground h-3.5 w-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <div className="border-border/50 bg-card/60 rounded-xl border p-0.5">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7 rounded-lg",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Account Credentials & Linked Accounts */}
      <SettingsGroup
        title="Account Credentials"
        description="Login details, security settings, and connected community accounts."
        action={
          <button
            type="button"
            onClick={() => setShowSensitive((prev) => !prev)}
            data-cuelume-press="soft"
            className="facet-interactive border-border/40 bg-card/60 text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
          >
            {showSensitive ? (
              <>
                <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
                <span>Hide</span>
              </>
            ) : (
              <>
                <Eye className="text-muted-foreground h-3.5 w-3.5" />
                <span>Show</span>
              </>
            )}
          </button>
        }
        footer="Click your avatar to change your password, turn on two-step verification, or manage active sessions."
      >
        <SettingsRow label="Username" icon={Key} glyphClass="bg-purple-500/15 text-purple-500">
          <span
            className={cn(
              "text-foreground text-xs font-semibold transition-[filter,opacity] duration-200",
              showSensitive ? "opacity-100 blur-none" : "opacity-60 blur-[4px] select-none"
            )}
          >
            {user?.username || (showSensitive ? "—" : "••••••••")}
          </span>
        </SettingsRow>

        <SettingsRow label="Primary Email" icon={Mail} glyphClass="bg-amber-500/15 text-amber-500">
          <span
            className={cn(
              "text-foreground text-xs font-semibold transition-[filter,opacity] duration-200",
              showSensitive ? "opacity-100 blur-none" : "opacity-60 blur-[4px] select-none"
            )}
          >
            {user?.emailAddresses?.[0]?.emailAddress ||
              (showSensitive ? "—" : "••••••••••••••••••••")}
          </span>
        </SettingsRow>

        {/* Linked Accounts Collapsible Row */}
        <SettingsRow
          label="Linked Accounts"
          description={
            status
              ? `${linkedServicesCount} of 3 connected (Forum, wikis, Discord)`
              : "Connect your Forum, wikis, and Discord accounts"
          }
          icon={LinkIcon}
          glyphClass="bg-indigo-500/15 text-indigo-500"
        >
          <button
            type="button"
            onClick={() => setShowLinkedAccounts((prev) => !prev)}
            data-cuelume-press="soft"
            className="facet-interactive border-border/60 bg-card/60 text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold active:scale-[0.98]"
          >
            <span>{showLinkedAccounts ? "Hide" : "Manage"}</span>
            <NavArrowDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                showLinkedAccounts ? "rotate-180" : ""
              )}
            />
          </button>
        </SettingsRow>

        {/* Expanded Linked Accounts Subsection */}
        {showLinkedAccounts && (
          <div className="divide-border/20 bg-muted/15 border-border/20 divide-y border-t">
            {/* Forum */}
            <SettingsRow
              label="Community Forum"
              description={
                status?.forum.linked
                  ? `Connected as @${status.forum.username}`
                  : "Connect your XenForo account to sync forum activity"
              }
              icon={MessageSquare}
              glyphClass="bg-orange-500/15 text-orange-500"
            >
              {status?.forum.linked ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Connected
                  </span>
                  <button
                    type="button"
                    onClick={() => unlinkForum.mutate()}
                    disabled={unlinkForum.isPending}
                    className="facet-interactive border-border/60 rounded-xl border px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/10 active:scale-[0.98] dark:text-rose-400"
                  >
                    {unlinkForum.isPending ? "Unlinking..." : "Unlink"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowForumInput((prev) => !prev)}
                  data-cuelume-press="soft"
                  className="facet-interactive border-border/60 bg-card text-foreground hover:bg-muted rounded-xl border px-3 py-1.5 text-xs font-bold active:scale-[0.98]"
                >
                  {showForumInput ? "Cancel" : "Connect"}
                </button>
              )}
            </SettingsRow>

            {showForumInput && !status?.forum.linked && (
              <div className="bg-muted/20 space-y-3 p-4">
                {/* A code on the forum profile proves the account (WK-1) */}
                <ForumAccountVerify onLinked={() => setShowForumInput(false)} />
              </div>
            )}

            {/* Wiki accounts (verified by user-page token) */}
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-blue-500/15 text-blue-500">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="text-foreground text-sm font-semibold tracking-tight">
                  Wikis
                </div>
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
              glyphClass="bg-indigo-500/15 text-indigo-500"
            >
              {status?.discord.linked ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Connected
                  </span>
                  <button
                    type="button"
                    onClick={() => unlinkDiscord.mutate()}
                    disabled={unlinkDiscord.isPending}
                    className="facet-interactive border-border/60 rounded-xl border px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/10 active:scale-[0.98] dark:text-rose-400"
                  >
                    {unlinkDiscord.isPending ? "Unlinking..." : "Unlink"}
                  </button>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs font-medium">
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
