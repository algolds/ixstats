"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { TabsContent } from "~/components/ui/tabs";
import { Globe, ChevronRight, Users, Building2, Target, Star, Activity } from "lucide-react";
import { DiplomaticOperationsHub } from "~/app/mycountry/intelligence/_components/DiplomaticOperationsHub";

interface MyCountryDiplomacyTabProps {
  userCountry: any;
  activityRingsData?: any;
  diplomaticRelations: any[];
  recentDiplomaticActivity: any[];
}

/** MyCountry "Diplomacy" tab: standing, allies, actions, operational network, recent activity.
 * Extracted from EnhancedCommandCenter.tsx (audit C2). */
export function MyCountryDiplomacyTab({
  userCountry,
  activityRingsData,
  diplomaticRelations,
  recentDiplomaticActivity,
}: MyCountryDiplomacyTabProps) {
  return (
    <TabsContent value="diplomacy" className="mt-6 space-y-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground flex items-center gap-3 text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
              <Globe className="h-4 w-4 text-white" />
            </div>
            Diplomatic Overview
          </h3>
          <Link href="/sdi/diplomatic">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              View Full Network
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Quick Diplomatic Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Card className="glass-hierarchy-child">
            <CardContent className="p-4 text-center">
              <div className="mb-1 text-2xl font-bold text-blue-500">
                {activityRingsData?.diplomaticStanding.toFixed(0) || 0}
              </div>
              <div className="text-muted-foreground text-xs">Diplomatic Score</div>
            </CardContent>
          </Card>
          <Card className="glass-hierarchy-child">
            <CardContent className="p-4 text-center">
              <div className="mb-1 text-2xl font-bold text-purple-500">
                {diplomaticRelations?.filter(
                  (r) => r.relationship === "alliance" || r.relationship === "friendly"
                ).length || 0}
              </div>
              <div className="text-muted-foreground text-xs">Active Allies</div>
            </CardContent>
          </Card>
          <Card className="glass-hierarchy-child">
            <CardContent className="p-4 text-center">
              <div className="mb-1 text-2xl font-bold text-green-500">
                {diplomaticRelations?.reduce((sum, r) => sum + (r.treaties?.length || 0), 0) || 0}
              </div>
              <div className="text-muted-foreground text-xs">Active Treaties</div>
            </CardContent>
          </Card>
          <Card className="glass-hierarchy-child">
            <CardContent className="p-4 text-center">
              <div className="mb-1 text-2xl font-bold text-amber-500">
                {activityRingsData?.diplomaticStanding >= 75
                  ? "Excellent"
                  : activityRingsData?.diplomaticStanding >= 60
                    ? "Good"
                    : activityRingsData?.diplomaticStanding >= 40
                      ? "Neutral"
                      : "Declining"}
              </div>
              <div className="text-muted-foreground text-xs">Reputation</div>
            </CardContent>
          </Card>
        </div>

        {/* Diplomatic Actions */}
        <div className="space-y-4">
          <h4 className="text-foreground flex items-center gap-2 text-base font-semibold sm:text-lg">
            <Users className="h-4 w-4 text-purple-400 sm:h-5 sm:w-5" />
            Diplomatic Actions
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <Link href="/sdi/diplomatic#embassies">
              <Card className="glass-hierarchy-interactive cursor-pointer transition-all hover:scale-[1.02]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-foreground font-semibold">Embassy Network</div>
                    <div className="text-muted-foreground text-xs">Manage embassies</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/sdi/diplomatic#missions">
              <Card className="glass-hierarchy-interactive cursor-pointer transition-all hover:scale-[1.02]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-foreground font-semibold">Missions</div>
                    <div className="text-muted-foreground text-xs">Diplomatic missions</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/sdi/diplomatic#cultural">
              <Card className="glass-hierarchy-interactive cursor-pointer transition-all hover:scale-[1.02]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                    <Star className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-foreground font-semibold">Cultural Exchange</div>
                    <div className="text-muted-foreground text-xs">Programs & events</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-blue-500" />
              Operational Network
            </CardTitle>
            <CardDescription>
              Live diplomatic missions, embassies, and cultural exchanges from the unified data core
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DiplomaticOperationsHub countryId={userCountry.id} countryName={userCountry.name} />
          </CardContent>
        </Card>

        {/* Recent Diplomatic Activity */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Recent Diplomatic Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentDiplomaticActivity && recentDiplomaticActivity.length > 0 ? (
              <div className="space-y-3">
                {recentDiplomaticActivity.map((activity) => {
                  const isUpgrade = activity.changeType === "status_upgrade";
                  const color = isUpgrade
                    ? "green"
                    : activity.changeType === "status_downgrade"
                      ? "red"
                      : "blue";
                  const timeDiff = Date.now() - new Date(activity.updatedAt).getTime();
                  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
                  const timeText =
                    hoursAgo < 1
                      ? "Less than an hour ago"
                      : hoursAgo < 24
                        ? `${hoursAgo} hour${hoursAgo > 1 ? "s" : ""} ago`
                        : `${Math.floor(hoursAgo / 24)} day${Math.floor(hoursAgo / 24) > 1 ? "s" : ""} ago`;

                  return (
                    <div
                      key={activity.id}
                      className="bg-muted/50 flex items-center gap-3 rounded-lg p-3"
                    >
                      <div className={`h-2 w-2 rounded-full bg-${color}-500`} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {activity.changeType === "status_upgrade" &&
                            `Relations improved with ${activity.targetCountry}`}
                          {activity.changeType === "status_downgrade" &&
                            `Tensions rising with ${activity.targetCountry}`}
                          {activity.changeType === "new_treaty" &&
                            `Treaty signed with ${activity.targetCountry}`}
                          {activity.changeType === "embassy_opened" &&
                            `Embassy established in ${activity.targetCountry}`}
                          {![
                            "status_upgrade",
                            "status_downgrade",
                            "new_treaty",
                            "embassy_opened",
                          ].includes(activity.changeType) &&
                            `Diplomatic activity with ${activity.targetCountry}`}
                        </div>
                        <div className="text-muted-foreground text-xs">{timeText}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Globe className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No recent diplomatic activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
