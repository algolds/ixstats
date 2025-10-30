"use client";

// Intelligence Summary - Summary cards and overview panels
// Refactored from EnhancedIntelligenceBriefing.tsx

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { cn } from "~/lib/utils";
import { IxTime } from "~/lib/ixtime";
import { ClassificationBadge } from "./StatusIndicators";
import { CLASSIFICATION_STYLES } from "./constants";
import type { IntelligenceAlert, CountryInformation, ClearanceLevel } from "./types";
import { RiAlertLine, RiCheckboxCircleLine } from "react-icons/ri";

export interface IntelligenceAlertsProps {
  alerts: IntelligenceAlert[];
  viewerClearanceLevel: ClearanceLevel;
  className?: string;
}

export const IntelligenceAlerts: React.FC<IntelligenceAlertsProps> = ({
  alerts,
  viewerClearanceLevel,
  className,
}) => {
  const levels = { PUBLIC: 1, RESTRICTED: 2, CONFIDENTIAL: 3 };

  const filteredAlerts = alerts.filter(
    (alert) => levels[viewerClearanceLevel] >= levels[alert.classification]
  );

  if (filteredAlerts.length === 0) {
    return null;
  }

  return (
    <Card className={cn("glass-hierarchy-child", className)}>
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <RiAlertLine className="h-5 w-5 text-orange-400" />
          <h3 className="text-lg font-semibold">Active Intelligence Alerts</h3>
        </div>

        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
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
                    <ClassificationBadge
                      classification={alert.classification}
                      className="text-xs"
                    />
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
            </motion.div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export interface CountryInformationDisplayProps {
  information: CountryInformation[];
  viewerClearanceLevel: ClearanceLevel;
  className?: string;
}

export const CountryInformationDisplay: React.FC<CountryInformationDisplayProps> = ({
  information,
  viewerClearanceLevel,
  className,
}) => {
  const levels = { PUBLIC: 1, RESTRICTED: 2, CONFIDENTIAL: 3 };

  return (
    <div className={cn("space-y-6", className)}>
      {information.map((section) => {
        const Icon = section.icon as React.ComponentType<{ className?: string }>;

        // Filter items based on clearance
        const visibleItems = section.items.filter(
          (item) => levels[viewerClearanceLevel] >= levels[item.classification]
        );

        if (visibleItems.length === 0) {
          return null;
        }

        return (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="glass-hierarchy-child">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Icon className="text-primary h-5 w-5" />
                  <h3 className="text-lg font-semibold">{section.category}</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {visibleItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-muted/30 flex items-start justify-between gap-2 rounded-lg p-3"
                    >
                      <div className="flex-1">
                        <div className="text-muted-foreground text-sm">{item.label}</div>
                        <div className="mt-1 font-medium">{item.value}</div>
                      </div>
                      {item.classification !== "PUBLIC" && (
                        <ClassificationBadge
                          classification={item.classification}
                          className="text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};

export interface IntelligenceHeaderProps {
  countryName: string;
  currentIxTime: number;
  viewerClearanceLevel: ClearanceLevel;
  isStable?: boolean;
  onToggleClassified?: () => void;
  showClassified?: boolean;
  flagElement?: React.ReactNode;
  className?: string;
}

export const IntelligenceHeader: React.FC<IntelligenceHeaderProps> = ({
  countryName,
  currentIxTime,
  viewerClearanceLevel,
  isStable = true,
  onToggleClassified,
  showClassified = false,
  flagElement,
  className,
}) => {
  return (
    <div className={cn("glass-hierarchy-child relative overflow-hidden rounded-lg", className)}>
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <div className="from-background/80 via-background/60 to-background/80 h-full w-full bg-gradient-to-r"></div>
      </div>

      <div className="relative p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {flagElement}
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{countryName}</h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-green-500/30 bg-green-500/10 text-green-400",
                    !isStable && "border-red-500/30 bg-red-500/10 text-red-400"
                  )}
                >
                  <RiCheckboxCircleLine className="mr-1 h-3 w-3" />
                  {isStable ? "STABLE" : "UNSTABLE"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Country Intelligence Briefing • {IxTime.formatIxTime(currentIxTime, true)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ClassificationBadge classification={viewerClearanceLevel} />
            {viewerClearanceLevel !== "PUBLIC" && onToggleClassified && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleClassified}
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                {showClassified ? "Hide" : "Show"} Classified
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
