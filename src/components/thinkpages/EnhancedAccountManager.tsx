"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import {
  Crown,
  Newspaper,
  Users,
  Plus,
  Settings,
  Eye,
  EyeOff,
  Star,
  MoreHorizontal,
  Verified,
  TrendingUp,
  MessageSquare,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface EnhancedAccountManagerProps {
  countryId: string;
  accounts: any[];
  selectedAccount: any | null;
  onAccountSelect: (account: any) => void;
  onAccountSettings: (account: any) => void;
  onCreateAccount: () => void;
  isOwner: boolean;
}

export function EnhancedAccountManager({
  countryId,
  accounts,
  selectedAccount,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  isOwner,
}: EnhancedAccountManagerProps) {
  const [filterType, setFilterType] = useState<"all" | "government" | "media" | "citizen">("all");
  const [favoriteAccounts, setFavoriteAccounts] = useState<string[]>([]);

  const updateAccountMutation = api.thinkpages.updateAccount.useMutation({
    onSuccess: () => {
      toast.success("Account visibility updated");
    },
  });

  const getAccountTypeCount = (type: string) => {
    return accounts.filter((account) => account.accountType === type).length;
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "government":
        return "border-amber-500/30 bg-amber-500/10 text-amber-400";
      case "media":
        return "border-blue-500/30 bg-blue-500/10 text-blue-400";
      case "citizen":
        return "border-green-500/30 bg-green-500/10 text-green-400";
      default:
        return "border-gray-500/30 bg-gray-500/10 text-gray-400";
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "government":
        return Crown;
      case "media":
        return Newspaper;
      case "citizen":
        return Users;
      default:
        return Users;
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    if (filterType === "all") return true;
    return account.accountType === filterType;
  });

  const toggleFavorite = (accountId: string) => {
    setFavoriteAccounts((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  };

  const getAccountPerformanceMetrics = (account: any) => {
    const engagement = (account.followerCount || 0) + (account.postCount || 0) * 2;
    const influence = Math.min(100, Math.max(0, engagement / 10));

    return {
      engagement,
      influence: Math.round(influence),
      activity: account.postCount || 0,
      reach: account.followerCount || 0,
    };
  };

  const AccountCard = ({ account, index }: { account: any; index: number }) => {
    const Icon = getAccountIcon(account.accountType);
    const colorClasses = getAccountTypeColor(account.accountType);
    const isSelected = selectedAccount?.id === account.id;
    const isFavorite = favoriteAccounts.includes(account.id);
    const metrics = getAccountPerformanceMetrics(account);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn(
          "rounded-lg border p-3 transition-all hover:scale-102",
          isSelected
            ? "border-blue-500/50 bg-blue-500/20 shadow-lg shadow-blue-500/25"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
            onClick={() => onAccountSelect(account)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={account.profileImageUrl} />
              <AvatarFallback className={colorClasses}>
                {account.displayName?.charAt(0) || account.username?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-medium">{account.displayName}</span>
                {account.verified && <Verified className="h-3 w-3 fill-current text-blue-500" />}
                {isFavorite && <Star className="h-3 w-3 fill-current text-yellow-500" />}
              </div>
              <div className="text-muted-foreground text-xs">@{account.username}</div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="hover:bg-accent flex h-6 w-6 items-center justify-center rounded-md transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toggleFavorite(account.id)}>
                <Star className="mr-2 h-4 w-4" />
                {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAccountSettings(account)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  updateAccountMutation.mutate({
                    accountId: account.id,
                    isActive: !account.isActive,
                  })
                }
              >
                {account.isActive ? (
                  <EyeOff className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {account.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-2 flex items-center gap-1">
          <div className={cn("rounded p-1", colorClasses)}>
            <Icon className="h-3 w-3" />
          </div>
          <Badge variant="outline" className="text-xs">
            {account.accountType}
          </Badge>
          {!account.isActive && (
            <Badge variant="secondary" className="bg-gray-500/20 text-xs text-gray-400">
              Inactive
            </Badge>
          )}
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="font-medium text-blue-400">{metrics.activity}</div>
            <div className="text-muted-foreground">Posts</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-green-400">{metrics.reach}</div>
            <div className="text-muted-foreground">Reach</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-purple-400">{metrics.influence}%</div>
            <div className="text-muted-foreground">Influence</div>
          </div>
        </div>

        {/* Account Bio Preview */}
        {account.bio && (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">{account.bio}</p>
        )}
      </motion.div>
    );
  };

  return (
    <Card className="glass-hierarchy-child">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Account Manager</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {accounts.length}/25
            </Badge>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage your strategic communication personas
        </p>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-5">
        <ToggleGroup
          type="single"
          value={filterType}
          onValueChange={(value) => value && setFilterType(value as typeof filterType)}
          className="flex w-full flex-wrap justify-center gap-2 rounded-full bg-white/5 p-1 [-webkit-overflow-scrolling:touch] sm:flex-nowrap sm:justify-between sm:gap-1 [&::-webkit-scrollbar]:hidden"
        >
          {(["all", "government", "media", "citizen"] as const).map((type) => {
            const Icon = getAccountIcon(type);
            const count = type === "all" ? accounts.length : getAccountTypeCount(type);
            const limit =
              type === "government" ? 5 : type === "media" ? 10 : type === "citizen" ? 15 : 25;
            return (
              <ToggleGroupItem
                key={type}
                value={type}
                className={cn(
                  "data-[state=on]:border-primary data-[state=on]:bg-primary/10 flex min-w-[130px] items-center justify-between gap-2 rounded-full border px-3 py-2 text-xs tracking-wide uppercase transition-all sm:min-w-[120px]",
                  type !== "all" ? getAccountTypeColor(type) : "border-accent/40 text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  {type === "all" ? <Users className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  <span className="font-medium">
                    {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                  </span>
                </span>
                <span className="bg-background/50 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  {count}/{limit}
                </span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        {/* Accounts List */}
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence>
            {filteredAccounts.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No accounts in this category</p>
                {isOwner && (
                  <Button variant="outline" size="sm" onClick={onCreateAccount} className="mt-2">
                    <Plus className="mr-1 h-3 w-3" />
                    Create Account
                  </Button>
                )}
              </div>
            ) : (
              filteredAccounts.map((account, index) => (
                <AccountCard key={account.id} account={account} index={index} />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Create Account Button */}
        {isOwner && accounts.length < 25 && (
          <Button
            onClick={onCreateAccount}
            variant="outline"
            size="sm"
            className="flex w-full items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Account ({25 - accounts.length} remaining)
          </Button>
        )}

        {/* Quick Stats */}
        <div className="border-t border-white/10 pt-2">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-green-400" />
              <span className="text-muted-foreground">Total Posts:</span>
              <span className="font-medium">
                {accounts.reduce((sum, acc) => sum + (acc.postCount || 0), 0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-blue-400" />
              <span className="text-muted-foreground">Active:</span>
              <span className="font-medium">{accounts.filter((acc) => acc.isActive).length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
