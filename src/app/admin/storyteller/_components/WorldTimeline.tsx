// src/app/admin/storyteller/_components/WorldTimeline.tsx
// Visual timeline of all world events
"use client";

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { formatDistanceToNow, format } from "date-fns";
import {
  TrendingDown,
  Swords,
  Wind,
  Scale,
  Cpu,
  Heart,
  Flame,
  Wand2,
  Sparkles,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Power,
  PowerOff,
} from "lucide-react";
import { useState } from "react";

const EVENT_ICONS: Record<string, typeof TrendingDown> = {
  economic_crisis: TrendingDown,
  trade_war: Swords,
  natural_disaster: Wind,
  political_upheaval: Scale,
  tech_revolution: Cpu,
  peace_era: Sparkles,
  pandemic: Heart,
  climate_disaster: Flame,
  custom: Wand2,
};

const EVENT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  economic_crisis: { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
  trade_war: { text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  natural_disaster: {
    text: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  political_upheaval: {
    text: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  tech_revolution: { text: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  peace_era: { text: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
  pandemic: { text: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  climate_disaster: {
    text: "text-orange-600",
    bg: "bg-orange-600/10",
    border: "border-orange-600/20",
  },
  custom: { text: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
};

const DEFAULT_COLORS = {
  text: "text-gray-500",
  bg: "bg-gray-500/10",
  border: "border-gray-500/20",
};

export function WorldTimeline() {
  const { data, isLoading } = api.admin.getWorldEvents.useQuery(
    { limit: 50 },
    { refetchInterval: 30000, refetchOnWindowFocus: false }
  );

  const utils = api.useUtils();
  const updateEvent = api.admin.updateWorldEvent.useMutation({
    onSuccess: () => utils.admin.getWorldEvents.invalidate(),
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data?.events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="text-muted-foreground mb-3 h-10 w-10" />
        <h3 className="text-foreground text-lg font-semibold">No World Events</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your first world event using the Event Wizard.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="relative space-y-3 pl-6">
        {/* Timeline line */}
        <div className="bg-border absolute top-0 bottom-0 left-[11px] w-px" />

        {data.events.map((event) => {
          const Icon = EVENT_ICONS[event.type] ?? Wand2;
          const colors = EVENT_COLORS[event.type] ?? DEFAULT_COLORS;
          const isExpanded = expandedId === event.id;
          const isActive = event.isActive;

          return (
            <div key={event.id} className="relative">
              {/* Timeline dot */}
              <div
                className={`absolute top-4 -left-6 h-[22px] w-[22px] rounded-full border-2 ${
                  isActive ? `${colors.bg} ${colors.border}` : "border-muted bg-muted/50"
                } flex items-center justify-center`}
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    isActive ? colors.text.replace("text-", "bg-") : "bg-muted-foreground/50"
                  }`}
                />
              </div>

              {/* Event card */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  isActive
                    ? `${colors.border} ${colors.bg}`
                    : "border-border/30 bg-muted/10 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-lg border p-2 ${isActive ? colors.border : "border-border/30"}`}
                    >
                      <Icon
                        className={`h-5 w-5 ${isActive ? colors.text : "text-muted-foreground"}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-foreground font-semibold">{event.name}</h4>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {event.type.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            event.severity >= 0.8
                              ? "border-red-500/30 text-red-600"
                              : event.severity >= 0.5
                                ? "border-amber-500/30 text-amber-600"
                                : "border-green-500/30 text-green-600"
                          }`}
                        >
                          {(event.severity * 100).toFixed(0)}% severity
                        </Badge>
                        {event.chain && (
                          <Badge variant="outline" className="text-xs">
                            Chain: {event.chain.name}
                          </Badge>
                        )}
                        {!isActive && (
                          <Badge
                            variant="outline"
                            className="border-red-500/30 text-xs text-red-500"
                          >
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateEvent.mutate({
                          eventId: event.id,
                          isActive: !isActive,
                        })
                      }
                      title={isActive ? "Deactivate" : "Activate"}
                    >
                      {isActive ? (
                        <PowerOff className="h-4 w-4 text-red-500" />
                      ) : (
                        <Power className="h-4 w-4 text-green-500" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Timeline info */}
                <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Started {formatDistanceToNow(new Date(event.startsAt), { addSuffix: true })}
                  </span>
                  {event.endsAt && (
                    <span>Ends {format(new Date(event.endsAt), "MMM d, yyyy")}</span>
                  )}
                  {event.duration && <span>{event.duration}yr duration</span>}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {event.affectedCountries.length} countries
                  </span>
                  <span>{event._count.storytellerEffects} effects</span>
                </div>

                {event.description && (
                  <p className="text-muted-foreground mt-2 text-sm">{event.description}</p>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-border/30 mt-3 space-y-2 border-t pt-3">
                    <h5 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                      Affected Countries
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {event.affectedCountries.map((ac) => (
                        <Badge key={ac.country.id} variant="outline" className="text-xs">
                          {ac.country.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-muted-foreground mt-2 text-xs">
                      Created {format(new Date(event.createdAt), "MMM d, yyyy 'at' HH:mm")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
