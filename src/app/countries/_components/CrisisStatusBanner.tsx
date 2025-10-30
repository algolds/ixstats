"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { AlertTriangle, Shield, CheckCircle, ExternalLink, Activity } from "lucide-react";
import { useUser } from "~/context/auth-context";
import { hasInterfaceAccess } from "~/lib/interface-routing";

interface CrisisStatusBannerProps {
  countryId: string;
}

export function CrisisStatusBanner({ countryId }: CrisisStatusBannerProps) {
  const { user } = useUser();

  // Get user profile to check access
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Get crisis events affecting this country
  const { data: crisisEvents, isLoading } = api.unifiedIntelligence.getCrisisEvents.useQuery();

  if (isLoading) {
    return null; // Don't show loading state for this banner
  }

  // Filter crises affecting this country
  const activeCrises =
    crisisEvents?.filter(
      (crisis) =>
        crisis.affectedCountries?.includes(countryId) &&
        crisis.status !== "resolved" &&
        crisis.status !== "standby"
    ) || [];

  const criticalCrises = activeCrises.filter((crisis) => crisis.severity === "critical");
  const highCrises = activeCrises.filter((crisis) => crisis.severity === "high");

  // Check if user has access to relevant interfaces
  const canAccessSDI = userProfile
    ? hasInterfaceAccess("user", userProfile.countryId ?? undefined, "sdi")
    : false;
  const canAccessECI = userProfile
    ? hasInterfaceAccess("user", userProfile.countryId ?? undefined, "eci")
    : false;

  // Don't show banner if no active crises
  if (activeCrises.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-300">
          <strong>All Clear:</strong> No active crisis events affecting this nation.
        </AlertDescription>
      </Alert>
    );
  }

  // Determine alert level and styling
  const alertLevel =
    criticalCrises.length > 0 ? "critical" : highCrises.length > 0 ? "high" : "medium";

  const alertStyles = {
    critical: {
      className: "border-red-500 bg-red-50 dark:bg-red-950/20",
      iconColor: "text-red-600",
      textColor: "text-red-800 dark:text-red-300",
    },
    high: {
      className: "border-orange-500 bg-orange-50 dark:bg-orange-950/20",
      iconColor: "text-orange-600",
      textColor: "text-orange-800 dark:text-orange-300",
    },
    medium: {
      className: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
      iconColor: "text-yellow-600",
      textColor: "text-yellow-800 dark:text-yellow-300",
    },
  };

  const style = alertStyles[alertLevel];

  return (
    <Alert className={style.className}>
      <AlertTriangle className={`h-4 w-4 ${style.iconColor}`} />
      <AlertDescription className={style.textColor}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong>Crisis Alert:</strong> {activeCrises.length} active crisis event
            {activeCrises.length !== 1 ? "s" : ""} affecting this nation.
            {criticalCrises.length > 0 && (
              <span className="ml-2">
                <Badge variant="destructive" className="bg-red-600">
                  {criticalCrises.length} Critical
                </Badge>
              </span>
            )}
            {highCrises.length > 0 && (
              <span className="ml-2">
                <Badge variant="destructive" className="bg-orange-600">
                  {highCrises.length} High
                </Badge>
              </span>
            )}
            {/* Show crisis titles */}
            <div className="mt-2 text-sm">
              {activeCrises.slice(0, 2).map((crisis, index) => (
                <div key={crisis.id} className="mb-1">
                  • {crisis.title} ({crisis.severity})
                </div>
              ))}
              {activeCrises.length > 2 && (
                <div className="text-xs opacity-75">...and {activeCrises.length - 2} more</div>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 gap-2">
            {canAccessSDI && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/sdi", "_blank")}
                className="text-xs"
              >
                <Shield className="mr-1 h-3 w-3" />
                SDI Dashboard
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            )}
            {canAccessECI && userProfile?.countryId === countryId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/eci", "_blank")}
                className="text-xs"
              >
                <Activity className="mr-1 h-3 w-3" />
                Executive Command
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
