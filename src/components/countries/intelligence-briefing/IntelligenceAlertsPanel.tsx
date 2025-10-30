/**
 * Intelligence Alerts Panel Component
 *
 * Displays active intelligence alerts with classification filtering.
 */

import React from "react";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { IxTime } from "~/lib/ixtime";
import { CLASSIFICATION_STYLES, hasAccess } from "~/lib/clearance-utils";
import type { IntelligenceAlert, ClassificationLevel } from "~/types/intelligence-briefing";
import { RiAlertLine } from "react-icons/ri";

interface IntelligenceAlertsPanelProps {
  alerts: IntelligenceAlert[];
  viewerClearanceLevel: ClassificationLevel;
}

export const IntelligenceAlertsPanel = React.memo<IntelligenceAlertsPanelProps>(
  ({ alerts, viewerClearanceLevel }) => {
    const filteredAlerts = alerts.filter((alert) =>
      hasAccess(viewerClearanceLevel, alert.classification)
    );

    if (filteredAlerts.length === 0) {
      return null;
    }

    return (
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiAlertLine className="h-5 w-5 text-orange-400" />
            Active Intelligence Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "rounded-lg border-l-4 p-4",
                  alert.type === "critical" && "border-red-500 bg-red-500/10",
                  alert.type === "warning" && "border-yellow-500 bg-yellow-500/10",
                  alert.type === "info" && "border-blue-500 bg-blue-500/10",
                  alert.type === "success" && "border-green-500 bg-green-500/10"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{alert.title}</h4>
                    <p className="text-muted-foreground mt-1 text-sm">{alert.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", CLASSIFICATION_STYLES[alert.classification].color)}
                      >
                        {alert.classification}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {IxTime.formatIxTime(alert.timestamp, true)}
                      </span>
                    </div>
                  </div>
                  {alert.action && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={alert.action.onClick}
                      className="ml-4"
                    >
                      {alert.action.label}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
);

IntelligenceAlertsPanel.displayName = "IntelligenceAlertsPanel";
