"use client";

import { NavArrowRight, WarningTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { focusRing } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * The tray's pinned row for a nation owner's waiting national issues. A standing task, not a notification: it can't
 * be swiped away, it doesn't count toward the unread badge, and it goes once nothing is waiting. Same query and options
 * as the sidebar's pending-issues badge, so the two share one request.
 */
export function PendingIssuesRow({ onOpen }: { onOpen: () => void }) {
  const { country } = useUserCountry();
  const countryId = country?.id;
  const { data } = api.nationalIssues.getPendingCount.useQuery(
    { countryId: countryId ?? "" },
    { enabled: Boolean(countryId), staleTime: 60_000, refetchOnWindowFocus: false }
  );
  const total = data?.total ?? 0;
  if (!countryId || total < 1) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-slot="pending-issues-row"
      className={cn(
        "bg-caution/10 hover:bg-caution/15 rounded-row duration-fast flex min-h-11 w-full items-center gap-3 px-3 text-left transition-colors",
        focusRing
      )}
    >
      <WarningTriangle aria-hidden className="text-caution size-4 shrink-0" />
      <span className="text-body text-label flex-1">
        {total === 1 ? "1 national issue is waiting" : `${total} national issues are waiting`}
      </span>
      <NavArrowRight aria-hidden className="text-label-tertiary size-4 shrink-0" />
    </button>
  );
}
