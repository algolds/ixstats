"use client";
/**
 * Notification Badge Provider
 * Manages page title badge with unread notification count
 */

import React from "react";
import { useNotificationBadge } from "~/hooks/useLiveNotifications";

interface NotificationBadgeProviderProps {
  children: React.ReactNode;
}

export function NotificationBadgeProvider({ children }: NotificationBadgeProviderProps) {
  // This hook automatically manages the page title badge
  useNotificationBadge({ enableTitleBadge: true });

  // This provider doesn't render anything, it just manages the title
  return <>{children}</>;
}

export default NotificationBadgeProvider;
