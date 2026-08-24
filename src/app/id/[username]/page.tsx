"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import {
  User,
  Component as Layers,
  Spark as Sparkles,
  Globe,
  ArrowRight,
  Crown as Gem,
  Coins,
  Settings,
  Send,
  Check,
  ShareAndroid as Share2,
  Trophy,
  FireFlame as Flame,
  Medal as Award,
  Pin as MapPin,
  Heart,
  OpenNewWindow as ExternalLink,
  Discord,
  Copy,
  Filter,
  Shield,
  Clock,
} from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { FacetCard } from "~/components/ui/facet-container";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { DashboardSidebarLayout } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { formatPopulation, formatCurrency, cn } from "~/lib/utils";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";

type ChannelType = "all" | "realms" | "wiki" | "forum" | "vault" | "thinkpages";

export default function UnifiedIxnayIdProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = use(params);
  const cleanUsername = decodeURIComponent(rawUsername).replace(/^@/, "");

  return <IxnayIdPassportCanvas cleanUsername={cleanUsername} />;
}

function IxnayIdPassportCanvas({ cleanUsername }: { cleanUsername: string }) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>("all");
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data, isLoading, error } = api.ixnayid.getUnifiedProfile.useQuery(
    { identifier: cleanUsername },
    { enabled: Boolean(cleanUsername) }
  );

  const displayName = data?.thinkpages?.displayName || data?.forum?.username || cleanUsername;
  const bio = data?.thinkpages?.bio || data?.forum?.aboutHtml || null;

  usePageTitle({
    title: `${displayName} (@${cleanUsername}) · IxnayID`,
  });

  const handleCopyHandle = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(`@${cleanUsername}`);
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    } catch {}
  };

  const handleShareLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  if (isLoading) {
    return (
      <DashboardSidebarLayout disableCollapse={true}>
        <div className="mx-auto w-full space-y-8 py-4">
          <div className="flex items-start gap-6">
            <Skeleton className="h-24 w-24 rounded-3xl shrink-0" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-8 w-64 rounded-xl" />
              <Skeleton className="h-4 w-40 rounded-lg" />
              <Skeleton className="h-16 w-full max-w-xl rounded-2xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <Skeleton className="h-10 w-full max-w-md rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-48 rounded-3xl" />
                <Skeleton className="h-48 rounded-3xl" />
              </div>
            </div>
            <div className="space-y-4 lg:col-span-4">
              <Skeleton className="h-44 rounded-3xl" />
              <Skeleton className="h-44 rounded-3xl" />
            </div>
          </div>
        </div>
      </DashboardSidebarLayout>
    );
  }

  // Not found state
  if (!data || error) {
    return (
      <DashboardSidebarLayout disableCollapse={true}>
        <div className="flex min-h-[60vh] items-center justify-center py-10">
          <FacetCard
            depth={1}
            className="relative max-w-md overflow-hidden p-8 text-center backdrop-blur-2xl border border-black/8 dark:border-white/10 shadow-2xl"
          >
            <TextureOverlay texture="noise" opacity={0.03} />
            <div className="relative z-10">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-inner">
                <User className="h-7 w-7" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight">
                Profile not found
              </h2>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed max-w-xs mx-auto">
                No account found for <span className="font-semibold text-foreground">@{cleanUsername}</span>.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  href="/countries"
                  data-cuelume-press="soft"
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.97] cursor-pointer"
                >
                  Browse nations
                </Link>
                <Link
                  href="/settings"
                  data-cuelume-press="soft"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.97] cursor-pointer"
                >
                  Settings
                </Link>
              </div>
            </div>
          </FacetCard>
        </div>
      </DashboardSidebarLayout>
    );
  }

  const isOwner = data.account.isOwner;
  const avatarUrl = data.thinkpages.avatarUrl || data.forum.avatarUrl;
  const nations = data.nations ?? [];

  return (
    <DashboardSidebarLayout disableCollapse={true}>
      <div className="w-full space-y-8 py-2 sm:py-4">
        {/* Editorial Profile Header */}
        <EditorialHeader
          cleanUsername={cleanUsername}
          displayName={displayName}
          avatarUrl={avatarUrl}
          bio={bio}
          data={data}
          nations={nations}
          isOwner={isOwner}
          copiedHandle={copiedHandle}
          copiedLink={copiedLink}
          onCopyHandle={handleCopyHandle}
          onShareLink={handleShareLink}
        />

        {/* 2-Column Main + Right Sidebar Layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main / Center Column (8 cols) */}
          <div className="space-y-8 lg:col-span-8 min-w-0">
            {/* Channel Filters */}
            <ChannelFilterBar
              selectedChannel={selectedChannel}
              onSelectChannel={setSelectedChannel}
              data={data}
              nationsCount={nations.length}
            />

            {/* Artifact Grid */}
            <ArtifactGrid
              selectedChannel={selectedChannel}
              data={data}
              nations={nations}
              cleanUsername={cleanUsername}
              displayName={displayName}
              isOwner={isOwner}
            />
          </div>

          {/* Right Sidebar Column (4 cols) — Sticky Citizen Dossier */}
          <div className="space-y-5 lg:col-span-4 lg:sticky lg:top-20 lg:self-start">
            {/* Citizen Stature Card */}
            <CitizenStatureWidget data={data} cleanUsername={cleanUsername} />

            {/* Dominions Quick Roster */}
            {nations.length > 0 && <DominionsRosterWidget nations={nations} />}

            {/* Loreward Streak & Accolades */}
            {data.wiki.lorewards && <LorewardAccoladesWidget lorewards={data.wiki.lorewards} />}

            {/* Quick Actions Card */}
            <QuickActionsWidget
              cleanUsername={cleanUsername}
              isOwner={isOwner}
              copiedLink={copiedLink}
              onShareLink={handleShareLink}
            />
          </div>
        </div>
      </div>
    </DashboardSidebarLayout>
  );
}

/* =========================================================================
   1. EDITORIAL PROFILE HEADER
   ========================================================================= */

interface EditorialHeaderProps {
  cleanUsername: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  data: any;
  nations: any[];
  isOwner: boolean;
  copiedHandle: boolean;
  copiedLink: boolean;
  onCopyHandle: () => void;
  onShareLink: () => void;
}

function EditorialHeader({
  cleanUsername,
  displayName,
  avatarUrl,
  bio,
  data,
  nations,
  isOwner,
  copiedHandle,
  copiedLink,
  onCopyHandle,
  onShareLink,
}: EditorialHeaderProps) {
  const membershipTier = data.account.membershipTier ?? "basic";
  const roleName = data.account.roleName;
  const isStaff = data.forum.isStaff;
  const joinedDate = data.account.createdAt
    ? new Date(data.account.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Top Row: Avatar, Identity, and Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
        {/* Left: Avatar + Details */}
        <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl border border-black/10 dark:border-white/15 object-cover shadow-lg"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl border border-black/10 dark:border-white/15 bg-stone-100 dark:bg-stone-800 text-2xl font-bold text-stone-700 dark:text-stone-300 shadow-md">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Verified badge */}
            <div
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-xl bg-blue-600 text-white shadow ring-2 ring-background"
              title="Verified account"
            >
              <Check className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-foreground text-2xl sm:text-3xl font-bold tracking-tight">
                {displayName}
              </h1>

              {/* Copyable handle */}
              <button
                onClick={onCopyHandle}
                data-cuelume-press="soft"
                className="group/handle inline-flex items-center gap-1.5 rounded-full border border-black/8 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] px-3 py-0.5 font-mono text-xs font-semibold text-stone-600 dark:text-stone-300 transition-all hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:scale-[0.97] cursor-pointer"
                title="Copy handle"
              >
                <span>@{cleanUsername}</span>
                {copiedHandle ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3 opacity-40 group-hover/handle:opacity-100 transition-opacity" />
                )}
              </button>

              {/* Tier badge */}
              {membershipTier !== "basic" && (
                <span className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                  membershipTier === "founder"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                )}>
                  {membershipTier}
                </span>
              )}

              {roleName && (
                <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  {roleName}
                </span>
              )}

              {isStaff && (
                <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                  Staff
                </span>
              )}
            </div>

            {/* Biography */}
            {bio ? (
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                {bio}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Community member on Ixnay.
              </p>
            )}

            {/* Metadata row */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-xs font-mono">
              {joinedDate && <span>Joined {joinedDate}</span>}
              {data.discord.linked && (
                <>
                  <span>•</span>
                  <span className="text-indigo-500 font-medium">
                    Discord: {data.discord.username ?? "linked"}
                  </span>
                </>
              )}
              {data.forum.location && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{data.forum.location}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-start">
          {isOwner ? (
            <Link
              href="/settings#ixnayid-section"
              data-cuelume-press="soft"
              className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-4 py-2 text-xs font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.97] cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </Link>
          ) : (
            <Link
              href={`/messages?user=${encodeURIComponent(cleanUsername)}`}
              data-cuelume-press="soft"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.97] cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Message</span>
            </Link>
          )}

          <button
            onClick={onShareLink}
            data-cuelume-press="soft"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-3 py-2 text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer",
              copiedLink
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary counters bar */}
      <div className="flex flex-wrap items-center gap-2 border-y border-black/6 dark:border-white/8 py-3 text-xs font-mono text-muted-foreground">
        <span className="text-[11px] uppercase tracking-wider text-stone-400 font-bold mr-1">
          Activity:
        </span>
        <span className="rounded bg-black/[0.03] dark:bg-white/[0.04] px-2 py-0.5 text-stone-900 dark:text-stone-200">
          [{nations.length} {nations.length === 1 ? "Dominion" : "Dominions"}]
        </span>
        <span className="rounded bg-black/[0.03] dark:bg-white/[0.04] px-2 py-0.5 text-stone-900 dark:text-stone-200">
          [{data.wiki.lorewards?.totalScore ?? data.wiki.editCount ?? 0} Lore points]
        </span>
        <span className="rounded bg-black/[0.03] dark:bg-white/[0.04] px-2 py-0.5 text-stone-900 dark:text-stone-200">
          [{data.forum.messageCount} Discussions]
        </span>
        <span className="rounded bg-black/[0.03] dark:bg-white/[0.04] px-2 py-0.5 text-stone-900 dark:text-stone-200">
          [{data.vault.totalCards} Cards]
        </span>
        {data.wiki.lorewards?.currentStreak ? (
          <span className="rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 font-bold flex items-center gap-1">
            <Flame className="h-3 w-3 inline" />
            {data.wiki.lorewards.currentStreak}d writing streak
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* =========================================================================
   2. CHANNEL FILTER BAR
   ========================================================================= */

interface ChannelFilterBarProps {
  selectedChannel: ChannelType;
  onSelectChannel: (channel: ChannelType) => void;
  data: any;
  nationsCount: number;
}

function ChannelFilterBar({
  selectedChannel,
  onSelectChannel,
  data,
  nationsCount,
}: ChannelFilterBarProps) {
  const channels: Array<{ id: ChannelType; label: string; count?: number }> = [
    { id: "all", label: "All" },
    { id: "realms", label: "Dominions", count: nationsCount },
    { id: "wiki", label: "Wiki & Lore", count: data.wiki.recentEdits?.length },
    { id: "forum", label: "Discussions", count: data.forum.messageCount },
    { id: "vault", label: "Cards", count: data.vault.totalCards },
    { id: "thinkpages", label: "Posts", count: data.thinkpages.postCount },
  ];

  return (
    <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1 scrollbar-none">
      <div className="flex items-center gap-1.5 p-1 rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-xl">
        {channels.map((ch) => {
          const isActive = selectedChannel === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => onSelectChannel(ch.id)}
              data-cuelume-press="soft"
              className={cn(
                "group relative flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.96] cursor-pointer",
                isActive
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
              )}
            >
              <span>{ch.label}</span>
              {ch.count !== undefined && ch.count > 0 && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.2 font-mono text-[10px]",
                    isActive
                      ? "bg-white/20 text-white dark:bg-black/20 dark:text-black"
                      : "bg-black/5 text-stone-500 dark:bg-white/10 dark:text-stone-400"
                  )}
                >
                  {ch.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-stone-400">
        <Filter className="h-3.5 w-3.5" />
        <span>Filter by category</span>
      </div>
    </div>
  );
}

/* =========================================================================
   3. ARTIFACT GRID
   ========================================================================= */

interface ArtifactGridProps {
  selectedChannel: ChannelType;
  data: any;
  nations: any[];
  cleanUsername: string;
  displayName: string;
  isOwner: boolean;
}

function ArtifactGrid({
  selectedChannel,
  data,
  nations,
  cleanUsername,
  displayName: _displayName,
  isOwner,
}: ArtifactGridProps) {
  const showRealms = selectedChannel === "all" || selectedChannel === "realms";
  const showWiki = selectedChannel === "all" || selectedChannel === "wiki";
  const showForum = selectedChannel === "all" || selectedChannel === "forum";
  const showVault = selectedChannel === "all" || selectedChannel === "vault";
  const showThinkpages = selectedChannel === "all" || selectedChannel === "thinkpages";

  return (
    <div className="space-y-12">
      {/* 1. Sovereign Realms Section */}
      {showRealms && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Dominions ({nations.length})
            </h2>
            <Link
              href="/countries"
              data-cuelume-press="soft"
              className="text-xs font-mono text-blue-500 hover:underline flex items-center gap-1"
            >
              <span>Browse all nations ↗</span>
            </Link>
          </div>

          {nations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center backdrop-blur-sm">
              <Globe className="mx-auto h-8 w-8 text-stone-400 opacity-60" />
              <h3 className="mt-2 text-xs font-semibold text-stone-700 dark:text-stone-300">
                {isOwner ? "You have not claimed any nations yet" : "No active nations"}
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground max-w-sm mx-auto">
                {isOwner
                  ? "Claim open territory in IxWorld or create your own custom realm."
                  : "This member currently holds no sovereign territory."}
              </p>
              {isOwner && (
                <div className="mt-4">
                  <Link
                    href="/countries"
                    data-cuelume-press="soft"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-4 py-2 text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95"
                  >
                    <span>Browse nations</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nations.map((nation) => (
                <div
                  key={nation.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-5 shadow-sm transition-all duration-200 hover:border-black/15 dark:hover:border-white/20 hover:shadow-lg"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0 transition-transform duration-200 group-hover:scale-105">
                          <UnifiedCountryFlag
                            countryName={nation.name}
                            size="md"
                            flagUrl={nation.flagUrl}
                            fitContainer={true}
                            rounded={true}
                            shadow={true}
                            border={true}
                            className="h-full w-full shadow-md"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm tracking-tight text-foreground truncate">
                              {nation.name.replace(/_/g, " ")}
                            </h4>
                            {nation.isFlagship && (
                              <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 font-mono text-[9px] font-semibold border border-amber-500/20">
                                Flagship
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            {nation.realmName} {nation.continent && `• ${nation.continent}`}
                          </p>
                        </div>
                      </div>

                      <span className="rounded bg-black/[0.04] dark:bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] text-stone-500">
                        Dominion
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-2 border-t border-black/4 dark:border-white/4">
                      <div>
                        <span className="text-[9px] text-stone-400 block uppercase">Pop</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          {formatPopulation(nation.currentPopulation)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-stone-400 block uppercase">GDP</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          {formatCurrency(nation.currentTotalGdp)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-stone-400 block uppercase">Per cap</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          ${Math.round(nation.currentGdpPerCapita).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Link */}
                  <div className="mt-5 pt-3 border-t border-black/4 dark:border-white/4 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      /countries/{nation.slug}
                    </span>
                    <Link
                      href={`/countries/${nation.slug}`}
                      data-cuelume-press="soft"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-stone-900 dark:text-white hover:text-blue-500 active:scale-95 transition-all cursor-pointer"
                    >
                      <span>View factbook</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. Wiki & Lore Section */}
      {showWiki && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Wiki and lore ({data.wiki.editCount} edits)
            </h2>
            {data.wiki.username && (
              <span className="text-xs font-mono text-muted-foreground">
                Author: {data.wiki.username}
              </span>
            )}
          </div>

          {/* Loreward Highlight Cards */}
          {data.wiki.lorewards && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-4">
                <span className="font-mono text-[10px] uppercase text-stone-400">Total score</span>
                <p className="mt-1 text-lg font-bold text-amber-500">
                  {data.wiki.lorewards.totalScore.toLocaleString()} pts
                </p>
              </div>
              <div className="rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-4">
                <span className="font-mono text-[10px] uppercase text-stone-400">Writing streak</span>
                <p className="mt-1 text-lg font-bold text-rose-500 flex items-center gap-1">
                  <Flame className="h-4 w-4" />
                  {data.wiki.lorewards.currentStreak} Days
                </p>
              </div>
              <div className="rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-4">
                <span className="font-mono text-[10px] uppercase text-stone-400">Rank</span>
                <p className="mt-1 text-lg font-bold text-purple-400">
                  {data.wiki.lorewards.rank ? `#${data.wiki.lorewards.rank}` : "Unranked"}
                </p>
              </div>
              <div className="rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-4">
                <span className="font-mono text-[10px] uppercase text-stone-400">Victories</span>
                <p className="mt-1 text-lg font-bold text-emerald-500">
                  {data.wiki.lorewards.dailyWins} Wins
                </p>
              </div>
            </div>
          )}

          {/* Recent Edits */}
          {data.wiki.recentEdits?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.wiki.recentEdits.slice(0, 6).map((edit: any) => (
                <div
                  key={edit.revid}
                  className="group rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-4 transition-all hover:border-black/15 dark:hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[9px] text-stone-400">
                      Rev #{edit.revid}
                    </span>
                    <span className="rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 font-mono text-[9px] font-semibold">
                      {edit.size > 0 ? `+${edit.size}B` : `${edit.size}B`}
                    </span>
                  </div>
                  <h4 className="font-semibold text-xs mt-2 text-foreground truncate">
                    {edit.title}
                  </h4>
                  <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>{formatMWTimeAgo(edit.timestamp)}</span>
                    <Link
                      href={`/wiki/${encodeURIComponent(edit.title)}`}
                      className="text-blue-500 hover:underline flex items-center gap-0.5"
                    >
                      <span>Read</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-mono text-muted-foreground">No recent wiki edits recorded.</p>
          )}
        </section>
      )}

      {/* 3. Forum Discussions Section */}
      {showForum && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Forum activity
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              {data.forum.messageCount} Messages • {data.forum.reactionScore} Reactions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-2">
              <span className="font-mono text-[10px] text-stone-400 uppercase">Trophy points</span>
              <p className="text-2xl font-bold text-foreground">{data.forum.trophyPoints}</p>
              <p className="text-[11px] text-muted-foreground">Points from community milestones and participation.</p>
            </div>

            <div className="rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-2">
              <span className="font-mono text-[10px] text-stone-400 uppercase">Reaction score</span>
              <p className="text-2xl font-bold text-pink-500">{data.forum.reactionScore}</p>
              <p className="text-[11px] text-muted-foreground">Positive reactions received across threads.</p>
            </div>
          </div>
        </section>
      )}

      {/* 4. Vault Cards Section */}
      {showVault && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Card collection ({data.vault.totalCards} cards)
            </h2>
            <Link
              href="/vault"
              data-cuelume-press="soft"
              className="text-xs font-mono text-emerald-500 hover:underline flex items-center gap-1"
            >
              <span>Marketplace ↗</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-4">
              <span className="font-mono text-[10px] uppercase text-stone-400">Deck value</span>
              <p className="mt-1 text-base font-bold text-emerald-500">
                {data.vault.deckValue.toLocaleString()} IX
              </p>
            </div>

            <div className="rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-4">
              <span className="font-mono text-[10px] uppercase text-stone-400">Collector level</span>
              <p className="mt-1 text-base font-bold text-purple-400">
                Level {data.vault.collectorLevel}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 5. ThinkPages Posts Section */}
      {showThinkpages && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Posts and bulletins ({data.thinkpages.postCount})
            </h2>
            <Link
              href={`/thinkpages?user=${encodeURIComponent(cleanUsername)}`}
              className="text-xs font-mono text-purple-500 hover:underline"
            >
              Feed ↗
            </Link>
          </div>

          <div className="rounded-3xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <h4 className="font-semibold text-xs">ThinkPages</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {data.thinkpages.bio ?? "Writer and community contributor."}
            </p>
            <div className="pt-2 flex items-center gap-4 text-xs font-mono text-stone-500">
              <span>{data.thinkpages.postCount} Posts</span>
              <span>•</span>
              <span>{data.thinkpages.followerCount} Followers</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* =========================================================================
   4. RIGHT SIDEBAR WIDGETS (Citizen Intelligence Dossier)
   ========================================================================= */

function CitizenStatureWidget({ data, cleanUsername }: { data: any; cleanUsername: string }) {
  const membershipTier = data.account.membershipTier ?? "basic";
  const roleName = data.account.roleName;

  return (
    <FacetCard
      depth={1}
      className="facet-surface relative overflow-hidden rounded-3xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between border-b border-black/4 dark:border-white/4 pb-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-400">
          Citizen Dossier
        </span>
        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 font-mono">
          @{cleanUsername}
        </span>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px]">Membership</span>
          <span className="font-semibold capitalize text-stone-800 dark:text-stone-200">
            {membershipTier}
          </span>
        </div>

        {roleName && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px]">Role</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {roleName}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px]">Forum Title</span>
          <span className="font-semibold text-stone-800 dark:text-stone-200">
            {data.forum.userTitle ?? "Citizen"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px]">Collector Rank</span>
          <span className="font-semibold text-purple-500">
            Level {data.vault.collectorLevel}
          </span>
        </div>

        {data.discord.linked && (
          <div className="flex items-center justify-between pt-2 border-t border-black/4 dark:border-white/4">
            <span className="text-muted-foreground text-[11px] flex items-center gap-1">
              <Discord className="h-3 w-3 text-indigo-500" />
              Discord
            </span>
            <span className="font-mono text-[11px] font-semibold text-indigo-500">
              {data.discord.username ?? "Linked"}
            </span>
          </div>
        )}
      </div>
    </FacetCard>
  );
}

function DominionsRosterWidget({ nations }: { nations: any[] }) {
  return (
    <FacetCard
      depth={1}
      className="facet-surface relative overflow-hidden rounded-3xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-5 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between border-b border-black/4 dark:border-white/4 pb-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-400">
          Sovereign Dominions ({nations.length})
        </span>
        <Globe className="h-3.5 w-3.5 text-stone-400" />
      </div>

      <div className="space-y-2">
        {nations.map((nation) => (
          <Link
            key={nation.id}
            href={`/countries/${nation.slug}`}
            data-cuelume-press="soft"
            className="group flex items-center justify-between rounded-xl p-2 -mx-2 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 shrink-0">
                <UnifiedCountryFlag
                  countryName={nation.name}
                  size="sm"
                  flagUrl={nation.flagUrl}
                  fitContainer={true}
                  rounded={true}
                  shadow={false}
                  className="h-full w-full"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {nation.name.replace(/_/g, " ")}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {nation.realmName}
                </p>
              </div>
            </div>
            <ArrowRight className="h-3 w-3 text-stone-400 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>
    </FacetCard>
  );
}

function LorewardAccoladesWidget({ lorewards }: { lorewards: any }) {
  return (
    <FacetCard
      depth={1}
      className="facet-surface relative overflow-hidden rounded-3xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-5 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between border-b border-black/4 dark:border-white/4 pb-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-400">
          Loreward Telemetry
        </span>
        <Trophy className="h-3.5 w-3.5 text-amber-500" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-2.5">
          <span className="text-[9px] text-stone-400 uppercase block font-mono">Streak</span>
          <span className="font-bold text-rose-500 flex items-center gap-1 mt-0.5">
            <Flame className="h-3 w-3" />
            {lorewards.currentStreak} Days
          </span>
        </div>

        <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-2.5">
          <span className="text-[9px] text-stone-400 uppercase block font-mono">Victories</span>
          <span className="font-bold text-emerald-500 mt-0.5 block">
            {lorewards.dailyWins} Wins
          </span>
        </div>
      </div>
    </FacetCard>
  );
}

function QuickActionsWidget({
  cleanUsername,
  isOwner,
  copiedLink,
  onShareLink,
}: {
  cleanUsername: string;
  isOwner: boolean;
  copiedLink: boolean;
  onShareLink: () => void;
}) {
  return (
    <div className="space-y-2">
      {!isOwner && (
        <Link
          href={`/messages?user=${encodeURIComponent(cleanUsername)}`}
          data-cuelume-press="soft"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.97] cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send message</span>
        </Link>
      )}

      <button
        onClick={onShareLink}
        data-cuelume-press="soft"
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-4 py-2.5 text-xs font-semibold text-stone-700 dark:text-stone-300 transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] cursor-pointer"
      >
        {copiedLink ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            <span>Copied link</span>
          </>
        ) : (
          <>
            <Share2 className="h-3.5 w-3.5" />
            <span>Share profile</span>
          </>
        )}
      </button>

      {isOwner && (
        <Link
          href="/settings#ixnayid-section"
          data-cuelume-press="soft"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-4 py-2.5 text-xs font-semibold text-stone-700 dark:text-stone-300 transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] cursor-pointer"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Account settings</span>
        </Link>
      )}
    </div>
  );
}
