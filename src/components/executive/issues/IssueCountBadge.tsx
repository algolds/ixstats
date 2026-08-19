"use client";

import { memo } from "react";
import { useIssueCount } from "~/hooks/useNationalIssues";

interface IssueCountBadgeProps {
  countryId: string | undefined;
  className?: string;
}

function IssueCountBadgeInner({ countryId, className }: IssueCountBadgeProps) {
  const { total, urgent } = useIssueCount(countryId);

  if (total === 0) return null;

  const isUrgent = urgent > 0;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-[10px] leading-none font-bold ${
        isUrgent
          ? "h-4 min-w-[16px] bg-red-500 px-1 text-white"
          : "h-4 min-w-[16px] bg-amber-500 px-1 text-white"
      } ${className ?? ""}`}
    >
      {total}
    </span>
  );
}

export const IssueCountBadge = memo(IssueCountBadgeInner);
