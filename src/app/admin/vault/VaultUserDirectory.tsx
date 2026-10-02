"use client";

import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  SystemRestart as Loader2,
  Gift,
  ArrowSeparateVertical as ArrowUpDown,
  MoreHoriz as MoreHorizontal,
  FireFlame as Flame,
  ClockRotateRight as History,
  Crown as Gem,
} from "iconoir-react";

import { FacetDataTable, type FacetColumn } from "~/components/ui/data-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

export function VaultUserDirectory() {
  const notify = useNotify();

  // Page state
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Selected target for adjustments
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    clerkUserId: string;
    displayName: string;
    country?: { name: string; flag: string } | null;
    credits: number;
  } | null>(null);

  // Dialog open states
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isPackOpen, setIsPackOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isStreakOpen, setIsStreakOpen] = useState(false);
  const [isCosmeticsOpen, setIsCosmeticsOpen] = useState(false);

  // Credit adjustment state
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState("ADMIN_ADJUSTMENT");
  const [adjustSource, setAdjustSource] = useState("Admin Adjustment");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustNotify, setAdjustNotify] = useState(true);

  // Pack award state
  const [selectedPackId, setSelectedPackId] = useState("");
  const [packMethod, setPackMethod] = useState("ADMIN_AWARD");
  const [packNotify, setPackNotify] = useState(true);
  const [streakDelta, setStreakDelta] = useState(0);

  // tRPC Queries
  const {
    data: vaultData,
    isLoading: isVaultsLoading,
    refetch: refetchVaults,
  } = api.vault.adminListVaults.useQuery(
    {
      search: searchTerm,
      limit,
      offset: (page - 1) * limit,
    },
    { placeholderData: (prev) => prev }
  );

  const { data: packsData } = api.cardPacks.getAllPacks.useQuery();

  // tRPC Mutations
  const adjustMutation = api.vault.adminAdjustCredits.useMutation({
    onSuccess: (data) => {
      notify.success("Success", data.message || "Credits adjusted successfully");
      setIsAdjustOpen(false);
      resetAdjustForm();
      refetchVaults();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to adjust credits");
    },
  });

  const awardPackMutation = api.cardPacks.adminAwardPack.useMutation({
    onSuccess: (data) => {
      notify.success("Success", data.message || "Pack awarded successfully");
      setIsPackOpen(false);
      resetPackForm();
      refetchVaults();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to award pack");
    },
  });

  const adjustStreakMutation = api.vault.adminAdjustStreak.useMutation({
    onSuccess: (data) => {
      notify.success("Success", `Streak updated: ${data.newStreak} days`);
      setIsStreakOpen(false);
      refetchVaults();
    },
    onError: (err) => notify.error("Error", err.message || "Failed to adjust streak"),
  });

  const listTransactionsQuery = api.vault.adminListUserTransactions.useQuery(
    { userId: selectedUser?.id ?? "", limit: 100 },
    { enabled: Boolean(isHistoryOpen && selectedUser?.id) }
  );

  const { data: storeItems } = api.vault.listStoreItems.useQuery();

  const { data: userPurchases, refetch: refetchUserPurchases } =
    api.vault.adminGetPurchasedItems.useQuery(
      { userId: selectedUser?.id ?? "" },
      { enabled: Boolean(isCosmeticsOpen && selectedUser?.id) }
    );

  const { data: userEquipped, refetch: refetchUserEquipped } =
    api.vault.adminGetEquippedCosmetics.useQuery(
      { userId: selectedUser?.id ?? "" },
      { enabled: Boolean(isCosmeticsOpen && selectedUser?.id) }
    );

  const adminToggleEquipMutation = api.vault.adminToggleEquipCosmetic.useMutation({
    onSuccess: (data) => {
      notify.success(
        "Success",
        data.isEquipped ? "Cosmetic equipped for user" : "Cosmetic unequipped for user"
      );
      void refetchUserEquipped();
      void refetchVaults();
    },
    onError: (err) => notify.error("Failed to toggle equipped state", err.message),
  });

  const grantItemMutation = api.vault.adminGrantStoreItem.useMutation({
    onSuccess: (data) => {
      notify.success("Granted", data.message || "Item granted successfully");
      void refetchUserPurchases();
      void refetchUserEquipped();
      void refetchVaults();
    },
    onError: (err) => notify.error("Failed to grant", err.message),
  });

  const revokeItemMutation = api.vault.adminRevokeStoreItem.useMutation({
    onSuccess: (data) => {
      notify.success("Revoked", data.message || "Item revoked successfully");
      void refetchUserPurchases();
      void refetchUserEquipped();
      void refetchVaults();
    },
    onError: (err) => notify.error("Failed to revoke", err.message),
  });

  // Resets
  const resetAdjustForm = () => {
    setAdjustAmount("");
    setAdjustType("ADMIN_ADJUSTMENT");
    setAdjustSource("Admin Adjustment");
    setAdjustReason("");
    setAdjustNotify(true);
  };

  const resetPackForm = () => {
    setSelectedPackId("");
    setPackMethod("ADMIN_AWARD");
    setPackNotify(true);
  };

  // Handlers
  const handleOpenAdjust = (user: any) => {
    setSelectedUser({
      id: user.id,
      clerkUserId: user.clerkUserId,
      displayName: user.country?.name ?? user.wikiUsername ?? user.clerkUserId,
      country: user.country,
      credits: user.vault.credits,
    });
    setIsAdjustOpen(true);
  };

  const handleOpenPack = (user: any) => {
    setSelectedUser({
      id: user.id,
      clerkUserId: user.clerkUserId,
      displayName: user.country?.name ?? user.wikiUsername ?? user.clerkUserId,
      country: user.country,
      credits: user.vault.credits,
    });
    setIsPackOpen(true);
  };

  const handleOpenCosmetics = (user: any) => {
    setSelectedUser({
      id: user.id,
      clerkUserId: user.clerkUserId,
      displayName: user.country?.name ?? user.wikiUsername ?? user.clerkUserId,
      country: user.country,
      credits: user.vault.credits,
    });
    setIsCosmeticsOpen(true);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const amountNum = parseFloat(adjustAmount);
    if (isNaN(amountNum) || amountNum === 0) {
      notify.error("Invalid Amount", "Please enter a valid non-zero amount.");
      return;
    }

    if (!adjustReason.trim()) {
      notify.error("Audit Reason Required", "A reason is required for administrative audit logs.");
      return;
    }

    adjustMutation.mutate({
      targetUserId: selectedUser.id,
      amount: amountNum,
      type: adjustType as any,
      source: adjustSource,
      reason: adjustReason,
      sendNotification: adjustNotify,
    });
  };

  const handlePackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedPackId) {
      notify.error("Validation Error", "Please select a pack to award.");
      return;
    }

    awardPackMutation.mutate({
      targetUserId: selectedUser.id,
      packId: selectedPackId,
      acquiredMethod: packMethod,
      sendNotification: packNotify,
    });
  };

  const totalItems = vaultData?.total ?? 0;
  const selectedUserVault = selectedUser
    ? vaultData?.users?.find((u: any) => u.id === selectedUser.id)?.vault
    : null;

  const columns = useMemo<FacetColumn<any>[]>(
    () => [
      {
        key: "user",
        header: "User Identification",
        mobileRole: "hero",
        accessor: (user: any) => user.country?.name ?? user.wikiUsername ?? user.clerkUserId,
        render: (_val: unknown, user: any) => (
          <div className="flex items-center gap-2">
            {user.country?.flag && (
              <img
                src={user.country.flag}
                alt=""
                className="rounded-control-sm h-4 w-6 shrink-0 object-cover"
              />
            )}
            <div className="min-w-0">
              <div
                className="text-label max-w-[200px] truncate font-semibold"
                title={`Clerk ID: ${user.clerkUserId}`}
              >
                {user.country?.name ?? user.wikiUsername ?? user.clerkUserId}
              </div>
              {user.country?.name && (
                <div className="text-label-secondary text-footnote flex max-w-[220px] flex-wrap gap-x-2 gap-y-0.5">
                  {user.wikiUsername && <span>Wiki: {user.wikiUsername}</span>}
                  {user.forumUsername && <span>Forum: {user.forumUsername}</span>}
                  {user.discordUsername && <span>Discord: {user.discordUsername}</span>}
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "credits",
        header: "Balance (IxC)",
        align: "right",
        sortable: true,
        mobileRole: "badge",
        accessor: (user: any) => user.vault?.credits ?? 0,
        render: (_val: unknown, user: any) => (
          <span className="text-yellow font-semibold tabular-nums">
            {(user.vault?.credits ?? 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: "lifetimeEarned",
        header: "Lifetime Earned",
        align: "right",
        sortable: true,
        mobileRole: "field",
        mobileLabel: "Earned",
        accessor: (user: any) => user.vault?.lifetimeEarned ?? 0,
        render: (_val: unknown, user: any) => (
          <span className="text-label-secondary text-footnote tabular-nums">
            {(user.vault?.lifetimeEarned ?? 0).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
          </span>
        ),
      },
      {
        key: "lifetimeSpent",
        header: "Lifetime Spent",
        align: "right",
        sortable: true,
        mobileRole: "field",
        mobileLabel: "Spent",
        accessor: (user: any) => user.vault?.lifetimeSpent ?? 0,
        render: (_val: unknown, user: any) => (
          <span className="text-label-secondary text-footnote tabular-nums">
            {(user.vault?.lifetimeSpent ?? 0).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
          </span>
        ),
      },
      {
        key: "streak",
        header: "Streak",
        align: "center",
        mobileRole: "field",
        accessor: (user: any) => user.vault?.loginStreak ?? 0,
        render: (_val: unknown, user: any) => (
          <Badge variant="orange">{user.vault?.loginStreak ?? 0}d</Badge>
        ),
      },
      {
        key: "level",
        header: "Level",
        align: "center",
        mobileRole: "field",
        accessor: (user: any) => user.vault?.vaultLevel ?? 1,
        render: (_val: unknown, user: any) => (
          <Badge variant="blue">Lvl {user.vault?.vaultLevel ?? 1}</Badge>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        align: "center",
        mobileRole: "action",
        render: (_val: unknown, user: any) => (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger className="border-separator bg-background text-label hover:bg-fill-4 rounded-control text-caption inline-flex h-8 cursor-pointer items-center justify-center gap-2 border px-3 py-2 select-none">
                <MoreHorizontal className="h-3.5 w-3.5 shrink-0" />
                <span>Actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => handleOpenAdjust(user)}
                  className="cursor-pointer gap-2 py-2"
                >
                  <ArrowUpDown className="text-yellow h-3.5 w-3.5" />
                  <span>Adjust Credits</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleOpenPack(user)}
                  className="cursor-pointer gap-2 py-2"
                >
                  <Gift className="text-blue h-3.5 w-3.5" />
                  <span>Award Card Pack</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleOpenCosmetics(user)}
                  className="cursor-pointer gap-2 py-2"
                >
                  <Gem className="text-purple h-3.5 w-3.5" />
                  <span>Manage Cosmetics</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedUser({
                      id: user.id,
                      clerkUserId: user.clerkUserId,
                      displayName: user.country?.name ?? user.wikiUsername ?? user.clerkUserId,
                      country: user.country,
                      credits: user.vault.credits,
                    });
                    setIsStreakOpen(true);
                    setStreakDelta(0);
                  }}
                  className="cursor-pointer gap-2 py-2"
                >
                  <Flame className="text-orange h-3.5 w-3.5" />
                  <span>Adjust Streak</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedUser({
                      id: user.id,
                      clerkUserId: user.clerkUserId,
                      displayName: user.country?.name ?? user.wikiUsername ?? user.clerkUserId,
                      country: user.country,
                      credits: user.vault.credits,
                    });
                    setIsHistoryOpen(true);
                  }}
                  className="cursor-pointer gap-2 py-2"
                >
                  <History className="text-label-secondary h-3.5 w-3.5" />
                  <span>Transaction History</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Directory Table */}
      <FacetDataTable
        data={vaultData?.users || []}
        columns={columns}
        title="User Vault Directory"
        description="Search, inspect, and adjust user balances, level progression, and card inventory."
        searchable
        searchPlaceholder="Search user ID, clerk ID, usernames..."
        searchValue={searchTerm}
        onSearchChange={(term) => {
          setSearchTerm(term);
          setPage(1);
        }}
        paginated
        pageSize={limit}
        page={page}
        totalCount={totalItems}
        onPageChange={setPage}
        loading={isVaultsLoading}
        emptyMessage="No user vaults found matching your search."
      />

      {/* Adjust Credits Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Adjust Credits Balance</DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4 py-2">
              <div className="bg-fill-4 border-separator rounded-control border p-3">
                <div className="text-label-secondary text-footnote">Target User</div>
                <div className="mt-0.5 flex items-center gap-2">
                  {selectedUser.country?.flag && (
                    <img
                      src={selectedUser.country.flag}
                      alt=""
                      className="rounded-control-sm h-4 w-6 shrink-0 object-cover"
                    />
                  )}
                  <div className="text-label text-headline truncate">
                    {selectedUser.displayName}
                  </div>
                </div>
                <div className="text-footnote mt-1 flex items-center justify-between">
                  <span className="text-label-secondary">Current Balance:</span>
                  <span className="text-yellow font-semibold tabular-nums">
                    {selectedUser.credits.toLocaleString()} IxC
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adjust-amount">Adjustment Amount</Label>
                  <Input
                    id="adjust-amount"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 100 or -50"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    required
                    className="font-mono"
                  />
                  <span className="text-label-secondary text-footnote">
                    Positive adds, negative subtracts.
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adjust-type">Transaction Type</Label>
                  <Select value={adjustType} onValueChange={setAdjustType}>
                    <SelectTrigger id="adjust-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN_ADJUSTMENT">Admin Adjustment</SelectItem>
                      <SelectItem value="EARN_ACTIVE">Earn Active Gameplay</SelectItem>
                      <SelectItem value="EARN_SOCIAL">Earn Social Engagement</SelectItem>
                      <SelectItem value="SPEND_MARKET">Spend Marketplace</SelectItem>
                      <SelectItem value="SPEND_BOOST">Spend Deck Boost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjust-source">System Source</Label>
                <Input
                  id="adjust-source"
                  type="text"
                  value={adjustSource}
                  onChange={(e) => setAdjustSource(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjust-reason">Audit Reason</Label>
                <Input
                  id="adjust-reason"
                  type="text"
                  placeholder="Explanation for audit logs"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                />
              </div>

              <div className="border-separator bg-fill-4 rounded-control flex items-center justify-between border p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-label text-caption">Send Alert Notification</span>
                  <span className="text-label-secondary text-footnote">
                    Send notification directly to user profile feed.
                  </span>
                </div>
                <Switch checked={adjustNotify} onCheckedChange={setAdjustNotify} />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAdjustOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={adjustMutation.isPending}>
                  {adjustMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adjusting...
                    </>
                  ) : (
                    "Apply Adjustment"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust Streak Dialog */}
      <Dialog open={isStreakOpen} onOpenChange={setIsStreakOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Adjust Login Streak</DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                adjustStreakMutation.mutate({
                  targetUserId: selectedUser.id,
                  delta: Number(streakDelta),
                });
              }}
              className="space-y-4 py-2"
            >
              <div className="bg-fill-4 border-separator rounded-control border p-3">
                <div className="text-label-secondary text-footnote">Target User</div>
                <div className="mt-0.5 flex items-center gap-2">
                  {selectedUser.country?.flag && (
                    <img
                      src={selectedUser.country.flag}
                      alt=""
                      className="rounded-control-sm h-4 w-6"
                    />
                  )}
                  <div className="text-label font-semibold">{selectedUser.displayName}</div>
                </div>
                <div className="text-label-secondary text-body mt-2">
                  Current Streak: {selectedUserVault?.loginStreak ?? "-"} days
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="streak-delta">Streak Delta (positive or negative)</Label>
                <Input
                  id="streak-delta"
                  type="number"
                  step="1"
                  value={String(streakDelta)}
                  onChange={(e) => setStreakDelta(Number(e.target.value))}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsStreakOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Apply</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction history sheet */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent size="wide" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">Transaction History</SheetTitle>
          </SheetHeader>

          <div className="py-2">
            {listTransactionsQuery.isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="rounded-control h-8 w-full" />
                ))}
              </div>
            ) : (
              <Table containerClassName="max-h-80">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3">Time</TableHead>
                    <TableHead className="px-3 text-right">Amount</TableHead>
                    <TableHead className="px-3">Type</TableHead>
                    <TableHead className="px-3">Source</TableHead>
                    <TableHead className="px-3 text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listTransactionsQuery.data?.transactions?.map((tx: any) => (
                    <TableRow key={tx.id} className="border-t">
                      <TableCell className="text-label-secondary text-footnote px-3">
                        {new Date(tx.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${tx.credits >= 0 ? "text-green" : "text-red"}`}
                      >
                        {tx.credits >= 0 ? "+" : ""}
                        {tx.credits}
                      </TableCell>
                      <TableCell className="text-footnote px-3">{tx.type}</TableCell>
                      <TableCell className="text-label-secondary text-footnote max-w-[200px] truncate px-3">
                        {tx.source}
                      </TableCell>
                      <TableCell className="text-footnote px-3 text-right">
                        {tx.balanceAfter}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Award Pack Dialog */}
      <Dialog open={isPackOpen} onOpenChange={setIsPackOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Award Card Pack</DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <form onSubmit={handlePackSubmit} className="space-y-4 py-2">
              <div className="bg-fill-4 border-separator rounded-control border p-3">
                <div className="text-label-secondary text-footnote">Recipient User</div>
                <div className="mt-0.5 flex items-center gap-2">
                  {selectedUser.country?.flag && (
                    <img
                      src={selectedUser.country.flag}
                      alt=""
                      className="rounded-control-sm h-4 w-6 shrink-0 object-cover"
                    />
                  )}
                  <div className="text-label text-headline truncate">
                    {selectedUser.displayName}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pack-select">Select Card Pack Template</Label>
                <Select value={selectedPackId} onValueChange={setSelectedPackId}>
                  <SelectTrigger id="pack-select">
                    <SelectValue placeholder="Choose a pack configurations..." />
                  </SelectTrigger>
                  <SelectContent>
                    {packsData?.packs?.map((pack: any) => (
                      <SelectItem key={pack.id} value={pack.id}>
                        {pack.name} ({pack.cardCount} cards, {pack.packType})
                      </SelectItem>
                    ))}
                    {!packsData?.packs ||
                      (packsData.packs.length === 0 && (
                        <SelectItem value="none" disabled>
                          No packs available
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pack-method">Acquired Method</Label>
                <Input
                  id="pack-method"
                  type="text"
                  value={packMethod}
                  onChange={(e) => setPackMethod(e.target.value)}
                  required
                />
              </div>

              <div className="border-separator bg-fill-4 rounded-control flex items-center justify-between border p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-label text-caption">Send Alert Notification</span>
                  <span className="text-label-secondary text-footnote">
                    Notify user they received a new pack configuration.
                  </span>
                </div>
                <Switch checked={packNotify} onCheckedChange={setPackNotify} />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPackOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={awardPackMutation.isPending}>
                  {awardPackMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Awarding...
                    </>
                  ) : (
                    "Award Pack"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Cosmetics Dialog */}
      <Dialog open={isCosmeticsOpen} onOpenChange={setIsCosmeticsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gem className="text-purple h-5 w-5" />
              Manage Cosmetics & Upgrades
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-2">
              <div className="bg-fill-4 border-separator rounded-control border p-3">
                <div className="text-label-secondary text-footnote">Target User</div>
                <div className="mt-0.5 flex items-center gap-2">
                  {selectedUser.country?.flag && (
                    <img
                      src={selectedUser.country.flag}
                      alt=""
                      className="rounded-control-sm h-4 w-6 shrink-0 object-cover"
                    />
                  )}
                  <div className="text-label text-headline truncate">
                    {selectedUser.displayName}
                  </div>
                </div>
              </div>

              <div className="border-separator bg-fill-4 rounded-control max-h-80 space-y-2 overflow-y-auto border p-2">
                {storeItems?.map((item: any) => {
                  const ownedItemIds = userPurchases?.purchasedItemIds || [];
                  const isOwned = ownedItemIds.includes(item.id);
                  const equippedIds = userEquipped?.equipped || [];
                  const isEquipped = equippedIds.includes(item.id);
                  const isPending =
                    (grantItemMutation.isPending &&
                      grantItemMutation.variables?.itemId === item.id) ||
                    (revokeItemMutation.isPending &&
                      revokeItemMutation.variables?.itemId === item.id);
                  const isTogglePending =
                    adminToggleEquipMutation.isPending &&
                    adminToggleEquipMutation.variables?.itemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="border-separator bg-surface rounded-control flex items-center justify-between border p-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-control-sm bg-purple/10 text-purple mt-0.5 flex h-7 w-7 items-center justify-center">
                          <Gem className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-label text-caption">{item.name}</div>
                          <div className="text-label-secondary text-footnote line-clamp-1 max-w-[280px]">
                            {item.description}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className="px-1 py-0 capitalize">
                              {item.category}
                            </Badge>
                            <span className="text-footnote text-yellow tabular-nums">
                              {item.price} IxC
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isOwned && item.category === "cosmetics" && (
                          <Button
                            size="sm"
                            variant={isEquipped ? "default" : "outline"}
                            disabled={isTogglePending || isPending}
                            onClick={() =>
                              adminToggleEquipMutation.mutate({
                                userId: selectedUser.id,
                                itemId: item.id,
                              })
                            }
                            className={`text-caption h-7 px-3 ${
                              isEquipped
                                ? "bg-purple text-on-purple hover:bg-purple"
                                : "border-purple/30 bg-purple/5 text-purple hover:bg-purple/10 hover:text-purple"
                            }`}
                          >
                            {isTogglePending ? "..." : isEquipped ? "Equipped" : "Equip"}
                          </Button>
                        )}
                        {isOwned ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isPending || isTogglePending}
                            onClick={() =>
                              revokeItemMutation.mutate({
                                userId: selectedUser.id,
                                itemId: item.id,
                              })
                            }
                          >
                            {isPending ? "Revoking..." : "Revoke"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isPending}
                            onClick={() =>
                              grantItemMutation.mutate({
                                userId: selectedUser.id,
                                itemId: item.id,
                              })
                            }
                          >
                            {isPending ? "Granting..." : "Grant"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(!storeItems || storeItems.length === 0) && (
                  <p className="text-label-secondary text-footnote py-4 text-center">
                    No store items configured.
                  </p>
                )}
              </div>

              <DialogFooter className="border-separator border-t pt-3">
                <Button variant="outline" onClick={() => setIsCosmeticsOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
