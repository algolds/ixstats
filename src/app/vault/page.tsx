"use client";

import { Package, ShoppingCart, Folder } from "lucide-react";
import { VaultDashboard } from "~/components/vault/VaultDashboard";
import { QuickActions } from "~/components/vault/QuickActions";
import { useVaultStats } from "~/hooks/vault/useVaultStats";
import { useRecentActivity } from "~/hooks/vault/useRecentActivity";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { toast } from "sonner";

export default function VaultPage() {
  const { user } = useUser();
  const { stats, loading: statsLoading } = useVaultStats();
  const { activities, loading: activitiesLoading } = useRecentActivity();

  // Fetch today's earnings
  const { data: earningsData, isLoading: earningsLoading } =
    api.vault.getTodayEarnings.useQuery(undefined, {
      enabled: !!user,
    });

  // Fetch balance for login streak info
  const { data: balanceData, refetch: refetchBalance } = api.vault.getBalance.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );

  // Daily bonus mutation
  const claimDailyBonus = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      void refetchBalance();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleClaimDailyBonus = () => {
    claimDailyBonus.mutate();
  };

  const quickActions = [
    {
      label: "Open Pack",
      href: "/vault/packs",
      icon: Package,
      description: "Open your card packs",
    },
    {
      label: "Visit Market",
      href: "/vault/market",
      icon: ShoppingCart,
      description: "Browse card auctions",
    },
    {
      label: "View Collections",
      href: "/vault/collections",
      icon: Folder,
      description: "Organize your cards",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gold-400">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your card collection and IxCredits
        </p>
      </div>

      {/* Quick actions */}
      <QuickActions actions={quickActions} />

      {/* Dashboard content */}
      <VaultDashboard
        stats={stats}
        todayEarnings={earningsData}
        recentActivity={activities}
        loginStreak={balanceData?.loginStreak ?? 0}
        dailyBonusAvailable={balanceData?.canClaimDailyBonus ?? false}
        loading={statsLoading || activitiesLoading || earningsLoading}
        onClaimDailyBonus={handleClaimDailyBonus}
      />
    </div>
  );
}
