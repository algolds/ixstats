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
      className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none ${
        isUrgent
          ? "bg-red-500 text-white min-w-[16px] h-4 px-1"
          : "bg-amber-500 text-white min-w-[16px] h-4 px-1"
      } ${className ?? ""}`}
    >
      {total}
    </span>
  );
}

export const IssueCountBadge = memo(IssueCountBadgeInner);
