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
            className="group relative cursor-pointer focus:outline-none active:scale-95 transition-transform duration-150"
            aria-label="Switch ThinkPages Account"
          >
            <Avatar className="h-9 w-9 border border-white/20 dark:border-white/10 shadow-md transition-all duration-200 group-hover:scale-105 active:scale-95">
              <AvatarImage src={accountAvatarUrl} alt={account.displayName} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
                {account.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>

            {/* Floating Chevron Down Badge */}
            <div className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border border-black/10 dark:border-border bg-white dark:bg-secondary text-slate-600 dark:text-muted-foreground shadow-md transition-all duration-200 group-hover:scale-110">
              <ChevronDown className={cn("h-2.5 w-2.5 transition-transform duration-200", showAccountManager && "rotate-180")} />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover/95 text-foreground border border-border shadow-xl backdrop-blur-md text-[11px] font-medium tracking-tight">
          Switch account
        </TooltipContent>
      </Tooltip>

      {/* Floating Account Switcher Dropdown (macOS Glass style per /apple-design) */}
      <AnimatePresence>
        {showAccountManager && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 6 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="absolute top-11 left-0 z-50 w-64 rounded-2xl border border-black/10 dark:border-border bg-white/90 dark:bg-popover/98 p-2.5 shadow-2xl backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          >
            <div className="mb-2 flex items-center justify-between border-b border-black/5 dark:border-border/60 px-2.5 pb-2">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
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
                  className="h-5 px-1.5 text-[9px] font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-500/10 active:scale-95 transition-all"
                >
                  <Plus className="mr-0.5 h-2.5 w-2.5" />
                  Add Account
                </Button>
              )}
            </div>

            <div className="thin-scrollbar grid max-h-52 gap-1 overflow-y-auto pr-0.5">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => {
                    onAccountSelect?.(acc);
                    setShowAccountManager(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border p-2 text-left transition-all duration-150 active:scale-[0.98]",
                    acc.id === account.id
                      ? "border-blue-500/30 bg-blue-500/10 font-bold text-blue-600 dark:text-blue-400 shadow-sm"
                      : "border-transparent text-foreground hover:bg-black/5 dark:hover:bg-secondary/70"
                  )}
                >
                  <Avatar className="h-7 w-7 border border-white/20 dark:border-border">
                    <AvatarImage src={getAccountAvatar(acc)} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-[0.6rem]">
                      {acc.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold leading-tight tracking-tight text-foreground">
                      {acc.displayName}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground font-medium">
                      @{acc.username}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-4 border-slate-200 dark:border-border px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider text-muted-foreground"
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
