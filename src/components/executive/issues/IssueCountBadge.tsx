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
      className={`text-caption inline-flex items-center justify-center rounded-full leading-none font-semibold ${
        isUrgent
          ? "bg-red text-on-red h-4 min-w-[16px] px-1"
          : "bg-yellow text-on-yellow h-4 min-w-[16px] px-1"
      } ${className ?? ""}`}
    >
      {total}
    </span>
  );
}

export const IssueCountBadge = memo(IssueCountBadgeInner);
