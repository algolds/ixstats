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
  Search,
  SystemRestart as Loader2,
  Eye,
  EyeClosed as EyeOff,
  Check,
  Copy,
  OpenNewWindow as ExternalLink,
  ShieldCheck,
  Crown,
  Globe,
  Settings,
  Plus,
  // oxlint-disable-next-line eslint/no-unused-vars
  Clock,
} from "iconoir-react";
import type { UserResource } from "@clerk/types";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { UserButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useUserCountry } from "~/hooks/useUserCountry";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow } from "../primitives";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { formatMembershipTier } from "~/lib/tier-utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";

function formatRoleName(role?: string | null): string {
  if (!role) return "Member";
  const clean = role.replace(/^org:/i, "").replace(/[_-]/g, " ");
  if (clean.toLowerCase() === "admin") return "Admin";
  if (clean.toLowerCase() === "member") return "Member";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

interface AccountIdentityPanelProps {
  user: UserResource | null | undefined;
}

export function AccountIdentityPanel({ user }: AccountIdentityPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { userProfile } = useUserCountry();
  const { data: status } = api.ixnayid.getStatus.useQuery();

  const { organization: currentOrg } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const memberships = userMemberships?.data ?? [];

  const [showSensitive, setShowSensitive] = useState(false);
  const [showLinkedAccounts, setShowLinkedAccounts] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);

  // Forum link state
  const [showForumInput, setShowForumInput] = useState(false);
  const [forumInput, setForumInput] = useState("");
  const [forumLookup, setForumLookup] = useState<string | null>(null);

  // Wiki link state
  const [showWikiInput, setShowWikiInput] = useState(false);
  const [wikiInput, setWikiInput] = useState("");
  const [wikiLookup, setWikiLookup] = useState<{ username: string; editCount: number } | null>(
    null
  );

  // Mutations
  const linkForum = api.ixnayid.linkForum.useMutation({
    onSuccess: () => {
      notify.success("Forum account linked");
      setShowForumInput(false);
      setForumInput("");
      setForumLookup(null);
      void utils.ixnayid.getStatus.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to link Forum"),
  });

  const unlinkForum = api.ixnayid.unlinkForum.useMutation({
    onSuccess: () => {
      notify.success("Forum unlinked");
      void utils.ixnayid.getStatus.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to unlink Forum"),
  });

  const linkWiki = api.ixnayid.linkWiki.useMutation({
    onSuccess: () => {
      notify.success("Wiki account linked");
      setShowWikiInput(false);
      setWikiInput("");
      setWikiLookup(null);
      void utils.ixnayid.getStatus.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to link Wiki"),
  });

  const unlinkWiki = api.ixnayid.unlinkWiki.useMutation({
    onSuccess: () => {
      notify.success("Wiki unlinked");
      void utils.ixnayid.getStatus.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to unlink Wiki"),
  });

  const unlinkDiscord = api.ixnayid.unlinkDiscord.useMutation({
    onSuccess: () => {
      notify.success("Discord unlinked");
      void utils.ixnayid.getStatus.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to unlink Discord"),
  });

  const forumLookupQuery = api.ixnayid.lookupForumUser.useQuery(
    { username: forumInput.trim() },
    { enabled: false }
  );

  const wikiLookupQuery = api.ixnayid.lookupWikiUser.useQuery(
    { username: wikiInput.trim() },
    { enabled: false }
  );

  const handleForumLookup = async () => {
    if (!forumInput.trim()) return;
    const res = await forumLookupQuery.refetch();
    if (res.data) {
      setForumLookup(res.data.username);
    } else {
      setForumLookup(null);
      notify.error("User not found on Forum");
    }
  };

  const handleWikiLookup = async () => {
    if (!wikiInput.trim()) return;
    const res = await wikiLookupQuery.refetch();
    if (res.data) {
      setWikiLookup({ username: res.data.username, editCount: res.data.editCount });
    } else {
      setWikiLookup(null);
      notify.error("User not found on Wiki");
    }
  };

  const passportHandle =
    status?.passportHandle ||
    status?.forum?.username ||
    status?.wiki?.username ||
    (user?.username ? user.username.replace(/_$/, "") : null) ||
    user?.username ||
    "me";
  const passportUrl = `/id/@${passportHandle}`;
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
    (status?.wiki.linked ? 1 : 0) +
    (status?.discord.linked ? 1 : 0);

  const totalConnectedCount = linkedServicesCount + (userProfile?.countryId ? 1 : 0);

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="IxnayID & Digital Passport"
        category="Profile & Identity"
        description="Public passport presentation, multi-tenant realms, and connected community accounts."
        actions={
          <Link
            href={passportUrl}
            data-cuelume-press="soft"
            className="facet-interactive flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-bold text-indigo-600 transition-all hover:bg-indigo-500/20 active:scale-[0.98] dark:text-indigo-400"
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
                <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
                <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
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
                          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-tight",
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
            className="facet-interactive border-border/40 bg-card/60 text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition-all active:scale-[0.98]"
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
              ? `${linkedServicesCount} of 3 connected (Forum, MediaWiki, Discord)`
              : "Connect your Forum, MediaWiki, and Discord accounts"
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
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
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
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={forumInput}
                    onChange={(e) => {
                      setForumInput(e.target.value);
                      setForumLookup(null);
                    }}
                    placeholder="Enter Forum username..."
                    className="flex-1 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleForumLookup()}
                  />
                  <button
                    type="button"
                    onClick={handleForumLookup}
                    disabled={!forumInput.trim() || forumLookupQuery.isFetching}
                    className="facet-interactive border-border/60 bg-card text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold active:scale-[0.98] disabled:opacity-50"
                  >
                    {forumLookupQuery.isFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>Search</span>
                  </button>
                </div>

                {forumLookup && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Account found: <strong>{forumLookup}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => linkForum.mutate({ forumUsername: forumLookup })}
                      disabled={linkForum.isPending}
                      className="facet-interactive rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 active:scale-[0.98]"
                    >
                      {linkForum.isPending ? "Linking..." : "Link Account"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Wiki */}
            <SettingsRow
              label="MediaWiki"
              description={
                status?.wiki.linked
                  ? `Connected as ${status.wiki.username}`
                  : "Link a MediaWiki account to verify past edits"
              }
              icon={BookOpen}
              glyphClass="bg-blue-500/15 text-blue-500"
            >
              {status?.wiki.linked ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                    Connected
                  </span>
                  <button
                    type="button"
                    onClick={() => unlinkWiki.mutate()}
                    disabled={unlinkWiki.isPending}
                    className="facet-interactive border-border/60 rounded-xl border px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/10 active:scale-[0.98] dark:text-rose-400"
                  >
                    {unlinkWiki.isPending ? "Unlinking..." : "Unlink"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowWikiInput((prev) => !prev)}
                  data-cuelume-press="soft"
                  className="facet-interactive border-border/60 bg-card text-foreground hover:bg-muted rounded-xl border px-3 py-1.5 text-xs font-bold active:scale-[0.98]"
                >
                  {showWikiInput ? "Cancel" : "Connect"}
                </button>
              )}
            </SettingsRow>

            {showWikiInput && !status?.wiki.linked && (
              <div className="bg-muted/20 space-y-3 p-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={wikiInput}
                    onChange={(e) => {
                      setWikiInput(e.target.value);
                      setWikiLookup(null);
                    }}
                    placeholder="Enter MediaWiki username..."
                    className="flex-1 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleWikiLookup()}
                  />
                  <button
                    type="button"
                    onClick={handleWikiLookup}
                    disabled={!wikiInput.trim() || wikiLookupQuery.isFetching}
                    className="facet-interactive border-border/60 bg-card text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold active:scale-[0.98] disabled:opacity-50"
                  >
                    {wikiLookupQuery.isFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>Search</span>
                  </button>
                </div>

                {wikiLookup && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Account found: <strong>{wikiLookup.username}</strong> (
                      {wikiLookup.editCount.toLocaleString()} edits)
                    </span>
                    <button
                      type="button"
                      onClick={() => linkWiki.mutate({ wikiUsername: wikiLookup.username })}
                      disabled={linkWiki.isPending}
                      className="facet-interactive rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 active:scale-[0.98]"
                    >
                      {linkWiki.isPending ? "Linking..." : "Link Account"}
                    </button>
                  </div>
                )}
              </div>
            )}

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
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
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

      {/* Realms & Multi-Tenancy */}
      <SettingsGroup
        title="Realms"
        description="Worlds and campaigns you belong to."
        action={
          <Link
            href="/realms/new"
            data-cuelume-press="soft"
            className="facet-interactive border-border/40 bg-card/60 text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition-all active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Found Realm</span>
          </Link>
        }
      >
        <div className="divide-border/40 divide-y">
          {memberships.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="border-border bg-accent/40 text-muted-foreground mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border">
                <Globe className="h-6 w-6" />
              </div>
              <h4 className="text-foreground text-sm font-bold">No Realms Joined</h4>
              <p className="text-muted-foreground mt-1 max-w-xs text-xs">
                You haven&apos;t joined any realms yet. Found a world or accept an invitation to
                join one.
              </p>
              <Link
                href="/realms/new"
                data-cuelume-press="soft"
                className="facet-interactive bg-foreground text-background mt-4 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Found a Realm</span>
              </Link>
            </div>
          ) : (
            memberships.map((membership) => {
              const isSelected = currentOrg?.id === membership.organization.id;
              const orgLogo = membership.organization.imageUrl;
              const formattedRole = formatRoleName(membership.role);
              const isAdmin = formattedRole.toLowerCase() === "admin";
              const membersCount = membership.organization.membersCount;
              const joinDate = membership.createdAt
                ? new Date(membership.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : null;

              return (
                <div
                  key={membership.organization.id}
                  className={cn(
                    "flex flex-col gap-3 p-4 transition-all sm:flex-row sm:items-center sm:justify-between",
                    isSelected ? "bg-accent/20" : "hover:bg-muted/10"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="border-border/60 bg-muted relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border shadow-xs">
                      {orgLogo ? (
                        <img
                          src={orgLogo}
                          alt={membership.organization.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="bg-accent text-foreground flex h-full w-full items-center justify-center">
                          <Globe className="h-5 w-5" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="border-background absolute right-1 bottom-1 h-2.5 w-2.5 rounded-full border-2 bg-emerald-500 shadow-xs" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-foreground truncate text-sm font-bold">
                          {membership.organization.name}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Check className="h-2.5 w-2.5" />
                            Active Realm
                          </span>
                        )}
                        <span className="border-border/60 bg-card/60 text-muted-foreground inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold">
                          {formattedRole}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {membersCount !== undefined && (
                          <span>
                            {membersCount} {membersCount === 1 ? "member" : "members"}
                          </span>
                        )}
                        {membersCount !== undefined && joinDate && <span> · </span>}
                        {joinDate && <span>Joined {joinDate}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!isSelected && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!setActive) return;
                          try {
                            soundEffects.press();
                            await setActive({ organization: membership.organization.id });
                            notify.success(
                              `Switched active realm to ${membership.organization.name}`
                            );
                            soundEffects.ready();
                          } catch {
                            soundEffects.error();
                          }
                        }}
                        data-cuelume-press="soft"
                        className="facet-interactive border-border/60 bg-card/60 text-foreground hover:bg-muted rounded-xl border px-3 py-1.5 text-xs font-bold active:scale-[0.98]"
                      >
                        Set Active
                      </button>
                    )}
                    <Link
                      href={`/r/${membership.organization.slug || membership.organization.id}`}
                      data-cuelume-press="soft"
                      className="facet-interactive border-border/60 bg-card/60 text-foreground hover:bg-muted flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold active:scale-[0.98]"
                    >
                      <span>Go to Realm</span>
                      <ExternalLink className="text-muted-foreground h-3 w-3" />
                    </Link>
                    {isAdmin && (
                      <Link
                        href={`/r/${membership.organization.slug || membership.organization.id}/settings`}
                        data-cuelume-press="soft"
                        className="facet-interactive flex items-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-500/20 active:scale-[0.98] dark:text-indigo-400"
                      >
                        <Settings className="h-3 w-3" />
                        <span>Settings</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SettingsGroup>
    </div>
  );
}
