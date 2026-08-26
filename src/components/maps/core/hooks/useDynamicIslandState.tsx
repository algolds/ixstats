"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { useTheme } from "~/context/theme-context";
import { useIxTime } from "~/context/IxTimeContext";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import { useNotificationStore } from "~/stores/notificationStore";
import { useDebounce } from "~/hooks/useDebounce";
import { useThinkPagesWebSocket } from "~/hooks/useThinkPagesWebSocket";
import { api } from "~/trpc/react";
import { getGreeting, getTimeDisplay } from "../utils/dynamic-island-helpers";
import type { MapSearchResult } from "../MapDynamicIsland";

interface UseDynamicIslandStateProps {
  onSearchResult: (result: MapSearchResult) => void;
}

export function useDynamicIslandState({ onSearchResult }: UseDynamicIslandStateProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [timeDisplayMode, setTimeDisplayMode] = useState<"time" | "date" | "both">("time");
  const [isFlashing, setIsFlashing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { user, isLoaded } = useUser();
  const { ixTimeTimestamp } = useIxTime();
  const { theme, effectiveTheme, setTheme } = useTheme();
  const router = useRouter();

  const greeting = useMemo(() => getGreeting(ixTimeTimestamp), [ixTimeTimestamp]);
  const timeDisplay = useMemo(() => getTimeDisplay(ixTimeTimestamp), [ixTimeTimestamp]);

  // Profile data for greeting
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
    retry: 1,
  });
  const countryName = userProfile?.country?.name ?? "Country";

  // Notification stats
  const { stats: notificationStats } = useNotificationStore();
  const unreadNotifications = notificationStats?.unread ?? 0;

  // Messages unread count
  const { totalUnread: messageUnreadCount = 0, refetch: refetchMessages } = useMessageUnreadCount();

  // Unified unread count
  const totalUnread = unreadNotifications + messageUnreadCount;

  // WebSocket for live notifications
  const wsOptions = useMemo(
    () => ({
      accountId: user?.id ?? "",
      autoReconnect: true,
      onMessageUpdate: () => {
        void refetchMessages();
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 3000);
      },
    }),
    [user?.id, refetchMessages]
  );

  useThinkPagesWebSocket(wsOptions);

  // Geo Search
  const debouncedQuery = useDebounce(query.trim(), 250);

  const { data: results, isLoading: searchLoading } = api.geoCore.searchFeatures.useQuery(
    { query: debouncedQuery, limit: 20 },
    { enabled: debouncedQuery.length >= 2, staleTime: 30_000 }
  );

  const grouped = useMemo(() => {
    if (!results || results.length === 0) return [];
    const groups: Record<string, MapSearchResult[]> = {};
    for (const r of results) {
      (groups[r.type] ??= []).push(r);
    }
    return Object.entries(groups);
  }, [results]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flatResults = results ?? [];
  const showResults = searchOpen && debouncedQuery.length >= 2;
  const hasResults = grouped.length > 0;

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setSelectedIdx(-1);
  }, []);

  const handleSelect = useCallback(
    (result: MapSearchResult) => {
      onSearchResult(result);
      closeSearch();
    },
    [onSearchResult, closeSearch]
  );

  // Click outside → close
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [searchOpen, closeSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSearch();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && selectedIdx >= 0 && flatResults[selectedIdx]) {
        e.preventDefault();
        handleSelect(flatResults[selectedIdx]);
      }
    },
    // oxlint-disable-next-line
    [flatResults, selectedIdx, handleSelect, closeSearch]
  );

  // Cmd+K shortcut to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (searchOpen) closeSearch();
        else openSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen, openSearch, closeSearch]);

  return {
    searchOpen,
    setSearchOpen,
    query,
    setQuery,
    selectedIdx,
    setSelectedIdx,
    timeDisplayMode,
    setTimeDisplayMode,
    isFlashing,
    setIsFlashing,
    containerRef,
    inputRef,
    user,
    isLoaded,
    ixTimeTimestamp,
    theme,
    effectiveTheme,
    setTheme,
    router,
    greeting,
    timeDisplay,
    countryName,
    messageUnreadCount,
    unreadNotifications,
    totalUnread,
    results,
    searchLoading,
    grouped,
    flatResults,
    showResults,
    hasResults,
    openSearch,
    closeSearch,
    handleSelect,
    handleKeyDown,
  };
}
