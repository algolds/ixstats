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
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";

export interface ForumViewProps extends DIViewProps {}

// ─── Section label ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-subhead text-label-secondary px-1 pt-2 pb-1">
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
      className={`group hover:bg-fill-4 rounded-control flex w-full items-center gap-3 px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <div className={`rounded-control-sm shrink-0 p-2 transition-colors ${iconBg}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <PreText
          className="text-label text-body block truncate leading-normal font-medium"
          whiteSpace="nowrap"
        >
          {label}
        </PreText>
        {description && (
          <PreText
            className="text-label-secondary text-footnote block truncate leading-normal"
            whiteSpace="nowrap"
          >
            {description}
          </PreText>
        )}
      </div>
      {rightElement !== undefined ? (
        rightElement
      ) : onClick ? (
        <ChevronRight className="text-label-tertiary group-hover:text-label-tertiary h-3.5 w-3.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] group-hover:translate-x-0.5" />
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
      <div className="text-label text-headline flex items-center gap-2">
        <MessageSquare className="text-orange h-4 w-4" />
        <PreText className="text-inherit" whiteSpace="nowrap">
          Forum
        </PreText>
      </div>
      <div className="flex items-center gap-1">
        {onSwitchMode && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onSwitchMode("search")}
              className="text-label-secondary hover:text-label"
              title="Global Search"
              type="button"
              aria-label="Global Search"
            >
              <Search aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onSwitchMode("notifications")}
              className="text-label-secondary hover:text-label"
              title="Notifications"
              type="button"
              aria-label="Notifications"
            >
              <Bell aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onSwitchMode("settings")}
              className="text-label-secondary hover:text-label"
              title="Settings"
              type="button"
              aria-label="Settings"
            >
              <Settings aria-hidden />
            </Button>
          </>
        )}
        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            className="text-label-secondary hover:text-label"
            aria-label="Refresh data"
          >
            <RefreshCw aria-hidden className={isRefreshing ? "animate-spin" : ""} />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-label-secondary hover:text-label"
          aria-label="Close"
        >
          <X aria-hidden />
        </Button>
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
                icon={<MessageSquare className="text-orange h-3.5 w-3.5" />}
                iconBg="bg-orange/15"
                label={currentThread.title}
                description={`Viewing thread in ${currentThread.forumName}`}
                onClick={() => navigate(`/forum/thread/${currentThread.id}`)}
              />
            )}
            {currentForum && !currentThread && (
              <ForumRow
                icon={<Layout className="text-orange h-3.5 w-3.5" />}
                iconBg="bg-orange/15"
                label={currentForum.title}
                description="Browsing forum category"
              />
            )}
          </>
        )}

        {/* ── Quick Actions ───────────────────────────────────────────── */}
        <SectionLabel>Actions</SectionLabel>

        <ForumRow
          icon={<Layout className="text-blue h-3.5 w-3.5" />}
          iconBg="bg-blue/15"
          label="All Forums"
          description="Browse categories and boards"
          onClick={() => navigate("/forum")}
        />

        <ForumRow
          icon={<Plus className="text-orange h-3.5 w-3.5" />}
          iconBg="bg-orange/15"
          label="New Thread"
          description="Start a new forum discussion"
          onClick={() => navigate("/forum/new-thread")}
        />

        <ForumRow
          icon={<MessageSquare className="text-blue h-3.5 w-3.5" />}
          iconBg="bg-blue/15"
          label="Messages"
          description="Private conversations and inbox"
          onClick={() => navigate("/forum/conversations")}
          rightElement={
            unreadAlerts > 0 ? (
              <PreText
                className="bg-orange text-caption text-on-orange shadow-card flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-2 font-semibold"
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
            <SegmentedControl
              aria-label="Discussions"
              size="sm"
              value={activeTab}
              onValueChange={setActiveTab}
              options={[
                { value: "recent", label: "Recent" },
                { value: "stash", label: "Stash" },
              ]}
            />
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
                        <MessageSquare className="text-label-secondary group-hover:text-orange h-3.5 w-3.5 transition-colors" />
                      }
                      iconBg="bg-fill-4 group-hover:bg-orange/10 transition-colors"
                      label={thread.title}
                      description="Recently visited thread"
                      onClick={() => navigate(`/forum/thread/${thread.id}`)}
                    />
                  ))
              ) : (
                <PreText
                  className="text-label-secondary bg-fill-4 rounded-control border-separator text-footnote border border-dashed py-6 text-center"
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
                  className="text-label-secondary text-footnote py-8 text-center"
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
                        <Bookmark className="text-label-secondary group-hover:text-orange h-3.5 w-3.5 transition-colors" />
                      }
                      iconBg="bg-fill-4 group-hover:bg-orange/10 transition-colors"
                      label={item.title}
                      description={`Saved on ${new Date(item.savedAt).toLocaleDateString()}`}
                      onClick={() => navigate(item.slug)}
                    />
                  ))
              ) : (
                <PreText
                  className="text-label-secondary bg-fill-4 rounded-control border-separator text-footnote border border-dashed py-6 text-center"
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
