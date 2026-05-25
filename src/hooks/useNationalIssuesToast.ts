"use client";

/**
 * useNationalIssuesToast — Pushes national issue alerts to the Dynamic Island toast queue.
 * Replaces the inline OverviewIssuesBanner with a floating DI notification.
 *
 * - Auto-dismisses after 8s (urgent) or 5s (normal)
 * - Uses "governance" category for DI icon mapping (Building2)
 * - Urgent issues trigger DI pill critical pulse animation
 * - Re-enqueues when counts change, deduplicates otherwise
 */

import { useEffect, useRef } from "react";
import { useIssueCount } from "./useNationalIssues";
import { useToastQueueStore } from "~/stores/toastQueueStore";

export function useNationalIssuesToast(countryId: string | undefined) {
  const { total, urgent } = useIssueCount(countryId);
  const enqueue = useToastQueueStore((s) => s.enqueue);
  const dismiss = useToastQueueStore((s) => s.dismiss);

  const toastIdRef = useRef<string | null>(null);
  const lastCountRef = useRef<{ total: number; urgent: number }>({ total: 0, urgent: 0 });

  useEffect(() => {
    if (total === 0) {
      if (toastIdRef.current) {
        dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      lastCountRef.current = { total: 0, urgent: 0 };
      return;
    }

    // Same counts — skip
    if (total === lastCountRef.current.total && urgent === lastCountRef.current.urgent) {
      return;
    }

    // Dismiss stale toast
    if (toastIdRef.current) {
      dismiss(toastIdRef.current);
    }

    const id = enqueue({
      title: `${total} National Issue${total !== 1 ? "s" : ""} Pending`,
      message:
        urgent > 0
          ? `${urgent} urgent — requires immediate attention`
          : "Review and respond in the Executive section",
      type: urgent > 0 ? "warning" : "info",
      priority: urgent > 0 ? "critical" : "high",
      category: "governance",
      duration: urgent > 0 ? 8000 : 5000,
      actions: [
        {
          label: "View Issues",
          onClick: () => {
            window.history.pushState({}, "", "/mycountry/executive");
            window.dispatchEvent(new PopStateEvent("popstate"));
          },
        },
      ],
    });

    toastIdRef.current = id;
    lastCountRef.current = { total, urgent };
  }, [total, urgent, enqueue, dismiss]);

  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, [dismiss]);
}
