/**
 * useClearanceAccess Hook
 *
 * Provides clearance-based access control for intelligence data.
 */

import { useCallback } from "react";
import { hasAccess as hasAccessUtil } from "~/lib/clearance-utils";
import type { ClassificationLevel } from "~/types/intelligence-briefing";

interface UseClearanceAccessProps {
  viewerClearanceLevel: ClassificationLevel;
}

export const useClearanceAccess = ({ viewerClearanceLevel }: UseClearanceAccessProps) => {
  const hasAccess = useCallback(
    (classification: ClassificationLevel): boolean => {
      return hasAccessUtil(viewerClearanceLevel, classification);
    },
    [viewerClearanceLevel]
  );

  const filterByAccess = useCallback(
    <T extends { classification: ClassificationLevel }>(items: T[]): T[] => {
      return items.filter(item => hasAccess(item.classification));
    },
    [hasAccess]
  );

  return {
    hasAccess,
    filterByAccess,
    viewerClearanceLevel,
  };
};
