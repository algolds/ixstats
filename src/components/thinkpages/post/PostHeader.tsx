"use client";

import Link from "next/link";
import { MoreHorizontal, Pin, Edit, Trash2, Flag, Crown, Newspaper, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { useRelativeTime } from "~/hooks/useRelativeTime";
import { cn } from "~/lib/utils";

export interface PostHeaderProps {
  account: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    flagUrl?: string | null;
    isVerified?: boolean;
    isStaff?: boolean;
    type?: string;
  };
  timestamp: string | Date;
  isPinned?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onReport?: () => void;
  className?: string;
}

export function PostHeader({
  account,
  timestamp,
  isPinned,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onPin,
  onReport,
  className,
}: PostHeaderProps) {
  const timeAgo = useRelativeTime(new Date(timestamp));

  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      {/* Author Details & Avatar */}
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={`/thinkpages/u/${account.username}`}
          className="group relative shrink-0 transition-transform duration-150 active:scale-[0.95]"
        >
          <Avatar className="h-10 w-10 border border-white/10 shadow-md">
            {account.avatarUrl ? (
              <AvatarImage src={account.avatarUrl} alt={account.displayName} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-purple-600 to-indigo-700 text-xs font-bold text-white">
              {account.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Account Type Icon Indicator */}
          {account.type === "OFFICIAL" && (
            <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] text-white shadow-sm">
              <Crown className="h-2.5 w-2.5" />
            </span>
          )}
          {account.type === "NEWS" && (
            <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white shadow-sm">
              <Newspaper className="h-2.5 w-2.5" />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/thinkpages/u/${account.username}`}
              className="truncate text-sm font-bold tracking-tight text-white transition-colors hover:text-purple-300"
            >
              {account.displayName}
            </Link>

            {account.isVerified && (
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">
                ✓
              </span>
            )}

            {account.isStaff && (
              <Badge className="border-purple-500/30 bg-purple-500/15 text-[8px] font-bold text-purple-300">
                STAFF
              </Badge>
            )}

            {isPinned && (
              <Badge className="border-amber-500/30 bg-amber-500/15 text-[8px] font-bold text-amber-400">
                <Pin className="mr-0.5 h-2.5 w-2.5" /> PINNED
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium tracking-tight text-slate-400">
            <span className="truncate">@{account.username}</span>
            <span>·</span>
            <span className="text-slate-400/80 tabular-nums">{timeAgo}</span>
          </div>
        </div>
      </div>

      {/* Action Dropdown Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white active:scale-[0.92]">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44 border-white/10 bg-slate-900/95 backdrop-blur-xl"
        >
          {onPin && (
            <DropdownMenuItem onClick={onPin} className="cursor-pointer text-xs font-medium">
              <Pin className="mr-2 h-3.5 w-3.5" />
              {isPinned ? "Unpin Post" : "Pin Post"}
            </DropdownMenuItem>
          )}

          {canEdit && onEdit && (
            <DropdownMenuItem onClick={onEdit} className="cursor-pointer text-xs font-medium">
              <Edit className="mr-2 h-3.5 w-3.5" />
              Edit Post
            </DropdownMenuItem>
          )}

          {canDelete && onDelete && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={onDelete}
                className="cursor-pointer text-xs font-medium text-rose-400 focus:text-rose-300"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete Post
              </DropdownMenuItem>
            </>
          )}

          {onReport && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={onReport}
                className="cursor-pointer text-xs font-medium text-slate-400"
              >
                <Flag className="mr-2 h-3.5 w-3.5" />
                Report Post
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
