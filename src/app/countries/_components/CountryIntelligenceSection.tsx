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
  MapPin
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
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
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Get SDI data related to this country
  const { data: crisisEvents, isLoading: crisisLoading } = api.sdi.getCrisisEvents.useQuery();
  const { data: diplomaticRelations, isLoading: diplomacyLoading } = api.sdi.getDiplomaticRelations.useQuery();
  const { data: economicAlerts, isLoading: economicLoading } = api.sdi.getEconomicAlerts.useQuery();
  const { data: intelligenceItems, isLoading: intelligenceLoading } = api.intelligence.getLatestIntelligence.useQuery();

  const isLoading = crisisLoading || diplomacyLoading || economicLoading || intelligenceLoading;

  // Check if user has SDI/ECI access for navigation links
  const canAccessSDI = userProfile ? hasInterfaceAccess((userProfile as UserProfile).role || 'user', userProfile.countryId || undefined, 'sdi') : false;
  const canAccessECI = userProfile ? hasInterfaceAccess((userProfile as UserProfile).role || 'user', userProfile.countryId || undefined, 'eci') : false;

  // Filter data relevant to this country
  const relevantCrises = crisisEvents?.filter(crisis => 
    crisis.affectedCountries?.includes(countryId)
  ) || [];

  const relevantDiplomacy = diplomaticRelations?.filter(relation => 
    relation.country1 === countryId || relation.country2 === countryId
  ) || [];

  const relevantIntelligence = intelligenceItems?.filter(item => 
    item.relatedCountries?.includes(countryId) || 
    item.source?.toLowerCase().includes('country') // Basic filtering
  ) || [];

  const relevantEconomicAlerts = economicAlerts?.filter(alert => 
    alert.affectedCountries?.includes(countryId)
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Intelligence & Diplomacy</h2>
        <div className="flex gap-2">
          {canAccessSDI && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('/sdi', '_blank')}
            >
              <Shield className="h-4 w-4 mr-2" />
              Open SDI
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          )}
          {canAccessECI && userProfile?.countryId === countryId && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('/eci', '_blank')}
            >
              <Activity className="h-4 w-4 mr-2" />
              Open ECI
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div key={crisis.id} className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-red-900 dark:text-red-300">{crisis.title}</h4>
                      <Badge 
                        variant="destructive" 
                        className={
                          crisis.severity === 'critical' ? 'bg-red-600' :
                          crisis.severity === 'high' ? 'bg-orange-600' :
                          crisis.severity === 'medium' ? 'bg-yellow-600' : 'bg-blue-600'
                        }
                      >
                        {crisis.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-red-800 dark:text-red-400 mb-2">{crisis.description}</p>
                    <div className="flex justify-between items-center text-xs text-red-600 dark:text-red-500">
                      <span>Status: {crisis.responseStatus}</span>
                      <span>{new Date(crisis.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {relevantCrises.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{relevantCrises.length - 3} more crises
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                  <div key={relation.id} className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-300">
                        {relation.relationship}
                      </h4>
                      <Badge 
                        variant="secondary"
                        className={
                          relation.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                          relation.status === 'monitoring' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                        }
                      >
                        {relation.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-500">
                      Partner: {relation.country1 === countryId ? relation.country2 : relation.country1}
                    </div>
                  </div>
                ))}
                {relevantDiplomacy.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{relevantDiplomacy.length - 3} more relations
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                  <div key={alert.id} className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-300">{alert.title}</h4>
                      <Badge variant="outline" className="text-yellow-700 border-yellow-400">
                        {alert.severity}
                      </Badge>
                    </div>
                    {alert.description && (
                      <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-2">{alert.description}</p>
                    )}
                    <div className="text-xs text-yellow-600 dark:text-yellow-500">
                      Type: {alert.type} | {new Date(alert.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                  <div key={item.id} className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-300">{item.title}</h4>
                      <Badge 
                        variant="outline" 
                        className={
                          item.priority === 'high' ? 'text-red-700 border-red-400' :
                          item.priority === 'medium' ? 'text-yellow-700 border-yellow-400' :
                          'text-green-700 border-green-400'
                        }
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-purple-800 dark:text-purple-400 mb-2">{item.content}</p>
                    <div className="flex justify-between items-center text-xs text-purple-600 dark:text-purple-500">
                      <span>Source: {item.source}</span>
                      <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {relevantIntelligence.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{relevantIntelligence.length - 3} more reports
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
              {" "}For comprehensive intelligence operations, visit the{" "}
              <Button variant="link" className="p-0 h-auto" onClick={() => window.open('/sdi', '_blank')}>
                Strategic Defense Initiative (SDI) →
              </Button>
            </span>
          )}
          {canAccessECI && userProfile?.countryId === countryId && (
            <span>
              {" "}For executive management, visit the{" "}
              <Button variant="link" className="p-0 h-auto" onClick={() => window.open('/eci', '_blank')}>
                Executive Command Interface (ECI) →
              </Button>
            </span>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}