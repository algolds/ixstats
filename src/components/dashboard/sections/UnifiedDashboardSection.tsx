// @ts-nocheck
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

import { motion } from "motion/react";
import Link from "next/link";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
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
  Map as MapIcon,
  ChevronDown,
  Settings,
  X,
} from "lucide-react";
import { Tooltip } from "~/components/ui/tooltip-card";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
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

import { FeedPollWidget } from "~/components/ui/FeedPollWidget";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";
import { GlassCanvasComposer } from "~/components/thinkpages/GlassCanvasComposer";
import { SimpleFlag } from "~/components/SimpleFlag";
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
  activity: { icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10", label: "Activity" },
  thinkpages: {
    icon: Newspaper,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    label: "Social",
  },
  wiki: { icon: BookOpen, color: "text-teal-400", bg: "bg-teal-500/10", label: "Wiki" },
  forum: { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
};

// Contextual label for IxStats activities based on metadata/category
function getActivityLabel(activity: any): {
  label: string;
  icon: typeof Rss;
  color: string;
  bg: string;
} {
  const cat = activity.category ?? activity.content?.metadata?.category ?? "";
  const title = (activity.content?.title ?? "").toLowerCase();
  // Specific map feature types (check before generic "map")
  if (title.includes("point of interest") || title.includes("poi"))
    return { label: "POI", icon: MapIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (title.includes("city") || title.includes("settlement"))
    return { label: "City", icon: MapIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (
    title.includes("subdivision") ||
    title.includes("province") ||
    title.includes("state") ||
    title.includes("region")
  )
    return {
      label: "Subdivision",
      icon: MapIcon,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    };
  if (cat === "map" || title.includes("map") || title.includes("claim"))
    return { label: "Maps", icon: MapIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (
    cat === "economic" ||
    title.includes("gdp") ||
    title.includes("econom") ||
    title.includes("trade")
  )
    return {
      label: "Economy",
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    };
  if (
    cat === "diplomatic" ||
    title.includes("embassy") ||
    title.includes("diplom") ||
    title.includes("treaty")
  )
    return { label: "Diplomacy", icon: Globe, color: "text-cyan-400", bg: "bg-cyan-500/10" };
  if (
    cat === "military" ||
    title.includes("military") ||
    title.includes("defense") ||
    title.includes("deploy")
  )
    return { label: "Defense", icon: Shield, color: "text-red-400", bg: "bg-red-500/10" };
  if (
    cat === "political" ||
    title.includes("govern") ||
    title.includes("politic") ||
    title.includes("election")
  )
    return { label: "Politics", icon: Landmark, color: "text-purple-400", bg: "bg-purple-500/10" };
  if (cat === "crisis" || title.includes("crisis"))
    return { label: "Crisis", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" };
  if (cat === "achievement" || title.includes("tier") || title.includes("achieve"))
    return { label: "Achievement", icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/10" };
  return { label: "Activity", icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10" };
}

// Group consecutive wiki edits to the same page
function groupWikiEdits(activities: any[]): any[] {
  const result: any[] = [];
  let i = 0;
  while (i < activities.length) {
    const a = activities[i];
    if (a.source === "wiki" && a.content?.metadata?.pageTitle) {
      const pageTitle = a.content.metadata.pageTitle;
      const group = [a];
      let j = i + 1;
      // Collect consecutive edits to same page
      while (j < activities.length) {
        const b = activities[j];
        if (b.source === "wiki" && b.content?.metadata?.pageTitle === pageTitle) {
          group.push(b);
          j++;
        } else {
          break;
        }
      }
      if (group.length > 1) {
        // Build a condensed entry
        const editors = new Set(group.map((g: any) => g.user?.name).filter(Boolean));
        const totalBytes = group.reduce((sum: number, g: any) => {
          const desc = g.content?.description ?? "";
          const match = desc.match(/([+-]?\d+)\s+bytes/);
          return sum + (match ? parseInt(match[1], 10) : 0);
        }, 0);
        const isNew = group.some((g: any) => g.content?.title?.startsWith("New wiki page"));
        result.push({
          ...group[0],
          id: `wiki-grouped-${pageTitle}`,
          content: {
            ...group[0].content,
            title: isNew ? `New wiki page: ${pageTitle}` : pageTitle,
          },
          _grouped: true,
          _editCount: group.length,
          _editors: Array.from(editors),
          _totalBytes: totalBytes,
          _subEdits: group,
          _isNew: isNew,
        });
      } else {
        result.push(a);
      }
      i = j;
    } else {
      result.push(a);
      i++;
    }
  }
  return result;
}

// Group repeated IxStats activities of the same type by the same user within a time window
const ACTIVITY_GROUP_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

function groupRepeatedActivities(activities: any[]): any[] {
  const result: any[] = [];
  let i = 0;
  while (i < activities.length) {
    const a = activities[i];
    // Only group source=activity (not wiki, thinkpages, forum)
    if (a.source === "activity") {
      // Group by country (or user if no country) + label
      const groupKey = a.user?.countryName ?? a.user?.countryId ?? a.user?.name ?? a.user?.id ?? "";
      const displayName = a.user?.countryName ?? a.user?.name ?? "unknown";
      const label = getActivityLabel(a).label;
      const aTime = new Date(a.timestamp).getTime();
      const group = [a];
      let j = i + 1;
      // Collect consecutive activities with same user + label within window
      while (j < activities.length) {
        const b = activities[j];
        if (
          b.source === "activity" &&
          (b.user?.countryName ?? b.user?.countryId ?? b.user?.name ?? b.user?.id ?? "") ===
            groupKey &&
          getActivityLabel(b).label === label &&
          Math.abs(new Date(b.timestamp).getTime() - aTime) < ACTIVITY_GROUP_WINDOW_MS
        ) {
          group.push(b);
          j++;
        } else {
          break;
        }
      }
      if (group.length > 1) {
        const titles = group.map((g: any) => g.content?.title ?? "").filter(Boolean);
        const groupLabel = getActivityLabel(a).label;
        result.push({
          ...group[0],
          id: `activity-grouped-${groupKey}-${label}-${i}`,
          content: {
            ...group[0].content,
            title: `${group.length} ${groupLabel} updates`,
          },
          _grouped: true,
          _editCount: group.length,
          _editors: [displayName],
          _totalBytes: 0,
          _subEdits: group,
          _groupLabel: groupLabel,
          _subTitles: titles,
        });
      } else {
        result.push(a);
      }
      i = j;
    } else {
      result.push(a);
      i++;
    }
  }
  return result;
}

const _CATEGORY_CONFIG: Record<
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

const _SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
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
  const _userId = user?.id ?? "";
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
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("ixstats:dismissed:thinkpages-notice") === "true";
      setIsNoticeDismissed(dismissed);
    }
  }, []);

  const handleDismissNotice = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ixstats:dismissed:thinkpages-notice", "true");
    }
    setIsNoticeDismissed(true);
  };

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
    let raw: any[] = [];
    if (activeTab === "following") {
      raw = followingData?.activities ?? [];
    } else if (activeTab === "community") {
      const fromFeed = (feedData?.activities ?? []).filter(
        (a: any) => a.source === "wiki" || a.source === "forum"
      );
      if (fromFeed.length === 0 && wikiAsFeed.length > 0) {
        raw = wikiAsFeed;
      } else {
        const merged = [...fromFeed];
        for (const wikiItem of wikiAsFeed) {
          if (!merged.some((m) => m.id === wikiItem.id)) {
            merged.push(wikiItem);
          }
        }
        merged.sort(
          (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        raw = merged.slice(0, 50);
      }
    } else {
      if (!feedData?.activities) {
        raw = [];
      } else {
        const hasWiki = feedData.activities.some((a: any) => a.source === "wiki");
        if (!hasWiki && wikiAsFeed.length > 0) {
          const merged = [...feedData.activities, ...wikiAsFeed];
          merged.sort(
            (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          raw = merged.slice(0, 50);
        } else {
          raw = feedData.activities;
        }
      }
    }
    // Group consecutive wiki edits, then group repeated IxStats activities
    return groupRepeatedActivities(groupWikiEdits(raw));
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
      {/* Feed + Sidebar Grid Layout */}
      <motion.div variants={staggerItem}>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Feed stream (left 2/3) */}
          <div className="space-y-4 lg:col-span-2">
            {/* Feed Tab Bar */}
            <motion.div variants={staggerItem}>
              <div className="glass-surface glass-refraction relative flex gap-1 rounded-xl p-1">
                {/* Sliding indicator behind active tab */}
                <motion.div
                  className="absolute inset-y-1 rounded-lg bg-white/8"
                  layout
                  layoutId="feed-tab-indicator"
                  style={{
                    width: `${100 / TABS.length}%`,
                    left: `${(TABS.findIndex((t) => t.id === activeTab) / TABS.length) * 100}%`,
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-200",
                        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 transition-colors duration-200",
                          isActive && "text-indigo-400"
                        )}
                      />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </motion.button>
                  );
                })}
                {/* Settings gear */}
                <button
                  onClick={() => setIsAccountModalOpen(true)}
                  className="text-muted-foreground hover:text-foreground relative z-10 flex shrink-0 cursor-pointer items-center justify-center rounded-lg p-2 transition-colors hover:bg-white/5"
                  title="Feed & Account Settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>

            {/* ThinkPages Account Creation Dismissible Notice */}
            {isSignedIn && hasCountry && accounts.length === 0 && !isNoticeDismissed && (
              <motion.div
                variants={staggerItem}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-surface glass-refraction flex items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4"
              >
                <div className="flex items-center gap-2.5">
                  <Newspaper className="h-4.5 w-4.5 shrink-0 text-purple-400" />
                  <div>
                    <p className="text-foreground text-xs font-medium">
                      Create a ThinkPages Account to publish posts.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setShowAccountCreation(true)}
                    className="h-7 shrink-0 text-xs"
                  >
                    Create Account
                  </Button>
                  <button
                    onClick={handleDismissNotice}
                    className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors hover:bg-white/5"
                    title="Dismiss notice"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
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
                ) : accounts.length === 0 ? null : selectedAccount ? (
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
            <CutoutCard
              className={cn(
                cutoutCardSurfaceClassName,
                "no-wiki-tooltip overflow-hidden rounded-xl"
              )}
              trackPointerHover={false}
            >
              {/* Cutout tab header */}
              <div className="relative bg-orange-500/10 px-4 pt-3 pb-5">
                <div className="text-card-foreground flex items-center gap-2 text-sm font-bold">
                  <Flame className="h-4.5 w-4.5 text-orange-400" />
                  Trending
                </div>
                <CutoutCorner className="text-card absolute -bottom-px left-0" size={20} />
                <CutoutCorner
                  className="text-card absolute right-0 -bottom-px -scale-x-100"
                  size={20}
                />
              </div>
              <CutoutCardContent className="space-y-3 px-4 pt-0 pb-4">
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

                {/* Blurb of the Day — integrated */}
                <BlurbSection />
              </CutoutCardContent>
            </CutoutCard>

            {/* Countries to Explore */}
            <CountriesToExploreCard currentUserCountryId={userProfile?.countryId ?? ""} />

            {/* Economic Tier Distribution */}
            {globalStats?.economicTierDistribution && (
              <CutoutCard
                className={cn(cutoutCardSurfaceClassName, "overflow-hidden rounded-xl")}
                trackPointerHover={false}
              >
                {/* Cutout tab header */}
                <div className="relative bg-emerald-500/10 px-4 pt-3 pb-5">
                  <div className="text-card-foreground flex items-center gap-2 text-sm font-bold">
                    <Globe className="h-4.5 w-4.5 text-emerald-500" />
                    Economic Tiers
                  </div>
                  <CutoutCorner className="text-card absolute -bottom-px left-0" size={20} />
                  <CutoutCorner
                    className="text-card absolute right-0 -bottom-px -scale-x-100"
                    size={20}
                  />
                </div>
                <CutoutCardContent className="px-4 pt-0 pb-4">
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
                </CutoutCardContent>
              </CutoutCard>
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
      <Card className="glass-surface glass-refraction border-border/40">
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
      <Card className="glass-surface glass-refraction border-border/40">
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
      <Card className="glass-surface glass-refraction border-border/40">
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
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "overflow-hidden rounded-xl")}
      trackPointerHover={false}
    >
      {/* Cutout tab header */}
      <div className="relative bg-blue-500/10 px-4 pt-3 pb-5">
        <div className="text-card-foreground flex items-center gap-2 text-sm font-bold">
          <Users className="h-4.5 w-4.5 text-blue-400" />
          Countries to Explore
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={20} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={20} />
      </div>
      <CutoutCardContent className="px-4 pt-0 pb-4">
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
                  <SimpleFlag countryName={c.name} size="sm" className="shrink-0" />
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
      </CutoutCardContent>
    </CutoutCard>
  );
}

// ─── Blurb of the Day ──────────────────────────────────────────

function BlurbSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: prompt } = api.blurbs.getRandomActivePrompt.useQuery();

  if (!prompt) return null;

  return (
    <>
      <div className="border-border/20 border-t pt-2.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <MessageCircle className="h-3 w-3 text-purple-400" />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Blurb of the Day
          </span>
        </div>
        <div className="border-border/30 bg-muted/20 rounded-lg border p-2.5">
          <p className="text-foreground text-[11px] leading-relaxed italic">
            &ldquo;{prompt.question}?&rdquo;
          </p>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">
            📝 {prompt._count?.responses ?? 0} responses
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="cursor-pointer text-[10px] font-medium text-purple-500 transition-colors hover:text-purple-400"
          >
            Write Response →
          </button>
        </div>
      </div>

      <BlurbResponseModal open={modalOpen} onClose={() => setModalOpen(false)} prompt={prompt} />
    </>
  );
}

function BlurbResponseModal({
  open,
  onClose,
  prompt,
}: {
  open: boolean;
  onClose: () => void;
  prompt: {
    id: string;
    title?: string;
    question: string;
    slug?: string;
    _count?: { responses: number };
  };
}) {
  const {
    data: responsesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.blurbs.getResponsesForPrompt.useInfiniteQuery(
    { promptId: prompt.id, limit: 8, featuredFirst: true },
    {
      enabled: open,
      getNextPageParam: (lastPage: any) => lastPage.nextCursor,
    }
  );

  const responses = responsesData?.pages.flatMap((p: any) => p.responses) ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-border/30 border-b px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
              <MessageCircle className="h-4 w-4 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold">
                {prompt.title ?? "Blurb of the Day"}
              </DialogTitle>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                {prompt.question}
              </p>
              <Badge variant="secondary" className="mt-1.5 text-[10px]">
                {prompt._count?.responses ?? 0}{" "}
                {(prompt._count?.responses ?? 0) === 1 ? "response" : "responses"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Responses */}
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-3">
          {responses.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-xs">
              No responses yet. Be the first!
            </p>
          )}
          {responses.map((r: any) => (
            <div
              key={r.id}
              className={cn(
                "rounded-lg border p-3",
                r.featured ? "border-amber-500/30 bg-amber-500/5" : "border-border/30"
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                {r.country?.flag && (
                  <img src={r.country.flag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                )}
                <span className="text-foreground text-xs font-medium">
                  {r.country?.name ?? "Unknown"}
                </span>
                {r.featured && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 px-1 py-0 text-[9px] text-amber-400"
                  >
                    Featured
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground line-clamp-4 text-xs whitespace-pre-wrap">
                {r.content}
              </p>
            </div>
          ))}
          {hasNextPage && (
            <div className="py-1 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-border/30 flex items-center justify-between border-t px-5 py-3">
          <Link
            href={createUrl(`/thinkpages?prompt=${prompt.slug ?? prompt.id}`)}
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 transition-colors hover:text-purple-300"
          >
            <ExternalLink className="h-3 w-3" />
            Open full prompt
          </Link>
          <Link
            href={createUrl("/thinkpages")}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            All prompts →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Feed Item ─────────────────────────────────────────────────

function UnifiedFeedItem({ activity }: { activity: any }) {
  const source = activity.source ?? "activity";
  const isWiki = source === "wiki";
  const isGrouped = !!activity._grouped;
  const [expanded, setExpanded] = useState(false);

  // Dynamic badge for IxStats activities
  const resolvedConfig = useMemo(() => {
    if (source === "activity") return getActivityLabel(activity);
    return SOURCE_CONFIG[source] ?? SOURCE_CONFIG.activity!;
  }, [source, activity]);

  const Icon = resolvedConfig.icon;
  const metadata = activity.content?.metadata ?? {};
  const externalUrl = metadata.wikiUrl ?? metadata.forumUrl;

  // Wiki page title for clickable link
  const wikiPageTitle = metadata.pageTitle as string | undefined;
  const wikiHref = wikiPageTitle ? titleToWikiOSRoute(wikiPageTitle) : null;

  const titleText = activity.content?.title ?? "";
  // For wiki items, strip the "Wiki edit: " or "New wiki page: " prefix — we show the page title as a link
  const displayTitle =
    isWiki && wikiPageTitle
      ? activity._isNew
        ? "New page created"
        : isGrouped
          ? ""
          : titleText.replace(/^(Wiki edit|New wiki page):\s*/i, "")
      : titleText;
  const titleHtml = displayTitle ? sanitizeUserContent(renderDiscordEmojis(displayTitle)) : "";

  const descHtml = activity.content?.description
    ? sanitizeUserContent(renderDiscordEmojis(activity.content.description))
    : "";

  return (
    <div className="group glass-hierarchy-child bg-muted/5 hover:bg-muted/15 border-border/30 rounded-xl border p-3 transition-colors">
      <div className="flex items-start gap-3">
        {/* Source icon — wiki uses the W logo */}
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isWiki ? "bg-teal-500/10" : resolvedConfig.bg
          )}
        >
          {isWiki ? (
            <img src="https://cdn.simpleicons.org/wikipedia/teal" alt="Wiki" className="h-4 w-4" />
          ) : (
            <Icon className={cn("h-4 w-4", resolvedConfig.color)} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="mb-1 flex items-center gap-2">
            {/* Wiki: clickable page title */}
            {isWiki && wikiPageTitle ? (
              <Link
                href={wikiHref ?? "#"}
                className="text-foreground truncate text-sm font-medium hover:underline"
              >
                {wikiPageTitle}
              </Link>
            ) : (
              <span
                className="text-foreground truncate text-sm font-medium"
                dangerouslySetInnerHTML={{ __html: titleHtml }}
              />
            )}
            {/* Badge — wiki shows nothing (icon is enough), others show dynamic label */}
            {!isWiki && (
              <Badge
                variant="outline"
                className={cn("shrink-0 text-[10px]", resolvedConfig.color, "border-current/30")}
              >
                {resolvedConfig.label}
              </Badge>
            )}
            {activity._isNew && (
              <Badge className="shrink-0 border-teal-500/30 bg-teal-500/15 text-[9px] text-teal-500">
                NEW
              </Badge>
            )}
          </div>

          {/* Grouped summary (wiki edits or IxStats activity batches) */}
          {isGrouped ? (
            <div>
              {isWiki ? (
                /* Wiki: byte-count summary */
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">{activity._editCount}</span> edits
                  by{" "}
                  <span className="text-foreground font-medium">
                    {activity._editors.length === 1
                      ? activity._editors[0]
                      : `${activity._editors.length} editors`}
                  </span>
                  {" · "}
                  <span
                    className={cn(
                      "font-medium",
                      activity._totalBytes > 0
                        ? "text-emerald-500"
                        : activity._totalBytes < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                    )}
                  >
                    {activity._totalBytes > 0 ? "+" : ""}
                    {activity._totalBytes} bytes
                  </span>
                </p>
              ) : (
                /* IxStats activity: count summary */
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">{activity._editCount}</span> updates
                  by{" "}
                  <span className="text-foreground font-medium">
                    {activity._editors?.[0] ?? "unknown"}
                  </span>
                </p>
              )}
              {/* Expandable sub-items */}
              {activity._subEdits.length > 1 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-muted-foreground hover:text-foreground mt-1 flex cursor-pointer items-center gap-0.5 text-[10px] transition-colors"
                >
                  <ChevronDown
                    className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
                  />
                  {expanded ? "Hide" : "Show"} {activity._subEdits.length}{" "}
                  {isWiki ? "edits" : "items"}
                </button>
              )}
              {expanded && (
                <div className="border-border/20 mt-1.5 space-y-0.5 border-l-2 pl-2">
                  {activity._subEdits.map((sub: any, i: number) => {
                    const subTitle = sub.content?.title ?? "";
                    const subDesc = sub.content?.description ?? "";
                    const display = isWiki ? subDesc.slice(0, 80) : subTitle.slice(0, 80);
                    return (
                      <div key={i} className="text-muted-foreground text-[10px]">
                        <span className="text-foreground/70 font-medium">
                          {sub.user?.name ?? "?"}
                        </span>
                        {" · "}
                        <span>{display}</span>
                        {" · "}
                        <span>{formatTimeAgo(new Date(sub.timestamp))}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activity.poll ? (
            <FeedPollWidget poll={activity.poll} />
          ) : descHtml ? (
            <p
              className="text-muted-foreground text-xs break-words whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: descHtml }}
            />
          ) : null}

          {/* Footer metadata */}
          <div className="text-muted-foreground mt-1.5 flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(new Date(activity.timestamp))}
            </span>
            {!isGrouped &&
              activity.user?.name &&
              (isWiki ? (
                <WikiAuthorPopover username={activity.user.name} />
              ) : activity.poll && activity.user.name === "User" ? null : (
                <span>by {activity.user.name}</span>
              ))}
            {isGrouped && activity._editors.length <= 3 && (
              <span className="flex items-center gap-1">
                {activity._editors.map((editor: string, idx: number) => (
                  <span key={editor}>
                    {idx > 0 && ", "}
                    <WikiAuthorPopover username={editor} />
                  </span>
                ))}
              </span>
            )}
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

// ─── Wiki Author Hover Card ──────────────────────────────────────

function WikiAuthorPopover({ username }: { username: string }) {
  const [open, setOpen] = useState(false);

  // Only fetch when the card is opened — avoids N+1 queries on page load
  const { data: author, isLoading } = api.users.resolveWikiAuthor.useQuery(
    { wikiUsername: username },
    { enabled: open, staleTime: 60_000 }
  );

  const wikiUserUrl = `https://ixwiki.com/wiki/User:${encodeURIComponent(username.replace(/ /g, "_"))}`;
  const wikiContribsUrl = `https://ixwiki.com/wiki/Special:Contributions/${encodeURIComponent(username.replace(/ /g, "_"))}`;

  return (
    <HoverCardPrimitive.Root open={open} onOpenChange={setOpen} openDelay={300} closeDelay={100}>
      <HoverCardPrimitive.Trigger asChild>
        <button className="text-foreground/80 hover:text-foreground cursor-pointer font-medium underline decoration-dotted underline-offset-2 transition-colors">
          {username}
        </button>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          side="top"
          align="start"
          sideOffset={4}
          className="bg-popover border-border/50 animate-in fade-in-0 zoom-in-95 z-50 w-56 rounded-xl border p-3 shadow-lg"
        >
          {isLoading ? (
            <div className="space-y-2">
              <div className="bg-muted h-4 w-24 animate-pulse rounded" />
              <div className="bg-muted/60 h-3 w-32 animate-pulse rounded" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2">
                {author?.country?.flag ? (
                  <SimpleFlag
                    countryName={author.country.name ?? ""}
                    size="sm"
                    className="shrink-0"
                  />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-teal-500/10">
                    <Users className="h-3 w-3 text-teal-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-foreground truncate text-xs font-semibold">{username}</p>
                  {author?.country && (
                    <p className="text-muted-foreground truncate text-[10px]">
                      {author.country.name}
                      {author.country.continent ? ` · ${author.country.continent}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Country info badge */}
              {author?.country?.economicTier && (
                <div className="text-muted-foreground text-[10px]">
                  <span className="text-foreground/70 font-medium">
                    {author.country.economicTier}
                  </span>
                  {author.country.leader && <span> · Led by {author.country.leader}</span>}
                </div>
              )}

              {/* Quick links */}
              <div className="border-border/30 flex flex-col gap-0.5 border-t pt-1.5">
                <a
                  href={wikiUserUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors"
                >
                  <BookOpen className="h-3 w-3 shrink-0 text-teal-400" />
                  Wiki User Page
                </a>
                <a
                  href={wikiContribsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors"
                >
                  <Clock className="h-3 w-3 shrink-0 text-teal-400" />
                  Contributions
                </a>
                {author?.country?.slug && (
                  <>
                    <Link
                      href={createUrl(`/countries/${author.country.slug}`)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors"
                    >
                      <Globe className="h-3 w-3 shrink-0 text-blue-400" />
                      Country Page
                    </Link>
                    <Link
                      href={createUrl(`/maps?country=${author.country.id}`)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors"
                    >
                      <MapIcon className="h-3 w-3 shrink-0 text-emerald-400" />
                      View on Map
                    </Link>
                  </>
                )}
                {!author?.country && !isLoading && (
                  <span className="text-muted-foreground/50 px-1.5 py-0.5 text-[9px] italic">
                    No linked IxStats country
                  </span>
                )}
              </div>
            </div>
          )}
          <HoverCardPrimitive.Arrow className="fill-popover" />
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
