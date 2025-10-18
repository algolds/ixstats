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
import {
  RiAlertLine,
  RiCheckboxCircleLine,
} from "react-icons/ri";

export interface IntelligenceAlertsProps {
  alerts: IntelligenceAlert[];
  viewerClearanceLevel: ClearanceLevel;
  className?: string;
}

export const IntelligenceAlerts: React.FC<IntelligenceAlertsProps> = ({
  alerts,
  viewerClearanceLevel,
  className
}) => {
  const levels = { 'PUBLIC': 1, 'RESTRICTED': 2, 'CONFIDENTIAL': 3 };

  const filteredAlerts = alerts.filter(alert =>
    levels[viewerClearanceLevel] >= levels[alert.classification]
  );

  if (filteredAlerts.length === 0) {
    return null;
  }

  return (
    <Card className={cn("glass-hierarchy-child", className)}>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <RiAlertLine className="h-5 w-5 text-orange-400" />
          <h3 className="font-semibold text-lg">Active Intelligence Alerts</h3>
        </div>

        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "p-4 rounded-lg border-l-4",
                alert.type === 'critical' && "border-red-500 bg-red-500/10",
                alert.type === 'warning' && "border-yellow-500 bg-yellow-500/10",
                alert.type === 'info' && "border-blue-500 bg-blue-500/10",
                alert.type === 'success' && "border-green-500 bg-green-500/10"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{alert.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {alert.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <ClassificationBadge
                      classification={alert.classification}
                      className="text-xs"
                    />
                    <span className="text-xs text-muted-foreground">
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
  className
}) => {
  const levels = { 'PUBLIC': 1, 'RESTRICTED': 2, 'CONFIDENTIAL': 3 };

  return (
    <div className={cn("space-y-6", className)}>
      {information.map((section) => {
        const Icon = section.icon as React.ComponentType<{ className?: string }>;

        // Filter items based on clearance
        const visibleItems = section.items.filter(item =>
          levels[viewerClearanceLevel] >= levels[item.classification]
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
                <div className="flex items-center gap-3 mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">{section.category}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-2 p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex-1">
                        <div className="text-sm text-muted-foreground">
                          {item.label}
                        </div>
                        <div className="font-medium mt-1">{item.value}</div>
                      </div>
                      {item.classification !== 'PUBLIC' && (
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
  className
}) => {
  return (
    <div className={cn("glass-hierarchy-child rounded-lg relative overflow-hidden", className)}>
      {/* Background gradient */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="w-full h-full bg-gradient-to-r from-background/80 via-background/60 to-background/80"></div>
      </div>

      <div className="relative p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {flagElement}
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{countryName}</h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-green-500/30 text-green-400 bg-green-500/10",
                    !isStable && "border-red-500/30 text-red-400 bg-red-500/10"
                  )}
                >
                  <RiCheckboxCircleLine className="h-3 w-3 mr-1" />
                  {isStable ? 'STABLE' : 'UNSTABLE'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Country Intelligence Briefing • {IxTime.formatIxTime(currentIxTime, true)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ClassificationBadge classification={viewerClearanceLevel} />
            {viewerClearanceLevel !== 'PUBLIC' && onToggleClassified && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleClassified}
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                {showClassified ? 'Hide' : 'Show'} Classified
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
