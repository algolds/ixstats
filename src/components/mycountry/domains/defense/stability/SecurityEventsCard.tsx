"use client";
// src/components/defense/stability/SecurityEventsCard.tsx

import React from "react";
import { WarningTriangle as AlertTriangle, CheckCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface SecurityEvent {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  casualties: number;
  arrested: number;
  economicImpact: number;
  region?: string | null;
  city?: string | null;
}

interface ResolveEventMutation {
  mutate: (input: { id: string; resolutionNotes?: string }) => void;
}

interface SecurityEventsCardProps {
  activeEvents: SecurityEvent[];
  resolveEvent: ResolveEventMutation;
}

/** Event severity → semantic outline-badge colour. */
const SEVERITY_TONE: Record<string, string> = {
  critical: "border-destructive/30 text-destructive",
  high: "border-destructive/30 text-destructive",
  moderate: "border-yellow/30 text-yellow",
};

export const SecurityEventsCard = React.memo(function SecurityEventsCard({
  activeEvents,
  resolveEvent,
}: SecurityEventsCardProps) {
  return (
    <Card>
      <CardHeader className="p-5 pb-3">
        <h3 className="text-label text-title-3 flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="text-red h-4 w-4" />
          Active security events ({activeEvents.length})
        </h3>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {activeEvents.length > 0 ? (
          <div className="space-y-3">
            {activeEvents.map((event) => (
              <Card variant="inset" key={event.id} className="p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          SEVERITY_TONE[event.severity] ?? "text-label-secondary"
                        )}
                      >
                        {event.severity}
                      </Badge>
                      <h5 className="text-label text-body font-medium">{event.title}</h5>
                    </div>
                    <p className="text-label-secondary text-body mb-3">{event.description}</p>

                    <div className="text-footnote grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {event.casualties > 0 && (
                        <div>
                          <span className="text-label-secondary">Casualties:</span>
                          <span className="ml-1 font-medium tabular-nums">
                            <NumberFlowDisplay value={event.casualties} />
                          </span>
                        </div>
                      )}
                      {event.arrested > 0 && (
                        <div>
                          <span className="text-label-secondary">Arrested:</span>
                          <span className="ml-1 font-medium tabular-nums">
                            <NumberFlowDisplay value={event.arrested} />
                          </span>
                        </div>
                      )}
                      {event.economicImpact > 0 && (
                        <div>
                          <span className="text-label-secondary">Economic Impact:</span>
                          <span className="ml-1 font-medium tabular-nums">
                            $<NumberFlowDisplay value={event.economicImpact} format="compact" />
                          </span>
                        </div>
                      )}
                    </div>

                    {event.region && (
                      <div className="text-label-secondary text-footnote mt-2">
                        Location: {event.region}
                        {event.city ? `, ${event.city}` : ""}
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 self-start"
                    onClick={() =>
                      resolveEvent.mutate({
                        id: event.id,
                        resolutionNotes: "Manually resolved",
                      })
                    }
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Resolve
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-label-secondary py-6 text-center">
            <CheckCircle aria-hidden="true" className="text-green mx-auto mb-3 h-8 w-8" />
            <h4 className="text-label mb-1 font-medium">All clear</h4>
            <p className="text-body">No active security events at this time</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
