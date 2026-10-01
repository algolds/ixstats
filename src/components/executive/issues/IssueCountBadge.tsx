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
      className={`text-caption font-data inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 leading-none font-semibold tabular-nums ${
        isUrgent ? "bg-red text-on-red" : "facet-gold"
      } ${className ?? ""}`}
    >
      {total}
      {/* Red is not the only signal: urgency is spoken too. */}
      {isUrgent ? <span className="sr-only">, {urgent} urgent</span> : null}
    </span>
  );
}

export const IssueCountBadge = memo(IssueCountBadgeInner);
