"use client";

import React from "react";
import { Crown, Newspaper, Users, Verified, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface Account {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  accountType: string;
  verified?: boolean;
  isThinkPagesAccount?: boolean;
  realUserDisplayName?: string; // If posting from ThinkPages account, show real user
  realUserUsername?: string;
}

interface AccountIndicatorProps {
  account: Account;
  onClick?: (accountId: string) => void;
  showUsername?: boolean;
  showAccountType?: boolean;
  showRealUser?: boolean;
  size?: "sm" | "md" | "lg";
  layout?: "horizontal" | "vertical";
  className?: string;
}

const ACCOUNT_TYPE_ICONS = {
  government: Crown,
  media: Newspaper,
  citizen: Users,
};

const ACCOUNT_TYPE_COLORS = {
  government: "text-amber-500 bg-amber-500/20 border-amber-500/30",
  media: "text-blue-500 bg-blue-500/20 border-blue-500/30",
  citizen: "text-green-500 bg-green-500/20 border-green-500/30",
};

const ACCOUNT_TYPE_LABELS = {
  government: "Government Official",
  media: "Media Organization",
  citizen: "Citizen Account",
};

export function AccountIndicator({
  account,
  onClick,
  showUsername = true,
  showAccountType = true,
  showRealUser = true,
  size = "md",
  layout = "horizontal",
  className = "",
}: AccountIndicatorProps) {
  const AccountTypeIcon =
    ACCOUNT_TYPE_ICONS[account.accountType as keyof typeof ACCOUNT_TYPE_ICONS];
  const accountTypeColor =
    ACCOUNT_TYPE_COLORS[account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] ||
    "text-gray-500 bg-gray-500/20 border-gray-500/30";
  const accountTypeLabel =
    ACCOUNT_TYPE_LABELS[account.accountType as keyof typeof ACCOUNT_TYPE_LABELS] ||
    "Unknown Account Type";

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const avatarSize = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-12 w-12" : "h-8 w-8";
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3 w-3";

  const content = (
    <div
      className={cn(
        "flex items-center gap-2",
        layout === "vertical" && "flex-col items-start gap-1",
        onClick && "cursor-pointer transition-opacity hover:opacity-80",
        className
      )}
    >
      {/* Avatar */}
      <div className="relative">
        <Avatar className={avatarSize}>
          <AvatarImage src={account.profileImageUrl || undefined} />
          <AvatarFallback className={cn("font-semibold", accountTypeColor)}>
            {getInitials(account.displayName)}
          </AvatarFallback>
        </Avatar>

        {/* Account Type Icon Overlay */}
        {showAccountType && AccountTypeIcon && (
          <div
            className={cn(
              "border-background absolute -right-0.5 -bottom-0.5 rounded border-2 p-0.5",
              accountTypeColor
            )}
          >
            <AccountTypeIcon className={iconSize} />
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className={cn("min-w-0 flex-1", layout === "vertical" && "w-full")}>
        <div className="flex flex-wrap items-center gap-1">
          {/* Display Name */}
          <span className={cn("truncate font-semibold", textSize)}>{account.displayName}</span>

          {/* Verified Badge */}
          {account.verified && (
            <Verified className={cn(iconSize, "flex-shrink-0 fill-current text-blue-500")} />
          )}

          {/* ThinkPages Account Indicator */}
          {account.isThinkPagesAccount && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant="secondary"
                    className="border-purple-500/30 bg-purple-500/20 text-xs text-purple-400"
                  >
                    ThinkPages
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is a ThinkPages roleplay account</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Username */}
        {showUsername && (
          <div className="flex items-center gap-1">
            <span className={cn("text-muted-foreground truncate", textSize)}>
              @{account.username}
            </span>
          </div>
        )}

        {/* Real User Indicator */}
        {showRealUser && account.isThinkPagesAccount && account.realUserDisplayName && (
          <div className="mt-0.5 flex items-center gap-1">
            <ExternalLink className="text-muted-foreground h-2.5 w-2.5" />
            <span className="text-muted-foreground text-xs">
              by {account.realUserDisplayName}
              {account.realUserUsername && ` (@${account.realUserUsername})`}
            </span>
          </div>
        )}

        {/* Account Type Label */}
        {showAccountType && layout === "vertical" && (
          <div className="mt-0.5 flex items-center gap-1">
            {AccountTypeIcon && (
              <AccountTypeIcon className={cn(iconSize, accountTypeColor.split(" ")[0])} />
            )}
            <span className={cn("text-muted-foreground", textSize)}>{accountTypeLabel}</span>
          </div>
        )}
      </div>
    </div>
  );

  // Don't wrap in button if there are interactive elements inside
  // Instead, make the main elements clickable individually
  if (onClick) {
    return (
      <div className="cursor-pointer" onClick={() => onClick(account.id)}>
        {content}
      </div>
    );
  }

  return content;
}

// Simplified version for compact displays
export function CompactAccountIndicator({
  account,
  onClick,
  className = "",
}: {
  account: Account;
  onClick?: (accountId: string) => void;
  className?: string;
}) {
  return (
    <AccountIndicator
      account={account}
      onClick={onClick}
      showUsername={false}
      showAccountType={true}
      showRealUser={false}
      size="sm"
      className={className}
    />
  );
}

// Full featured version for detailed displays
export function DetailedAccountIndicator({
  account,
  onClick,
  className = "",
}: {
  account: Account;
  onClick?: (accountId: string) => void;
  className?: string;
}) {
  return (
    <AccountIndicator
      account={account}
      onClick={onClick}
      showUsername={true}
      showAccountType={true}
      showRealUser={true}
      size="md"
      layout="vertical"
      className={className}
    />
  );
}
