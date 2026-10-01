"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import {
  Crown,
  Journal as Newspaper,
  Group as Users,
  Plus,
  Settings,
  Eye,
  EyeClosed as EyeOff,
  Star,
  MoreHoriz as MoreHorizontal,
  StatUp as TrendingUp,
  ChatBubble as MessageSquare,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Stat } from "~/components/ui/stat";
import { springGentle } from "~/lib/design/motion";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { PreText } from "~/components/ui/pretext";

interface EnhancedAccountManagerProps {
  countryId: string;
  accounts: any[];
  selectedAccount: any | null;
  onAccountSelect: (account: any) => void;
  onAccountSettings: (account: any) => void;
  onCreateAccount: () => void;
  isOwner: boolean;
  inModal?: boolean;
}

export function EnhancedAccountManager({
  // oxlint-disable-next-line eslint/no-unused-vars
  countryId,
  accounts,
  selectedAccount,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  isOwner,
  inModal = false,
}: EnhancedAccountManagerProps) {
  const notify = useNotify();
  const [filterType, setFilterType] = useState<"all" | "government" | "media" | "citizen">("all");
  const [favoriteAccounts, setFavoriteAccounts] = useState<string[]>([]);

  const updateAccountMutation = api.thinkpages.updateAccount.useMutation({
    onSuccess: () => {
      notify.success("Account visibility updated");
    },
  });

  const getAccountTypeCount = (type: string) => {
    return accounts.filter((account) => account.accountType === type).length;
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "government":
        return "border-yellow/30 bg-yellow/10 text-yellow";
      case "media":
        return "border-blue/30 bg-blue/10 text-blue";
      case "citizen":
        return "border-green/30 bg-green/10 text-green";
      default:
        return "border-separator bg-fill-3 text-label-secondary";
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

  // oxlint-disable-next-line
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
        transition={{ ...springGentle, delay: index * 0.05 }}
        className={cn(
          "rounded-row border p-3 transition-[background-color,border-color] duration-150",
          isSelected
            ? "border-tint bg-tint-fill"
            : "border-separator bg-surface-secondary hover:bg-fill-3"
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
            onClick={() => onAccountSelect(account)}
          >
            <Avatar className="size-8">
              <AvatarImage src={account.profileImageUrl} />
              <AvatarFallback className={colorClasses}>
                {account.displayName?.charAt(0) || account.username?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <PreText className="text-headline text-label truncate">
                  {account.displayName}
                </PreText>
                {account.verified && (
                  <span
                    className="text-footnote inline-flex size-3.5 items-center justify-center leading-none"
                    title="Verified"
                  >
                    ✅
                  </span>
                )}
                {(account as any).bio?.startsWith("Former Nation") && (
                  <span className="text-footnote text-label-secondary">[Former Nation]</span>
                )}
                {isFavorite && (
                  <Star className="text-yellow size-3.5 fill-current" aria-label="Favorite" />
                )}
              </div>
              <div className="text-label-secondary text-footnote">@{account.username}</div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="hover:bg-fill-3 text-label-secondary rounded-control-sm flex size-7 items-center justify-center transition-colors"
              aria-label={`Actions for ${account.displayName}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toggleFavorite(account.id)}>
                <Star />
                {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAccountSettings(account)}>
                <Settings />
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
                {account.isActive ? <EyeOff /> : <Eye />}
                {account.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-2 flex items-center gap-1">
          <div className={cn("rounded-control-sm p-1", colorClasses)}>
            <Icon className="size-3.5" aria-hidden="true" />
          </div>
          <Badge variant="outline">{account.accountType}</Badge>
          {!account.isActive && <Badge variant="neutral">Inactive</Badge>}
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat size="sm" label="Posts" value={metrics.activity} />
          <Stat size="sm" label="Reach" value={metrics.reach} />
          <Stat size="sm" label="Influence" value={`${metrics.influence}%`} />
        </div>

        {/* Account Bio Preview */}
        {account.bio && (
          <PreText className="text-footnote text-label-secondary mt-2 line-clamp-2">
            {account.bio}
          </PreText>
        )}
      </motion.div>
    );
  };

  const innerContent = (
    <>
      <div
        role="radiogroup"
        aria-label="Filter by account type"
        className="bg-fill-3 rounded-control grid w-full grid-cols-2 gap-1 p-1"
      >
        {(["all", "government", "media", "citizen"] as const).map((type) => {
          const Icon = getAccountIcon(type);
          const count = type === "all" ? accounts.length : getAccountTypeCount(type);
          const limit =
            type === "government" ? 5 : type === "media" ? 10 : type === "citizen" ? 15 : 25;
          const isActive = filterType === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setFilterType(type)}
              className={cn(
                "text-caption rounded-control-sm flex flex-1 cursor-pointer items-center justify-between gap-1 px-2 py-2 transition-[color,background-color] duration-150",
                isActive
                  ? "bg-surface text-label shadow-card"
                  : "text-label-secondary hover:text-label"
              )}
            >
              <span className="flex items-center gap-1">
                {type === "all" ? (
                  <Users className="size-3.5" aria-hidden="true" />
                ) : (
                  <Icon className="size-3.5" aria-hidden="true" />
                )}
                <span>{type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}</span>
              </span>
              <span className="bg-fill-3 rounded-full px-2 py-0.5 tabular-nums">
                {count}/{limit}
              </span>
            </button>
          );
        })}
      </div>

      {/* Accounts List */}
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence>
          {filteredAccounts.length === 0 ? (
            <EmptyState
              compact
              icon={<Users />}
              title="No accounts in this category"
              action={
                isOwner ? (
                  <Button variant="bordered" size="sm" onClick={onCreateAccount}>
                    <Plus aria-hidden="true" />
                    Create Account
                  </Button>
                ) : undefined
              }
            />
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCreateAccount();
          }}
          variant="bordered"
          size="sm"
          className="w-full"
          type="button"
        >
          <Plus aria-hidden="true" />
          Create New Account ({25 - accounts.length} remaining)
        </Button>
      )}

      {/* Quick Stats */}
      <div className="border-separator border-t pt-2">
        <div className="text-footnote grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-label-secondary size-3.5" aria-hidden="true" />
            <span className="text-label-secondary">Total Posts:</span>
            <span className="text-label font-medium tabular-nums">
              {accounts.reduce((sum, acc) => sum + (acc.postCount || 0), 0)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="text-label-secondary size-3.5" aria-hidden="true" />
            <span className="text-label-secondary">Active:</span>
            <span className="text-label font-medium tabular-nums">
              {accounts.filter((acc) => acc.isActive).length}
            </span>
          </div>
        </div>
      </div>
    </>
  );

  if (inModal) {
    return <div className="space-y-4 sm:space-y-5">{innerContent}</div>;
  }

  return (
    <FacetCard>
      <FacetCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-title-3 text-label">Account Manager</h3>
          <Badge variant="outline" className="tabular-nums">
            {accounts.length}/25
          </Badge>
        </div>
        <PreText className="text-body text-label-secondary">
          Manage your Thinkpages personas
        </PreText>
      </FacetCardHeader>

      <FacetCardContent className="space-y-4 px-4 pb-4 sm:space-y-5 md:px-5 md:pb-5">
        {innerContent}
      </FacetCardContent>
    </FacetCard>
  );
}
