"use client";

import { Heart, Repeat2, MessageCircle, Bookmark, Share2 } from "lucide-react";
import { cn } from "~/lib/utils";

export interface PostFooterActionsProps {
  liked: boolean;
  likeCount: number;
  reposted: boolean;
  repostCount: number;
  commentCount: number;
  bookmarked: boolean;
  onLike: () => void;
  onRepost: () => void;
  onComment: () => void;
  onBookmark: () => void;
  onShare: () => void;
  className?: string;
}

export function PostFooterActions({
  liked,
  likeCount,
  reposted,
  repostCount,
  commentCount,
  bookmarked,
  onLike,
  onRepost,
  onComment,
  onBookmark,
  onShare,
  className,
}: PostFooterActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between pt-2 text-xs font-medium tracking-tight text-slate-400 select-none",
        className
      )}
    >
      {/* Comment */}
      <button
        onClick={onComment}
        className="group flex items-center gap-1.5 rounded-full p-1.5 transition-all duration-150 hover:bg-cyan-500/10 hover:text-cyan-400 active:scale-[0.92]"
      >
        <MessageCircle className="h-4 w-4 transition-transform group-hover:scale-110" />
        <span className="tabular-nums">{commentCount > 0 ? commentCount : ""}</span>
      </button>

      {/* Repost */}
      <button
        onClick={onRepost}
        className={cn(
          "group flex items-center gap-1.5 rounded-full p-1.5 transition-all duration-150 active:scale-[0.92]",
          reposted
            ? "text-emerald-400 hover:bg-emerald-500/20"
            : "hover:bg-emerald-500/10 hover:text-emerald-400"
        )}
      >
        <Repeat2 className="h-4 w-4 transition-transform group-hover:scale-110" />
        <span className="tabular-nums">{repostCount > 0 ? repostCount : ""}</span>
      </button>

      {/* Like */}
      <button
        onClick={onLike}
        className={cn(
          "group flex items-center gap-1.5 rounded-full p-1.5 transition-all duration-150 active:scale-[0.92]",
          liked ? "text-rose-500 hover:bg-rose-500/20" : "hover:bg-rose-500/10 hover:text-rose-400"
        )}
      >
        <Heart
          className={cn(
            "h-4 w-4 transition-transform group-hover:scale-110",
            liked && "fill-current"
          )}
        />
        <span className="tabular-nums">{likeCount > 0 ? likeCount : ""}</span>
      </button>

      {/* Bookmark */}
      <button
        onClick={onBookmark}
        className={cn(
          "group flex items-center gap-1.5 rounded-full p-1.5 transition-all duration-150 active:scale-[0.92]",
          bookmarked
            ? "text-amber-400 hover:bg-amber-500/20"
            : "hover:bg-amber-500/10 hover:text-amber-400"
        )}
      >
        <Bookmark
          className={cn(
            "h-4 w-4 transition-transform group-hover:scale-110",
            bookmarked && "fill-current"
          )}
        />
      </button>

      {/* Share */}
      <button
        onClick={onShare}
        className="group flex items-center gap-1.5 rounded-full p-1.5 transition-all duration-150 hover:bg-purple-500/10 hover:text-purple-400 active:scale-[0.92]"
      >
        <Share2 className="h-4 w-4 transition-transform group-hover:scale-110" />
      </button>
    </div>
  );
}
