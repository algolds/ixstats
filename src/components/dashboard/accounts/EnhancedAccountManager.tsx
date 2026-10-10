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
  CheckCircle,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
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
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import type { ThinkpagesAccountItem } from "./account-types";

interface EnhancedAccountManagerProps {
  accounts: ThinkpagesAccountItem[];
  selectedAccount: ThinkpagesAccountItem | null;
  onAccountSelect: (account: ThinkpagesAccountItem) => void;
  onAccountSettings: (account: ThinkpagesAccountItem) => void;
  onCreateAccount: () => void;
  isOwner: boolean;
  inModal?: boolean;
}

/** Default per-user account limit until the admin-configured one loads. */
const MAX_ACCOUNTS = 25;

const TYPE_STYLES = {
  government: { color: "border-yellow/30 bg-yellow/10 text-yellow", Icon: Crown, limit: 5 },
  media: { color: "border-blue/30 bg-blue/10 text-blue", Icon: Newspaper, limit: 10 },
  citizen: { color: "border-green/30 bg-green/10 text-green", Icon: Users, limit: 15 },
};

const FILTER_TYPES = ["all", "government", "media", "citizen"] as const;
type FilterType = (typeof FILTER_TYPES)[number];

const typeStyle = (type: string) =>
  TYPE_STYLES[type as keyof typeof TYPE_STYLES] ?? {
    color: "border-separator bg-fill-3 text-label-secondary",
    Icon: Users,
    limit: MAX_ACCOUNTS,
  };

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

interface AccountCardProps {
  account: ThinkpagesAccountItem;
  index: number;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onSettings: () => void;
  onToggleFavorite: () => void;
  onToggleActive: () => void;
}

function AccountCard({
  account,
  index,
  isSelected,
  isFavorite,
  onSelect,
  onSettings,
  onToggleFavorite,
  onToggleActive,
}: AccountCardProps) {
  const { Icon, color } = typeStyle(account.accountType);
  const posts = account.postCount || 0;
  const reach = account.followerCount || 0;
  const influence = Math.round(Math.min(100, Math.max(0, (reach + posts * 2) / 10)));

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
        <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-2" onClick={onSelect}>
          <Avatar className="size-8">
            <AvatarImage src={account.profileImageUrl ?? undefined} />
            <AvatarFallback className={color}>
              {account.displayName?.charAt(0) || account.username?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <PreText className="text-headline text-label truncate">{account.displayName}</PreText>
              {account.verified && (
                <CheckCircle
                  className="text-tint size-3.5 shrink-0"
                  role="img"
                  aria-label="Verified"
                />
              )}
              {account.bio?.startsWith("Former Nation") && (
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
            <DropdownMenuItem onClick={onToggleFavorite}>
              <Star />
              {isFavorite ? "Remove from favorites" : "Add to favorites"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSettings}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleActive}>
              {account.isActive ? <EyeOff /> : <Eye />}
              {account.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-2 flex items-center gap-1">
        <div className={cn("rounded-control-sm p-1", color)}>
          <Icon className="size-3.5" aria-hidden="true" />
        </div>
        <Badge variant="outline">{account.accountType}</Badge>
        {!account.isActive && <Badge variant="default">Inactive</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat size="sm" label="Posts" value={posts} />
        <Stat size="sm" label="Reach" value={reach} />
        <Stat size="sm" label="Influence" value={`${influence}%`} />
      </div>

      {account.bio && (
        <PreText className="text-footnote text-label-secondary mt-2 line-clamp-2">
          {account.bio}
        </PreText>
      )}
    </motion.div>
  );
}

export function EnhancedAccountManager({
  accounts,
  selectedAccount,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  isOwner,
  inModal = false,
}: EnhancedAccountManagerProps) {
  const notify = useNotify();
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [favoriteAccounts, setFavoriteAccounts] = useState<string[]>([]);
  const { data: maxAccounts = MAX_ACCOUNTS } = api.thinkpages.getAccountLimit.useQuery();

  const updateAccountMutation = api.thinkpages.updateAccount.useMutation({
    onSuccess: () => {
      notify.success("Account visibility updated");
    },
  });

  const filteredAccounts =
    filterType === "all" ? accounts : accounts.filter((a) => a.accountType === filterType);

  const toggleFavorite = (accountId: string) => {
    setFavoriteAccounts((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  };

  const innerContent = (
    <>
      <div
        role="radiogroup"
        aria-label="Filter by account type"
        className="bg-fill-3 rounded-control grid w-full grid-cols-2 gap-1 p-1"
      >
        {FILTER_TYPES.map((type) => {
          const { Icon, limit } = typeStyle(type);
          const count =
            type === "all"
              ? accounts.length
              : accounts.filter((a) => a.accountType === type).length;
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
                <Icon className="size-3.5" aria-hidden="true" />
                <span>{type === "all" ? "All" : capitalize(type)}</span>
              </span>
              <span className="bg-fill-3 rounded-full px-2 py-0.5 tabular-nums">
                {count}/{limit}
              </span>
            </button>
          );
        })}
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence>
          {filteredAccounts.length === 0 ? (
            <EmptyState
              compact
              icon={<Users />}
              title="No accounts in this category"
              action={
                isOwner ? (
                  <Button variant="outline" size="sm" onClick={onCreateAccount}>
                    <Plus aria-hidden="true" />
                    Create account
                  </Button>
                ) : undefined
              }
            />
          ) : (
            filteredAccounts.map((account, index) => (
              <AccountCard
                key={account.id}
                account={account}
                index={index}
                isSelected={selectedAccount?.id === account.id}
                isFavorite={favoriteAccounts.includes(account.id)}
                onSelect={() => onAccountSelect(account)}
                onSettings={() => onAccountSettings(account)}
                onToggleFavorite={() => toggleFavorite(account.id)}
                onToggleActive={() =>
                  updateAccountMutation.mutate({
                    accountId: account.id,
                    isActive: !account.isActive,
                  })
                }
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {isOwner && accounts.length < maxAccounts && (
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCreateAccount();
          }}
          variant="outline"
          size="sm"
          className="w-full"
          type="button"
        >
          <Plus aria-hidden="true" />
          Create New Account ({maxAccounts - accounts.length} remaining)
        </Button>
      )}

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-title-3 text-label">Account manager</h3>
          <Badge variant="outline" className="tabular-nums">
            {accounts.length}/{maxAccounts}
          </Badge>
        </div>
        <PreText className="text-body text-label-secondary">
          Manage your Thinkpages personas
        </PreText>
      </CardHeader>

      <CardContent className="space-y-4 px-4 pb-4 sm:space-y-5 md:px-5 md:pb-5">
        {innerContent}
      </CardContent>
    </Card>
  );
}
