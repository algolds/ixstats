"use client";
// src/components/defense/stability/SecurityEventsCard.tsx

import React from "react";
import { motion } from "motion/react";
import { WarningTriangle as AlertTriangle, CheckCircle } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";

interface SecurityEvent {
  id: string;
  title: string;
  description: string;
  severity: string;
  casualties: number;
  arrested: number;
  economicImpact: number;
  region?: string | null;
  city?: string | null;
}

interface ResolveEventMutation {
  mutate: (input: { id: string; resolutionNotes: string }) => void;
}

interface SecurityEventsCardProps {
  activeEvents: SecurityEvent[];
  resolveEvent: ResolveEventMutation;
  getSeverityColor: (severity: string) => string;
}

export const SecurityEventsCard = React.memo(function SecurityEventsCard({
  activeEvents,
  resolveEvent,
  getSeverityColor,
}: SecurityEventsCardProps) {
  return (
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          Active Security Events ({activeEvents.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeEvents.length > 0 ? (
          <div className="space-y-3">
            {activeEvents.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-lg border p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity.toUpperCase()}
                      </Badge>
                      <h5 className="text-sm font-medium">{event.title}</h5>
                    </div>
                    <p className="text-muted-foreground mb-3 text-sm">{event.description}</p>

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      {event.casualties > 0 && (
                        <div>
                          <span className="text-muted-foreground">Casualties:</span>
                          <span className="ml-1 font-medium">
                            <NumberFlowDisplay value={event.casualties} />
                          </span>
                        </div>
                      )}
                      {event.arrested > 0 && (
                        <div>
                          <span className="text-muted-foreground">Arrested:</span>
                          <span className="ml-1 font-medium">
                            <NumberFlowDisplay value={event.arrested} />
                          </span>
                        </div>
                      )}
                      {event.economicImpact > 0 && (
                        <div>
                          <span className="text-muted-foreground">Economic Impact:</span>
                          <span className="ml-1 font-medium">
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
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground py-6 text-center">
            <CheckCircle className="mx-auto mb-3 h-8 w-8 text-green-600" />
            <h4 className="mb-1 font-medium">All Clear</h4>
            <p className="text-sm">No active security events at this time</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
