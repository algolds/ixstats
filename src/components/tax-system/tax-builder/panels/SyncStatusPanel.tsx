/**
 * Sync Status Panel for Tax Builder
 *
 * Displays cross-builder synchronization status including:
 * - Auto-sync indicators
 * - Conflict warnings
 * - Revenue source sync status
 */

"use client";

import React from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge as UIBadge } from "~/components/ui/badge";
import { CheckCircle, Zap } from "lucide-react";

interface SyncStatusPanelProps {
  governmentData?: any;
  revenueAutoPopulated: boolean;
  syncedCategoryIndices: Set<number>;
}

/**
 * Sync Status Panel Component
 * ~200 lines extracted from main TaxBuilder
 */
export const SyncStatusPanel = React.memo<SyncStatusPanelProps>(
  ({ governmentData, revenueAutoPopulated, syncedCategoryIndices }) => {
    // Only show if there's sync data
    if (!governmentData?.revenueSources || !revenueAutoPopulated) {
      return null;
    }

    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Tax categories auto-populated from government revenue sources. You can modify or add
          additional categories as needed.
        </AlertDescription>
      </Alert>
    );
  }
);

SyncStatusPanel.displayName = "SyncStatusPanel";

interface CategorySyncBadgeProps {
  categoryIndex: number;
  syncedCategoryIndices: Set<number>;
}

/**
 * Badge to show sync status for individual categories
 */
export const CategorySyncBadge = React.memo<CategorySyncBadgeProps>(
  ({ categoryIndex, syncedCategoryIndices }) => {
    if (!syncedCategoryIndices.has(categoryIndex)) {
      return null;
    }

    return (
      <div className="absolute top-2 right-2 z-10">
        <UIBadge variant="secondary" className="text-xs">
          <Zap className="mr-1 h-3 w-3" />
          Auto-synced
        </UIBadge>
      </div>
    );
  }
);

CategorySyncBadge.displayName = "CategorySyncBadge";
