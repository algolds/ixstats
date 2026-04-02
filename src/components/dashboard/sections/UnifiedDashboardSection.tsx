"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import Link from "next/link";
import {
  AlertTriangle, Newspaper, Users, TrendingUp, Clock, Shield, Zap,
  Mail, Trophy, Handshake, Rss, Landmark, BookOpen, MessageCircle,
  ExternalLink, Flame, MessageSquare,
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
import { LiveHeadlinesTicker } from "~/components/shared/LiveHeadlinesTicker";

// Lazy-load the heavy social platform component
const ThinkpagesSocialPlatform = dynamic(
  () =>
    import("~/components/thinkpages/ThinkpagesSocialPlatform").then((mod) => ({
      default: mod.ThinkpagesSocialPlatform,
    })),
  { ssr: false }
);

// ─── Config ──────────────────────────────────────────────────────

type FeedTab = "all" | "following" | "thinkpages" | "wiki" | "forum";

const BASE_TABS: { id: FeedTab; label: string; icon: typeof Rss }[] = [
  { id: "all", label: "All", icon: Rss },
  { id: "following", label: "Following", icon: Users },
  { id: "thinkpages", label: "Social", icon: Newspaper },
  { id: "wiki", label: "Wiki", icon: BookOpen },
  { id: "forum", label: "Forum", icon: MessageCircle },
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

  // ── Feed state ──
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<any>(null);

  // ── Snapshot data ──
  const { data: headlineData } = api.activities.getGlobalHeadlines.useQuery(
    { limit: 25 },
    { refetchInterval: 5 * 60_000 }
  );
  const { data: activityStats } = api.activities.getActivityStats.useQuery({ timeRange: "24h" });
  const { data: trendingData } = api.activities.getUnifiedTrending.useQuery(
    { limit: 8 },
    { refetchInterval: 5 * 60_000 }
  );
  const { data: crisisStats } = api.crisisEvents.getStatistics.useQuery({ timeframe: "month" });
  const { data: leaderboard } = api.diplomatic.getInfluenceLeaderboard.useQuery();
  const { data: inboxData } = api.thinkpages.getConversations.useQuery(
    { userId, limit: 20 },
    { enabled: !!userId }
  );
  const { data: activeCrisisList } = api.crisisEvents.getActive.useQuery({ limit: 10 });

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
  const trendingItems = trendingData?.items ?? [];
  const activeCrisesCount = crisisStats?.activeEvents ?? 0;
  const totalEmbassies = (leaderboard ?? []).reduce((sum: number, e: any) => sum + (e.activeEmbassies ?? 0), 0);
  const totalEvents24h = activityStats?.totalActivities ?? 0;
  const conversations = inboxData?.conversations ?? [];
  const totalUnread = conversations.reduce((sum: number, c: any) => sum + (c.unreadCount ?? 0), 0);
  const totalConversations = conversations.length;

  const isCountryDataReady =
    userProfile && countryData &&
    userProfile.countryId?.trim() &&
    countryData.id?.trim() &&
    countryData.name?.trim();

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
    if (activeTab === "wiki") {
      const fromFeed = (feedData?.activities ?? []).filter((a: any) => a.source === "wiki");
      return fromFeed.length > 0 ? fromFeed : wikiAsFeed;
    }
    if (!feedData?.activities) return [];
    if (activeTab === "all") {
      const hasWiki = feedData.activities.some((a: any) => a.source === "wiki");
      if (!hasWiki && wikiAsFeed.length > 0) {
        const merged = [...feedData.activities, ...wikiAsFeed];
        merged.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return merged.slice(0, 50);
      }
      return feedData.activities;
    }
    return feedData.activities.filter((a: any) => a.source === activeTab);
  }, [feedData, followingData, wikiAsFeed, activeTab]);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4 sm:space-y-6">
      {/* Quick Snapshot — action cards only (economy stats moved to World tab) */}
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

      {/* Live Headlines Ticker */}
      <motion.div variants={staggerItem}>
        <LiveHeadlinesTicker />
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
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
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

      {/* Feed + optional Sidebar */}
      <motion.div variants={staggerItem}>
        {activeTab === "thinkpages" ? (
          /* Social tab: full-width, no sidebar */
          <ThinkPagesTabContent
            isSignedIn={isSignedIn}
            isCountryDataReady={!!isCountryDataReady}
            countryData={countryData}
            selectedAccount={selectedAccount}
            accounts={accounts}
            onAccountSelect={setSelectedAccount}
            onAccountSettings={(account: any) => { setSettingsAccount(account); setShowAccountSettings(true); }}
            onCreateAccount={() => setShowAccountCreation(true)}
          />
        ) : (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
          {/* Feed stream (left 3/5) */}
          <div className="lg:col-span-3">
            {activeTab === "following" ? (
              <FollowingFeedContent
                activities={filteredFeed}
                isLoading={followingLoading}
                followingCount={followingData?.followingCount ?? 0}
              />
            ) : (
              <UnifiedFeedContent activities={filteredFeed} isLoading={feedLoading} activeTab={activeTab} />
            )}
          </div>

          {/* Sidebar (right 2/5): Trending + Headlines */}
          <div className="space-y-4 lg:col-span-2">
            {/* Trending Now */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                    Trending Now
                  </CardTitle>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Cross-platform</Badge>
                </div>
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
                    return (
                      <W key={item.id} {...wp} className={cn("flex items-start gap-2.5 rounded-lg border border-border/40 p-2.5 transition-colors hover:bg-muted/30", item.url && "cursor-pointer")}>
                        <span className="mt-0.5 w-3 text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                        <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded", src.bg)}>
                          <SrcIcon className={cn("h-3 w-3", src.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium">{item.title}</span>
                            {item.url && <ExternalLink className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
                          </div>
                          {item.excerpt && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{item.excerpt}</p>}
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Badge variant="outline" className={cn("px-1 py-0 text-[8px]", src.color, "border-current/30")}>{src.label}</Badge>
                            {item.engagement?.views > 0 && <span>{item.engagement.views.toLocaleString()} views</span>}
                            {item.engagement?.replies > 0 && <span>{item.engagement.replies} replies</span>}
                          </div>
                        </div>
                      </W>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* World Activity (headlines) — compact */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">World Activity</CardTitle>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{headlines.length} headlines</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                  {headlines.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No recent activity</p>}
                  {headlines.slice(0, 15).map((item: any) => {
                    const config = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.economic!;
                    const HIcon = config.icon;
                    const isCritical = item.priority === "critical";
                    const isHigh = item.priority === "high";
                    const HW = item.url ? "a" : "div";
                    const hwp = item.url ? { href: item.url, target: "_blank", rel: "noopener noreferrer" } : {};
                    const wikiMatch = item.url?.match(/ixwiki\.com\/wiki\/([^#?]+)/);
                    const forumMatch = item.url?.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
                    const wikiTitle = wikiMatch ? decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ") : null;
                    const forumThreadId = forumMatch ? parseInt(forumMatch[1]!, 10) : null;

                    const el = (
                      <HW key={item.id} {...hwp} className={cn("flex items-start gap-2 rounded-lg border p-2 transition-colors hover:bg-muted/30", isCritical ? "border-red-500/30 bg-red-500/5" : "border-border/40", item.url && "cursor-pointer")}>
                        <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", config.bg, config.text)}>
                          <HIcon className="h-2.5 w-2.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            {isCritical && <Badge variant="destructive" className="shrink-0 px-1 py-0 text-[8px]">BREAKING</Badge>}
                            {isHigh && !isCritical && <Badge variant="outline" className="shrink-0 border-amber-500/30 px-1 py-0 text-[8px] text-amber-600">ALERT</Badge>}
                            <span className={cn("text-[11px] font-medium leading-snug", isCritical && "text-red-400")}>{item.text}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Badge variant="outline" className={cn("px-1 py-0 text-[8px]", config.border)}>{config.label}</Badge>
                            <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{formatTimeAgo(new Date(item.timestamp))}</span>
                          </div>
                        </div>
                      </HW>
                    );

                    if (wikiTitle) return <WikiLinkPreview key={item.id} title={wikiTitle} wiki="ixwiki">{el}</WikiLinkPreview>;
                    if (forumThreadId) return <ForumLinkPreview key={item.id} threadId={forumThreadId}>{el}</ForumLinkPreview>;
                    return el;
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}
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
    </motion.div>
  );
}

// ─── ThinkPages Tab Content ──────────────────────────────────────

function ThinkPagesTabContent({
  isSignedIn, isCountryDataReady, countryData, selectedAccount, accounts,
  onAccountSelect, onAccountSettings, onCreateAccount,
}: {
  isSignedIn: boolean | undefined; isCountryDataReady: boolean; countryData: any;
  selectedAccount: any; accounts: any[]; onAccountSelect: (a: any) => void;
  onAccountSettings: (a: any) => void; onCreateAccount: () => void;
}) {
  if (isSignedIn && isCountryDataReady) {
    return (
      <ThinkpagesSocialPlatform
        countryId={countryData.id} countryName={countryData.name} isOwner
        selectedAccount={selectedAccount} accounts={accounts}
        onAccountSelect={onAccountSelect} onAccountSettings={onAccountSettings}
        onCreateAccount={onCreateAccount}
      />
    );
  }
  if (isSignedIn && !isCountryDataReady) {
    return (
      <Card className="glass-hierarchy-parent">
        <CardContent className="p-8 text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">Country Setup Required</h3>
          <p className="mb-4 text-sm text-muted-foreground">Complete your country setup to post and interact.</p>
          <Link href={createUrl("/setup")}><Button size="sm">Complete Setup</Button></Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <ThinkpagesSocialPlatform countryId="global" countryName="Global Community" isOwner={false} />
  );
}

// ─── Unified Feed Content ────────────────────────────────────────

function UnifiedFeedContent({ activities, isLoading, activeTab }: { activities: any[]; isLoading: boolean; activeTab: FeedTab }) {
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
    const label = activeTab === "wiki" ? "wiki edits" : activeTab === "forum" ? "forum posts" : "activity";
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
      {activities.map((a: any) => <UnifiedFeedItem key={a.id} activity={a} />)}
    </div>
  );
}

// ─── Following Feed Content ──────────────────────────────────────

function FollowingFeedContent({ activities, isLoading, followingCount }: { activities: any[]; isLoading: boolean; followingCount: number }) {
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
      {activities.map((a: any) => <UnifiedFeedItem key={a.id} activity={a} />)}
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

  return (
    <div className="group rounded-xl border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.bg)}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{activity.content?.title}</span>
            <Badge variant="outline" className={cn("shrink-0 text-[10px]", config.color, "border-current/30")}>{config.label}</Badge>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{activity.content?.description}</p>
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
