// src/components/economy/historical-charts/EventCard.tsx
/**
 * Event Card Component
 *
 * Displays individual economic event with details and actions
 */

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { AlertCircle, Clock, Edit, Trash2, Zap, FileText, TrendingUp } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import type { EconomicEvent } from "~/lib/historical-economic-data-transformers";

interface EventCardProps {
  event: EconomicEvent;
  onEdit?: (event: Partial<EconomicEvent>) => void;
  onDelete?: () => void;
}

const eventTypes = [
  { value: "dm_input", label: "DM Input", icon: Zap },
  { value: "policy_change", label: "Policy Change", icon: FileText },
  { value: "economic_shift", label: "Economic Shift", icon: TrendingUp },
  { value: "external_event", label: "External Event", icon: AlertCircle },
];

const severityConfig = {
  minor: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Minor" },
  moderate: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Moderate" },
  major: { color: "bg-orange-100 text-orange-800 border-orange-200", label: "Major" },
  critical: { color: "bg-red-100 text-red-800 border-red-200", label: "Critical" },
};

export const EventCard = React.memo(function EventCard({
  event,
  onEdit,
  onDelete,
}: EventCardProps) {
  const eventTypeInfo = eventTypes.find((t) => t.value === event.type);
  const Icon = eventTypeInfo?.icon || AlertCircle;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 items-start gap-3">
            <div className="bg-muted rounded-lg p-2">
              <Icon className="h-4 w-4" />
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium">{event.title}</h4>
                <Badge className={severityConfig[event.severity].color}>
                  {severityConfig[event.severity].label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {event.category}
                </Badge>
                {event.isActive && (
                  <Badge className="bg-green-100 text-xs text-green-800">Active</Badge>
                )}
              </div>

              <p className="text-muted-foreground text-sm">{event.description}</p>

              <div className="text-muted-foreground flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {IxTime.formatIxTime(event.timestamp)}
                </div>
                {event.duration && <div>Duration: {event.duration} months</div>}
                <div>Source: {event.source}</div>
              </div>

              {(event.impact.gdp || event.impact.population || event.impact.employment) && (
                <div className="bg-muted/50 mt-2 rounded p-2 text-xs">
                  <span className="font-medium">Impact: </span>
                  {event.impact.gdp &&
                    `GDP ${event.impact.gdp > 0 ? "+" : ""}${(event.impact.gdp * 100).toFixed(1)}% `}
                  {event.impact.population &&
                    `Population ${event.impact.population > 0 ? "+" : ""}${(event.impact.population * 100).toFixed(1)}% `}
                  {event.impact.employment &&
                    `Employment ${event.impact.employment > 0 ? "+" : ""}${(event.impact.employment * 100).toFixed(1)}%`}
                </div>
              )}
            </div>
          </div>

          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <Button variant="ghost" size="sm">
                  <Edit className="h-3 w-3" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
