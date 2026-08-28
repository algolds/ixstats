"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";

import {
  Group as Users,
  RssFeed as Rss,
  OpenBook as BookOpen,
  Settings,
  Globe,
} from "iconoir-react";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { Badge } from "~/components/ui/badge";
import {
  staggerContainer,
  staggerItem,
} from "~/components/mycountry/shared/primitives/tabs/TabMotionConfig";
import { useUser } from "~/context/auth-context";
import { api, type RouterOutputs } from "~/trpc/react";
import { FacetTabs } from "~/components/ui/facet";
import { cn } from "~/lib/utils";

type ThinkpagesAccountItem = RouterOutputs["thinkpages"]["getMyAccounts"][number];

import dynamic from "next/dynamic";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";

const GlassCanvasComposer = dynamic(
  () => import("~/components/thinkpages/GlassCanvasComposer").then((m) => m.GlassCanvasComposer),
  {
    loading: () => <div className="h-36 animate-pulse rounded-2xl bg-white/5" />,
    ssr: false,
  }
);

const AccountCreationModal = dynamic(
  () => import("~/components/thinkpages/AccountCreationModal").then((m) => m.AccountCreationModal),
  { ssr: false }
);

const AccountSettingsModal = dynamic(
  () => import("~/components/thinkpages/AccountSettingsModal").then((m) => m.AccountSettingsModal),
  { ssr: false }
);

const AccountManagerModal = dynamic(
  () => import("~/components/thinkpages/AccountManagerModal").then((m) => m.AccountManagerModal),
  { ssr: false }
);

const RepostModal = dynamic(
  () => import("~/components/thinkpages/RepostModal").then((m) => m.RepostModal),
  { ssr: false }
);

import { UnifiedFeedContent, FollowingFeedContent } from "./UnifiedFeedContent";
import { TrendingSectionWidget } from "./TrendingSectionWidget";
import { BlurbSection } from "./BlurbSection";
import { CountriesToExploreCard } from "./CountriesToExploreCard";

// ─── Config ──────────────────────────────────────────────────────

type FeedTab = "all" | "following" | "community";

const BASE_TABS: { id: FeedTab; label: string; icon: typeof Rss }[] = [
  { id: "all", label: "All Activity", icon: Rss },
  { id: "following", label: "Following", icon: Users },
  { id: "community", label: "Community", icon: BookOpen },
];

// ─── Props ───────────────────────────────────────────────────────

interface UnifiedDashboardSectionProps {
  globalStats?: {
    totalCountries?: number;
    countryCount?: number;
    totalPopulation?: number;
    totalGdp?: number;
    globalGrowthRate?: number;
    averageGdpPerCapita?: number;
    economicTierDistribution?: Record<string, number>;
  };
}

// ─── Main Component ──────────────────────────────────────────────

export function UnifiedDashboardSection({
  globalStats: propGlobalStats,
}: UnifiedDashboardSectionProps) {
  const { user, isSignedIn } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  // ── Feed state ──
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [selectedAccount, setSelectedAccount] = useState<ThinkpagesAccountItem | null>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<ThinkpagesAccountItem | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isRepostModalOpen, setIsRepostModalOpen] = useState(false);
  const [repostingPost, setRepostingPost] = useState<any>(null);

  // ── World Economics ──
  const { data: queriedGlobalStats } = api.countries.getGlobalStats.useQuery(undefined, {
    enabled: !propGlobalStats,
    staleTime: 300_000,
  });
  const globalStats = propGlobalStats ?? queriedGlobalStats;

  // ── Profile / User data ──
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 300_000,
  });
  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || "" },
    {
      enabled: !!userProfile?.countryId && userProfile.countryId.trim() !== "",
      retry: false,
      staleTime: 60_000,
    }
  );

  // Fetch accounts user owns for posting
  const { data: accountsData } = api.thinkpages.getMyAccounts.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 120_000,
  });
  const accounts = useMemo(() => accountsData || [], [accountsData]);

  const hasCountry = !!userProfile?.countryId;

  // ── Auto-select account ──
  useEffect(() => {
    // oxlint-disable-next-line
    if (!selectedAccount && accounts.length > 0) setSelectedAccount(accounts[0]);
  }, [accounts, selectedAccount]);

  const isCountryDataReady =
    userProfile &&
    countryData &&
    userProfile.countryId?.trim() &&
    countryData.newStats?.name?.trim();

  const TABS = useMemo(
    () => (hasCountry ? BASE_TABS : BASE_TABS.filter((t) => t.id !== "following")),
    [hasCountry]
  );

  // ── ThinkPages Action Handlers ──

  const handleLike = useCallback((_postId: string) => {
    // Handled globally by PostActions
  }, []);

  const handleRepost = useCallback(
    (post: any) => {
      if (selectedAccount) {
        if (post) {
          setRepostingPost(post);
          setIsRepostModalOpen(true);
        } else {
          notify.error("Unable to find the original post to repost.");
        }
      } else {
        notify.error("Please select an account first");
      }
    },
    [selectedAccount, notify]
  );

  const handleReply = useCallback(
    (_postId: string) => {
      if (!selectedAccount) {
        if (accounts.length === 0 && isCountryDataReady) {
          setShowAccountCreation(true);
        } else {
          setIsAccountModalOpen(true);
        }
        notify.error("Please select or create an account first to reply");
      }
    },
    [selectedAccount, accounts.length, isCountryDataReady, notify]
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
      className="space-y-5 pb-16 sm:pb-20 md:space-y-7 md:pb-24"
    >
      {/* Feed + Sidebar Grid Layout */}
      <motion.div variants={staggerItem}>
        <div className="facet-layout-grid-3">
          {/* Feed stream (left 2/3) */}
          <div className="facet-layout-main-span-2 space-y-5">
            {/* Feed Tab Bar - ticks on change incl Community */}
            <motion.div variants={staggerItem} className="flex items-center gap-2">
              <FacetTabs
                tabs={TABS}
                activeTab={activeTab}
                onChange={(tabId) => {
                  if (tabId !== activeTab) soundEffects.tick(0.14);
                  setActiveTab(tabId as FeedTab);
                  if (tabId === "community") soundEffects.page(0.12);
                }}
                tone="accent"
                size="md"
                className="flex-1"
                indicatorClassName="rounded-xl"
              />
              {/* Settings gear */}
              {isSignedIn && (
                <button
                  onClick={() => setIsAccountModalOpen(true)}
                  data-cuelume-press="soft"
                  className="text-muted-foreground hover:text-foreground relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.04] shadow-sm transition-all duration-300 hover:bg-black/[0.08] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.08]"
                  title="Feed & Account Settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>

            {/* ThinkPages Composer integrated on top of the stream */}
            {activeTab !== "community" && isSignedIn && (
              <div className="mb-4 space-y-2">
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
                  isOwner={hasCountry}
                  isSignedIn={isSignedIn}
                  hasCountry={hasCountry}
                  onCreateAccount={() => setIsAccountModalOpen(true)}
                />
                {hasCountry && accounts.length > 1 && selectedAccount && (
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
                      className="ml-2 cursor-pointer text-[11px] font-semibold text-purple-600 underline hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                    >
                      Switch Account
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "following" ? (
              <FollowingFeedContent
                currentUserAccountId={selectedAccount?.id || ""}
                accounts={accounts}
                countryId={userProfile?.countryId || ""}
                isOwner={hasCountry}
                onAccountSelectAction={setSelectedAccount}
                onAccountSettingsAction={(account: any) => {
                  setSettingsAccount(account);
                  setShowAccountSettings(true);
                }}
                onCreateAccountAction={() => setShowAccountCreation(true)}
                onLikeAction={handleLike}
                onRepostAction={handleRepost}
                onReactionAction={handleReaction}
                onReplyAction={handleReply}
                onShareAction={handleShare}
              />
            ) : (
              <UnifiedFeedContent
                activeTab={activeTab}
                currentUserAccountId={selectedAccount?.id || ""}
                accounts={accounts}
                countryId={userProfile?.countryId || ""}
                isOwner={hasCountry}
                onAccountSelectAction={setSelectedAccount}
                onAccountSettingsAction={(account: any) => {
                  setSettingsAccount(account);
                  setShowAccountSettings(true);
                }}
                onCreateAccountAction={() => setShowAccountCreation(true)}
                onLikeAction={handleLike}
                onRepostAction={handleRepost}
                onReactionAction={handleReaction}
                onReplyAction={handleReply}
                onShareAction={handleShare}
              />
            )}
          </div>

          {/* Sidebar (right 1/3): Community widgets */}
          <div className="facet-layout-sidebar-span-1 space-y-4 md:sticky md:top-20 md:self-start">
            {/* Trending Now — Compact */}
            <TrendingSectionWidget />

            {/* Blurb of the Day Widget */}
            <BlurbSection />

            {/* Countries to Explore */}
            <CountriesToExploreCard currentUserCountryId={userProfile?.countryId ?? ""} />

            {/* Economic Tier Distribution */}
            {(globalStats as any)?.economicTierDistribution && (
              <CutoutCard
                className={cn(cutoutCardSurfaceClassName, "overflow-hidden rounded-xl")}
                trackPointerHover={false}
              >
                {/* Cutout tab header */}
                <div className="relative bg-emerald-500/10 px-4 pt-3 pb-5">
                  <div className="text-card-foreground flex items-center gap-2 text-xs font-semibold tracking-tight">
                    <Globe className="h-4 w-4 text-emerald-500" />
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
                    {Object.entries((globalStats as any).economicTierDistribution).map(
                      ([tier, count]) => (
                        <div
                          key={tier}
                          className="bg-muted/50 flex items-center gap-1 rounded px-2 py-0.5"
                        >
                          <span className="text-[10px] font-medium">{tier}</span>
                          <Badge
                            variant="secondary"
                            className="bg-background text-foreground border-border border px-1 py-0 text-[9px] font-semibold tabular-nums"
                          >
                            {count as number}
                          </Badge>
                        </div>
                      )
                    )}
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
