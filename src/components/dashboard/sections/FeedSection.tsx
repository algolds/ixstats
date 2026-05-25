"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";

const DISCORD_CDN_HOSTNAMES = ["cdn.discordapp.com", "media.discordapp.net"];

function proxyDiscordUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (DISCORD_CDN_HOSTNAMES.includes(parsed.hostname)) {
      return `/api/proxy-discord-image?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
}
import {
  MessageSquare,
  BookOpen,
  MessageCircle,
  Newspaper,
  Rss,
  ExternalLink,
  Clock,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
import { AccountCreationModal } from "~/components/thinkpages/AccountCreationModal";
import { AccountSettingsModal } from "~/components/thinkpages/AccountSettingsModal";
import {
  staggerContainer,
  staggerItem,
} from "~/components/mycountry/primitives/tabs/TabMotionConfig";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";
import { formatTimeAgo } from "~/lib/time-utils";
import { WikiLinkPreview, ForumLinkPreview } from "~/components/wiki/WikiLinkPreview";
import { renderDiscordEmojis, formatThinkpagesContentForDisplay } from "~/lib/text-formatter";
import { sanitizeUserContent } from "~/lib/sanitize-html";

type FeedTab = "all" | "following" | "thinkpages" | "wiki" | "forum";

const BASE_TABS: { id: FeedTab; label: string; icon: typeof Rss }[] = [
  { id: "all", label: "All", icon: Rss },
  { id: "following", label: "Following", icon: Users },
  { id: "thinkpages", label: "ThinkPages", icon: Newspaper },
  { id: "wiki", label: "Wiki", icon: BookOpen },
  { id: "forum", label: "Forum", icon: MessageCircle },
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
    label: "ThinkPages",
  },
  wiki: { icon: BookOpen, color: "text-teal-400", bg: "bg-teal-500/10", label: "Wiki" },
  forum: { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
};

export function FeedSection() {
  const { user, isSignedIn } = useUser();
  const [activeTab, setActiveTab] = useState<FeedTab>("all");

  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<any>(null);

  // Get user profile and country data (for ThinkPages tab)
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
  });

  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || "" },
    {
      enabled: !!userProfile?.countryId && userProfile.countryId.trim() !== "",
      retry: false,
    }
  );

  const { data: accountsData } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  );

  const accounts = accountsData || [];

  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) {
      setSelectedAccount(accounts[0]);
    }
  }, [accounts, selectedAccount]);

  const isCountryDataReady =
    userProfile &&
    countryData &&
    userProfile.countryId &&
    userProfile.countryId.trim() !== "" &&
    countryData.id &&
    countryData.id.trim() !== "" &&
    countryData.name &&
    countryData.name.trim() !== "";

  // Show "Following" tab only when user has a country
  const hasCountry = !!userProfile?.countryId;
  const TABS = useMemo(
    () => (hasCountry ? BASE_TABS : BASE_TABS.filter((t) => t.id !== "following")),
    [hasCountry]
  );

  // Unified feed data — always fetched, polls every 30s
  const { data: feedData, isLoading: feedLoading } = api.activities.getGlobalFeed.useQuery(
    { limit: 50 },
    { refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 15_000 }
  );

  // Direct wiki recent changes — independent query for reliable wiki tab
  const { data: wikiRecentChanges } = api.wiki.getRecentChanges.useQuery(
    { limit: 20 },
    { refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 15_000 }
  );

  // Following feed data
  const { data: followingData, isLoading: followingLoading } =
    api.activities.getFollowingFeed.useQuery(
      { limit: 30 },
      {
        enabled: hasCountry,
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
        staleTime: 15_000,
      }
    );

  // Transform wiki recent changes into feed format
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
            const sizeStr = `${sizeChange > 0 ? "+" : ""}${sizeChange} bytes`;
            if (isNewPage) return `Created new page (${sizeStr})`;
            if (!rc.comment) return `Edited page (${sizeStr})`;
            const clean = rc.comment.replace(/\/\*.*?\*\/\s*/, "").trim();
            return clean ? `${clean.slice(0, 100)} (${sizeStr})` : `Edited page (${sizeStr})`;
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
    if (activeTab === "following") {
      return followingData?.activities ?? [];
    }
    // For wiki tab, prefer the direct wiki query for reliability
    if (activeTab === "wiki") {
      const fromFeed = (feedData?.activities ?? []).filter((a: any) => a.source === "wiki");
      // Merge: use direct wiki data if feed is empty
      return fromFeed.length > 0 ? fromFeed : wikiAsFeed;
    }
    if (!feedData?.activities) return [];
    if (activeTab === "all") {
      // Merge direct wiki data into feed if feed has no wiki items
      const hasWiki = feedData.activities.some((a: any) => a.source === "wiki");
      if (!hasWiki && wikiAsFeed.length > 0) {
        const merged = [...feedData.activities, ...wikiAsFeed];
        merged.sort(
          (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return merged.slice(0, 50);
      }
      return feedData.activities;
    }
    return feedData.activities.filter((a: any) => a.source === activeTab);
  }, [feedData, followingData, wikiAsFeed, activeTab]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-4 sm:space-y-6"
    >
      {/* Tab Bar */}
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

      {/* Tab Content */}
      <motion.div variants={staggerItem}>
        {activeTab === "thinkpages" ? (
          <ThinkPagesContent
            isSignedIn={isSignedIn}
            isCountryDataReady={!!isCountryDataReady}
            countryData={countryData}
            selectedAccount={selectedAccount}
            accounts={accounts}
            onAccountSelect={setSelectedAccount}
            onAccountSettings={(account: any) => {
              setSettingsAccount(account);
              setShowAccountSettings(true);
            }}
            onCreateAccount={() => setShowAccountCreation(true)}
          />
        ) : activeTab === "following" ? (
          <FollowingFeedContent
            activities={filteredFeed}
            isLoading={followingLoading}
            followingCount={followingData?.followingCount ?? 0}
          />
        ) : (
          <UnifiedFeedContent
            activities={filteredFeed}
            isLoading={feedLoading}
            activeTab={activeTab}
          />
        )}
      </motion.div>

      {/* Account Management Modals */}
      {showAccountCreation && isCountryDataReady && (
        <AccountCreationModal
          countryId={countryData.id}
          countryName={countryData.name}
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
    </motion.div>
  );
}

// ── ThinkPages Tab (preserved existing behavior) ──

function ThinkPagesContent({
  isSignedIn,
  isCountryDataReady,
  countryData,
  selectedAccount,
  accounts,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
}: {
  isSignedIn: boolean | undefined;
  isCountryDataReady: boolean;
  countryData: any;
  selectedAccount: any;
  accounts: any[];
  onAccountSelect: (a: any) => void;
  onAccountSettings: (a: any) => void;
  onCreateAccount: () => void;
}) {
  if (isSignedIn && isCountryDataReady) {
    return (
      <ThinkpagesSocialPlatform
        countryId={countryData.id}
        countryName={countryData.name}
        isOwner={true}
        selectedAccount={selectedAccount}
        accounts={accounts}
        onAccountSelect={onAccountSelect}
        onAccountSettings={onAccountSettings}
        onCreateAccount={onCreateAccount}
      />
    );
  }

  if (isSignedIn && !isCountryDataReady) {
    return (
      <Card className="glass-hierarchy-parent">
        <CardContent className="p-8 text-center">
          <MessageSquare className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">Country Setup Required</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Complete your country setup to post, reply, and interact on the feed.
          </p>
          <Link href={"/setup"}>
            <Button size="sm">Complete Setup</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="glass-hierarchy-parent">
        <CardContent className="flex items-start gap-4 p-4">
          <MessageSquare className="mt-0.5 h-6 w-6 shrink-0 text-purple-500" />
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-semibold">Welcome to the Feed</h3>
            <p className="text-muted-foreground text-xs">
              You're browsing in read-only mode. Sign in to post, reply, and interact.
            </p>
            <Link href={"/setup"} className="mt-2 inline-block">
              <Button size="sm" variant="outline" className="text-xs">
                Sign In
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <ThinkpagesSocialPlatform countryId="global" countryName="Global Community" isOwner={false} />
    </div>
  );
}

// ── Unified Feed Content (All / Wiki / Forum tabs) ──

function UnifiedFeedContent({
  activities,
  isLoading,
  activeTab,
}: {
  activities: any[];
  isLoading: boolean;
  activeTab: FeedTab;
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
    const emptyLabel =
      activeTab === "wiki" ? "wiki edits" : activeTab === "forum" ? "forum posts" : "activity";
    return (
      <Card className="glass-hierarchy-parent">
        <CardContent className="p-8 text-center">
          <Rss className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
          <h3 className="mb-1 text-sm font-semibold">No recent {emptyLabel}</h3>
          <p className="text-muted-foreground text-xs">Check back later for updates.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity: any) => (
        <UnifiedFeedItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

// ── Following Feed Content ──

function FollowingFeedContent({
  activities,
  isLoading,
  followingCount,
}: {
  activities: any[];
  isLoading: boolean;
  followingCount: number;
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
            Follow countries from the explore page to see their activity here.
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
          <p className="text-muted-foreground text-xs">
            Countries you follow haven't posted any activity yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity: any) => (
        <UnifiedFeedItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

function UnifiedFeedItem({ activity }: { activity: any }) {
  const source = activity.source ?? "activity";
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.activity!;
  const Icon = config.icon;
  const metadata = activity.content?.metadata ?? {};
  const externalUrl = metadata.wikiUrl ?? metadata.forumUrl;

  const titleHtml = activity.content?.title
    ? formatThinkpagesContentForDisplay(activity.content.title)
    : "";
  const descHtml = activity.content?.description
    ? formatThinkpagesContentForDisplay(activity.content.description)
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
          {/* Media Attachments */}
          {activity.content?.mediaAttachments && activity.content.mediaAttachments.length > 0 && (
            <div
              className={cn(
                "mt-2 overflow-hidden rounded-lg",
                activity.content.mediaAttachments.length === 1 && "max-w-xs",
                activity.content.mediaAttachments.length > 1 && "grid grid-cols-2 gap-1"
              )}
            >
              {activity.content.mediaAttachments.map((media: any, index: number) => (
                <div
                  key={media.id || index}
                  className={cn(
                    "bg-muted relative overflow-hidden rounded-lg bg-white/5",
                    activity.content.mediaAttachments.length === 1 && "aspect-video",
                    activity.content.mediaAttachments.length > 1 && "aspect-square"
                  )}
                >
                  <img
                    src={proxyDiscordUrl(media.url)}
                    alt={media.filename || `Image ${index + 1}`}
                    className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                    onClick={() => {
                      window.open(media.url, "_blank");
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          {/* Post Reactions */}
          {(() => {
            const reactionCounts = activity.content?.reactionCounts;
            if (reactionCounts && Object.keys(reactionCounts).length > 0) {
              return (
                <div className="border-border/20 mt-2 flex flex-wrap items-center gap-1.5 border-t pt-1.5">
                  {Object.entries(reactionCounts).map(([type, count]) => {
                    if ((count as number) <= 0) return null;

                    // Render custom Discord reactions
                    if (type.startsWith("discord:")) {
                      const parts = type.split(":");
                      const emojiName = parts[1] || "";
                      const emojiId = parts[2] || "";

                      const url = `https://cdn.discordapp.com/emojis/${emojiId}.png`;
                      return (
                        <div
                          key={type}
                          className="bg-muted/30 text-muted-foreground border-border/10 hover:bg-muted/50 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors"
                        >
                          <img src={url} alt={emojiName} className="h-3.5 w-3.5 object-contain" />
                          <span>{count as number}</span>
                        </div>
                      );
                    }

                    // Render standard reactions or unicode characters
                    const emojiMap: Record<string, string> = {
                      like: "❤️",
                      laugh: "😂",
                      angry: "😡",
                      fire: "🔥",
                      thumbsup: "👍",
                      thumbsdown: "👎",
                    };

                    const displayEmoji = emojiMap[type] || type;

                    return (
                      <div
                        key={type}
                        className="bg-muted/30 text-muted-foreground border-border/10 hover:bg-muted/50 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors"
                      >
                        <span className="text-[11px]">{displayEmoji}</span>
                        <span>{count as number}</span>
                      </div>
                    );
                  })}
                </div>
              );
            }
            return null;
          })()}
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

/** External link with wiki/forum tooltip on hover */
function FeedExternalLink({ url, title }: { url: string; title?: string }) {
  const wikiMatch = url.match(/ixwiki\.com\/wiki\/([^#?]+)/);
  const iiMatch = url.match(/iiwiki\.com\/wiki\/([^#?]+)/);
  const forumMatch = url.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);

  const linkEl = (
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

  if (wikiMatch) {
    const wikiTitle = decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ");
    return (
      <WikiLinkPreview title={wikiTitle} wiki="ixwiki">
        {linkEl}
      </WikiLinkPreview>
    );
  }
  if (iiMatch) {
    const wikiTitle = decodeURIComponent(iiMatch[1]!).replace(/_/g, " ");
    return (
      <WikiLinkPreview title={wikiTitle} wiki="iiwiki">
        {linkEl}
      </WikiLinkPreview>
    );
  }
  if (forumMatch) {
    const threadId = parseInt(forumMatch[1]!, 10);
    return <ForumLinkPreview threadId={threadId}>{linkEl}</ForumLinkPreview>;
  }

  return linkEl;
}
