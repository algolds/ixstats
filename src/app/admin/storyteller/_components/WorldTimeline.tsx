"use client";
// src/app/admin/storyteller/_components/WorldTimeline.tsx
// Visual timeline of all world events

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { formatDistanceToNow, format } from "date-fns";
import {
  StatDown as TrendingDown,
  Tournament as Swords,
  Wind,
  ScaleFrameEnlarge as Scale,
  Cpu,
  Heart,
  FireFlame as Flame,
  MagicWand as Wand2,
  Sparks as Sparkles,
  Clock,
  Group as Users,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  OffTag as Power,
  OffTag as PowerOff,
} from "iconoir-react";
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
  economic_crisis: { text: "text-red", bg: "bg-red/10", border: "border-red/20" },
  trade_war: { text: "text-orange", bg: "bg-orange/10", border: "border-orange/20" },
  natural_disaster: {
    text: "text-yellow",
    bg: "bg-yellow/10",
    border: "border-yellow/20",
  },
  political_upheaval: {
    text: "text-purple",
    bg: "bg-purple/10",
    border: "border-purple/20",
  },
  tech_revolution: { text: "text-blue", bg: "bg-blue/10", border: "border-blue/20" },
  peace_era: { text: "text-green", bg: "bg-green/10", border: "border-green/20" },
  pandemic: { text: "text-pink", bg: "bg-pink/10", border: "border-pink/20" },
  climate_disaster: {
    text: "text-orange",
    bg: "bg-orange/10",
    border: "border-orange/20",
  },
  custom: { text: "text-indigo", bg: "bg-indigo/10", border: "border-indigo/20" },
};

const DEFAULT_COLORS = {
  text: "text-label-secondary",
  bg: "bg-fill-3",
  border: "border-separator",
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
          <Skeleton key={i} className="rounded-row h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!data?.events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="text-label-secondary mb-3 h-10 w-10" />
        <h3 className="text-label text-title-3">No World Events</h3>
        <p className="text-label-secondary text-body mt-1">
          Create your first world event using the Event Wizard.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="relative space-y-3 pl-6">
        {/* Timeline line */}
        <div className="bg-separator absolute top-0 bottom-0 left-[11px] w-px" />

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
                  isActive ? `${colors.bg} ${colors.border}` : "border-separator bg-fill-3"
                } flex items-center justify-center`}
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    isActive ? colors.text.replace("text-", "bg-") : "bg-fill"
                  }`}
                />
              </div>

              {/* Event card */}
              <div
                className={`rounded-row border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
                  isActive
                    ? `${colors.border} ${colors.bg}`
                    : "border-separator bg-fill-4 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-control border p-2 ${isActive ? colors.border : "border-separator"}`}
                    >
                      <Icon
                        className={`h-5 w-5 ${isActive ? colors.text : "text-label-secondary"}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-label font-semibold">{event.name}</h4>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {event.type.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-footnote ${
                            event.severity >= 0.8
                              ? "border-red/30 text-red"
                              : event.severity >= 0.5
                                ? "border-yellow/30 text-yellow"
                                : "border-green/30 text-green"
                          }`}
                        >
                          {(event.severity * 100).toFixed(0)}% severity
                        </Badge>
                        {event.chain && <Badge variant="outline">Chain: {event.chain.name}</Badge>}
                        {!isActive && <Badge variant="destructive">Inactive</Badge>}
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
                        <PowerOff className="text-red h-4 w-4" />
                      ) : (
                        <Power className="text-green h-4 w-4" />
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
                <div className="text-label-secondary text-footnote mt-2 flex items-center gap-4">
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
                  <p className="text-label-secondary text-body mt-2">{event.description}</p>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-separator mt-3 space-y-2 border-t pt-3">
                    <h5 className="text-label text-subhead">Affected Countries</h5>
                    <div className="flex flex-wrap gap-2">
                      {event.affectedCountries.map((ac) => (
                        <Badge key={ac.country.id} variant="outline">
                          {ac.country.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-label-secondary text-footnote mt-2">
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
