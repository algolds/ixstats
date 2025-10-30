"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Shield,
  AlertTriangle,
  Globe,
  Users,
  TrendingUp,
  ExternalLink,
  Activity,
  MapPin,
} from "lucide-react";
import { useUser } from "~/context/auth-context";
import { hasInterfaceAccess } from "~/lib/interface-routing";

interface CountryIntelligenceSectionProps {
  countryId: string;
}

interface UserProfile {
  role?: string;
  countryId?: string;
}

export function CountryIntelligenceSection({ countryId }: CountryIntelligenceSectionProps) {
  const { user } = useUser();

  // Get user profile to check access
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Get unified intelligence data related to this country
  const { data: crisisEvents, isLoading: crisisLoading } =
    api.unifiedIntelligence.getCrisisEvents.useQuery();
  const { data: diplomaticData, isLoading: diplomacyLoading } =
    api.unifiedIntelligence.getEnhancedDiplomaticIntelligence.useQuery({ countryId });
  const { data: economicIntelligence, isLoading: economicLoading } =
    api.unifiedIntelligence.getIntelligenceFeed.useQuery({
      countryId,
      category: "ECONOMIC",
      limit: 20,
    });
  const { data: intelligenceItems, isLoading: intelligenceLoading } =
    api.intelligence.getLatestIntelligence.useQuery();

  const isLoading = crisisLoading || diplomacyLoading || economicLoading || intelligenceLoading;

  // Check if user has SDI/ECI access for navigation links
  const canAccessSDI = userProfile
    ? hasInterfaceAccess(
        (userProfile as UserProfile).role || "user",
        userProfile.countryId || undefined,
        "sdi"
      )
    : false;
  const canAccessECI = userProfile
    ? hasInterfaceAccess(
        (userProfile as UserProfile).role || "user",
        userProfile.countryId || undefined,
        "eci"
      )
    : false;

  // Filter data relevant to this country
  const relevantCrises =
    crisisEvents?.filter((crisis) => crisis.affectedCountries?.includes(countryId)) || [];

  // diplomaticData already filtered by countryId in the query
  const relevantDiplomacy = diplomaticData?.relations || [];

  const relevantIntelligence =
    intelligenceItems?.filter(
      (item) =>
        item.relatedCountries?.includes(countryId) || item.source?.toLowerCase().includes("country") // Basic filtering
    ) || [];

  // economicIntelligence already filtered by countryId and category in the query
  const relevantEconomicAlerts = economicIntelligence?.items || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Intelligence & Diplomacy</h2>
        <div className="flex gap-2">
          {canAccessSDI && (
            <Button variant="outline" size="sm" onClick={() => window.open("/sdi", "_blank")}>
              <Shield className="mr-2 h-4 w-4" />
              Open SDI
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          )}
          {canAccessECI && userProfile?.countryId === countryId && (
            <Button variant="outline" size="sm" onClick={() => window.open("/eci", "_blank")}>
              <Activity className="mr-2 h-4 w-4" />
              Open ECI
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Crisis Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Active Crises
            </CardTitle>
            <CardDescription>Crisis events affecting this nation</CardDescription>
          </CardHeader>
          <CardContent>
            {relevantCrises.length > 0 ? (
              <div className="space-y-3">
                {relevantCrises.slice(0, 3).map((crisis) => (
                  <div
                    key={crisis.id}
                    className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h4 className="font-semibold text-red-900 dark:text-red-300">
                        {crisis.title}
                      </h4>
                      <Badge
                        variant="destructive"
                        className={
                          crisis.severity === "critical"
                            ? "bg-red-600"
                            : crisis.severity === "high"
                              ? "bg-orange-600"
                              : crisis.severity === "medium"
                                ? "bg-yellow-600"
                                : "bg-blue-600"
                        }
                      >
                        {crisis.severity}
                      </Badge>
                    </div>
                    <p className="mb-2 text-sm text-red-800 dark:text-red-400">
                      {crisis.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-red-600 dark:text-red-500">
                      <span>Status: {crisis.responseStatus}</span>
                      <span>{new Date(crisis.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {relevantCrises.length > 3 && (
                  <p className="text-muted-foreground text-center text-sm">
                    +{relevantCrises.length - 3} more crises
                  </p>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <AlertTriangle className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-sm">No active crisis events</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diplomatic Relations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Diplomatic Relations
            </CardTitle>
            <CardDescription>International relationships and treaties</CardDescription>
          </CardHeader>
          <CardContent>
            {relevantDiplomacy.length > 0 ? (
              <div className="space-y-3">
                {relevantDiplomacy.slice(0, 3).map((relation) => (
                  <div
                    key={relation.id}
                    className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-300">
                        {relation.relationship}
                      </h4>
                      <Badge
                        variant="secondary"
                        className={
                          relation.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : relation.status === "monitoring"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
                        }
                      >
                        {relation.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-500">
                      Partner:{" "}
                      {relation.country1 === countryId ? relation.country2 : relation.country1}
                    </div>
                  </div>
                ))}
                {relevantDiplomacy.length > 3 && (
                  <p className="text-muted-foreground text-center text-sm">
                    +{relevantDiplomacy.length - 3} more relations
                  </p>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Globe className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-sm">No diplomatic relations</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Economic Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-yellow-500" />
              Economic Intelligence
            </CardTitle>
            <CardDescription>Economic indicators and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {relevantEconomicAlerts.length > 0 ? (
              <div className="space-y-3">
                {relevantEconomicAlerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950/20"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-300">
                        {alert.title}
                      </h4>
                      <Badge variant="outline" className="border-yellow-400 text-yellow-700">
                        {alert.severity || alert.priority}
                      </Badge>
                    </div>
                    {alert.content && (
                      <p className="mb-2 text-sm text-yellow-800 dark:text-yellow-400">
                        {alert.content}
                      </p>
                    )}
                    <div className="text-xs text-yellow-600 dark:text-yellow-500">
                      Source: {alert.source} | {new Date(alert.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <TrendingUp className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-sm">No economic alerts</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Intelligence Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-500" />
              Intelligence Reports
            </CardTitle>
            <CardDescription>Relevant intelligence and reports</CardDescription>
          </CardHeader>
          <CardContent>
            {relevantIntelligence.length > 0 ? (
              <div className="space-y-3">
                {relevantIntelligence.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/20"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-300">
                        {item.title}
                      </h4>
                      <Badge
                        variant="outline"
                        className={
                          item.priority === "high"
                            ? "border-red-400 text-red-700"
                            : item.priority === "medium"
                              ? "border-yellow-400 text-yellow-700"
                              : "border-green-400 text-green-700"
                        }
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="mb-2 text-sm text-purple-800 dark:text-purple-400">
                      {item.content}
                    </p>
                    <div className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-500">
                      <span>Source: {item.source}</span>
                      <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {relevantIntelligence.length > 3 && (
                  <p className="text-muted-foreground text-center text-sm">
                    +{relevantIntelligence.length - 3} more reports
                  </p>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <MapPin className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-sm">No intelligence reports</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer with link to full interfaces */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          This section shows intelligence and diplomatic information relevant to this country.
          {canAccessSDI && (
            <span>
              {" "}
              For comprehensive intelligence operations, visit the{" "}
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => window.open("/sdi", "_blank")}
              >
                Strategic Defense Initiative (SDI) →
              </Button>
            </span>
          )}
          {canAccessECI && userProfile?.countryId === countryId && (
            <span>
              {" "}
              For executive management, visit the{" "}
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => window.open("/eci", "_blank")}
              >
                Executive Command Interface (ECI) →
              </Button>
            </span>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
