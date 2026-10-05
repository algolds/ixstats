"use client";

import React, { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { WarningTriangle } from "iconoir-react";
import { Badge, type BadgeTone } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { timeAgo } from "~/lib/format/compact";
import { useNotify } from "~/hooks/useNotify";

/** Element id the `?focus=alerts` deep link (threshold-alert notifications) scrolls to. */
export const INTELLIGENCE_ALERTS_ANCHOR = "intelligence-alerts";

const SEVERITY_TONE: Record<string, BadgeTone> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
};

export function severityTone(severity: string): BadgeTone {
  return SEVERITY_TONE[severity.toLowerCase()] ?? "default";
}

function severityLabel(severity: string): string {
  const s = severity.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * MyCountry overview rail card: the nation's open intelligence alerts (threshold breaches set up
 * in notification preferences), most severe first. Unread rows are marked; the owner marks them
 * read or dismisses them. Renders nothing while there are no open alerts.
 */
export function IntelligenceAlertsCard({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data } = api.intelligence.getMyAlerts.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const refresh = () => utils.intelligence.getMyAlerts.invalidate({ countryId });
  const onError = (e: { message?: string }) =>
    notify.error("Could not update the alert", e?.message);
  const markRead = api.intelligence.markAlertRead.useMutation({ onSuccess: refresh, onError });
  const markAll = api.intelligence.markAllAlertsRead.useMutation({ onSuccess: refresh, onError });
  const dismiss = api.intelligence.dismissAlert.useMutation({ onSuccess: refresh, onError });

  const alerts = data?.alerts ?? [];

  // Threshold-alert notifications link to /mycountry?focus=alerts: scroll here once the card
  // has rows to show (it renders nothing until the query returns).
  const focusAlerts = useSearchParams()?.get("focus") === "alerts";
  const scrolled = useRef(false);
  useEffect(() => {
    if (!focusAlerts || alerts.length === 0 || scrolled.current) return;
    scrolled.current = true;
    document.getElementById(INTELLIGENCE_ALERTS_ANCHOR)?.scrollIntoView({ behavior: "smooth" });
  }, [focusAlerts, alerts.length]);

  if (alerts.length === 0) return null;
  const unread = data?.unreadCount ?? 0;

  return (
    <Card
      id={INTELLIGENCE_ALERTS_ANCHOR}
      role="region"
      aria-labelledby="intelligence-alerts-title"
      className="rounded-card scroll-mt-24"
    >
      <CardHeader className="flex-row items-center gap-3 px-4 pt-4 pb-0">
        <span
          aria-hidden="true"
          className="bg-fill-3 text-label-secondary flex size-8 shrink-0 items-center justify-center rounded-lg"
        >
          <WarningTriangle className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="intelligence-alerts-title" className="text-headline text-label">
            Intelligence alerts
          </h2>
          <p className="text-footnote text-label-secondary">
            {data?.openCount ?? alerts.length} open
            {unread > 0 ? `, ${unread} unread` : ""}
          </p>
        </div>
        {unread > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate({ countryId })}
          >
            Mark all read
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pt-2 pb-3">
        <ul className="divide-separator divide-y" aria-label="Open intelligence alerts">
          {alerts.map((alert) => {
            const isUnread = !alert.readAt;
            return (
              <li key={alert.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-start gap-2">
                  <Badge variant={severityTone(alert.severity)}>
                    {severityLabel(alert.severity)}
                  </Badge>
                  <p
                    className={cn(
                      "text-body text-label min-w-0 flex-1",
                      isUnread ? "font-semibold" : "font-normal"
                    )}
                  >
                    {alert.title}
                    {isUnread ? <span className="sr-only"> (unread)</span> : null}
                  </p>
                </div>
                <p className="text-footnote text-label-secondary">{alert.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-caption text-label-secondary mr-auto">
                    {timeAgo(alert.detectedAt)}
                  </span>
                  {isUnread ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate({ id: alert.id })}
                    >
                      Mark read
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={dismiss.isPending}
                    onClick={() => dismiss.mutate({ id: alert.id })}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
