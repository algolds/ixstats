import { useMemo, useState } from "react";
import { useVaultStats } from "~/hooks/vault/useVaultStats";
import { useRecentActivity } from "~/hooks/vault/useRecentActivity";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { getRarityGlow, getRarityBorder } from "~/components/vault/vault-theme";
import { VaultParticleExplosionModal } from "~/components/vault/VaultParticleExplosionModal";
import type { CardInstance } from "~/types/cards-display";
import { VaultNetWorthCard } from "./dashboard/VaultNetWorthCard";
import { VaultYieldProjectionsCard } from "./dashboard/VaultYieldProjectionsCard";
import { VaultRecentActivityCard, type ActivityEntry } from "./dashboard/VaultRecentActivityCard";
import { VaultShowcaseGrid } from "./dashboard/VaultShowcaseGrid";

interface VaultDashboardSectionProps {
  onNavigate?: (section: any) => void;
}

export function VaultDashboardSection({ onNavigate }: VaultDashboardSectionProps) {
  const { user } = useUser();
  const { stats, loading: statsLoading } = useVaultStats();
  const { activities, loading: activitiesLoading } = useRecentActivity() as {
    activities: ActivityEntry[] | undefined;
    loading: boolean;
  };

  const [showCoinExplosion, setShowCoinExplosion] = useState(false);
  const [claimedBonusAmount, setClaimedBonusAmount] = useState(0);

  const { data: hasImported } = api.nsImport.hasImported.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const [isNoticeDismissed, setIsNoticeDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ns-import-notice-dismissed") === "true";
    }
    return false;
  });

  const handleDismissNotice = () => {
    setIsNoticeDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("ns-import-notice-dismissed", "true");
    }
  };

  const { isLoading: earningsLoading } = api.vault.getTodayEarnings.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: balanceData, refetch: refetchBalance } = api.vault.getBalance.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );

  const { data: levelData } = api.vault.getVaultLevel.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );

  const { data: topCardsData, isLoading: topCardsLoading } = api.cards.getMyCards.useQuery(
    { sortBy: "value" },
    { enabled: !!user }
  );

  const { data: userData } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: myAchievements } = api.achievements.getAllByCountry.useQuery(
    { countryId: userData?.countryId || "" },
    { enabled: !!userData?.countryId }
  );

  const { data: leaderboard } = api.achievements.getLeaderboard.useQuery(
    { limit: 100 },
    { enabled: !!userData?.countryId }
  );

  const { data: passiveIncomeData } = api.vault.calculatePassiveIncome.useQuery(
    { countryId: userData?.countryId ?? "" },
    { enabled: !!userData?.countryId }
  );

  const { data: budgetMultiplierData } = api.vault.getBudgetMultiplier.useQuery(
    { countryId: userData?.countryId ?? "" },
    { enabled: !!userData?.countryId }
  );

  const { data: activeCapData, isLoading: activeCapLoading } = api.vault.checkDailyCap.useQuery(
    { earnType: "EARN_ACTIVE" },
    { enabled: !!user }
  );

  const { data: socialCapData, isLoading: socialCapLoading } = api.vault.checkDailyCap.useQuery(
    { earnType: "EARN_SOCIAL" },
    { enabled: !!user }
  );

  type TopCardItem = NonNullable<typeof topCardsData>[number];

  const featuredCards: CardInstance[] = useMemo(
    () =>
      topCardsData?.slice(0, 3).map((ownership: TopCardItem) => {
        const cardObj = (ownership.cards || {}) as any;
        return {
          id: cardObj.id ?? ownership.id,
          title: cardObj.title ?? "Unknown",
          description: cardObj.description || "",
          artwork: cardObj.artwork || "/images/cards/placeholder-nation.png",
          artworkVariants: cardObj.artworkVariants || null,
          cardType: cardObj.cardType ?? "NS_IMPORT",
          rarity: cardObj.rarity ?? "COMMON",
          season: cardObj.season ?? 1,
          nsCardId: cardObj.nsCardId || null,
          nsSeason: cardObj.nsSeason || null,
          nsData: cardObj.nsData || null,
          wikiSource: cardObj.wikiSource || null,
          wikiArticleTitle: cardObj.wikiArticleTitle || null,
          wikiUrl: cardObj.wikiUrl || null,
          countryId: cardObj.countryId ?? null,
          stats: cardObj.stats || {},
          marketValue: cardObj.marketValue || 0,
          totalSupply: cardObj.totalSupply || 0,
          level: ownership.level || 1,
          evolutionStage: cardObj.evolutionStage || 0,
          enhancements: cardObj.enhancements || null,
          createdAt: cardObj.createdAt ?? new Date(),
          updatedAt: cardObj.updatedAt ?? new Date(),
          lastTrade: cardObj.lastTrade || null,
          country: cardObj.country ?? null,
          owners: [],
        };
      }) || [],
    [topCardsData]
  );

  const claimDailyBonus = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      setClaimedBonusAmount(data.bonus);
      setShowCoinExplosion(true);

      vaultNotify.dailyBonusClaimed(data.message);
      void refetchBalance();

      setTimeout(() => {
        setShowCoinExplosion(false);
      }, 3200);
    },
    onError: (error) => {
      vaultNotify.error(error.message);
    },
  });

  const loading = statsLoading || activitiesLoading || earningsLoading;

  const collectionValuation = stats?.deckValue ?? 0;
  const liquidCredits = balanceData?.credits ?? 0;
  const netWorth = collectionValuation + liquidCredits;

  return (
    <div className="space-y-6">
      {/* 2-Column Premium Banking Grid Layout */}
      <div className="facet-layout-grid-3">
        {/* Left Column (Financial Center & Ledger) */}
        <div className="facet-layout-main-span-2 space-y-6">
          <VaultNetWorthCard
            vaultLevel={levelData?.vaultLevel ?? 1}
            netWorth={netWorth}
            liquidCredits={liquidCredits}
            collectionValuation={collectionValuation}
            totalCards={stats?.totalCards ?? 0}
            capacityBoost={stats?.capacityBoost ?? 0}
            unopenedPacks={stats?.unopenedPacks ?? 0}
            activeAuctions={stats?.activeAuctions ?? 0}
          />

          <VaultYieldProjectionsCard
            loading={loading}
            canClaimDailyBonus={balanceData?.canClaimDailyBonus}
            isClaimPending={claimDailyBonus.isPending}
            onClaimDailyBonus={() => claimDailyBonus.mutate()}
            passiveIncomeData={passiveIncomeData}
            loginStreak={balanceData?.loginStreak ?? 0}
            budgetMultiplierPercent={budgetMultiplierData?.percentChange ?? 0}
            vaultLevel={levelData?.vaultLevel ?? 1}
            activeCapLoading={activeCapLoading}
            activeCapData={activeCapData}
            socialCapLoading={socialCapLoading}
            socialCapData={socialCapData}
          />

          {/* Activity placed directly under Treasury Revenue & Yields */}
          <VaultRecentActivityCard loading={loading} activities={activities} />
        </div>

        {/* Right Sidebar Column (Card Holdings Top Right + Milestones) */}
        <VaultShowcaseGrid
          hasImported={hasImported}
          isNoticeDismissed={isNoticeDismissed}
          onDismissNotice={handleDismissNotice}
          onNavigate={onNavigate}
          featuredCards={featuredCards}
          topCardsLoading={topCardsLoading}
          myAchievements={myAchievements}
          leaderboard={leaderboard}
          userCountryId={userData?.countryId}
          totalCards={stats?.totalCards ?? 0}
          creditsBalance={balanceData?.credits ?? 0}
          getRarityGlow={getRarityGlow}
          getRarityBorder={getRarityBorder}
        />
      </div>

      <VaultParticleExplosionModal
        open={showCoinExplosion}
        title="Daily Bonus Claimed!"
        subtitle="Added to Vault Balance"
        amount={claimedBonusAmount}
        icon={<div className="animate-bounce text-4xl">🎁</div>}
      />
    </div>
  );
}
