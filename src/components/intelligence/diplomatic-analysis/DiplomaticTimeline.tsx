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
        <CardDescription>
          Recent diplomatic milestones and relationship changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{event.country}</p>
                    <Badge variant="outline" className="text-xs">
                      {event.changeType}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {event.description}
                  </p>
                  <p className="text-xs text-muted-foreground">{event.date}</p>
                </div>
                <div className="flex-shrink-0">
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
          <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
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
