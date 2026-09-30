"use client";
// src/components/defense/stability/SecurityEventsCard.tsx

import React from "react";
import { WarningTriangle as AlertTriangle, CheckCircle } from "iconoir-react";
import {
  FacetCard,
  FacetCardContent,
  FacetCardHeader,
  FacetContainer,
} from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";

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
  /** Kept for API compatibility; severity maps to semantic outline badges below. */
  getSeverityColor: (severity: string) => string;
}

/** Event severity → semantic outline-badge colour. */
const SEVERITY_TONE: Record<string, string> = {
  critical: "border-destructive/30 text-destructive",
  high: "border-destructive/30 text-destructive",
  moderate: "border-amber-500/30 text-amber-600",
};

export const SecurityEventsCard = React.memo(function SecurityEventsCard({
  activeEvents,
  resolveEvent,
  getSeverityColor: _getSeverityColor,
}: SecurityEventsCardProps) {
  return (
    <FacetCard depth={1} surface="solid">
      <FacetCardHeader className="p-5 pb-3">
        <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 text-rose-500" />
          Active security events ({activeEvents.length})
        </h3>
      </FacetCardHeader>
      <FacetCardContent className="px-5 pb-5">
        {activeEvents.length > 0 ? (
          <div className="space-y-3">
            {activeEvents.map((event) => (
              <FacetContainer
                key={event.id}
                depth={3}
                surface="solid"
                enableRefraction={false}
                className="rounded-lg p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          SEVERITY_TONE[event.severity] ?? "text-muted-foreground"
                        )}
                      >
                        {event.severity}
                      </Badge>
                      <h5 className="text-foreground text-sm font-medium">{event.title}</h5>
                    </div>
                    <p className="text-muted-foreground mb-3 text-sm">{event.description}</p>

                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                      {event.casualties > 0 && (
                        <div>
                          <span className="text-muted-foreground">Casualties:</span>
                          <span className="ml-1 font-medium tabular-nums">
                            <NumberFlowDisplay value={event.casualties} />
                          </span>
                        </div>
                      )}
                      {event.arrested > 0 && (
                        <div>
                          <span className="text-muted-foreground">Arrested:</span>
                          <span className="ml-1 font-medium tabular-nums">
                            <NumberFlowDisplay value={event.arrested} />
                          </span>
                        </div>
                      )}
                      {event.economicImpact > 0 && (
                        <div>
                          <span className="text-muted-foreground">Economic Impact:</span>
                          <span className="ml-1 font-medium tabular-nums">
                            $<NumberFlowDisplay value={event.economicImpact} format="compact" />
                          </span>
                        </div>
                      )}
                    </div>

                    {event.region && (
                      <div className="text-muted-foreground mt-2 text-xs">
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
              </FacetContainer>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground py-6 text-center">
            <CheckCircle aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-emerald-600" />
            <h4 className="text-foreground mb-1 font-medium">All clear</h4>
            <p className="text-sm">No active security events at this time</p>
          </div>
        )}
      </FacetCardContent>
    </FacetCard>
  );
});
