"use client";

import { motion } from "motion/react";
import {
  AlertTriangle,
  Newspaper,
  Users,
  TrendingUp,
  Clock,
  Shield,
  Zap,
  Mail,
  Trophy,
  Handshake,
  Rss,
  Landmark,
  BookOpen,
  MessageCircle,
  ExternalLink,
  Flame,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { MetricCardGrid } from "~/components/mycountry/primitives/tabs/MetricCardGrid";
import {
  staggerContainer,
  staggerItem,
} from "~/components/mycountry/primitives/tabs/TabMotionConfig";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { formatTimeAgo } from "~/lib/time-utils";
import { useDashboardSnapshotModals } from "~/hooks/useDashboardSnapshotModals";
import { InboxPreviewModal } from "~/components/dashboard/modals/InboxPreviewModal";
import { WorldEventsModal } from "~/components/dashboard/modals/WorldEventsModal";
import { DiplomaticNetworkModal } from "~/components/dashboard/modals/DiplomaticNetworkModal";
import { CrisisStatusModal } from "~/components/dashboard/modals/CrisisStatusModal";
import { WikiLinkPreview, ForumLinkPreview } from "~/components/wiki/WikiLinkPreview";

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
    label: "ThinkPages",
  },
  forum: { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
  wiki: { icon: BookOpen, color: "text-teal-400", bg: "bg-teal-500/10", label: "Wiki" },
  ixstats: { icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10", label: "IxStats" },
};

interface ActivitySectionProps {
  globalStats?: {
    totalCountries?: number;
    countryCount?: number;
    totalPopulation?: number;
    totalGdp?: number;
    globalGrowthRate?: number;
    averageGdpPerCapita?: number;
  };
}

export function ActivitySection({ globalStats }: ActivitySectionProps) {
  const { user } = useUser();
  const userId = user?.id ?? "";

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

  const { activeModal, openModal, closeModal } = useDashboardSnapshotModals();

  const headlines = headlineData?.headlines ?? [];
  const trendingItems = trendingData?.items ?? [];
  const activeCrisesCount = crisisStats?.activeEvents ?? 0;
  const totalEmbassies = (leaderboard ?? []).reduce((sum, e) => sum + (e.activeEmbassies ?? 0), 0);
  const totalEvents24h = activityStats?.totalActivities ?? 0;

  const conversations = inboxData?.conversations ?? [];
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const totalConversations = conversations.length;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-4 sm:space-y-6"
    >
      {/* World Snapshot */}
      <motion.div variants={staggerItem}>
        <MetricCardGrid
          theme="overview"
          columns={4}
          title="World Snapshot"
          subtitle="Current state of the simulation"
          metrics={[
            {
              id: "inbox",
              title: "Inbox",
              value: totalUnread > 0 ? `${totalUnread} unread` : "All caught up",
              icon: Mail,
              status: totalUnread > 0 ? "warning" : "success",
              description: `${totalConversations} conversation${totalConversations !== 1 ? "s" : ""}${totalUnread > 0 ? " · tap to view" : ""}`,
              onClick: () => openModal("inbox"),
            },
            {
              id: "world-events",
              title: "World Events",
              value: totalEvents24h.toLocaleString(),
              icon: Zap,
              description: "Events in last 24h across all nations",
              onClick: () => openModal("world-events"),
            },
            {
              id: "diplomatic-network",
              title: "Diplomatic Network",
              value: `${totalEmbassies} embassies`,
              icon: Users,
              description: `${(leaderboard ?? []).length} nations with diplomatic ties`,
              onClick: () => openModal("diplomatic-network"),
            },
            {
              id: "crisis-status",
              title: "World Stability",
              value:
                activeCrisesCount === 0
                  ? "Stable"
                  : `${activeCrisesCount} ${activeCrisesCount === 1 ? "crisis" : "crises"}`,
              icon: Shield,
              status:
                activeCrisesCount === 0 ? "success" : activeCrisesCount <= 2 ? "warning" : "error",
              description:
                activeCrisesCount === 0
                  ? "No active crises"
                  : `${crisisStats?.criticalEvents ?? 0} critical`,
              onClick: () => openModal("crisis-status"),
            },
          ]}
        />
      </motion.div>

      {/* Two-column: Feed + Trending sidebar */}
      <motion.div variants={staggerItem}>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
          {/* Global Activity Feed — powered by headline engine */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">World Activity</CardTitle>
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {headlines.length} headlines
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                {headlines.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-xs">
                    No recent activity
                  </p>
                )}
                {headlines.map((item: any) => {
                  const config = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.economic!;
                  const Icon = config.icon;
                  const isCritical = item.priority === "critical";
                  const isHigh = item.priority === "high";
                  const Wrapper = item.url ? "a" : "div";
                  const wrapperProps = item.url
                    ? { href: item.url, target: "_blank", rel: "noopener noreferrer" }
                    : {};
                  // Detect wiki/forum links for tooltip wrapping
                  const wikiMatch = item.url?.match(/ixwiki\.com\/wiki\/([^#?]+)/);
                  const iiMatch = item.url?.match(/iiwiki\.com\/wiki\/([^#?]+)/);
                  const forumMatch = item.url?.match(
                    /forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/
                  );
                  const wikiTitle = wikiMatch
                    ? decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ")
                    : iiMatch
                      ? decodeURIComponent(iiMatch[1]!).replace(/_/g, " ")
                      : null;
                  const wikiSource = wikiMatch ? ("ixwiki" as const) : ("iiwiki" as const);
                  const forumThreadId = forumMatch ? parseInt(forumMatch[1]!, 10) : null;

                  const itemContent = (
                    <Wrapper
                      key={item.id}
                      {...wrapperProps}
                      className={cn(
                        "hover:bg-muted/30 flex items-start gap-3 rounded-lg border p-2.5 transition-colors",
                        isCritical ? "border-red-500/30 bg-red-500/5" : "border-border/40",
                        item.url && "cursor-pointer"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          config.bg,
                          config.text
                        )}
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {isCritical && (
                            <Badge variant="destructive" className="shrink-0 px-1 py-0 text-[8px]">
                              BREAKING
                            </Badge>
                          )}
                          {isHigh && !isCritical && (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-amber-500/30 px-1 py-0 text-[8px] text-amber-600"
                            >
                              ALERT
                            </Badge>
                          )}
                          <span
                            className={cn(
                              "text-xs leading-snug font-medium",
                              isCritical ? "text-red-400" : ""
                            )}
                          >
                            {item.text}
                          </span>
                          {item.url && (
                            <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0" />
                          )}
                        </div>
                        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[10px]">
                          <Badge
                            variant="outline"
                            className={cn("px-1 py-0 text-[8px]", config.border)}
                          >
                            {config.label}
                          </Badge>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatTimeAgo(new Date(item.timestamp))}
                          </span>
                        </div>
                      </div>
                    </Wrapper>
                  );

                  // Wrap with tooltip if wiki/forum link detected
                  if (wikiTitle) {
                    return (
                      <WikiLinkPreview key={item.id} title={wikiTitle} wiki={wikiSource}>
                        {itemContent}
                      </WikiLinkPreview>
                    );
                  }
                  if (forumThreadId) {
                    return (
                      <ForumLinkPreview key={item.id} threadId={forumThreadId}>
                        {itemContent}
                      </ForumLinkPreview>
                    );
                  }
                  return itemContent;
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right column: Unified Trending */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                    Trending Now
                  </CardTitle>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    Cross-platform
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {trendingItems.length === 0 && (
                    <p className="text-muted-foreground py-8 text-center text-xs">
                      No trending content
                    </p>
                  )}
                  {trendingItems.map((item: any, i: number) => {
                    const sourceConfig =
                      TRENDING_SOURCE[item.source as string] ?? TRENDING_SOURCE.ixstats!;
                    const SourceIcon = sourceConfig.icon;
                    const ItemWrapper = item.url ? "a" : "div";
                    const itemProps = item.url
                      ? { href: item.url, target: "_blank", rel: "noopener noreferrer" }
                      : {};
                    return (
                      <ItemWrapper
                        key={item.id}
                        {...itemProps}
                        className={cn(
                          "border-border/40 hover:bg-muted/30 flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                          item.url && "cursor-pointer"
                        )}
                      >
                        <span className="text-muted-foreground mt-0.5 w-3 text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <div
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded",
                            sourceConfig.bg
                          )}
                        >
                          <SourceIcon className={cn("h-3 w-3", sourceConfig.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium">{item.title}</span>
                            {item.url && (
                              <ExternalLink className="text-muted-foreground h-2.5 w-2.5 shrink-0" />
                            )}
                          </div>
                          {item.excerpt && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px]">
                              {item.excerpt}
                            </p>
                          )}
                          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[10px]">
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-1 py-0 text-[8px]",
                                sourceConfig.color,
                                "border-current/30"
                              )}
                            >
                              {sourceConfig.label}
                            </Badge>
                            {item.engagement?.views > 0 && (
                              <span>{item.engagement.views.toLocaleString()} views</span>
                            )}
                            {item.engagement?.replies > 0 && (
                              <span>{item.engagement.replies} replies</span>
                            )}
                            {item.engagement?.likes > 0 && (
                              <span>{item.engagement.likes} likes</span>
                            )}
                            {item.author && <span>by {item.author}</span>}
                          </div>
                        </div>
                      </ItemWrapper>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
      {/* Snapshot Modals */}
      {activeModal === "inbox" && (
        <InboxPreviewModal
          isOpen={true}
          onClose={closeModal}
          conversations={conversations as any[]}
          totalUnread={totalUnread}
        />
      )}
      {activeModal === "world-events" && (
        <WorldEventsModal isOpen={true} onClose={closeModal} headlines={headlines} />
      )}
      {activeModal === "diplomatic-network" && (
        <DiplomaticNetworkModal
          isOpen={true}
          onClose={closeModal}
          leaderboard={(leaderboard ?? []) as any[]}
        />
      )}
      {activeModal === "crisis-status" && (
        <CrisisStatusModal
          isOpen={true}
          onClose={closeModal}
          crisisStats={crisisStats as any}
          activeCrises={(activeCrisisList ?? []) as any[]}
        />
      )}
    </motion.div>
  );
}
