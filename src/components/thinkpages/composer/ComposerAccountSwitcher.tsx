"use client";

import React from "react";
import { NavArrowDown as ChevronDown, Plus, User as UserIcon } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";

export interface ComposerAccountSwitcherProps {
  account: any;
  accounts: any[];
  accountAvatarUrl: string;
  showAccountManager: boolean;
  setShowAccountManager: (val: boolean) => void;
  onAccountSelect?: (account: any) => void;
  onCreateAccount?: () => void;
  isOwner: boolean;
  getAccountAvatar: (acc: any) => string;
  /** Offered when the user has no personal persona yet: creates it and switches to it. */
  onPostAsYourself?: () => void;
  isPostAsYourselfPending?: boolean;
}

export function ComposerAccountSwitcher({
  account,
  accounts,
  accountAvatarUrl,
  showAccountManager,
  setShowAccountManager,
  onAccountSelect,
  onCreateAccount,
  isOwner,
  getAccountAvatar,
  onPostAsYourself,
  isPostAsYourselfPending = false,
}: ComposerAccountSwitcherProps) {
  return (
    <div className="relative flex shrink-0 flex-col items-center">
      <Popover open={showAccountManager} onOpenChange={setShowAccountManager}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group relative cursor-pointer rounded-full transition-transform duration-150 active:scale-[0.98]"
                aria-label="Switch ThinkPages Account"
              >
                <Avatar className="border-separator size-9 border">
                  <AvatarImage src={accountAvatarUrl} alt={account.displayName} />
                  <AvatarFallback className="bg-tint-fill text-caption text-tint">
                    {account.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="border-separator bg-surface text-label-secondary absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border">
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-3 transition-transform duration-150",
                      showAccountManager && "rotate-180"
                    )}
                  />
                </div>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Switch account</TooltipContent>
        </Tooltip>

        <PopoverContent side="bottom" align="start" className="w-64 p-2">
          <div className="border-separator mb-2 flex items-center justify-between border-b px-2 pb-2">
            <span className="text-subhead text-label-secondary">Switch account</span>
            {isOwner && accounts.length < 25 && (
              <Button
                variant="plain"
                size="sm"
                onClick={() => {
                  onCreateAccount?.();
                  setShowAccountManager(false);
                }}
                className="h-6"
              >
                <Plus aria-hidden="true" />
                Add Account
              </Button>
            )}
          </div>

          <FacetList variant="plain" className="thin-scrollbar max-h-52 overflow-y-auto">
            <FacetListSection aria-label="Post as">
              {onPostAsYourself && (
                <FacetRow
                  onClick={() => {
                    onPostAsYourself();
                    setShowAccountManager(false);
                  }}
                  disabled={isPostAsYourselfPending}
                  leading={
                    <span className="bg-fill-3 text-label-secondary flex size-7 items-center justify-center rounded-full">
                      <UserIcon className="size-3.5" aria-hidden="true" />
                    </span>
                  }
                  title="Post as yourself"
                  subtitle="Your own name, no nation attached"
                />
              )}
              {accounts.map((acc) => (
                <FacetRow
                  key={acc.id}
                  selected={acc.id === account.id}
                  selectionStyle="tint"
                  onClick={() => {
                    onAccountSelect?.(acc);
                    setShowAccountManager(false);
                  }}
                  leading={
                    <Avatar className="border-separator size-7 border">
                      <AvatarImage src={getAccountAvatar(acc)} />
                      <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
                        {acc.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  }
                  title={acc.displayName}
                  subtitle={`@${acc.username}`}
                  trailing={
                    <Badge variant="outline">
                      {acc.accountType === "personal" ? "you" : acc.accountType}
                    </Badge>
                  }
                />
              ))}
            </FacetListSection>
          </FacetList>
        </PopoverContent>
      </Popover>
    </div>
  );
}
