"use client";

import { Users, ChevronDown, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";

export interface ComposerHeaderProps {
  account: any | null;
  accounts: any[];
  onAccountSelect?: (account: any) => void;
  onOpenAccountManager?: () => void;
  onCreateAccount?: () => void;
  postToDiscord: boolean;
  setPostToDiscord: (value: boolean) => void;
}

export function ComposerHeader({
  account,
  accounts,
  onAccountSelect,
  onOpenAccountManager,
  onCreateAccount,
  postToDiscord,
  setPostToDiscord,
}: ComposerHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3">
      {/* Account Selector */}
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-8 w-8 border border-white/10 shadow-sm">
          {account?.avatarUrl ? (
            <AvatarImage src={account.avatarUrl} alt={account.displayName} />
          ) : null}
          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-indigo-700 text-xs font-bold text-white">
            {(account?.displayName ?? "U").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {accounts.length > 1 ? (
          <Select
            value={account?.id ?? ""}
            onValueChange={(val) => {
              const selected = accounts.find((a) => a.id === val);
              if (selected && onAccountSelect) onAccountSelect(selected);
            }}
          >
            <SelectTrigger className="h-8 w-[180px] border-white/10 bg-black/40 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/10">
              <SelectValue placeholder="Select Account" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-900/95 backdrop-blur-xl">
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id} className="text-xs font-medium cursor-pointer">
                  {acc.displayName} (@{acc.username})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs font-bold text-white truncate">
              {account?.displayName ?? "User"}
            </span>
            <span className="text-[11px] font-medium text-slate-400 truncate">
              @{account?.username ?? "user"}
            </span>
          </div>
        )}

        {onOpenAccountManager && (
          <button
            onClick={onOpenAccountManager}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white active:scale-[0.94]"
          >
            <Users className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Crossposting & Quick Actions */}
      <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-[11px] tracking-tight">Discord Crosspost</span>
          <Switch
            checked={postToDiscord}
            onCheckedChange={setPostToDiscord}
            className="data-[state=checked]:bg-purple-600"
          />
        </label>
      </div>
    </div>
  );
}
