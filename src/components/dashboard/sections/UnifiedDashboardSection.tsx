"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import Link from "next/link";
import {
  AlertTriangle,
  Newspaper,
  Users,
  TrendingUp,
  Clock,
  Shield,
  Trophy,
  Handshake,
  Rss,
  Landmark,
  BookOpen,
  MessageCircle,
  ExternalLink,
  Flame,
  MessageSquare,
  Globe,
  Eye,
} from "lucide-react";
import { Tooltip } from "~/components/ui/tooltip-card";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  staggerContainer,
  staggerItem,
} from "~/components/mycountry/primitives/tabs/TabMotionConfig";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { formatTimeAgo } from "~/lib/time-utils";
import { createUrl } from "~/lib/url-utils";
import { titleToWikiOSRoute } from "~/lib/wikios/url-compat";
import { WikiLinkPreview, ForumLinkPreview } from "~/components/wiki/WikiLinkPreview";
import { AccountCreationModal } from "~/components/thinkpages/AccountCreationModal";
import { AccountSettingsModal } from "~/components/thinkpages/AccountSettingsModal";
import { AccountManagerModal } from "~/components/thinkpages/AccountManagerModal";
import { RepostModal } from "~/components/thinkpages/RepostModal";
import { renderDiscordEmojis } from "~/lib/text-formatter";
import { sanitizeUserContent } from "~/lib/sanitize-html";

import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";
import { GlassCanvasComposer } from "~/components/thinkpages/GlassCanvasComposer";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { SimpleFlag } from "~/components/SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { useNotify } from "~/hooks/useNotify";

// ─── Config ──────────────────────────────────────────────────────

type FeedTab = "all" | "following" | "community";

const BASE_TABS: { id: FeedTab; label: string; icon: typeof Rss }[] = [
  { id: "all", label: "All Activity", icon: Rss },
  { id: "following", label: "Following", icon: Users },
  { id: "community", label: "Community", icon: BookOpen },
];

const SOURCE_CONFIG: Record<
  string,
  { icon: typeof Rss; color: string; bg: string; label: string }
> = {
  activity: { icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10", label: "IxStats" },
  thinkpages: {
    icon: Newspaper,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    label: "Social",
  },
  wiki: { icon: BookOpen, color: "text-teal-400", bg: "bg-teal-500/10", label: "Wiki" },
  forum: { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
};

const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof TrendingUp; bg: string; text: string; label: string; border: string }
> = {
  economic: {
    icon: TrendingUp,
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    label: "Economy",
    border: "text-emerald-600 border-emerald-500/30",
  },
  crisis: {
    icon: AlertTriangle,
    bg: "bg-red-500/10",
    text: "text-red-500",
    label: "Crisis",
    border: "text-red-600 border-red-500/30",
  },
  diplomatic: {
    icon: Handshake,
    bg: "bg-cyan-500/10",
    text: "text-cyan-500",
    label: "Diplomacy",
    border: "text-cyan-600 border-cyan-500/30",
  },
  military: {
    icon: Shield,
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    label: "Security",
    border: "text-orange-600 border-orange-500/30",
  },
  social: {
    icon: Rss,
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    label: "Social",
    border: "text-blue-600 border-blue-500/30",
  },
  political: {
    icon: Landmark,
    bg: "bg-purple-500/10",
    text: "text-purple-500",
    label: "Political",
    border: "text-purple-600 border-purple-500/30",
  },
  achievement: {
    icon: Trophy,
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    label: "Achievement",
    border: "text-amber-600 border-amber-500/30",
  },
  wiki: {
    icon: BookOpen,
    bg: "bg-teal-500/10",
    text: "text-teal-500",
    label: "Wiki",
    border: "text-teal-600 border-teal-500/30",
  },
  forum: {
    icon: MessageCircle,
    bg: "bg-indigo-500/10",
    text: "text-indigo-500",
    label: "Forum",
    border: "text-indigo-600 border-indigo-500/30",
  },
};

const TRENDING_SOURCE: Record<
  string,
  { icon: typeof Rss; color: string; bg: string; label: string }
> = {
  thinkpages: {
    icon: Newspaper,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    label: "Social",
  },
  forum: { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
  wiki: { icon: BookOpen, color: "text-teal-400", bg: "bg-teal-500/10", label: "Wiki" },
  ixstats: { icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10", label: "IxStats" },
  crisis: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", label: "Crisis" },
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/30",
  },
  high: {
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/30",
  },
  medium: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-500/30",
  },
  low: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
  },
};

// ─── Props ───────────────────────────────────────────────────────

interface UnifiedDashboardSectionProps {
  globalStats?: {
    totalCountries?: number;
    countryCount?: number;
    totalPopulation?: number;
    totalGdp?: number;
    globalGrowthRate?: number;
    averageGdpPerCapita?: number;
  };
}

// ─── Main Component ──────────────────────────────────────────────

export function UnifiedDashboardSection({
  globalStats: _globalStats,
}: UnifiedDashboardSectionProps) {
  const { user, isSignedIn } = useUser();
  const userId = user?.id ?? "";
  const notify = useNotify();
  const utils = api.useUtils();

  // ── Feed state ──
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<any>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isRepostModalOpen, setIsRepostModalOpen] = useState(false);
  const [repostingPost, setRepostingPost] = useState<any>(null);

  const TRENDING_LIMIT = 5;

  // ── Snapshot / World data ──
  const { data: trendingData } = api.activities.getUnifiedTrending.useQuery(
    { limit: 50 },
    { refetchInterval: 5 * 60_000 }
  );

  // ── World Economics ──
  const { data: globalStats } = api.countries.getGlobalStats.useQuery({});

  // ── Feed data ──
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
  });
  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId && userProfile.countryId.trim() !== "", retry: false }
  );
  // Fetch accounts user owns for posting
  const { data: accountsData } = api.thinkpages.getMyAccounts.useQuery(undefined, {
    enabled: !!user?.id,
  });
  const accounts = useMemo(() => accountsData || [], [accountsData]);

  const { data: feedData, isLoading: feedLoading } = api.activities.getGlobalFeed.useQuery(
    { limit: 50 },
    { refetchInterval: 30_000, staleTime: 15_000 }
  );
  const { data: wikiRecentChanges } = api.wiki.getRecentChanges.useQuery(
    { limit: 20 },
    { refetchInterval: 30_000, staleTime: 15_000 }
  );
  const hasCountry = !!userProfile?.countryId;
  const { data: followingData, isLoading: followingLoading } =
    api.activities.getFollowingFeed.useQuery(
      { limit: 30 },
      { enabled: hasCountry, refetchInterval: 30_000, staleTime: 15_000 }
    );

  // ── Auto-select account ──
  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) setSelectedAccount(accounts[0]);
  }, [accounts, selectedAccount]);

  // ── Derived data ──
  const trendingItems = useMemo(() => {
    const rawItems = trendingData?.items ?? [];
    if (rawItems.length === 0) return [];

    const nowMs = Date.now();

    const scored = rawItems.map((item: any) => {
      const { source, engagement, timestamp } = item;
      const likes = engagement?.likes ?? 0;
      const replies = engagement?.replies ?? 0;
      const reposts = engagement?.reposts ?? 0;
      const views = engagement?.views ?? 0;

      let baseInteraction = 0;
      if (source === "thinkpages") {
        baseInteraction = likes + replies * 3 + reposts * 5 + views * 0.05;
      } else if (source === "wiki") {
        const editsMatch = item.excerpt?.match(/(\d+)\s+edit/);
        const editorsMatch = item.excerpt?.match(/(\d+)\s+editor/);
        const bytesMatch = item.excerpt?.match(/([+-]?\d+)\s+bytes/);
        const edits = editsMatch ? parseInt(editsMatch[1], 10) : 1;
        const editors = editorsMatch ? parseInt(editorsMatch[1], 10) : 1;
        const bytes = bytesMatch ? Math.abs(parseInt(bytesMatch[1], 10)) : 100;
        baseInteraction =
          edits * 8 + editors * 15 + Math.min(bytes / 50, 30) + (item.isNew ? 25 : 0);
      } else if (source === "forum") {
        baseInteraction = replies * 4 + views * 0.1;
      } else {
        baseInteraction = likes * 2 + replies * 4 + reposts * 6 + views * 0.05;
      }

      const scoreBase = Math.max(1, baseInteraction);
      const ageHours = Math.max(0.1, (nowMs - new Date(timestamp).getTime()) / 3600000);
      const decayFactor = 1 / Math.pow(ageHours + 2, 1.4);
      const finalScore = scoreBase * decayFactor;

      return { ...item, computedScore: finalScore };
    });

    return scored.sort((a, b) => b.computedScore - a.computedScore).slice(0, TRENDING_LIMIT);
  }, [trendingData]);

  const isCountryDataReady =
    userProfile &&
    countryData &&
    userProfile.countryId?.trim() &&
    countryData.newStats?.name?.trim();

  const TABS = useMemo(
    () => (hasCountry ? BASE_TABS : BASE_TABS.filter((t) => t.id !== "following")),
    [hasCountry]
  );

  // ── Feed filtering ──
  const wikiAsFeed = useMemo(() => {
    if (!wikiRecentChanges) return [];
    return wikiRecentChanges.map((rc: any) => {
      const sizeChange = (rc.newLen ?? 0) - (rc.oldLen ?? 0);
      const isNewPage = rc.type === "new";
      return {
        id: `wiki-rc-${rc.title}-${rc.timestamp}`,
        type: "meta",
        category: "platform",
        source: "wiki",
        user: { id: `wiki-user-${rc.user}`, name: rc.user },
        content: {
          title: isNewPage ? `New wiki page: ${rc.title}` : `Wiki edit: ${rc.title}`,
          description: (() => {
            const s = `${sizeChange > 0 ? "+" : ""}${sizeChange} bytes`;
            if (isNewPage) return `Created new page (${s})`;
            if (!rc.comment) return `Edited page (${s})`;
            const clean = rc.comment.replace(/\/\*.*?\*\/\s*/, "").trim();
            return clean ? `${clean.slice(0, 100)} (${s})` : `Edited page (${s})`;
          })(),
          metadata: {
            source: "ixwiki",
            pageTitle: rc.title,
            wikiUrl: `https://ixwiki.com/wiki/${encodeURIComponent(rc.title.replace(/ /g, "_"))}`,
          },
        },
        engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
        timestamp: new Date(
          rc.timestamp?.replace(
            /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
            "$1-$2-$3T$4:$5:$6Z"
          ) ?? 0
        ),
        priority: isNewPage ? "medium" : "low",
        visibility: "public",
      };
    });
  }, [wikiRecentChanges]);

  const filteredFeed = useMemo(() => {
    if (activeTab === "following") return followingData?.activities ?? [];

    if (activeTab === "community") {
      const fromFeed = (feedData?.activities ?? []).filter(
        (a: any) => a.source === "wiki" || a.source === "forum"
      );
      if (fromFeed.length === 0 && wikiAsFeed.length > 0) {
        return wikiAsFeed;
      }
      const merged = [...fromFeed];
      for (const wikiItem of wikiAsFeed) {
        if (!merged.some((m) => m.id === wikiItem.id)) {
          merged.push(wikiItem);
        }
      }
      merged.sort(
        (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return merged.slice(0, 50);
    }

    if (!feedData?.activities) return [];

    const hasWiki = feedData.activities.some((a: any) => a.source === "wiki");
    if (!hasWiki && wikiAsFeed.length > 0) {
      const merged = [...feedData.activities, ...wikiAsFeed];
      merged.sort(
        (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return merged.slice(0, 50);
    }
    return feedData.activities;
  }, [feedData, followingData, wikiAsFeed, activeTab]);

  // ── ThinkPages Action Handlers ──

  const handleLike = useCallback((_postId: string) => {
    // Handled globally by PostActions
  }, []);

  const handleRepost = useCallback(
    (postId: string) => {
      if (selectedAccount) {
        const postToRepost = filteredFeed?.find(
          (a: any) => a.source === "thinkpages" && a.rawPost?.id === postId
        )?.rawPost;
        if (postToRepost) {
          setRepostingPost(postToRepost);
          setIsRepostModalOpen(true);
        } else {
          notify.error("Unable to find the original post to repost.");
        }
      } else {
        notify.error("Please select an account first");
      }
    },
    [selectedAccount, filteredFeed, notify]
  );

  const handleReply = useCallback(
    (_postId: string) => {
      if (!selectedAccount) {
        notify.error("Please select an account first");
      }
    },
    [selectedAccount, notify]
  );

  const handleShare = useCallback(
    (_postId: string) => {
      if (typeof navigator !== "undefined" && navigator.share) {
        navigator.share({
          title: "ThinkPages Post",
          text: "Check out this post on ThinkPages",
          url: window.location.href,
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        notify.success("Link copied to clipboard!");
      }
    },
    [notify]
  );

  const handleReaction = useCallback((_postId: string, _reactionType: string) => {
    // Handled globally by PostActions
  }, []);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-4 sm:space-y-6"
    >
      {/* Feed Tab Bar */}
      <motion.div variants={staggerItem}>
        <div className="border-border/50 bg-muted/30 flex gap-1 rounded-xl border p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Feed + Sidebar Grid Layout */}
      <motion.div variants={staggerItem}>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Feed stream (left 2/3) */}
          <div className="space-y-4 lg:col-span-2">
            {/* ThinkPages Composer integrated on top of the stream */}
            {activeTab !== "community" && isSignedIn && (
              <div className="mb-4">
                {!hasCountry ? (
                  <Card className="glass-hierarchy-child border-amber-500/20 bg-amber-500/5">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-start gap-2.5">
                        <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                        <div>
                          <h4 className="text-foreground text-xs font-semibold">
                            Country Setup Required to Post
                          </h4>
                          <p className="text-muted-foreground text-[11px]">
                            Claim or create a country in the setup wizard to participate in
                            ThinkPages discussion.
                          </p>
                        </div>
                      </div>
                      <Link href={"/setup"}>
                        <Button size="sm" className="h-8 shrink-0 text-xs">
                          Setup Country
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : accounts.length === 0 ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Newspaper className="h-4 w-4 shrink-0 text-purple-400" />
                      <p className="text-foreground text-xs font-medium">
                        Create a ThinkPages Account to publish posts.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowAccountCreation(true)}
                      className="h-7 shrink-0 text-xs"
                    >
                      Create Account
                    </Button>
                  </div>
                ) : selectedAccount ? (
                  <div className="space-y-2">
                    <GlassCanvasComposer
                      account={selectedAccount}
                      onAccountSelect={setSelectedAccount}
                      onPost={() => {
                        notify.success("Posted successfully!");
                        utils.activities.getGlobalFeed.refetch();
                        if (hasCountry) {
                          utils.activities.getFollowingFeed.refetch();
                        }
                      }}
                      placeholder="What's happening?"
                      countryId={userProfile?.countryId ?? ""}
                      accounts={accounts}
                      isOwner={true}
                    />
                    {accounts.length > 1 && (
                      <div className="flex items-center gap-2 px-1 text-[11px]">
                        <span className="text-muted-foreground font-normal">Posting as:</span>
                        <div className="text-foreground flex items-center gap-1.5 font-medium">
                          <span>@{selectedAccount.username}</span>
                          <span className="text-muted-foreground text-[10px] font-normal">
                            ({selectedAccount.accountType})
                          </span>
                        </div>
                        <button
                          onClick={() => setIsAccountModalOpen(true)}
                          className="ml-2 cursor-pointer text-[11px] font-semibold text-purple-400 underline hover:text-purple-300"
                        >
                          Switch Account
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-muted/20 border-border/50 h-28 animate-pulse rounded-xl border" />
                )}
              </div>
            )}

            {activeTab === "following" ? (
              <FollowingFeedContent
                activities={filteredFeed}
                isLoading={followingLoading}
                followingCount={followingData?.followingCount ?? 0}
                currentUserAccountId={selectedAccount?.id || ""}
                accounts={accounts}
                countryId={userProfile?.countryId || ""}
                isOwner={hasCountry}
                onAccountSelect={setSelectedAccount}
                onAccountSettings={(account: any) => {
                  setSettingsAccount(account);
                  setShowAccountSettings(true);
                }}
                onCreateAccount={() => setShowAccountCreation(true)}
                onLike={handleLike}
                onRepost={handleRepost}
                onReaction={handleReaction}
                onReply={handleReply}
                onShare={handleShare}
              />
            ) : (
              <UnifiedFeedContent
                activities={filteredFeed}
                isLoading={feedLoading}
                activeTab={activeTab}
                currentUserAccountId={selectedAccount?.id || ""}
                accounts={accounts}
                countryId={userProfile?.countryId || ""}
                isOwner={hasCountry}
                onAccountSelect={setSelectedAccount}
                onAccountSettings={(account: any) => {
                  setSettingsAccount(account);
                  setShowAccountSettings(true);
                }}
                onCreateAccount={() => setShowAccountCreation(true)}
                onLike={handleLike}
                onRepost={handleRepost}
                onReaction={handleReaction}
                onReply={handleReply}
                onShare={handleShare}
              />
            )}
          </div>

          {/* Sidebar (right 1/3): Community widgets */}
          <div className="space-y-4 md:sticky md:top-6 md:self-start lg:col-span-1">
            {/* Trending Now — Compact */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <Flame className="h-3 w-3 text-orange-400" />
                  Trending
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {trendingItems.length === 0 && (
                    <p className="text-muted-foreground py-6 text-center text-[11px]">
                      No trending content
                    </p>
                  )}
                  {trendingItems.map((item: any) => {
                    const src = TRENDING_SOURCE[item.source as string] ?? TRENDING_SOURCE.ixstats!;
                    const SrcIcon = src.icon;
                    const W = item.url ? "a" : "div";
                    const wp = item.url
                      ? { href: item.url, target: "_blank", rel: "noopener noreferrer" }
                      : {};

                    const wikiMatch = item.url?.match(/ixwiki\.com\/wiki\/([^#?]+)/);
                    const forumMatch = item.url?.match(
                      /forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/
                    );
                    const wikiTitle = wikiMatch
                      ? decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ")
                      : null;
                    const forumThreadId = forumMatch ? parseInt(forumMatch[1]!, 10) : null;

                    const isWiki = !!wikiTitle;
                    const isForum = !!forumThreadId;
                    const wikiHref = isWiki && wikiTitle ? titleToWikiOSRoute(wikiTitle) : null;

                    const el = (
                      <W
                        key={item.id}
                        {...(isWiki ? { href: wikiHref } : wp)}
                        className="border-border/30 hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors"
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded",
                            isWiki ? "bg-teal-500/15" : src.bg
                          )}
                        >
                          {isWiki ? (
                            <img
                              src="https://cdn.simpleicons.org/wikipedia/teal"
                              alt=""
                              className="h-2.5 w-2.5"
                            />
                          ) : (
                            <SrcIcon className={cn("h-2.5 w-2.5", src.color)} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground truncate text-[11px] font-medium">
                              {item.title}
                            </span>
                            {isForum && item.url && (
                              <ExternalLink className="text-muted-foreground h-2 w-2 shrink-0" />
                            )}
                          </div>
                          {!isWiki && (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "px-1 py-0 text-[8px]",
                                  src.color,
                                  "border-current/30"
                                )}
                              >
                                {src.label}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </W>
                    );

                    if (isWiki)
                      return (
                        <Tooltip
                          key={item.id}
                          content={<WikiPreviewContent title={wikiTitle!} wiki="ixwiki" />}
                          containerClassName="block"
                        >
                          {el}
                        </Tooltip>
                      );
                    if (isForum)
                      return (
                        <Tooltip
                          key={item.id}
                          content={<ForumPreviewContent threadId={forumThreadId!} />}
                          containerClassName="block"
                        >
                          {el}
                        </Tooltip>
                      );
                    return el;
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Countries to Explore */}
            <CountriesToExploreCard currentUserCountryId={userProfile?.countryId ?? ""} />

            {/* Blurb of the Day */}
            <BlurbOfTheDayCard />

            {/* Economic Tier Distribution */}
            {globalStats?.economicTierDistribution && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
                    <Globe className="h-3.5 w-3.5 text-emerald-500" />
                    Economic Tiers
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-1">
                    {Object.entries(globalStats.economicTierDistribution).map(([tier, count]) => (
                      <div
                        key={tier}
                        className="bg-muted/50 flex items-center gap-1 rounded px-2 py-0.5"
                      >
                        <span className="text-[10px] font-medium">{tier}</span>
                        <Badge
                          variant="secondary"
                          className="bg-background text-foreground border-border border px-1 py-0 text-[9px] font-bold"
                        >
                          {count as number}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </motion.div>

      {/* Account Modals */}
      {showAccountCreation && isCountryDataReady && (
        <AccountCreationModal
          countryId={countryData!.id}
          countryName={countryData!.name}
          existingAccountCount={accounts.length}
          isOpen={showAccountCreation}
          onClose={() => setShowAccountCreation(false)}
          onAccountCreated={() => setShowAccountCreation(false)}
        />
      )}
      {showAccountSettings && settingsAccount && (
        <AccountSettingsModal
          account={settingsAccount}
          isOpen={showAccountSettings}
          onClose={() => {
            setShowAccountSettings(false);
            setSettingsAccount(null);
          }}
          onAccountUpdate={() => {
            setShowAccountSettings(false);
            setSettingsAccount(null);
          }}
        />
      )}

      {/* Account Manager Modal */}
      <AccountManagerModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        countryId={userProfile?.countryId ?? ""}
        accounts={accounts}
        selectedAccount={selectedAccount}
        onAccountSelect={setSelectedAccount}
        onAccountSettings={(account: any) => {
          setSettingsAccount(account);
          setShowAccountSettings(true);
        }}
        onCreateAccount={() => setShowAccountCreation(true)}
        isOwner={hasCountry}
      />

      {/* Repost Modal */}
      {repostingPost && (
        <RepostModal
          open={isRepostModalOpen}
          onOpenChange={setIsRepostModalOpen}
          originalPost={repostingPost}
          countryId={userProfile?.countryId ?? ""}
          selectedAccount={selectedAccount}
          accounts={accounts}
          onAccountSelect={setSelectedAccount}
          onAccountSettings={(account: any) => {
            setSettingsAccount(account);
            setShowAccountSettings(true);
          }}
          onCreateAccount={() => setShowAccountCreation(true)}
          isOwner={hasCountry}
          onPost={() => {
            notify.success("Reposted successfully!");
            utils.activities.getGlobalFeed.refetch();
            if (hasCountry) {
              utils.activities.getFollowingFeed.refetch();
            }
            setIsRepostModalOpen(false);
            setRepostingPost(null);
          }}
        />
      )}
    </motion.div>
  );
}

// ─── Unified Feed Content ────────────────────────────────────────

function UnifiedFeedContent({
  activities,
  isLoading,
  activeTab,
  currentUserAccountId,
  accounts,
  countryId,
  isOwner,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  onLike,
  onRepost,
  onReaction,
  onReply,
  onShare,
}: {
  activities: any[];
  isLoading: boolean;
  activeTab: FeedTab;
  currentUserAccountId: string;
  accounts: any[];
  countryId: string;
  isOwner: boolean;
  onAccountSelect: (a: any) => void;
  onAccountSettings: (a: any) => void;
  onCreateAccount: () => void;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onReaction: (id: string, type: string) => void;
  onReply: (id: string) => void;
  onShare: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border/50 bg-muted/30 animate-pulse rounded-xl border p-4">
            <div className="bg-muted mb-2 h-4 w-3/4 rounded" />
            <div className="bg-muted/60 h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    );
  }
  if (activities.length === 0) {
    const label = activeTab === "community" ? "community updates" : "activity";
    return (
      <Card className="glass-hierarchy-parent">
        <CardContent className="p-8 text-center">
          <Rss className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
          <h3 className="mb-1 text-sm font-semibold">No recent {label}</h3>
          <p className="text-muted-foreground text-xs">Check back later for updates.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {activities.map((a: any) => {
        if (a.source === "thinkpages" && a.rawPost) {
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ThinkpagesPost
                post={a.rawPost}
                currentUserAccountId={currentUserAccountId}
                accounts={accounts}
                countryId={countryId}
                isOwner={isOwner}
                onAccountSelect={onAccountSelect}
                onAccountSettings={onAccountSettings}
                onCreateAccount={onCreateAccount}
                onLike={onLike}
                onRepost={onRepost}
                onReaction={onReaction}
                onReply={onReply}
                onShare={onShare}
                onAccountClick={() => {}}
                showThread={true}
              />
            </motion.div>
          );
        }
        return <UnifiedFeedItem key={a.id} activity={a} />;
      })}
    </div>
  );
}

// ─── Following Feed Content ──────────────────────────────────────

function FollowingFeedContent({
  activities,
  isLoading,
  followingCount,
  currentUserAccountId,
  accounts,
  countryId,
  isOwner,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  onLike,
  onRepost,
  onReaction,
  onReply,
  onShare,
}: {
  activities: any[];
  isLoading: boolean;
  followingCount: number;
  currentUserAccountId: string;
  accounts: any[];
  countryId: string;
  isOwner: boolean;
  onAccountSelect: (a: any) => void;
  onAccountSettings: (a: any) => void;
  onCreateAccount: () => void;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onReaction: (id: string, type: string) => void;
  onReply: (id: string) => void;
  onShare: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border/50 bg-muted/30 animate-pulse rounded-xl border p-4">
            <div className="bg-muted mb-2 h-4 w-3/4 rounded" />
            <div className="bg-muted/60 h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    );
  }
  if (followingCount === 0) {
    return (
      <Card className="glass-hierarchy-parent">
        <CardContent className="p-8 text-center">
          <Users className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
          <h3 className="mb-1 text-sm font-semibold">Not following anyone yet</h3>
          <p className="text-muted-foreground text-xs">
            Follow countries to see their activity here.
          </p>
          <Link href={"/countries"}>
            <Button size="sm" variant="outline" className="mt-3 text-xs">
              Explore Countries
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  if (activities.length === 0) {
    return (
      <Card className="glass-hierarchy-parent">
        <CardContent className="p-8 text-center">
          <Users className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
          <h3 className="mb-1 text-sm font-semibold">No recent activity</h3>
          <p className="text-muted-foreground text-xs">Countries you follow haven't posted yet.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {activities.map((a: any) => {
        if (a.source === "thinkpages" && a.rawPost) {
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ThinkpagesPost
                post={a.rawPost}
                currentUserAccountId={currentUserAccountId}
                accounts={accounts}
                countryId={countryId}
                isOwner={isOwner}
                onAccountSelect={onAccountSelect}
                onAccountSettings={onAccountSettings}
                onCreateAccount={onCreateAccount}
                onLike={onLike}
                onRepost={onRepost}
                onReaction={onReaction}
                onReply={onReply}
                onShare={onShare}
                onAccountClick={() => {}}
                showThread={true}
              />
            </motion.div>
          );
        }
        return <UnifiedFeedItem key={a.id} activity={a} />;
      })}
    </div>
  );
}

// ─── Feed Item ───────────────────────────────────────────────────

// ─── Countries to Explore ──────────────────────────────────────

// ── Wiki/Forum Preview Components (for trending tooltips) ──

function WikiPreviewContent({ title, wiki }: { title: string; wiki: "ixwiki" | "iiwiki" }) {
  const { data: intro } = api.wiki.getIntro.useQuery({ title, wiki }, { staleTime: 30 * 60_000 });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="text-foreground truncate text-sm font-semibold">{title}</span>
        <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium">
          {wiki === "ixwiki" ? "IxWiki" : "IIWiki"}
        </span>
      </div>
      {intro?.text ? (
        <p className="text-foreground/80 line-clamp-4 text-xs leading-relaxed">
          {intro.text.substring(0, 300)}
          {intro.text.length > 300 ? "…" : ""}
        </p>
      ) : (
        <div className="bg-muted h-10 animate-pulse rounded" />
      )}
    </div>
  );
}

function ForumPreviewContent({ threadId }: { threadId: number }) {
  const { data: thread } = api.wiki.getForumThreadPreview.useQuery(
    { threadId },
    { staleTime: 10 * 60_000 }
  );
  if (!thread) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <span className="text-foreground text-sm font-medium">Loading thread...</span>
        </div>
        <div className="bg-muted h-10 animate-pulse rounded" />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-violet-500" />
        <span className="text-foreground truncate text-sm font-semibold">{thread.title}</span>
      </div>
      {thread.forumName && (
        <span className="inline-block rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
          {thread.forumName}
        </span>
      )}
      {thread.excerpt && (
        <p className="text-foreground/80 line-clamp-3 text-xs leading-relaxed">
          {thread.excerpt.substring(0, 250)}
          {thread.excerpt.length > 250 ? "…" : ""}
        </p>
      )}
      <div className="text-muted-foreground flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-0.5">
          <Users className="h-2.5 w-2.5" />
          {thread.author}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageSquare className="h-2.5 w-2.5" />
          {thread.replyCount} replies
        </span>
        <span className="flex items-center gap-0.5">
          <Eye className="h-2.5 w-2.5" />
          {thread.viewCount}
        </span>
      </div>
    </div>
  );
}

function CountriesToExploreCard({ currentUserCountryId }: { currentUserCountryId: string }) {
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    setSeed(Date.now());
  }, []);
  const { data: randomCountries } = api.countries.getRandomCountries.useQuery(
    { limit: 3, _seed: seed },
    { enabled: seed > 0, staleTime: 0 }
  );
  const followerCountryId = currentUserCountryId;
  const utils = api.useUtils();
  const notify = useNotify();

  const followMutation = api.activities.followCountry.useMutation({
    onSuccess: () => {
      notify.success("Followed country!");
      utils.countries.getRandomCountries.invalidate({ limit: 3 });
    },
    onError: (err) => {
      notify.error(err.message || "Failed to follow");
    },
  });

  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  if (!randomCountries || randomCountries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-xs">
          <Users className="h-3 w-3 text-blue-400" />
          Countries to Explore
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1.5">
          {randomCountries.map((c) => {
            const isFollowed = followedIds.has(c.id);
            return (
              <div
                key={c.id}
                className="border-border/30 relative flex items-center gap-2 overflow-hidden rounded-lg border p-2"
                style={
                  c.flagUrl
                    ? {
                        backgroundImage: `linear-gradient(to right, hsl(var(--card)) 40%, transparent 70%), url(${c.flagUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "right center",
                      }
                    : undefined
                }
              >
                <div className="relative z-10 flex items-center gap-2">
                  <SimpleFlag countryName={c.name} size="sm" className="flex-shrink-0" />
                  <div className="min-w-0">
                    <Link
                      href={createUrl(`/countries/${c.slug}`)}
                      className="truncate text-[11px] font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className="text-muted-foreground border-border/40 px-1 py-0 text-[8px]"
                      >
                        Tier {c.economicTier}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="relative z-10 ml-auto">
                  <Button
                    size="sm"
                    variant={isFollowed ? "secondary" : "outline"}
                    className="h-6 shrink-0 px-2 text-[9px]"
                    disabled={!followerCountryId || followMutation.isPending}
                    onClick={() => {
                      if (isFollowed) return;
                      followMutation.mutate({
                        followerCountryId,
                        followedCountryId: c.id,
                      });
                      setFollowedIds((prev) => new Set(prev).add(c.id));
                    }}
                  >
                    {isFollowed ? "Following" : "Follow"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <Link
          href={"/countries"}
          className="text-muted-foreground hover:text-foreground mt-2 flex items-center justify-center gap-1 text-[10px] transition-colors"
        >
          <Globe className="h-3 w-3" />
          Explore all countries →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Blurb of the Day ──────────────────────────────────────────

function BlurbOfTheDayCard() {
  const { data: prompt } = api.blurbs.getRandomActivePrompt.useQuery();

  if (!prompt) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-xs">
          <MessageCircle className="h-3 w-3 text-purple-400" />
          Blurb of the Day
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="border-border/30 bg-muted/20 rounded-lg border p-2.5">
          <p className="text-foreground text-[11px] leading-relaxed italic">
            &ldquo;{prompt.question}?&rdquo;
          </p>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">
            📝 {prompt._count?.responses ?? 0} responses
          </span>
          <Link
            href={createUrl(`/thinkpages?prompt=${prompt.slug ?? prompt.id}`)}
            className="text-[10px] font-medium text-purple-500 transition-colors hover:text-purple-400"
          >
            Write Response →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Feed Item ─────────────────────────────────────────────────

function UnifiedFeedItem({ activity }: { activity: any }) {
  const source = activity.source ?? "activity";
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.activity!;
  const Icon = config.icon;
  const metadata = activity.content?.metadata ?? {};
  const externalUrl = metadata.wikiUrl ?? metadata.forumUrl;

  const titleHtml = activity.content?.title
    ? sanitizeUserContent(renderDiscordEmojis(activity.content.title))
    : "";
  const descHtml = activity.content?.description
    ? sanitizeUserContent(renderDiscordEmojis(activity.content.description))
    : "";

  return (
    <div className="group border-border/50 bg-muted/20 hover:bg-muted/40 rounded-xl border p-3 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            config.bg
          )}
        >
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="text-foreground truncate text-sm font-medium"
              dangerouslySetInnerHTML={{ __html: titleHtml }}
            />
            <Badge
              variant="outline"
              className={cn("shrink-0 text-[10px]", config.color, "border-current/30")}
            >
              {config.label}
            </Badge>
          </div>
          <p
            className="text-muted-foreground text-xs break-words whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: descHtml }}
          />
          <div className="text-muted-foreground mt-1.5 flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(new Date(activity.timestamp))}
            </span>
            {activity.user?.name && <span>by {activity.user.name}</span>}
            {externalUrl && <FeedExternalLink url={externalUrl} title={activity.content?.title} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedExternalLink({ url }: { url: string; title?: string }) {
  const wikiMatch = url.match(/ixwiki\.com\/wiki\/([^#?]+)/);
  const forumMatch = url.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
  const link = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
    >
      <ExternalLink className="h-3 w-3" />
      Open
    </a>
  );
  if (wikiMatch)
    return (
      <WikiLinkPreview title={decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ")} wiki="ixwiki">
        {link}
      </WikiLinkPreview>
    );
  if (forumMatch)
    return <ForumLinkPreview threadId={parseInt(forumMatch[1]!, 10)}>{link}</ForumLinkPreview>;
  return link;
}
