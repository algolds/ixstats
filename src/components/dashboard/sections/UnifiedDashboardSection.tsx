"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  AlertTriangle, Newspaper, Users, TrendingUp, Clock, Shield, Zap,
  Mail, Trophy, Handshake, Rss, Landmark, BookOpen, MessageCircle,
  ExternalLink, Flame, MessageSquare, Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { staggerContainer, staggerItem } from "~/components/mycountry/primitives/tabs/TabMotionConfig";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { formatTimeAgo } from "~/lib/time-utils";
import { createUrl } from "~/lib/url-utils";
import { useDashboardSnapshotModals } from "~/hooks/useDashboardSnapshotModals";
import { InboxPreviewModal } from "~/components/dashboard/modals/InboxPreviewModal";
import { WorldEventsModal } from "~/components/dashboard/modals/WorldEventsModal";
import { DiplomaticNetworkModal } from "~/components/dashboard/modals/DiplomaticNetworkModal";
import { CrisisStatusModal } from "~/components/dashboard/modals/CrisisStatusModal";
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
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { useNotify } from "~/hooks/useNotify";

// ─── Config ──────────────────────────────────────────────────────

type FeedTab = "all" | "following" | "community";

const BASE_TABS: { id: FeedTab; label: string; icon: typeof Rss }[] = [
  { id: "all", label: "All Activity", icon: Rss },
  { id: "following", label: "Following", icon: Users },
  { id: "community", label: "Community", icon: BookOpen },
];

const SOURCE_CONFIG: Record<string, { icon: typeof Rss; color: string; bg: string; label: string }> = {
  activity:   { icon: Rss,           color: "text-blue-400",   bg: "bg-blue-500/10",   label: "IxStats" },
  thinkpages: { icon: Newspaper,     color: "text-purple-400", bg: "bg-purple-500/10", label: "Social" },
  wiki:       { icon: BookOpen,      color: "text-teal-400",   bg: "bg-teal-500/10",   label: "Wiki" },
  forum:      { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
};

const CATEGORY_CONFIG: Record<string, { icon: typeof TrendingUp; bg: string; text: string; label: string; border: string }> = {
  economic:    { icon: TrendingUp,    bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Economy",     border: "text-emerald-600 border-emerald-500/30" },
  crisis:      { icon: AlertTriangle, bg: "bg-red-500/10",     text: "text-red-500",     label: "Crisis",      border: "text-red-600 border-red-500/30" },
  diplomatic:  { icon: Handshake,     bg: "bg-cyan-500/10",    text: "text-cyan-500",    label: "Diplomacy",   border: "text-cyan-600 border-cyan-500/30" },
  military:    { icon: Shield,        bg: "bg-orange-500/10",  text: "text-orange-500",  label: "Security",    border: "text-orange-600 border-orange-500/30" },
  social:      { icon: Rss,           bg: "bg-blue-500/10",    text: "text-blue-500",    label: "Social",      border: "text-blue-600 border-blue-500/30" },
  political:   { icon: Landmark,      bg: "bg-purple-500/10",  text: "text-purple-500",  label: "Political",   border: "text-purple-600 border-purple-500/30" },
  achievement: { icon: Trophy,        bg: "bg-amber-500/10",   text: "text-amber-500",   label: "Achievement", border: "text-amber-600 border-amber-500/30" },
  wiki:        { icon: BookOpen,      bg: "bg-teal-500/10",    text: "text-teal-500",    label: "Wiki",        border: "text-teal-600 border-teal-500/30" },
  forum:       { icon: MessageCircle, bg: "bg-indigo-500/10",  text: "text-indigo-500",  label: "Forum",       border: "text-indigo-600 border-indigo-500/30" },
};

const TRENDING_SOURCE: Record<string, { icon: typeof Rss; color: string; bg: string; label: string }> = {
  thinkpages: { icon: Newspaper,     color: "text-purple-400", bg: "bg-purple-500/10", label: "Social" },
  forum:      { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
  wiki:       { icon: BookOpen,      color: "text-teal-400",   bg: "bg-teal-500/10",   label: "Wiki" },
  ixstats:    { icon: Rss,           color: "text-blue-400",   bg: "bg-blue-500/10",   label: "IxStats" },
  crisis:     { icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-500/10",    label: "Crisis" },
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
  high: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" },
  low: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
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



export function UnifiedDashboardSection({ globalStats: _globalStats }: UnifiedDashboardSectionProps) {
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

  // ── Trending Settings States ──
  const [trendingLimit, setTrendingLimit] = useState<5 | 6 | 7>(6);
  const [trendingBias, setTrendingBias] = useState<"balanced" | "social" | "wiki" | "forum">("balanced");
  const [trendingRecency, setTrendingRecency] = useState<"hot" | "balanced" | "classic">("balanced");
  const [showTrendingSettings, setShowTrendingSettings] = useState(false);

  // ── Snapshot / World data ──
  const { data: headlineData } = api.activities.getGlobalHeadlines.useQuery(
    { limit: 25 },
    { refetchInterval: 5 * 60_000 }
  );
  const { data: activityStats } = api.activities.getActivityStats.useQuery({ timeRange: "24h" });
  const { data: trendingData } = api.activities.getUnifiedTrending.useQuery(
    { limit: 50 },
    { refetchInterval: 5 * 60_000 }
  );
  const { data: crisisStats } = api.crisisEvents.getStatistics.useQuery({ timeframe: "month" });
  const { data: leaderboard } = api.diplomatic.getInfluenceLeaderboard.useQuery();
  const { data: inboxData } = api.thinkpages.getConversations.useQuery(
    { userId, limit: 20 },
    { enabled: !!userId }
  );
  const { data: activeCrisisList } = api.crisisEvents.getActive.useQuery({ limit: 10 });

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
  const { data: accountsData } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  );
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
  const { data: followingData, isLoading: followingLoading } = api.activities.getFollowingFeed.useQuery(
    { limit: 30 },
    { enabled: hasCountry, refetchInterval: 30_000, staleTime: 15_000 }
  );

  // ── Auto-select account ──
  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) setSelectedAccount(accounts[0]);
  }, [accounts, selectedAccount]);

  // ── Snapshot modals ──
  const { activeModal, openModal, closeModal } = useDashboardSnapshotModals();

  // ── Derived data ──
  const headlines = headlineData?.headlines ?? [];
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
        
        baseInteraction = edits * 8 + editors * 15 + Math.min(bytes / 50, 30) + (item.isNew ? 25 : 0);
      } else if (source === "forum") {
        baseInteraction = replies * 4 + views * 0.1;
      } else {
        baseInteraction = likes * 2 + replies * 4 + reposts * 6 + views * 0.05;
      }

      const scoreBase = Math.max(1, baseInteraction);
      const ageHours = Math.max(0.1, (nowMs - new Date(timestamp).getTime()) / 3600000);
      
      let decayPower = 1.4;
      if (trendingRecency === "hot") decayPower = 2.0;
      else if (trendingRecency === "classic") decayPower = 0.0;

      const decayFactor = 1 / Math.pow(ageHours + 2, decayPower);

      let biasMultiplier = 1.0;
      if (trendingBias === "social" && source === "thinkpages") biasMultiplier = 1.8;
      else if (trendingBias === "wiki" && source === "wiki") biasMultiplier = 1.8;
      else if (trendingBias === "forum" && source === "forum") biasMultiplier = 1.8;

      const finalScore = scoreBase * decayFactor * biasMultiplier;

      return {
        ...item,
        computedScore: finalScore,
      };
    });

    return scored
      .sort((a, b) => b.computedScore - a.computedScore)
      .slice(0, trendingLimit);
  }, [trendingData, trendingLimit, trendingBias, trendingRecency]);

  const activeCrisesCount = crisisStats?.activeEvents ?? 0;
  const totalEmbassies = (leaderboard ?? []).reduce((sum: number, e: any) => sum + (e.activeEmbassies ?? 0), 0);
  const totalEvents24h = activityStats?.totalActivities ?? 0;
  const conversations = inboxData?.conversations ?? [];
  const totalUnread = conversations.reduce((sum: number, c: any) => sum + (c.unreadCount ?? 0), 0);
  const totalConversations = conversations.length;

  const isCountryDataReady =
    userProfile && countryData &&
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
        type: "meta", category: "platform", source: "wiki",
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
        timestamp: new Date(rc.timestamp?.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6Z") ?? 0),
        priority: isNewPage ? "medium" : "low",
        visibility: "public",
      };
    });
  }, [wikiRecentChanges]);

  const filteredFeed = useMemo(() => {
    if (activeTab === "following") return followingData?.activities ?? [];
    
    if (activeTab === "community") {
      const fromFeed = (feedData?.activities ?? []).filter((a: any) => a.source === "wiki" || a.source === "forum");
      if (fromFeed.length === 0 && wikiAsFeed.length > 0) {
        return wikiAsFeed;
      }
      const merged = [...fromFeed];
      for (const wikiItem of wikiAsFeed) {
        if (!merged.some(m => m.id === wikiItem.id)) {
          merged.push(wikiItem);
        }
      }
      merged.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return merged.slice(0, 50);
    }
    
    if (!feedData?.activities) return [];
    
    const hasWiki = feedData.activities.some((a: any) => a.source === "wiki");
    if (!hasWiki && wikiAsFeed.length > 0) {
      const merged = [...feedData.activities, ...wikiAsFeed];
      merged.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return merged.slice(0, 50);
    }
    return feedData.activities;
  }, [feedData, followingData, wikiAsFeed, activeTab]);

  // ── ThinkPages Action Handlers ──


  const handleLike = useCallback(
    (_postId: string) => {
      // Handled globally by PostActions
    },
    [],
  );

  const handleRepost = useCallback(
    (postId: string) => {
      if (selectedAccount) {
        const postToRepost = filteredFeed?.find((a: any) => a.source === "thinkpages" && a.rawPost?.id === postId)?.rawPost;
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
    [selectedAccount, filteredFeed, notify],
  );

  const handleReply = useCallback(
    (_postId: string) => {
      if (!selectedAccount) {
        notify.error("Please select an account first");
      }
    },
    [selectedAccount, notify],
  );

  const handleShare = useCallback((_postId: string) => {
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
  }, [notify]);

  const handleReaction = useCallback(
    (_postId: string, _reactionType: string) => {
      // Handled globally by PostActions
    },
    [],
  );

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4 sm:space-y-6">
      


      {/* Quick Snapshot — action cards */}
      <motion.div variants={staggerItem}>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            {
              id: "inbox", title: "Inbox", icon: Mail,
              value: totalUnread > 0 ? `${totalUnread} unread` : "All caught up",
              sub: `${totalConversations} conversations`,
              color: totalUnread > 0 ? "text-amber-500" : "text-emerald-500",
              bg: totalUnread > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
            },
            {
              id: "world-events", title: "Events", icon: Zap,
              value: totalEvents24h.toLocaleString(),
              sub: "Last 24h",
              color: "text-blue-500", bg: "bg-blue-500/10",
            },
            {
              id: "diplomatic-network", title: "Diplomacy", icon: Handshake,
              value: `${totalEmbassies} embassies`,
              sub: `${(leaderboard ?? []).length} nations`,
              color: "text-cyan-500", bg: "bg-cyan-500/10",
            },
            {
              id: "crisis-status", title: "Stability", icon: Shield,
              value: activeCrisesCount === 0 ? "Stable" : `${activeCrisesCount} crises`,
              sub: activeCrisesCount === 0 ? "No active crises" : `${crisisStats?.criticalEvents ?? 0} critical`,
              color: activeCrisesCount === 0 ? "text-emerald-500" : "text-red-500",
              bg: activeCrisesCount === 0 ? "bg-emerald-500/10" : "bg-red-500/10",
            },
          ].map((card) => {
            const CIcon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => openModal(card.id as any)}
                className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-card/50 p-2.5 text-left transition-colors hover:bg-muted/40"
              >
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", card.bg)}>
                  <CIcon className={cn("h-4 w-4", card.color)} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground">{card.title}</div>
                  <div className={cn("text-xs font-semibold", card.color)}>{card.value}</div>
                  <div className="text-[10px] text-muted-foreground/70">{card.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Feed Tab Bar */}
      <motion.div variants={staggerItem}>
        <div className="flex gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer",
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
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
          {/* Feed stream (left 3/5) */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* ThinkPages Composer integrated on top of the stream */}
            {activeTab !== "community" && isSignedIn && (
              <div className="mb-4">
                {!hasCountry ? (
                  <Card className="glass-hierarchy-child border-amber-500/20 bg-amber-500/5">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex gap-2.5 items-start">
                        <Landmark className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">Country Setup Required to Post</h4>
                          <p className="text-[11px] text-muted-foreground">Claim or create a country in the setup wizard to participate in ThinkPages discussion.</p>
                        </div>
                      </div>
                      <Link href={createUrl("/setup")}>
                        <Button size="sm" className="h-8 text-xs shrink-0">Setup Country</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : accounts.length === 0 ? (
                  <Card className="glass-hierarchy-child border-purple-500/20 bg-purple-500/5">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex gap-2.5 items-start">
                        <Newspaper className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">Create a ThinkPages Account</h4>
                          <p className="text-[11px] text-muted-foreground">Create an official government, media, or citizen account to publish posts to the public feed.</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setShowAccountCreation(true)} className="h-8 text-xs shrink-0">
                        Create Account
                      </Button>
                    </CardContent>
                  </Card>
                ) : selectedAccount ? (
                  <div className="space-y-2">
                    <GlassCanvasComposer
                      account={selectedAccount}
                      onPost={() => {
                        notify.success("Posted successfully!");
                        utils.activities.getGlobalFeed.refetch();
                        if (hasCountry) {
                          utils.activities.getFollowingFeed.refetch();
                        }
                      }}
                      placeholder="What's happening across the nations?"
                      countryId={userProfile?.countryId ?? ""}
                      accounts={accounts}
                      isOwner={true}
                    />
                    {accounts.length > 1 && (
                      <div className="flex items-center gap-2 px-1 text-[11px]">
                        <span className="text-muted-foreground font-normal">Posting as:</span>
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span>@{selectedAccount.username}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">({selectedAccount.accountType})</span>
                        </div>
                        <button
                          onClick={() => setIsAccountModalOpen(true)}
                          className="text-purple-400 hover:text-purple-300 font-semibold ml-2 underline cursor-pointer text-[11px]"
                        >
                          Switch Account
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="animate-pulse h-28 rounded-xl bg-muted/20 border border-border/50" />
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
                onAccountSettings={(account: any) => { setSettingsAccount(account); setShowAccountSettings(true); }}
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
                onAccountSettings={(account: any) => { setSettingsAccount(account); setShowAccountSettings(true); }}
                onCreateAccount={() => setShowAccountCreation(true)}
                onLike={handleLike}
                onRepost={handleRepost}
                onReaction={handleReaction}
                onReply={handleReply}
                onShare={handleShare}
              />
            )}
          </div>

          {/* Sidebar (right 2/5): Trending + World page widgets */}
          <div className="space-y-4 lg:col-span-2">
            
            {/* Trending Now */}
            <Card className="relative overflow-visible">
              <CardHeader className="pb-3 relative">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Flame className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
                    Trending Now
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowTrendingSettings(!showTrendingSettings)}
                      className={cn(
                        "rounded-md p-1 text-muted-foreground transition-all hover:bg-muted hover:text-foreground cursor-pointer",
                        showTrendingSettings && "bg-muted text-foreground"
                      )}
                      title="Trending Algorithm Controls"
                    >
                      <Shield className={cn("h-3.5 w-3.5 transition-transform duration-500", showTrendingSettings && "rotate-45 text-orange-400")} />
                    </button>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Algorithm</Badge>
                  </div>
                </div>

                {/* Sliding Glass Settings Panel */}
                <AnimatePresence>
                  {showTrendingSettings && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute inset-x-0 top-full z-[1000] mx-3 rounded-xl border border-border/50 bg-popover/95 p-3.5 shadow-xl backdrop-blur-xl"
                    >
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between border-b border-border/40 pb-1.5 font-medium text-foreground">
                          <span>Trending Settings</span>
                          <span className="text-[10px] text-muted-foreground">Adjust Curation Weights</span>
                        </div>

                        {/* Limit Selector */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Display Count</label>
                          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/50 bg-muted/20 p-0.5">
                            {([5, 6, 7] as const).map((l) => (
                              <button
                                key={l}
                                onClick={() => setTrendingLimit(l)}
                                className={cn(
                                  "rounded px-1.5 py-1 text-center font-medium transition-all text-[11px] cursor-pointer",
                                  trendingLimit === l
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {l} items
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Bias Selector */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Source Bias Weight</label>
                          <div className="grid grid-cols-4 gap-1 rounded-lg border border-border/50 bg-muted/20 p-0.5">
                            {(["balanced", "social", "wiki", "forum"] as const).map((b) => (
                              <button
                                key={b}
                                onClick={() => setTrendingBias(b)}
                                className={cn(
                                  "rounded px-1 py-1 text-center font-medium capitalize transition-all text-[10px] cursor-pointer",
                                  trendingBias === b
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {b}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Recency Selector */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Recency Decay Bias</label>
                          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/50 bg-muted/20 p-0.5">
                            {(["hot", "balanced", "classic"] as const).map((r) => (
                              <button
                                key={r}
                                onClick={() => setTrendingRecency(r)}
                                className={cn(
                                  "rounded px-1.5 py-1 text-center font-medium capitalize transition-all text-[10px] cursor-pointer",
                                  trendingRecency === r
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {trendingItems.length === 0 && (
                    <p className="py-8 text-center text-xs text-muted-foreground">No trending content</p>
                  )}
                  {trendingItems.map((item: any, i: number) => {
                    const src = TRENDING_SOURCE[item.source as string] ?? TRENDING_SOURCE.ixstats!;
                    const SrcIcon = src.icon;
                    const W = item.url ? "a" : "div";
                    const wp = item.url ? { href: item.url, target: "_blank", rel: "noopener noreferrer" } : {};

                    const wikiMatch = item.url?.match(/ixwiki\.com\/wiki\/([^#?]+)/);
                    const forumMatch = item.url?.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
                    const wikiTitle = wikiMatch ? decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ") : null;
                    const forumThreadId = forumMatch ? parseInt(forumMatch[1]!, 10) : null;

                    const el = (
                      <W key={item.id} {...wp} className={cn("flex items-start gap-2.5 rounded-lg border border-border/40 p-2.5 transition-all duration-200 hover:glass-hierarchy-interactive hover:bg-muted/40 cursor-pointer shadow-xs hover:scale-[1.01]")}>
                        <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded", src.bg)}>
                          <SrcIcon className={cn("h-3 w-3", src.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium text-foreground">{item.title}</span>
                            {item.url && <ExternalLink className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
                          </div>
                          {item.excerpt && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{item.excerpt}</p>}
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Badge variant="outline" className={cn("px-1 py-0 text-[8px]", src.color, "border-current/30")}>{src.label}</Badge>
                            {item.engagement?.views > 0 && <span>{item.engagement.views.toLocaleString()} views</span>}
                            {item.engagement?.replies > 0 && <span>{item.engagement.replies} replies</span>}
                            {item.computedScore && <span className="text-[9px] text-muted-foreground/60">Hotness: {Math.round(item.computedScore * 10) / 10}</span>}
                          </div>
                        </div>
                      </W>
                    );

                    if (wikiTitle) return <WikiLinkPreview key={item.id} title={wikiTitle} wiki="ixwiki">{el}</WikiLinkPreview>;
                    if (forumThreadId) return <ForumLinkPreview key={item.id} threadId={forumThreadId}>{el}</ForumLinkPreview>;
                    return el;
                  })}
                </div>
              </CardContent>
            </Card>




            {/* Economic Tier Distribution */}
            {globalStats?.economicTierDistribution && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-emerald-500" />
                    Economic Tiers
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    {Object.entries(globalStats.economicTierDistribution).map(([tier, count]) => (
                      <div key={tier} className="flex items-center gap-1 rounded bg-muted/50 px-2 py-0.5">
                        <span className="text-[10px] font-medium">{tier}</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 font-bold bg-background text-foreground border border-border">
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

      {/* Snapshot Modals */}
      {activeModal === "inbox" && <InboxPreviewModal isOpen onClose={closeModal} conversations={conversations as any[]} totalUnread={totalUnread} />}
      {activeModal === "world-events" && <WorldEventsModal isOpen onClose={closeModal} headlines={headlines} />}
      {activeModal === "diplomatic-network" && <DiplomaticNetworkModal isOpen onClose={closeModal} leaderboard={(leaderboard ?? []) as any[]} />}
      {activeModal === "crisis-status" && <CrisisStatusModal isOpen onClose={closeModal} crisisStats={crisisStats as any} activeCrises={(activeCrisisList ?? []) as any[]} />}

      {/* Account Modals */}
      {showAccountCreation && isCountryDataReady && (
        <AccountCreationModal countryId={countryData!.id} countryName={countryData!.name} existingAccountCount={accounts.length} isOpen={showAccountCreation} onClose={() => setShowAccountCreation(false)} onAccountCreated={() => setShowAccountCreation(false)} />
      )}
      {showAccountSettings && settingsAccount && (
        <AccountSettingsModal account={settingsAccount} isOpen={showAccountSettings} onClose={() => { setShowAccountSettings(false); setSettingsAccount(null); }} onAccountUpdate={() => { setShowAccountSettings(false); setSettingsAccount(null); }} />
      )}

      {/* Account Manager Modal */}
      <AccountManagerModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        countryId={userProfile?.countryId ?? ""}
        accounts={accounts}
        selectedAccount={selectedAccount}
        onAccountSelect={setSelectedAccount}
        onAccountSettings={(account: any) => { setSettingsAccount(account); setShowAccountSettings(true); }}
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
          onAccountSettings={(account: any) => { setSettingsAccount(account); setShowAccountSettings(true); }}
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
          <div key={i} className="animate-pulse rounded-xl border border-border/50 bg-muted/30 p-4">
            <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted/60" />
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
          <Rss className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-1 text-sm font-semibold">No recent {label}</h3>
          <p className="text-xs text-muted-foreground">Check back later for updates.</p>
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
          <div key={i} className="animate-pulse rounded-xl border border-border/50 bg-muted/30 p-4">
            <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted/60" />
          </div>
        ))}
      </div>
    );
  }
  if (followingCount === 0) {
    return (
      <Card className="glass-hierarchy-parent">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-1 text-sm font-semibold">Not following anyone yet</h3>
          <p className="text-xs text-muted-foreground">Follow countries to see their activity here.</p>
          <Link href={createUrl("/countries")}><Button size="sm" variant="outline" className="mt-3 text-xs">Explore Countries</Button></Link>
        </CardContent>
      </Card>
    );
  }
  if (activities.length === 0) {
    return (
      <Card className="glass-hierarchy-parent">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-1 text-sm font-semibold">No recent activity</h3>
          <p className="text-xs text-muted-foreground">Countries you follow haven't posted yet.</p>
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
    <div className="group rounded-xl border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.bg)}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground" dangerouslySetInnerHTML={{ __html: titleHtml }} />
            <Badge variant="outline" className={cn("shrink-0 text-[10px]", config.color, "border-current/30")}>{config.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: descHtml }} />
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTimeAgo(new Date(activity.timestamp))}</span>
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
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground">
      <ExternalLink className="h-3 w-3" />Open
    </a>
  );
  if (wikiMatch) return <WikiLinkPreview title={decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ")} wiki="ixwiki">{link}</WikiLinkPreview>;
  if (forumMatch) return <ForumLinkPreview threadId={parseInt(forumMatch[1]!, 10)}>{link}</ForumLinkPreview>;
  return link;
}
