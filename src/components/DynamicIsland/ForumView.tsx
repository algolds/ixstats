// src/components/DynamicIsland/ForumView.tsx
// DynamicIsland expanded view for forum pages.
// Shows current thread info, recent threads, and quick actions.

"use client";

import { useRouter } from "next/navigation";
import { MessageSquare, Search, Clock, ArrowRight } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { useForumContext } from "~/components/forum/shared/ForumContext";

interface ForumViewProps {
  onClose: () => void;
}

function formatTimeAgo(unixTimestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - unixTimestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function ForumView({ onClose }: ForumViewProps) {
  const router = useRouter();
  const { currentThread, currentForum, recentThreads, unreadAlerts } = useForumContext();

  const navigate = (href: string) => {
    onClose();
    router.push(withBasePath(href));
  };

  return (
    <div className="w-full max-w-sm p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-orange-400" />
          <span className="text-xs font-semibold text-orange-400">Forum</span>
          {unreadAlerts > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
              {unreadAlerts}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate("/forum/search")}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <Search className="h-3 w-3" />
          Search
        </button>
      </div>

      {/* Current context */}
      {currentThread && (
        <div className="mb-3 rounded-lg bg-orange-500/10 border border-orange-500/20 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-orange-400/70 mb-1">
            Currently viewing
          </div>
          <div className="text-xs font-medium text-white truncate">
            {currentThread.title}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            in {currentThread.forumName}
          </div>
        </div>
      )}

      {currentForum && !currentThread && (
        <div className="mb-3 rounded-lg bg-orange-500/10 border border-orange-500/20 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-orange-400/70 mb-1">
            Browsing
          </div>
          <div className="text-xs font-medium text-white">
            {currentForum.title}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-3 flex gap-1.5">
        <button
          onClick={() => navigate("/forum")}
          className="flex-1 rounded-lg bg-white/5 px-2 py-1.5 text-[10px] font-medium text-zinc-300 hover:bg-white/10 transition-colors"
        >
          All Forums
        </button>
        <button
          onClick={() => navigate("/forum/new-thread")}
          className="flex-1 rounded-lg bg-orange-500/15 px-2 py-1.5 text-[10px] font-medium text-orange-400 hover:bg-orange-500/25 transition-colors"
        >
          New Thread
        </button>
        <button
          onClick={() => navigate("/forum/conversations")}
          className="flex-1 rounded-lg bg-white/5 px-2 py-1.5 text-[10px] font-medium text-zinc-300 hover:bg-white/10 transition-colors"
        >
          Messages
        </button>
      </div>

      {/* Recent threads */}
      {recentThreads.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1 text-[10px] text-zinc-500">
            <Clock className="h-3 w-3" />
            Recent threads
          </div>
          <div className="space-y-0.5">
            {recentThreads.slice(0, 5).map((thread) => (
              <button
                key={thread.id}
                onClick={() => navigate(`/forum/thread/${thread.id}`)}
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
              >
                <MessageSquare className="h-3 w-3 shrink-0 text-zinc-500 group-hover:text-orange-400" />
                <span className="truncate text-xs text-zinc-300 group-hover:text-white">
                  {thread.title}
                </span>
                <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-zinc-600 opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      )}

      {recentThreads.length === 0 && !currentThread && !currentForum && (
        <div className="py-3 text-center text-[11px] text-zinc-500">
          Browse forums to see recent threads here
        </div>
      )}
    </div>
  );
}
