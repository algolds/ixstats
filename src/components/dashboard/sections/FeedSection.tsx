"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { MessageSquare, BookOpen, MessageCircle, Newspaper, Rss, ExternalLink, Clock } from "lucide-react";
import Link from "next/link";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
import { AccountCreationModal } from "~/components/thinkpages/AccountCreationModal";
import { AccountSettingsModal } from "~/components/thinkpages/AccountSettingsModal";
import { staggerContainer, staggerItem } from "~/components/mycountry/primitives/tabs/TabMotionConfig";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";

type FeedTab = "all" | "thinkpages" | "wiki" | "forum";

const TABS: { id: FeedTab; label: string; icon: typeof Rss }[] = [
  { id: "all", label: "All", icon: Rss },
  { id: "thinkpages", label: "ThinkPages", icon: Newspaper },
  { id: "wiki", label: "Wiki", icon: BookOpen },
  { id: "forum", label: "Forum", icon: MessageCircle },
];

const SOURCE_CONFIG: Record<string, { icon: typeof Rss; color: string; bg: string; label: string }> = {
  activity:   { icon: Rss,            color: "text-blue-400",   bg: "bg-blue-500/10",   label: "IxStats" },
  thinkpages: { icon: Newspaper,      color: "text-purple-400", bg: "bg-purple-500/10", label: "ThinkPages" },
  wiki:       { icon: BookOpen,       color: "text-teal-400",   bg: "bg-teal-500/10",   label: "Wiki" },
  forum:      { icon: MessageCircle,  color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
    },
  );

  const { data: accountsData } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId },
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

  // Unified feed data (for All/Wiki/Forum tabs)
  const { data: feedData, isLoading: feedLoading } = api.activities.getGlobalFeed.useQuery(
    { limit: 30 },
    { enabled: activeTab !== "thinkpages", refetchInterval: 60_000 },
  );

  const filteredFeed = useMemo(() => {
    if (!feedData?.activities) return [];
    if (activeTab === "all") return feedData.activities;
    return feedData.activities.filter((a: any) => a.source === activeTab);
  }, [feedData, activeTab]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-4 sm:space-y-6"
    >
      {/* Tab Bar */}
      <motion.div variants={staggerItem}>
        <div className="flex gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
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
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/50 hover:bg-white/5 hover:text-white/70",
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
          <Link href={createUrl("/setup")}>
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
          <MessageSquare className="mt-0.5 h-6 w-6 flex-shrink-0 text-purple-500" />
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-semibold">Welcome to the Feed</h3>
            <p className="text-muted-foreground text-xs">
              You're browsing in read-only mode. Sign in to post, reply, and interact.
            </p>
            <Link href={createUrl("/setup")} className="mt-2 inline-block">
              <Button size="sm" variant="outline" className="text-xs">
                Sign In
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <ThinkpagesSocialPlatform
        countryId="global"
        countryName="Global Community"
        isOwner={false}
      />
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
          <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="mb-2 h-4 w-3/4 rounded bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    const emptyLabel = activeTab === "wiki" ? "wiki edits" : activeTab === "forum" ? "forum posts" : "activity";
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

function UnifiedFeedItem({ activity }: { activity: any }) {
  const source = activity.source ?? "activity";
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.activity!;
  const Icon = config.icon;
  const metadata = activity.content?.metadata ?? {};
  const externalUrl = metadata.wikiUrl ?? metadata.forumUrl;

  return (
    <div className="group rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.bg)}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate text-sm font-medium text-white/90">
              {activity.content?.title}
            </span>
            <Badge variant="outline" className={cn("shrink-0 text-[10px]", config.color, "border-current/30")}>
              {config.label}
            </Badge>
          </div>
          <p className="line-clamp-2 text-xs text-white/50">
            {activity.content?.description}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(new Date(activity.timestamp))}
            </span>
            {activity.user?.name && (
              <span>by {activity.user.name}</span>
            )}
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-white/40 transition-colors hover:text-white/70"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
