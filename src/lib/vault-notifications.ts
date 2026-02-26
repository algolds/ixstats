/**
 * Vault & Card System Notification Helpers
 *
 * Dispatches vault/card events through the unified Dynamic Island notification system.
 * Uses notifyFromStore() for non-hook contexts (callable from any function).
 */

"use client";

import { notifyFromStore } from "~/hooks/useNotify";
import type {
  NotificationCategory,
} from "~/types/unified-notifications";

type ToastType = "success" | "error" | "warning" | "info";
type ToastPriority = "critical" | "high" | "medium" | "low";

interface VaultNotificationOptions {
  title: string;
  message: string;
  type: ToastType;
  priority?: ToastPriority;
  category?: NotificationCategory;
  metadata?: Record<string, unknown>;
}

/**
 * Send a vault notification through the Dynamic Island toast system.
 * Call directly (not a hook) — safe from any component or function.
 */
export function sendVaultNotification({
  title,
  message,
  type,
  priority = "medium",
  category = "achievement",
  metadata,
}: VaultNotificationOptions) {
  notifyFromStore({
    title,
    message,
    type,
    priority,
    category,
    metadata,
  });
}

// ─── Convenience helpers for common vault events ────────────────────

export const vaultNotify = {
  packPurchased: () =>
    sendVaultNotification({
      title: "Pack Purchased",
      message: "Pack purchased successfully!",
      type: "success",
      category: "achievement",
    }),

  packOpened: (cardCount: number) =>
    sendVaultNotification({
      title: "Pack Opened",
      message: `Opened a pack and received ${cardCount} cards!`,
      type: "success",
      category: "achievement",
      priority: "medium",
    }),

  cardsImported: (count: number, nation: string) =>
    sendVaultNotification({
      title: "Deck Imported",
      message: `Imported ${count} cards from ${nation}`,
      type: "success",
      category: "achievement",
      priority: "high",
      metadata: { nation, cardsImported: count },
    }),

  nationVerified: (nation: string) =>
    sendVaultNotification({
      title: "Nation Verified",
      message: `Ownership of ${nation} verified successfully`,
      type: "success",
      category: "system",
    }),

  dailyBonusClaimed: (message: string) =>
    sendVaultNotification({
      title: "Daily Bonus",
      message,
      type: "success",
      category: "achievement",
    }),

  tradeCompleted: (action: string) =>
    sendVaultNotification({
      title: "Trade Update",
      message: action,
      type: "success",
      category: "economic",
    }),

  cardsBulkAction: (action: string, count: number) =>
    sendVaultNotification({
      title: "Bulk Action",
      message: `${action} ${count} cards`,
      type: "success",
      category: "achievement",
    }),

  error: (message: string) =>
    sendVaultNotification({
      title: "Vault Error",
      message,
      type: "error",
      priority: "high",
      category: "system",
    }),
};
