// src/app/admin/_components/UpcomingEventsWidget.tsx
// Displays upcoming events across all systems (interventions, elections, crises, policies)
"use client";

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  Zap,
  Vote,
  AlertTriangle,
  FileText,
  Calendar,
} from "lucide-react";

const EVENT_CONFIG = {
  intervention: { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
  election: { icon: Vote, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
  crisis: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
  },
  policy_expiry: {
    icon: FileText,
    color: "text-purple-500",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  admin_action: { icon: Zap, color: "text-gray-500", bg: "bg-gray-500/10 border-gray-500/20" },
} as const;

export function UpcomingEventsWidget() {
  const { data, isLoading } = api.admin.getUpcomingEvents.useQuery(
    { limit: 10 },
    { refetchInterval: 60000, refetchOnWindowFocus: false }
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">Upcoming Events</h2>
        {data && (
          <div className="flex gap-2">
            {data.counts.interventions > 0 && (
              <Badge variant="outline" className="border-amber-500/20 text-xs text-amber-600">
                {data.counts.interventions} interventions
              </Badge>
            )}
            {data.counts.elections > 0 && (
              <Badge variant="outline" className="border-blue-500/20 text-xs text-blue-600">
                {data.counts.elections} elections
              </Badge>
            )}
            {data.counts.crises > 0 && (
              <Badge variant="outline" className="border-red-500/20 text-xs text-red-600">
                {data.counts.crises} crises
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="glass-card-child space-y-2 rounded-xl border border-border/50 p-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="mb-1 h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : !data?.events.length ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
            <Calendar className="h-4 w-4" />
            No upcoming events
          </div>
        ) : (
          data.events.map((event) => {
            const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.admin_action;
            const Icon = config.icon;
            return (
              <div
                key={`${event.type}-${event.id}`}
                className="flex items-start gap-3 rounded-lg border border-border/20 p-2.5 transition-colors hover:bg-muted/20"
              >
                <div className={`rounded-lg border p-1.5 ${config.bg}`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground truncate text-sm font-medium">
                      {event.title}
                    </span>
                    <Badge variant="outline" className="flex-shrink-0 text-xs capitalize">
                      {event.type.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                    {event.countryName && <span>{event.countryName}</span>}
                    {event.countryName && <span>-</span>}
                    <span>
                      {formatDistanceToNow(new Date(event.scheduledAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                {event.severity && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      event.severity === "critical"
                        ? "border-red-500/30 text-red-600"
                        : event.severity === "high"
                          ? "border-orange-500/30 text-orange-600"
                          : "border-gray-500/30 text-gray-600"
                    }`}
                  >
                    {event.severity}
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
