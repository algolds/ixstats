"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";

import {
  Group as Users,
  RssFeed as Rss,
  OpenBook as BookOpen,
  Settings,
  FireFlame as Flame,
  StatsUpSquare,
} from "iconoir-react";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  staggerContainer,
  staggerItem,
} from "~/components/mycountry/shared/primitives/tabs/TabMotionConfig";
import { useUser } from "~/context/auth-context";
import { api, type RouterOutputs } from "~/trpc/react";
import dynamic from "next/dynamic";
import { useNotify } from "~/hooks/useNotify";

type ThinkpagesAccountItem = RouterOutputs["thinkpages"]["getMyAccounts"][number];

const GlassCanvasComposer = dynamic(
  () => import("~/components/thinkpages/GlassCanvasComposer").then((m) => m.GlassCanvasComposer),
  {
    loading: () => <Skeleton className="rounded-card h-36" />,
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

import { UnifiedFeedContent, FollowingFeedContent, type FeedHandlers } from "./UnifiedFeedContent";
import { TrendingFeedContent } from "./TrendingFeedContent";
import { TrendingSectionWidget } from "./TrendingSectionWidget";
import { BlurbSection } from "./BlurbSection";
import { CountriesToExploreCard } from "./CountriesToExploreCard";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Inspector } from "~/components/ui/inspector";

type FeedTab = "all" | "following" | "trending" | "community";

const BASE_TABS: { value: FeedTab; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All activity", icon: <Rss /> },
  { value: "following", label: "Following", icon: <Users /> },
  { value: "trending", label: "Trending", icon: <Flame /> },
  { value: "community", label: "Community", icon: <BookOpen /> },
];

// Likes and reactions are handled globally by PostActions.
const noop = () => {};

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

function PostingAs({
  account,
  onSwitch,
}: {
  account: ThinkpagesAccountItem;
  onSwitch: () => void;
}) {
  return (
    <div className="text-footnote flex items-center gap-2 px-1">
      <span className="text-label-secondary">Posting as</span>
      <div className="text-label flex items-center gap-2 font-medium">
        <span>@{account.username}</span>
        <span className="text-label-secondary text-footnote font-normal">
          ({account.accountType})
        </span>
      </div>
      <Button variant="link" size="sm" onClick={onSwitch} className="ml-2 h-auto px-0">
        Switch account
      </Button>
    </div>
  );
}

function EconomicTiersCard({ tiers }: { tiers: Record<string, number> }) {
  return (
    <Card padding="md">
      <h2 className="text-headline text-label mb-3">Economic tiers</h2>
      <div className="flex flex-wrap items-center gap-1">
        {Object.entries(tiers).map(([tier, count]) => (
          <Badge key={tier} variant="default">
            <span>{tier}</span>
            <span className="text-label tabular-nums">{count}</span>
          </Badge>
        ))}
      </div>
    </Card>
  );
}

/** The viewer's country and ThinkPages accounts, with the first account auto-selected. */
function useViewerAccounts(userId: string | undefined) {
  const [selectedAccount, setSelectedAccount] = useState<ThinkpagesAccountItem | null>(null);
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!userId,
    staleTime: 300_000,
  });
  const countryId = userProfile?.countryId ?? "";
  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: !!countryId.trim(), retry: false, staleTime: 60_000 }
  );

  // Accounts the user owns, for posting.
  const { data: accountsData } = api.thinkpages.getMyAccounts.useQuery(undefined, {
    enabled: !!userId,
    staleTime: 120_000,
  });
  const accounts = useMemo(() => accountsData || [], [accountsData]);
  const hasCountry = !!countryId;

  useEffect(() => {
    // oxlint-disable-next-line
    if (!selectedAccount && accounts.length > 0) setSelectedAccount(accounts[0]);
  }, [accounts, selectedAccount]);

  const isCountryDataReady = !!(
    userProfile &&
    countryData?.newStats?.name?.trim() &&
    countryId.trim()
  );

  return {
    countryId,
    hasCountry,
    countryData,
    accounts,
    selectedAccount,
    setSelectedAccount,
    isCountryDataReady,
  };
}

export function UnifiedDashboardSection({
  globalStats: propGlobalStats,
}: UnifiedDashboardSectionProps) {
  const { user, isSignedIn } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<ThinkpagesAccountItem | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isRepostModalOpen, setIsRepostModalOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [repostingPost, setRepostingPost] = useState<any>(null);

  const { data: queriedGlobalStats } = api.countries.getGlobalStats.useQuery(undefined, {
    enabled: !propGlobalStats,
    staleTime: 300_000,
  });
  const globalStats = propGlobalStats ?? queriedGlobalStats;

  const {
    countryId,
    hasCountry,
    countryData,
    accounts,
    selectedAccount,
    setSelectedAccount,
    isCountryDataReady,
  } = useViewerAccounts(user?.id);

  // Anyone signed in can follow ThinkPages accounts, so Following no longer needs a country.
  const tabs = isSignedIn ? BASE_TABS : BASE_TABS.filter((t) => t.value !== "following");

  const openAccountSettings = (account: ThinkpagesAccountItem) => setSettingsAccount(account);
  const openAccountCreation = () => setShowAccountCreation(true);
  const openAccountManager = () => setIsAccountModalOpen(true);
  const refetchFeeds = (following: boolean) => {
    utils.activities.getGlobalFeed.refetch();
    if (following) utils.activities.getFollowingFeed.refetch();
  };

  const handleRepost = (post: any) => {
    if (!selectedAccount) return notify.error("Select an account first");
    if (!post) return notify.error("Could not find the original post.");
    setRepostingPost(post);
    setIsRepostModalOpen(true);
  };

  const handleReply = () => {
    if (selectedAccount) return;
    if (accounts.length === 0 && isCountryDataReady) openAccountCreation();
    else openAccountManager();
    notify.error("Select or create an account to reply");
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: "ThinkPages Post",
        text: "A post on ThinkPages",
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      notify.success("Link copied");
    }
  };

  const feedHandlers: FeedHandlers = {
    currentUserAccountId: selectedAccount?.id || "",
    accounts,
    countryId,
    isOwner: hasCountry,
    onAccountSelectAction: setSelectedAccount,
    onAccountSettingsAction: openAccountSettings,
    onCreateAccountAction: openAccountCreation,
    onLikeAction: noop,
    onRepostAction: handleRepost,
    onReactionAction: noop,
    onReplyAction: handleReply,
    onShareAction: handleShare,
  };
  const accountProps = {
    countryId,
    accounts,
    selectedAccount,
    onAccountSelect: setSelectedAccount,
    onAccountSettings: openAccountSettings,
    onCreateAccount: openAccountCreation,
    isOwner: hasCountry,
  };
  const tierDistribution = (globalStats as UnifiedDashboardSectionProps["globalStats"])
    ?.economicTierDistribution;

  return (
    <>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-5 pb-16 sm:pb-20 md:space-y-7 md:pb-24"
      >
        <motion.div variants={staggerItem}>
          <div className="flex min-w-0 flex-col space-y-5">
            <motion.div variants={staggerItem} className="flex items-center gap-2">
              <SegmentedControl
                options={tabs}
                value={activeTab}
                onValueChange={(tabId) => setActiveTab(tabId as FeedTab)}
                size="md"
                className="flex-1"
                asTabs
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInspectorOpen(true)}
                className="shrink-0 xl:hidden"
              >
                <StatsUpSquare className="size-4" />
                Trends
              </Button>
              {isSignedIn && (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={openAccountManager}
                  className="shrink-0"
                  title="Feed and account settings"
                  aria-label="Feed and account settings"
                >
                  <Settings />
                </Button>
              )}
            </motion.div>

            {activeTab !== "community" && isSignedIn && (
              <div className="mb-4 space-y-2">
                <GlassCanvasComposer
                  account={selectedAccount}
                  onAccountSelect={setSelectedAccount}
                  onPost={() => refetchFeeds(true)}
                  placeholder="Write a post"
                  countryId={countryId}
                  accounts={accounts}
                  isOwner={hasCountry}
                  isSignedIn={isSignedIn}
                  hasCountry={hasCountry}
                  onCreateAccount={openAccountManager}
                />
                {hasCountry && accounts.length > 1 && selectedAccount && (
                  <PostingAs account={selectedAccount} onSwitch={openAccountManager} />
                )}
              </div>
            )}

            {activeTab === "following" ? (
              <FollowingFeedContent {...feedHandlers} />
            ) : activeTab === "trending" ? (
              <TrendingFeedContent {...feedHandlers} />
            ) : (
              <UnifiedFeedContent activeTab={activeTab} {...feedHandlers} />
            )}
          </div>
        </motion.div>

        {showAccountCreation && isCountryDataReady && (
          <AccountCreationModal
            countryId={countryData!.id}
            countryName={countryData!.name}
            existingAccountCount={accounts.length}
            isOpen
            onClose={() => setShowAccountCreation(false)}
            onAccountCreated={() => setShowAccountCreation(false)}
          />
        )}
        {settingsAccount && (
          <AccountSettingsModal
            account={settingsAccount}
            isOpen
            onClose={() => setSettingsAccount(null)}
            onAccountUpdate={() => setSettingsAccount(null)}
          />
        )}

        <AccountManagerModal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          {...accountProps}
        />

        {repostingPost && (
          <RepostModal
            open={isRepostModalOpen}
            onOpenChange={setIsRepostModalOpen}
            originalPost={repostingPost}
            {...accountProps}
            onPost={() => {
              refetchFeeds(hasCountry);
              setIsRepostModalOpen(false);
              setRepostingPost(null);
            }}
          />
        )}
      </motion.div>

      {/* Outside the animated wrappers: a transformed ancestor would be the fixed aside's containing block. */}
      <Inspector title="Around IxStates" open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <div className="flex flex-col space-y-4">
          <TrendingSectionWidget />
          <BlurbSection />
          <CountriesToExploreCard currentUserCountryId={countryId} />
          {tierDistribution && <EconomicTiersCard tiers={tierDistribution} />}
        </div>
      </Inspector>
    </>
  );
}
