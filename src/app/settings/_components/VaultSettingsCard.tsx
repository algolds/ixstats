import { useState, useEffect } from "react";
import {
  Gem,
  Flame,
  CheckCircle,
  Database,
  TrendingUp,
  Coins,
  Cpu,
  Crown,
  BookOpen,
  Calendar,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import { useVaultBalance } from "~/hooks/vault/useVaultBalance";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import Link from "next/link";

export function VaultSettingsCard() {
  const notify = useNotify();

  const {
    balance,
    vaultLevel,
    vaultXp,
    loginStreak,
    isPremium,
    isLoading: balanceLoading,
    refresh: refreshBalance,
  } = useVaultBalance();

  const { data: ownedData, isLoading: ownedLoading } = api.vault.getPurchasedItems.useQuery();
  const { data: storeItems, isLoading: itemsLoading } = api.vault.listStoreItems.useQuery();
  const { data: equippedData, isLoading: equippedLoading } =
    api.vault.getEquippedCosmetics.useQuery();

  const ownedItemIds = ownedData?.purchasedItemIds || [];

  // Claim Daily Bonus Mutation
  const claimDailyMutation = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      notify.success("Daily Bonus Claimed!", `+${data.bonus} IxC earned.`);
      void refreshBalance();
    },
    onError: (err) => {
      notify.error("Claim Failed", err.message);
    },
  });

  // Purchase Store Item Mutation
  const utils = api.useUtils();
  const purchaseMutation = api.vault.purchaseStoreItem.useMutation({
    onSuccess: (data) => {
      notify.success("Purchase Successful!", data.message || "Store item purchased successfully.");
      void refreshBalance();
      void utils.vault.getPurchasedItems.invalidate();
    },
    onError: (err) => {
      notify.error("Purchase Failed", err.message);
    },
  });

  // Local state for cosmetics toggled on/off (stored in localStorage)
  const [activeCosmetics, setActiveCosmetics] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem("settings:active-cosmetics");
    return saved ? JSON.parse(saved) : {};
  });

  // Seed activeCosmetics from server state when equippedData loads
  useEffect(() => {
    if (equippedData?.equipped) {
      const equippedMap: Record<string, boolean> = {};
      for (const id of equippedData.equipped) {
        equippedMap[id] = true;
      }
      setActiveCosmetics(equippedMap);
      localStorage.setItem("settings:active-cosmetics", JSON.stringify(equippedMap));
      // Dispatch custom event to notify useActiveCosmetics
      window.dispatchEvent(new Event("cosmetics-updated"));
    }
  }, [equippedData]);

  // Toggle Equip Cosmetic Mutation
  const toggleCosmeticMutation = api.vault.toggleEquipCosmetic.useMutation({
    onSuccess: (data) => {
      const equippedMap: Record<string, boolean> = {};
      for (const id of data.equipped) {
        equippedMap[id] = true;
      }
      setActiveCosmetics(equippedMap);
      localStorage.setItem("settings:active-cosmetics", JSON.stringify(equippedMap));
      window.dispatchEvent(new Event("cosmetics-updated"));
      void utils.vault.getEquippedCosmetics.invalidate();
    },
    onError: (err) => {
      notify.error("Failed to toggle cosmetic", err.message);
      void utils.vault.getEquippedCosmetics.invalidate();
    },
  });

  const toggleCosmetic = (itemId: string) => {
    // Optimistic UI toggle
    setActiveCosmetics((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      localStorage.setItem("settings:active-cosmetics", JSON.stringify(next));
      notify.success(
        next[itemId] ? "Cosmetic Enabled!" : "Cosmetic Disabled!",
        `Customization preference updated.`
      );
      window.dispatchEvent(new Event("cosmetics-updated"));
      return next;
    });

    toggleCosmeticMutation.mutate({ itemId });
  };

  // Local state for upgrades toggled on/off (stored in localStorage)
  const [activeUpgrades, setActiveUpgrades] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem("settings:active-upgrades");
    return saved ? JSON.parse(saved) : {};
  });

  const toggleUpgrade = (itemId: string) => {
    setActiveUpgrades((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      localStorage.setItem("settings:active-upgrades", JSON.stringify(next));
      notify.success(
        next[itemId] ? "Upgrade Enabled!" : "Upgrade Disabled!",
        `Account upgrade preference updated.`
      );
      // Optional: dispatch custom event to alert components to re-render
      window.dispatchEvent(new Event("upgrades-updated"));
      return next;
    });
  };

  const progressPercent = Math.min(100, Math.max(0, ((vaultXp % 1000) / 1000) * 100));

  // Filter dynamic store items into upgrades and cosmetics
  const cosmeticsList = (storeItems || []).filter((item) => item.category === "cosmetics");
  const upgradesList = (storeItems || []).filter((item) => item.category === "upgrades");

  const ICON_MAP: Record<string, any> = {
    Sparkles: Gem,
    Gem,
    Cpu,
    Crown,
    BookOpen,
    Database,
    TrendingUp,
  };

  return (
    <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <TextureOverlay texture="halftone" opacity={0.03} />

        {/* Card Header */}
        <div className="relative z-10 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Vault Rewards & Upgrades
              </h2>
            </div>
          </div>
          <Link
            href="/vault/marketplace"
            className="glass-interactive flex items-center gap-1 rounded-xl bg-white/50 px-3 py-1.5 text-xs font-semibold text-amber-600 transition-all hover:bg-white dark:bg-slate-800/50 dark:text-amber-400 dark:hover:bg-slate-800"
          >
            Vault Store <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Vault Stats Panel */}
        <div className="relative z-10 mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Balance and Premium status */}
          <div className="flex flex-col justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <div>
              <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                Credits Balance
              </label>
              <p className="mt-1 flex items-center gap-1 text-xl font-black text-slate-950 dark:text-white">
                <Coins className="h-5 w-5 text-amber-500" />
                {balanceLoading ? "..." : balance.toLocaleString()}
                <span className="text-[10px] font-bold text-slate-400">IxC</span>
              </p>
            </div>
            {isPremium && (
              <span className="mt-2 inline-flex items-center gap-1 self-start rounded-md bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                Premium Active
              </span>
            )}
          </div>

          {/* Level Progress */}
          <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                Vault Level {vaultLevel}
              </label>
              <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400">
                {vaultXp % 1000} / 1000 XP
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/50 dark:bg-slate-800/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[9px] text-slate-400">
              Level up to unlock larger passive yields
            </p>
          </div>

          {/* Login Streak & Claim Rewards */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <div>
              <div className="flex items-center gap-1">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {loginStreak} Days
                </span>
              </div>
              <label className="mt-1 block text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                Streak Bonus
              </label>
            </div>
            <button
              onClick={() => claimDailyMutation.mutate()}
              disabled={claimDailyMutation.isPending}
              className="glass-interactive flex items-center gap-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-all hover:scale-105 disabled:opacity-50"
            >
              <Calendar className="h-3.5 w-3.5" />
              {claimDailyMutation.isPending ? "Claiming..." : "Claim"}
            </button>
          </div>
        </div>

        {/* Upgrades & Upgraded Stats */}
        <div className="relative z-10 mb-6 border-t border-slate-100 pt-6 dark:border-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold tracking-widest text-slate-900 uppercase dark:text-white">
              Account Upgrades
            </h3>
          </div>
          {ownedLoading || itemsLoading ? (
            <div className="py-4 text-center text-xs text-slate-400">Loading upgrades...</div>
          ) : upgradesList.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              No account upgrades available.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {upgradesList.map((item) => {
                const isOwned = ownedItemIds.includes(item.id);
                const ItemIcon = ICON_MAP[item.icon] || TrendingUp;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                      isOwned
                        ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10"
                        : "border-slate-200 bg-white/20 opacity-60 dark:border-slate-800 dark:bg-slate-900/10"
                    }`}
                  >
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <div
                          className={`rounded-lg p-1.5 ${isOwned ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}
                        >
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {item.name}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {isOwned ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="h-3 w-3" /> Unlocked
                          </span>
                          <button
                            onClick={() => toggleUpgrade(item.id)}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                              (activeUpgrades[item.id] ?? false)
                                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {(activeUpgrades[item.id] ?? false) ? "Enabled" : "Enable"}
                          </button>
                        </>
                      ) : (
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <Lock className="h-3.5 w-3.5 text-slate-400" /> {item.price} IxC
                          </span>
                          <button
                            onClick={() => purchaseMutation.mutate({ itemId: item.id })}
                            disabled={balance < item.price || purchaseMutation.isPending}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                              balance >= item.price
                                ? "bg-amber-500 text-white shadow-md shadow-amber-500/10 hover:bg-amber-600 hover:shadow-amber-500/20 active:scale-95"
                                : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                            }`}
                          >
                            {purchaseMutation.isPending &&
                            purchaseMutation.variables?.itemId === item.id
                              ? "Buying..."
                              : "Buy"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cosmetics & Profile Customization */}
        <div
          id="cosmetics-section"
          className="relative z-10 border-t border-slate-100 pt-6 dark:border-slate-800"
        >
          <div className="mb-4 flex items-center gap-2">
            <Gem className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-bold tracking-widest text-slate-900 uppercase dark:text-white">
              Cosmetics Preferences
            </h3>
          </div>
          {ownedLoading || itemsLoading || equippedLoading ? (
            <div className="py-4 text-center text-xs text-slate-400">Loading cosmetics...</div>
          ) : cosmeticsList.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              No cosmetics configured in storefront.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {cosmeticsList.map((item) => {
                const isOwned = ownedItemIds.includes(item.id);
                const ItemIcon = ICON_MAP[item.icon] || Gem;
                const isEnabled = activeCosmetics[item.id] ?? false;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                      isOwned
                        ? "border-purple-500/30 bg-purple-500/5 dark:bg-purple-500/10"
                        : "border-slate-200 bg-white/20 opacity-60 dark:border-slate-800 dark:bg-slate-900/10"
                    }`}
                  >
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <div
                          className={`rounded-lg p-1.5 ${isOwned ? "bg-purple-500/10 text-purple-600" : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}
                        >
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {item.name}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      {isOwned ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-600 dark:text-purple-400">
                            <CheckCircle className="h-3 w-3" /> Unlocked
                          </span>
                          <button
                            onClick={() => toggleCosmetic(item.id)}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                              isEnabled
                                ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {isEnabled ? "Enabled" : "Enable"}
                          </button>
                        </>
                      ) : (
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <Lock className="h-3.5 w-3.5 text-slate-400" /> {item.price} IxC
                          </span>
                          <button
                            onClick={() => purchaseMutation.mutate({ itemId: item.id })}
                            disabled={balance < item.price || purchaseMutation.isPending}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                              balance >= item.price
                                ? "bg-amber-500 text-white shadow-md shadow-amber-500/10 hover:bg-amber-600 hover:shadow-amber-500/20 active:scale-95"
                                : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                            }`}
                          >
                            {purchaseMutation.isPending &&
                            purchaseMutation.variables?.itemId === item.id
                              ? "Buying..."
                              : "Buy"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
