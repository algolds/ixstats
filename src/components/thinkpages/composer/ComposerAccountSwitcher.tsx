"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { NavArrowDown as ChevronDown, Plus, User as UserIcon } from "iconoir-react";
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
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowAccountManager(!showAccountManager)}
            className="group relative cursor-pointer transition-transform duration-150 focus:outline-none active:scale-95"
            aria-label="Switch ThinkPages Account"
          >
            <Avatar className="h-9 w-9 border border-white/20 shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 group-hover:scale-105 active:scale-95 dark:border-white/10">
              <AvatarImage src={accountAvatarUrl} alt={account.displayName} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
                {account.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>

            {/* Floating Chevron Down Badge */}
            <div className="dark:border-border dark:bg-secondary dark:text-muted-foreground absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border border-black/10 bg-white text-slate-600 shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 group-hover:scale-110">
              <ChevronDown
                className={cn(
                  "h-2.5 w-2.5 transition-transform duration-200",
                  showAccountManager && "rotate-180"
                )}
              />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="bg-popover/95 text-foreground border-border border text-xs font-medium tracking-tight shadow-xl backdrop-blur-md"
        >
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
            className="dark:border-border dark:bg-popover/98 absolute top-11 left-0 z-50 w-64 rounded-2xl border border-black/10 bg-white/90 p-2.5 shadow-2xl backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          >
            <div className="dark:border-border/60 mb-2 flex items-center justify-between border-b border-black/5 px-2.5 pb-2">
              <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
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
                  className="h-5 px-1.5 text-xs font-bold text-blue-500 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-blue-500/10 hover:text-blue-600 active:scale-95 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Plus className="mr-0.5 h-2.5 w-2.5" />
                  Add Account
                </Button>
              )}
            </div>

            <div className="thin-scrollbar grid max-h-52 gap-1 overflow-y-auto pr-0.5">
              {onPostAsYourself && (
                <button
                  onClick={() => {
                    onPostAsYourself();
                    setShowAccountManager(false);
                  }}
                  disabled={isPostAsYourselfPending}
                  className="text-foreground dark:hover:bg-secondary/70 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-black/10 p-2 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 hover:bg-black/5 active:scale-[0.98] disabled:opacity-60 dark:border-white/15"
                >
                  <div className="bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate text-xs leading-tight font-bold tracking-tight">
                      Post as yourself
                    </div>
                    <div className="text-muted-foreground mt-0.5 truncate text-xs font-medium">
                      Your own name, no nation attached
                    </div>
                  </div>
                </button>
              )}
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => {
                    onAccountSelect?.(acc);
                    setShowAccountManager(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border p-2 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]",
                    acc.id === account.id
                      ? "border-blue-500/30 bg-blue-500/10 font-bold text-blue-600 shadow-sm dark:text-blue-400"
                      : "text-foreground dark:hover:bg-secondary/70 border-transparent hover:bg-black/5"
                  )}
                >
                  <Avatar className="dark:border-border h-7 w-7 border border-white/20">
                    <AvatarImage src={getAccountAvatar(acc)} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {acc.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate text-xs leading-tight font-bold tracking-tight">
                      {acc.displayName}
                    </div>
                    <div className="text-muted-foreground mt-0.5 truncate text-xs font-medium">
                      @{acc.username}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="dark:border-border text-muted-foreground h-4 border-slate-200 px-1.5 py-0 text-xs font-bold tracking-wider uppercase"
                  >
                    {acc.accountType === "personal" ? "you" : acc.accountType}
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
