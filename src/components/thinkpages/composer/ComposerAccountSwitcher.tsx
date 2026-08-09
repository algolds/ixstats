"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";

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
}: ComposerAccountSwitcherProps) {
  return (
    <div className="relative flex shrink-0 flex-col items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowAccountManager(!showAccountManager)}
            className="group relative cursor-pointer focus:outline-none"
          >
            <Avatar className="border-border/50 h-9 w-9 border shadow-sm transition-all duration-200 group-hover:scale-105 active:scale-95">
              <AvatarImage src={accountAvatarUrl} alt={account.displayName} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
                {account.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>

            {/* Floating Chevron Down Badge */}
            <div className="bg-popover border-border text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border shadow-md transition-colors">
              <ChevronDown className="h-2.5 w-2.5" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Switch account</TooltipContent>
      </Tooltip>

      {/* Floating Account Switcher Dropdown (macOS Glass style) */}
      <AnimatePresence>
        {showAccountManager && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="border-border/50 bg-popover/95 text-popover-foreground absolute top-11 left-0 z-50 w-64 rounded-2xl border p-2 shadow-2xl backdrop-blur-xl"
          >
            <div className="border-border mb-2 flex items-center justify-between border-b px-2 py-1 pb-2">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Switch Account
              </span>
              {isOwner && accounts.length < 25 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onCreateAccount?.();
                    setShowAccountManager(false);
                  }}
                  className="hover:bg-accent h-5 px-1.5 text-[9px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Plus className="mr-0.5 h-2.5 w-2.5" />
                  Add Account
                </Button>
              )}
            </div>

            <div className="thin-scrollbar grid max-h-48 gap-1 overflow-y-auto">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => {
                    onAccountSelect?.(acc);
                    setShowAccountManager(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border p-2 text-left transition-all duration-200",
                    acc.id === account.id
                      ? "border-blue-500/30 bg-blue-500/10 font-semibold text-blue-600 dark:text-blue-400"
                      : "hover:bg-accent text-foreground border-transparent"
                  )}
                >
                  <Avatar className="border-border h-7 w-7 border">
                    <AvatarImage src={getAccountAvatar(acc)} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-[0.6rem]">
                      {acc.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs leading-tight font-semibold">
                      {acc.displayName}
                    </div>
                    <div className="text-muted-foreground mt-0.5 truncate text-[10px]">
                      @{acc.username}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground h-4 px-1 py-0 text-[8px] leading-none"
                  >
                    {acc.accountType}
                  </Badge>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
