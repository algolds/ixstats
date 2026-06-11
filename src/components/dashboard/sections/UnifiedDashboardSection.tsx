// @ts-nocheck
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";

import {
  Users,
  Rss,
  BookOpen,
  Settings,
  Globe,
} from "lucide-react";
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
} from "~/components/mycountry/primitives/tabs/TabMotionConfig";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import {
  DynamicIslandEffects,
  DYNAMIC_ISLAND_STYLE,
  DYNAMIC_ISLAND_BORDER_CLASS,
} from "~/app/builder/components/glass";
import { cn } from "~/lib/utils";

import { AccountCreationModal } from "~/components/thinkpages/AccountCreationModal";
import { AccountSettingsModal } from "~/components/thinkpages/AccountSettingsModal";
import { AccountManagerModal } from "~/components/thinkpages/AccountManagerModal";
import { RepostModal } from "~/components/thinkpages/RepostModal";
import { GlassCanvasComposer } from "~/components/thinkpages/GlassCanvasComposer";
import { useNotify } from "~/hooks/useNotify";

import { UnifiedFeedContent, FollowingFeedContent } from "./UnifiedFeedContent";
import { TrendingSectionWidget } from "./TrendingSectionWidget";
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
  globalStats: _globalStats,
}: UnifiedDashboardSectionProps) {
  const { user, isSignedIn } = useUser();
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

  // ── World Economics ──
  const { data: globalStats } = api.countries.getGlobalStats.useQuery({});

  // ── Profile / User data ──
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

  const hasCountry = !!userProfile?.countryId;

  // ── Auto-select account ──
  useEffect(() => {
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
      className="space-y-5 md:space-y-7"
    >
      {/* Feed + Sidebar Grid Layout */}
      <motion.div variants={staggerItem}>
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Feed stream (left 2/3) */}
          <div className="space-y-5 lg:col-span-2">
            {/* Feed Tab Bar */}
            <motion.div variants={staggerItem}>
              <div
                className={cn(
                  "relative flex gap-1 overflow-hidden rounded-xl p-1",
                  DYNAMIC_ISLAND_BORDER_CLASS
                )}
                style={DYNAMIC_ISLAND_STYLE}
              >
                {/* Dynamic Island refraction edge, sheen highlights, and pulse shimmer */}
                <DynamicIslandEffects showGlow={false} showShimmer={false} />

                {/* Sliding indicator behind active tab */}
                <motion.div
                  className="absolute inset-y-1 rounded-lg border border-white/20 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 shadow-md backdrop-blur-md"
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
                        isActive
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
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
                {isSignedIn && (
                  <button
                    onClick={() => setIsAccountModalOpen(true)}
                    className="text-muted-foreground hover:text-foreground relative z-10 flex shrink-0 cursor-pointer items-center justify-center rounded-lg p-2 transition-colors hover:bg-white/10"
                    title="Feed & Account Settings"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
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
                      className="ml-2 cursor-pointer text-[11px] font-semibold text-purple-400 underline hover:text-purple-300"
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
          <div className="space-y-5 md:sticky md:top-6 md:self-start lg:col-span-1">
            {/* Trending Now — Compact */}
            <TrendingSectionWidget />

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
