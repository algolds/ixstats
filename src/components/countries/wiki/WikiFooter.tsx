"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { IxTime } from "~/lib/ixtime";

/**
 * WikiFooter Component
 *
 * Displays footer information for Wiki Intelligence tab with:
 * - Last updated timestamp (formatted with IxTime)
 * - Confidence percentage
 * - Section count badge
 */
interface WikiFooterProps {
  /** Unix timestamp of last wiki data update */
  lastUpdated: number;
  /** Confidence percentage (0-100) of wiki data accuracy */
  confidence: number;
  /** Number of wiki sections loaded */
  sectionCount: number;
}

export const WikiFooter: React.FC<WikiFooterProps> = ({
  lastUpdated,
  confidence,
  sectionCount,
}) => {
  return (
    <div className="glass-hierarchy-child rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Wiki data last updated: {IxTime.formatIxTime(lastUpdated, true)} •
          Confidence: {confidence}%
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            MediaWiki API
          </Badge>
          <Badge variant="outline" className="text-xs">
            {sectionCount} sections
          </Badge>
        </div>
      </div>
    </div>
  );
};
