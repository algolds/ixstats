"use client";

/**
 * ForumHalo — Halo overlay plugin for forum pages.
 *
 * Shows the current forum/thread breadcrumb in the capsule center
 * and exposes ForumView as the "forum" expanded view.
 */

import React, { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { useDIPlugin } from "~/components/halo/plugin-context";
import { ForumView } from "./views";
import { useDynamicIslandSize, SIZE_PRESETS } from "~/components/ui/dynamic-island";
import { PreText } from "~/components/ui/pretext";

function ForumBreadcrumb() {
  const { currentThread, currentForum, unreadAlerts } = useForumContext();
  const { state } = useDynamicIslandSize();
  const isCollapsed = state.size === SIZE_PRESETS.WIKI_COMPACT;

  const label = currentThread?.title ?? currentForum?.title ?? "Forum";

  return (
    <span
      className={`flex items-center gap-1.5 overflow-hidden transition-all duration-300 ${
        isCollapsed ? "max-w-[100px]" : "max-w-[220px]"
      }`}
    >
      <MessageSquare className="h-3 w-3 shrink-0 text-orange-400 opacity-70" />
      <PreText className="text-foreground/80 truncate text-xs font-medium" whiteSpace="nowrap">
        {label}
      </PreText>
      {unreadAlerts > 0 && (
        <PreText
          className="flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1 text-[8px] font-bold text-white"
          whiteSpace="nowrap"
        >
          {String(unreadAlerts)}
        </PreText>
      )}
    </span>
  );
}

export function ForumHalo() {
  const { unreadAlerts } = useForumContext();

  const plugin = useMemo(
    () => ({
      id: "forum",
      priority: 10,
      center: <ForumBreadcrumb />,
      expandedViews: { forum: ForumView },
      accentColor: "#f97316",
      stickyLabel: "Forum",
      badge: unreadAlerts > 0 ? { color: "#f97316", pulse: true } : undefined,
    }),
    [unreadAlerts]
  );

  useDIPlugin(plugin);
  return null;
}

// Backwards compatibility alias
export const ForumDIPlugin = ForumHalo;
