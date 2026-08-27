"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChatBubble as MessageSquare,
  Search,
  NavArrowRight as ChevronRight,
  Plus,
  ViewGrid as Layout,
  Bookmark,
  Refresh as RefreshCw,
  Xmark as X,
  Bell,
  Settings,
} from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { PreText } from "~/components/ui/pretext";
import type { DIViewProps, ViewMode } from "~/components/halo/types";

export interface ForumViewProps extends DIViewProps {}

// ─── Section label ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground px-1 pt-2 pb-1 text-[11px] font-semibold tracking-wider uppercase">
      {typeof children === "string" ? <PreText whiteSpace="nowrap">{children}</PreText> : children}
    </div>
  );
}

// ─── Reusable forum row item ─────────────────────────────────────────────────

function ForumRow({
  icon,
  iconBg,
  label,
  description,
  onClick,
  rightElement,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description?: string;
  onClick?: () => void;
  rightElement?: React.ReactNode;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className={`group hover:bg-accent/10 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-200 ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <div className={`shrink-0 rounded-md p-1.5 transition-colors ${iconBg}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <PreText
          className="text-foreground block truncate text-sm leading-normal font-medium"
          whiteSpace="nowrap"
        >
          {label}
        </PreText>
        {description && (
          <PreText
            className="text-foreground/70 block truncate text-xs leading-normal"
            whiteSpace="nowrap"
          >
            {description}
          </PreText>
        )}
      </div>
      {rightElement !== undefined ? (
        rightElement
      ) : onClick ? (
        <ChevronRight className="text-muted-foreground/30 group-hover:text-muted-foreground/60 h-3.5 w-3.5 transition-all group-hover:translate-x-0.5" />
      ) : null}
    </Component>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function ForumHeader({
  onClose,
  onSwitchMode,
  onRefresh,
  isRefreshing,
}: {
  onClose: () => void;
  onSwitchMode?: (mode: ViewMode) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4 text-orange-400" />
        <PreText className="text-inherit" whiteSpace="nowrap">
          Forum
        </PreText>
      </div>
      <div className="flex items-center gap-1">
        {onSwitchMode && (
          <>
            <button
              onClick={() => onSwitchMode("search")}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
              title="Global Search"
              type="button"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onSwitchMode("notifications")}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
              title="Notifications"
              type="button"
            >
              <Bell className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onSwitchMode("settings")}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
              title="Settings"
              type="button"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ForumView({ onClose, onSwitchMode }: ForumViewProps) {
  const router = useRouter();
  const { currentThread, currentForum, recentThreads, unreadAlerts } = useForumContext();
  const { isSignedIn } = useUser();
  const [activeTab, setActiveTab] = useState<"recent" | "stash">("recent");

  const {
    data: stashedThreads,
    isLoading: loadingStashed,
    refetch: refetchStash,
  } = api.forum.getStashedThreads.useQuery({ limit: 5 }, { enabled: !!isSignedIn });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (isSignedIn) {
        await refetchStash();
      }
    } catch (e) {
      console.error("Refetch stash failed:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [isSignedIn, refetchStash]);

  const navigate = (href: string) => {
    onClose();
    router.push(withBasePath(href));
  };

  return (
    <div className="p-4">
      <ForumHeader
        onClose={onClose}
        onSwitchMode={onSwitchMode}
        onRefresh={isSignedIn ? handleRefresh : undefined}
        isRefreshing={isRefreshing}
      />

      <div className="space-y-1">
        {/* ── Current Context ─────────────────────────────────────────── */}
        {(currentThread || currentForum) && (
          <>
            <SectionLabel>Current Context</SectionLabel>
            {currentThread && (
              <ForumRow
                icon={<MessageSquare className="h-3.5 w-3.5 text-orange-500" />}
                iconBg="bg-orange-500/15"
                label={currentThread.title}
                description={`Viewing thread in ${currentThread.forumName}`}
                onClick={() => navigate(`/forum/thread/${currentThread.id}`)}
              />
            )}
            {currentForum && !currentThread && (
              <ForumRow
                icon={<Layout className="h-3.5 w-3.5 text-orange-500" />}
                iconBg="bg-orange-500/15"
                label={currentForum.title}
                description="Browsing forum category"
              />
            )}
          </>
        )}

        {/* ── Quick Actions ───────────────────────────────────────────── */}
        <SectionLabel>Actions</SectionLabel>

        <ForumRow
          icon={<Layout className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-500/15"
          label="All Forums"
          description="Browse categories and boards"
          onClick={() => navigate("/forum")}
        />

        <ForumRow
          icon={<Plus className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-500/15"
          label="New Thread"
          description="Start a new forum discussion"
          onClick={() => navigate("/forum/new-thread")}
        />

        <ForumRow
          icon={<MessageSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
          iconBg="bg-purple-500/15"
          label="Messages"
          description="Private conversations and inbox"
          onClick={() => navigate("/forum/conversations")}
          rightElement={
            unreadAlerts > 0 ? (
              <PreText
                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white shadow-sm"
                whiteSpace="nowrap"
              >
                {String(unreadAlerts)}
              </PreText>
            ) : undefined
          }
        />

        {/* ── Discussions ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-1 pt-2 pb-1">
          <SectionLabel>Discussions</SectionLabel>

          {/* Segmented control for tabs */}
          {isSignedIn && (
            <div className="bg-accent/15 flex max-w-[140px] flex-1 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab("recent")}
                className={`flex-1 rounded-md py-0.5 text-center text-[9px] font-bold tracking-wide uppercase transition-all ${
                  activeTab === "recent"
                    ? "bg-white text-orange-500 shadow-sm dark:bg-white/10 dark:text-orange-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PreText className="text-inherit" whiteSpace="nowrap">
                  Recent
                </PreText>
              </button>
              <button
                onClick={() => setActiveTab("stash")}
                className={`flex-1 rounded-md py-0.5 text-center text-[9px] font-bold tracking-wide uppercase transition-all ${
                  activeTab === "stash"
                    ? "bg-white text-orange-500 shadow-sm dark:bg-white/10 dark:text-orange-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PreText className="text-inherit" whiteSpace="nowrap">
                  Stash
                </PreText>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          {activeTab === "recent" && (
            <>
              {recentThreads.length > 0 ? (
                recentThreads
                  .slice(0, 5)
                  .map((thread) => (
                    <ForumRow
                      key={thread.id}
                      icon={
                        <MessageSquare className="text-muted-foreground h-3.5 w-3.5 transition-colors group-hover:text-orange-500" />
                      }
                      iconBg="bg-accent/10 group-hover:bg-orange-500/10 transition-colors"
                      label={thread.title}
                      description="Recently visited thread"
                      onClick={() => navigate(`/forum/thread/${thread.id}`)}
                    />
                  ))
              ) : (
                <PreText
                  className="text-muted-foreground bg-accent/5 rounded-lg border border-dashed border-white/5 py-6 text-center text-xs"
                  whiteSpace="nowrap"
                >
                  No recent threads visited.
                </PreText>
              )}
            </>
          )}

          {activeTab === "stash" && (
            <>
              {loadingStashed ? (
                <PreText
                  className="text-muted-foreground animate-pulse py-8 text-center text-xs"
                  whiteSpace="nowrap"
                >
                  Loading stashed threads…
                </PreText>
              ) : stashedThreads && stashedThreads.length > 0 ? (
                stashedThreads
                  .slice(0, 5)
                  .map((item) => (
                    <ForumRow
                      key={item.id}
                      icon={
                        <Bookmark className="text-muted-foreground h-3.5 w-3.5 transition-colors group-hover:text-orange-500" />
                      }
                      iconBg="bg-accent/10 group-hover:bg-orange-500/10 transition-colors"
                      label={item.title}
                      description={`Saved on ${new Date(item.savedAt).toLocaleDateString()}`}
                      onClick={() => navigate(item.slug)}
                    />
                  ))
              ) : (
                <PreText
                  className="text-muted-foreground bg-accent/5 rounded-lg border border-dashed border-white/5 py-6 text-center text-xs"
                  whiteSpace="nowrap"
                >
                  Stash is empty. Bookmark threads to see them here!
                </PreText>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
