"use client";

/**
 * Diplomatic Timeline
 *
 * Chronological list of recent diplomatic events with status badges
 * and change-type indicators.
 *
 * @module DiplomaticTimeline
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Calendar } from "lucide-react";
import type { TimelineEvent } from "~/hooks/useDiplomaticAnalytics";

interface DiplomaticTimelineProps {
  events: TimelineEvent[];
}

export const DiplomaticTimeline = React.memo<DiplomaticTimelineProps>(({ events }) => {
  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          Diplomatic Events Timeline
        </CardTitle>
        <CardDescription>Recent diplomatic milestones and relationship changes</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-muted/30 hover:bg-muted/50 flex items-start gap-4 rounded-lg p-4 transition-colors"
              >
                <div className="mt-1 shrink-0">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-semibold">{event.country}</p>
                    <Badge variant="outline" className="text-xs">
                      {event.changeType}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-2 text-sm">{event.description}</p>
                  <p className="text-muted-foreground text-xs">{event.date}</p>
                </div>
                <div className="shrink-0">
                  <Badge
                    className={`${
                      event.status === "allied" || event.status === "friendly"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        : event.status === "hostile" || event.status === "tense"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                    }`}
                  >
                    {event.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground flex min-h-[300px] items-center justify-center">
            <div className="space-y-2 text-center">
              <Calendar className="mx-auto h-12 w-12 opacity-50" />
              <p>No recent diplomatic events</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

DiplomaticTimeline.displayName = "DiplomaticTimeline";
