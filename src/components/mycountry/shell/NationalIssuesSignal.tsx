"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Signal } from "~/components/ui/signal";
import { useIssueCount } from "~/hooks/useNationalIssues";

interface NationalIssuesSignalProps {
  countryId: string;
  section: string;
  onNavigate?: (section: string) => void;
}

/**
 * Inline national-issues notice for the MyCountry command shell: surfaces pending issues cleanly
 * above the section content without floating over the side rail.
 */
export function NationalIssuesSignal({
  countryId,
  section,
  onNavigate,
}: NationalIssuesSignalProps) {
  const { total, urgent, isLoading } = useIssueCount(countryId);
  const [dismissedForCount, setDismissedForCount] = useState<number | null>(null);

  if (!countryId || isLoading || total === 0 || dismissedForCount === total) {
    return null;
  }

  const viewIssues = () => {
    if (section !== "overview") {
      onNavigate?.("overview");
    }
    requestAnimationFrame(() => {
      document.getElementById("executive-agenda")?.scrollIntoView({ behavior: "smooth" });
    });
  };

  return (
    <Signal
      tone={urgent > 0 ? "warning" : "info"}
      title={`${total} national ${total === 1 ? "issue" : "issues"} waiting`}
      onDismiss={() => setDismissedForCount(total)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {urgent > 0
            ? `${urgent} ${urgent === 1 ? "carries" : "carry"} a deadline on your executive agenda.`
            : "Review and respond on the Overview agenda."}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={viewIssues}>
          View issues
        </Button>
      </div>
    </Signal>
  );
}
