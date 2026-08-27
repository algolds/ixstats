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

const STORAGE_KEY = "national_issues_last_counts";

export function useNationalIssuesToast(countryId: string | undefined) {
  const { total, urgent, isLoading } = useIssueCount(countryId);
  const enqueue = useToastQueueStore((s) => s.enqueue);
  const dismiss = useToastQueueStore((s) => s.dismiss);

  const toastIdRef = useRef<string | null>(null);
  const lastCountRef = useRef<{ total: number; urgent: number }>({ total: 0, urgent: 0 });

  // Load from sessionStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        lastCountRef.current = JSON.parse(stored);
      }
    } catch {
      // Ignore sessionStorage/JSON parse errors
    }
  }, []);

  useEffect(() => {
    // Avoid running effect if country hasn't loaded or query is in loading state
    if (!countryId || isLoading) {
      return;
    }

    if (total === 0) {
      if (toastIdRef.current) {
        dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      lastCountRef.current = { total: 0, urgent: 0 };
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
      return;
    }

    // Same counts — skip showing new toast (survives reload)
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

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ total, urgent }));
    } catch {
      // Ignore
    }
  }, [total, urgent, countryId, isLoading, enqueue, dismiss]);

  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, [dismiss]);
}
