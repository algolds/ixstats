"use client";

import { useEffect } from "react";
import { useNotificationBadge } from "./useLiveNotifications";
import { restoreTitle } from "~/lib/notifications/title-badge";

interface UsePageTitleOptions {
  /**
   * Custom page title without the "- IxStats" suffix
   * @example "Dashboard", "Country Profile", "MyCountry"
   */
  title: string;
  /**
   * Whether to enable notification badge in the title
   * @default true
   */
  enableNotificationBadge?: boolean;
}

/**
 * Universal page title hook that combines custom title with notification badge
 *
 * Format: "(N) PageName - IxStats" when unread notifications exist
 * Otherwise: "PageName - IxStats"
 *
 * @param options - Configuration options
 * @returns void (updates document.title directly)
 *
 * @example
 * ```tsx
 * function DashboardPage() {
 *   usePageTitle({ title: "Dashboard" });
 *   // Sets title to "Dashboard - IxStats" or "(3) Dashboard - IxStats" if 3 unread notifications
 *   return <div>...</div>;
 * }
 * ```
 */
export function usePageTitle({ title, enableNotificationBadge = true }: UsePageTitleOptions) {
  // Get unread count from notification system
  const { unreadCount } = useNotificationBadge({
    enableTitleBadge: enableNotificationBadge,
  });

  useEffect(() => {
    if (typeof document === "undefined") return;

    const baseTitle = `${title} - IxStats`;
    const fullTitle =
      enableNotificationBadge && unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;

    document.title = fullTitle;

    // On unmount (or before the next title) leave this page's title, keeping the unread badge
    // that a still-mounted instance (the app shell's) shows.
    return () => {
      if (typeof document !== "undefined") restoreTitle(baseTitle);
    };
  }, [title, unreadCount, enableNotificationBadge]);
}
