// src/app/admin/vault/page.tsx
// Cards/Vault Admin Panel - manage credits, stream streak logins, award packs
"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useNotify } from "~/hooks/useNotify";
import { AdminHeader } from "../_components/AdminHeader";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
import {
  Wallet,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Gift,
  Coins,
  ArrowUpDown,
  History,
  Settings,
} from "lucide-react";

export default function VaultAdminPage() {
  usePageTitle({ title: "Admin - Vault & Credits" });
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
      notify.success(data.message || "Credits adjusted successfully");
      setIsAdjustOpen(false);
      resetAdjustForm();
      refetchVaults();
    },
    onError: (error) => {
      notify.error(error.message || "Failed to adjust credits");
    },
  });

  const awardPackMutation = api.cardPacks.adminAwardPack.useMutation({
    onSuccess: (data) => {
      notify.success(data.message || "Pack awarded successfully");
      setIsPackOpen(false);
      resetPackForm();
      refetchVaults();
    },
    onError: (error) => {
      notify.error(error.message || "Failed to award pack");
    },
  });

  // Vault config state & mutations
  const { data: vaultConfig, isLoading: isConfigLoading } = api.vault.adminGetVaultConfig.useQuery();
  const [configForm, setConfigForm] = useState({
    activeDailyCap: 100,
    socialDailyCap: 50,
    xpPerLevel: 1000,
    maxStreakBonus: 7,
    premiumMultiplier: 1,
  });

  useEffect(() => {
    if (vaultConfig) {
      setConfigForm({
        activeDailyCap: vaultConfig.activeDailyCap,
        socialDailyCap: vaultConfig.socialDailyCap,
        xpPerLevel: vaultConfig.xpPerLevel,
        maxStreakBonus: vaultConfig.maxStreakBonus,
        premiumMultiplier: vaultConfig.premiumMultiplier,
      });
    }
  }, [vaultConfig]);

  const saveConfigMutation = api.vault.adminSaveVaultConfig.useMutation({
    onSuccess: (data) => {
      notify.success(data.message || "Vault configuration saved");
    },
    onError: (error) => {
      notify.error(error.message || "Failed to save vault configuration");
    },
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate(configForm);
  };

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

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const amountNum = parseFloat(adjustAmount);
    if (isNaN(amountNum) || amountNum === 0) {
      notify.error("Please enter a valid non-zero amount.");
      return;
    }

    if (!adjustReason.trim()) {
      notify.error("A reason is required for administrative audit logs.");
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
      notify.error("Please select a pack to award.");
      return;
    }

    awardPackMutation.mutate({
      targetUserId: selectedUser.id,
      packId: selectedPackId,
      acquiredMethod: packMethod,
      sendNotification: packNotify,
    });
  };

  // Pagination bounds
  const totalItems = vaultData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Wallet}
        title="Vault & Credits Admin"
        description="Administrative panel for credit adjustments, login streak monitoring, and pack awards."
      />

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card-child rounded-xl border border-border/50 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Vault Users</span>
            <h3 className="text-2xl font-bold mt-1 text-foreground">{totalItems}</h3>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
            <Wallet className="h-6 w-6 text-amber-500" />
          </div>
        </div>

        <div className="glass-card-child rounded-xl border border-border/50 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pack Configurations</span>
            <h3 className="text-2xl font-bold mt-1 text-foreground">{packsData?.packs?.length ?? 0}</h3>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
            <Gift className="h-6 w-6 text-blue-500" />
          </div>
        </div>

        <div className="glass-card-child rounded-xl border border-border/50 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default Currency</span>
            <h3 className="text-2xl font-bold mt-1 text-foreground">IxCredits (IxC)</h3>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
            <Coins className="h-6 w-6 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Vault Configuration Card */}
      <Card className="border-border/50 bg-card/30 backdrop-blur-sm">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-amber-500" />
            Vault System Configuration
          </CardTitle>
          {!isConfigLoading && (
            <span className="text-[10px] text-muted-foreground">Applied immediately — no restart needed</span>
          )}
        </CardHeader>
        <CardContent>
          {isConfigLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-active-cap">Daily Cap (Active)</Label>
                  <div className="relative">
                    <Input
                      id="cfg-active-cap"
                      type="number"
                      min={1}
                      max={10000}
                      value={configForm.activeDailyCap}
                      onChange={(e) => setConfigForm((f) => ({ ...f, activeDailyCap: Number(e.target.value) }))}
                      className="bg-background/50 border-border/50 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">IxC</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-social-cap">Daily Cap (Social)</Label>
                  <div className="relative">
                    <Input
                      id="cfg-social-cap"
                      type="number"
                      min={1}
                      max={10000}
                      value={configForm.socialDailyCap}
                      onChange={(e) => setConfigForm((f) => ({ ...f, socialDailyCap: Number(e.target.value) }))}
                      className="bg-background/50 border-border/50 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">IxC</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-xp">XP per Level</Label>
                  <div className="relative">
                    <Input
                      id="cfg-xp"
                      type="number"
                      min={100}
                      max={100000}
                      value={configForm.xpPerLevel}
                      onChange={(e) => setConfigForm((f) => ({ ...f, xpPerLevel: Number(e.target.value) }))}
                      className="bg-background/50 border-border/50 font-mono pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">XP</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-streak">Max Streak Bonus</Label>
                  <div className="relative">
                    <Input
                      id="cfg-streak"
                      type="number"
                      min={1}
                      max={365}
                      value={configForm.maxStreakBonus}
                      onChange={(e) => setConfigForm((f) => ({ ...f, maxStreakBonus: Number(e.target.value) }))}
                      className="bg-background/50 border-border/50 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">IxC</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-premium">Premium Multiplier</Label>
                  <div className="relative">
                    <Input
                      id="cfg-premium"
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={configForm.premiumMultiplier}
                      onChange={(e) => setConfigForm((f) => ({ ...f, premiumMultiplier: Number(e.target.value) }))}
                      className="bg-background/50 border-border/50 font-mono pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">x</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                >
                  {saveConfigMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Configuration"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Main card panel */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            User Vault Directory
          </CardTitle>

          {/* Search bar */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search user ID, clerk ID, usernames..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1); // reset to first page on search
              }}
              className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary/30"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isVaultsLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !vaultData?.users || vaultData.users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No user vaults found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border/40 rounded-xl">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>User Identification</TableHead>
                    <TableHead className="text-right">Balance (IxC)</TableHead>
                    <TableHead className="text-right">Lifetime Earned</TableHead>
                    <TableHead className="text-right">Lifetime Spent</TableHead>
                    <TableHead className="text-center">Streak</TableHead>
                    <TableHead className="text-center">Level</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vaultData.users.map((user: any) => (
                    <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.country?.flag && (
                            <img src={user.country.flag} alt="" className="h-4 w-6 rounded-sm object-cover flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate max-w-[200px]" title={`Clerk ID: ${user.clerkUserId}`}>
                              {user.country?.name ?? user.wikiUsername ?? user.clerkUserId}
                            </div>
                            {user.country?.name && (
                              <div className="text-[10px] text-muted-foreground">
                                {user.wikiUsername && <span className="mr-2">Wiki: {user.wikiUsername}</span>}
                                {user.forumUsername && <span className="mr-2">Forum: {user.forumUsername}</span>}
                                {user.discordUsername && <span>Discord: {user.discordUsername}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        {user.vault.credits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {user.vault.lifetimeEarned.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {user.vault.lifetimeSpent.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        <Badge variant="outline" className="border-orange-500/20 bg-orange-500/5 text-orange-600 dark:text-orange-400">
                          {user.vault.loginStreak}d
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400">
                          Lvl {user.vault.vaultLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAdjust(user)}
                            className="h-8 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 gap-1.5 transition-all"
                          >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            Adjust
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPack(user)}
                            className="h-8 border-blue-500/30 text-blue-600 hover:bg-blue-50/10 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-300 gap-1.5 transition-all"
                          >
                            <Gift className="h-3.5 w-3.5" />
                            Award Pack
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({totalItems} total vaults)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Credits Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border/80 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Coins className="h-5 w-5 text-amber-500" />
              Adjust Credits Balance
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/40 border p-3">
                <div className="text-xs text-muted-foreground">Target User</div>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedUser.country?.flag && (
                    <img src={selectedUser.country.flag} alt="" className="h-4 w-6 rounded-sm object-cover flex-shrink-0" />
                  )}
                  <div className="font-semibold text-foreground text-sm truncate" title={`Clerk ID: ${selectedUser.clerkUserId}`}>
                    {selectedUser.displayName}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Current Balance:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {selectedUser.credits.toLocaleString()} IxC
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="adjust-amount">Adjustment Amount</Label>
                  <Input
                    id="adjust-amount"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 100 or -50"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground">Positive adds, negative subtracts.</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adjust-type">Transaction Type</Label>
                  <Select value={adjustType} onValueChange={setAdjustType}>
                    <SelectTrigger id="adjust-type" className="bg-background/50 border-border/50">
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

              <div className="space-y-1.5">
                <Label htmlFor="adjust-source">System Source</Label>
                <Input
                  id="adjust-source"
                  type="text"
                  value={adjustSource}
                  onChange={(e) => setAdjustSource(e.target.value)}
                  required
                  className="bg-background/50 border-border/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjust-reason">Audit Reason</Label>
                <Input
                  id="adjust-reason"
                  type="text"
                  placeholder="Mandatory explanation for audit logs"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                  className="bg-background/50 border-border/50"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/40 p-3 bg-muted/20">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-foreground">Send Alert Notification</span>
                  <span className="text-[10px] text-muted-foreground">Send notification directly to user profile feed.</span>
                </div>
                <Switch checked={adjustNotify} onCheckedChange={setAdjustNotify} />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAdjustOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={adjustMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
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

      {/* Award Pack Dialog */}
      <Dialog open={isPackOpen} onOpenChange={setIsPackOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border/80 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Gift className="h-5 w-5 text-blue-500" />
              Award Card Pack
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <form onSubmit={handlePackSubmit} className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/40 border p-3">
                <div className="text-xs text-muted-foreground">Recipient User</div>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedUser.country?.flag && (
                    <img src={selectedUser.country.flag} alt="" className="h-4 w-6 rounded-sm object-cover flex-shrink-0" />
                  )}
                  <div className="font-semibold text-foreground text-sm truncate" title={`Clerk ID: ${selectedUser.clerkUserId}`}>
                    {selectedUser.displayName}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pack-select">Select Card Pack Template</Label>
                <Select value={selectedPackId} onValueChange={setSelectedPackId}>
                  <SelectTrigger id="pack-select" className="bg-background/50 border-border/50">
                    <SelectValue placeholder="Choose a pack configurations..." />
                  </SelectTrigger>
                  <SelectContent>
                    {packsData?.packs?.map((pack: any) => (
                      <SelectItem key={pack.id} value={pack.id}>
                        {pack.name} ({pack.cardCount} cards, {pack.packType})
                      </SelectItem>
                    ))}
                    {!packsData?.packs || packsData.packs.length === 0 && (
                      <SelectItem value="none" disabled>No packs available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pack-method">Acquired Method</Label>
                <Input
                  id="pack-method"
                  type="text"
                  value={packMethod}
                  onChange={(e) => setPackMethod(e.target.value)}
                  required
                  className="bg-background/50 border-border/50"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/40 p-3 bg-muted/20">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-foreground">Send Alert Notification</span>
                  <span className="text-[10px] text-muted-foreground">Notify user they received a new pack configuration.</span>
                </div>
                <Switch checked={packNotify} onCheckedChange={setPackNotify} />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPackOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={awardPackMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
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
    </div>
  );
}
