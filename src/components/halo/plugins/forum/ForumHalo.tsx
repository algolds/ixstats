"use client";

/**
 * ForumHalo — Halo overlay plugin for forum pages.
 *
 * Shows the current forum/thread breadcrumb in the capsule center
 * and exposes ForumView as the "forum" expanded view.
 */

import React, { useMemo } from "react";
import { ChatBubble as MessageSquare } from "iconoir-react";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { useDIPlugin } from "~/components/halo/plugin-context";
import { ForumView } from "./views";
import { useDynamicIslandSize, SIZE_PRESETS } from "~/components/halo/HaloPrimitives";
import { PreText } from "~/components/ui/pretext";

function ForumBreadcrumb() {
  const { currentThread, currentForum, unreadAlerts } = useForumContext();
  const { state } = useDynamicIslandSize();
  const isCollapsed = state.size === SIZE_PRESETS.WIKI_COMPACT;

  const label = currentThread?.title ?? currentForum?.title ?? "Forum";

  return (
    <span
      className={`flex items-center gap-2 overflow-hidden transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ${
        isCollapsed ? "max-w-[100px]" : "max-w-[220px]"
      }`}
    >
      <MessageSquare className="text-orange h-3 w-3 shrink-0 opacity-70" />
      <PreText className="text-label text-caption truncate" whiteSpace="nowrap">
        {label}
      </PreText>
      {unreadAlerts > 0 && (
        <PreText
          className="bg-orange text-caption text-on-orange flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full px-1 font-semibold"
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
      accentColor: "var(--color-orange)",
      stickyLabel: "Forum",
      badge: unreadAlerts > 0 ? { color: "var(--color-orange)", pulse: true } : undefined,
    }),
    [unreadAlerts]
  );

  useDIPlugin(plugin);
  return null;
}

// Backwards compatibility alias
export const ForumDIPlugin = ForumHalo;
