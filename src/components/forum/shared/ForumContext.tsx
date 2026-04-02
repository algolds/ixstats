// src/components/forum/shared/ForumContext.tsx
// Context for passing forum state to the DynamicIsland and other global components.
// Mirrors WikiContext.tsx pattern.

"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface ForumThread {
  id: number;
  title: string;
}

interface ForumInfo {
  id: number;
  title: string;
}

interface ForumContextState {
  /** Whether the user is currently on a forum page */
  isForumPage: boolean;
  /** Current thread being viewed (null if not in a thread) */
  currentThread: (ForumThread & { forumName: string }) | null;
  /** Current forum/category being viewed */
  currentForum: ForumInfo | null;
  /** Unread alerts count */
  unreadAlerts: number;
  /** Recently visited threads (from sessionStorage, newest first) */
  recentThreads: ForumThread[];
  /** Set the current forum page state */
  setForumPage: (thread: (ForumThread & { forumName: string }) | null, forum: ForumInfo | null) => void;
  /** Update unread alerts count */
  setUnreadAlerts: (count: number) => void;
  /** Clear forum page state (when leaving forum) */
  clearForumPage: () => void;
}

const ForumContext = createContext<ForumContextState>({
  isForumPage: false,
  currentThread: null,
  currentForum: null,
  unreadAlerts: 0,
  recentThreads: [],
  setForumPage: () => {},
  setUnreadAlerts: () => {},
  clearForumPage: () => {},
});

export function ForumContextProvider({ children }: { children: ReactNode }) {
  const [currentThread, setCurrentThread] = useState<(ForumThread & { forumName: string }) | null>(null);
  const [currentForum, setCurrentForum] = useState<ForumInfo | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [recentThreads, setRecentThreads] = useState<ForumThread[]>([]);

  // Restore recent threads from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("forum:recentThreads");
      if (stored) setRecentThreads(JSON.parse(stored));
    } catch { /* SSR or private browsing */ }
  }, []);

  const setForumPage = useCallback(
    (thread: (ForumThread & { forumName: string }) | null, forum: ForumInfo | null) => {
      setCurrentThread(thread);
      setCurrentForum(forum);

      // Track recent threads in sessionStorage (last 8, no duplicates)
      if (thread) {
        try {
          setRecentThreads((prev) => {
            const filtered = prev.filter((t) => t.id !== thread.id);
            const next = [{ id: thread.id, title: thread.title }, ...filtered].slice(0, 8);
            sessionStorage.setItem("forum:recentThreads", JSON.stringify(next));
            return next;
          });
        } catch { /* ignore */ }
      }
    },
    []
  );

  const clearForumPage = useCallback(() => {
    setCurrentThread(null);
    setCurrentForum(null);
  }, []);

  return (
    <ForumContext.Provider
      value={{
        isForumPage: currentThread !== null || currentForum !== null,
        currentThread,
        currentForum,
        unreadAlerts,
        recentThreads,
        setForumPage,
        setUnreadAlerts,
        clearForumPage,
      }}
    >
      {children}
    </ForumContext.Provider>
  );
}

export function useForumContext() {
  return useContext(ForumContext);
}
