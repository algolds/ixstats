"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { TabsContent } from "~/components/ui/tabs";
import {
  Crown,
  Clock,
  FileText,
  Shield,
  AlertCircle,
  Eye,
  Target,
  Zap,
  Activity,
  ChevronRight,
} from "lucide-react";
import { ExecutiveCommandCenter } from "~/app/mycountry/components/ExecutiveCommandCenter";
import { unifiedFlagService } from "~/lib/unified-flag-service";

type MyCountryTab = "overview" | "executive" | "diplomacy";

interface MyCountryExecutiveTabProps {
  userCountry: any;
  executiveIntelligence: any;
  economyData?: any;
  upcomingMeetings: any[];
  policies: any[];
  onNavigate: (tab: MyCountryTab) => void;
}

/** MyCountry "Executive" tab: command center, meetings/policy/security/agenda cards.
 * Extracted from EnhancedCommandCenter.tsx (audit C2). */
export function MyCountryExecutiveTab({
  userCountry,
  executiveIntelligence,
  economyData,
  upcomingMeetings,
  policies,
  onNavigate,
}: MyCountryExecutiveTabProps) {
  return (
    <TabsContent value="executive" className="mt-6 space-y-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground flex items-center gap-3 text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
              <Crown className="h-4 w-4 text-white" />
            </div>
            Executive Brief
          </h3>
          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1 text-xs text-white">
            Leadership
          </Badge>
        </div>

        {executiveIntelligence && (
          <Card className="glass-hierarchy-child">
            <CardContent className="p-0">
              <ExecutiveCommandCenter
                intelligence={executiveIntelligence}
                country={{
                  name: userCountry.name,
                  flag:
                    unifiedFlagService.getCachedFlagUrl(userCountry.name) ||
                    userCountry.flagUrl ||
                    null,
                  leader: userCountry.leader || "Unknown",
                }}
                isOwner
                countryStats={userCountry}
                economyData={economyData ?? userCountry}
                onNavigateToIntelligence={() => onNavigate("overview")}
                onNavigateToMeetings={() => onNavigate("executive")}
                onNavigateToPolicy={() => onNavigate("executive")}
              />
            </CardContent>
          </Card>
        )}

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Scheduler & Meetings */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-blue-500" />
                Upcoming Meetings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingMeetings && upcomingMeetings.length > 0 ? (
                <>
                  {upcomingMeetings
                    .filter((m: any) => m.status !== "completed" && m.status !== "cancelled")
                    .slice(0, 3)
                    .map((meeting: any, idx: number) => {
                      const colors = ["blue", "purple", "green"];
                      const color = colors[idx % colors.length];
                      const meetingDate = new Date(meeting.scheduledDate);
                      const timeStr = meetingDate.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      });

                      return (
                        <div
                          key={meeting.id}
                          className={`flex items-start gap-3 rounded-lg p-3 bg-${color}-500/10 border border-${color}-500/20`}
                        >
                          <div
                            className={`text-sm font-medium text-${color}-600 dark:text-${color}-400 min-w-[60px]`}
                          >
                            {timeStr}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold">{meeting.title}</div>
                            {meeting.description && (
                              <div className="text-muted-foreground truncate text-xs">
                                {meeting.description}
                              </div>
                            )}
                          </div>
                          <Link href="/mycountry/meetings">
                            <Button size="sm" variant="ghost" className="h-6 px-2">
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      );
                    })}
                  <Link href="/mycountry/meetings">
                    <Button variant="outline" size="sm" className="mt-2 w-full">
                      View Full Calendar
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="text-muted-foreground py-8 text-center">
                  <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No upcoming meetings scheduled</p>
                  <Link href="/mycountry/meetings">
                    <Button variant="outline" size="sm" className="mt-3">
                      Schedule Meeting
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Policy Status */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-green-500" />
                Policy Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {policies ? (
                <>
                  <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold">Active Policies</div>
                      <Badge
                        variant="secondary"
                        className="bg-green-500/20 text-green-700 dark:text-green-300"
                      >
                        {policies.filter((p: any) => p.status === "active").length} Active
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {policies.filter((p: any) => p.status === "active").length > 0
                        ? `Latest: ${policies.filter((p: any) => p.status === "active")[0]?.name || "Policy active"}`
                        : "No active policies"}
                    </div>
                    <Link href="/mycountry#government">
                      <Button size="sm" variant="ghost" className="mt-2 w-full text-xs">
                        Review Policies
                      </Button>
                    </Link>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold">Pending Approval</div>
                      <Badge
                        variant="secondary"
                        className="bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      >
                        {policies.filter((p: any) => p.status === "draft").length} Pending
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {policies.filter((p: any) => p.status === "draft").length > 0
                        ? `Awaiting: ${policies.filter((p: any) => p.status === "draft")[0]?.name || "Policy draft"}`
                        : "No pending policies"}
                    </div>
                    <Link href="/mycountry#government">
                      <Button size="sm" variant="ghost" className="mt-2 w-full text-xs">
                        Review Pending
                      </Button>
                    </Link>
                  </div>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold">All Policies</div>
                      <Badge
                        variant="secondary"
                        className="bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      >
                        {policies.length} Total
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Across all categories and statuses
                    </div>
                    <Link href="/mycountry#government">
                      <Button size="sm" variant="ghost" className="mt-2 w-full text-xs">
                        View All
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground py-8 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No policies found</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Status */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-red-500" />
                Security Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20">
                    <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Threat Level</div>
                    <div className="text-muted-foreground text-xs">Low - All Clear</div>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-500/20 text-green-700 dark:text-green-300"
                >
                  Safe
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Border Security</div>
                    <div className="text-muted-foreground text-xs">Normal operations</div>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-blue-500/20 text-blue-700 dark:text-blue-300"
                >
                  Nominal
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
                    <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Intelligence</div>
                    <div className="text-muted-foreground text-xs">Monitoring active</div>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-purple-500/20 text-purple-700 dark:text-purple-300"
                >
                  Active
                </Badge>
              </div>
              <Link href="/mycountry#defense">
                <Button variant="outline" size="sm" className="mt-2 w-full">
                  Full Security Report
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* National Agenda */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-orange-500" />
                National Agenda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">Economic Growth</div>
                  <div className="text-xs text-orange-600 dark:text-orange-400">85% Complete</div>
                </div>
                <Progress value={85} className="mb-2 h-1.5" />
                <div className="text-muted-foreground text-xs">Q4 targets on track</div>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">Infrastructure Development</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">62% Complete</div>
                </div>
                <Progress value={62} className="mb-2 h-1.5" />
                <div className="text-muted-foreground text-xs">Highway project Phase 2</div>
              </div>
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">Education Reform</div>
                  <div className="text-xs text-purple-600 dark:text-purple-400">40% Complete</div>
                </div>
                <Progress value={40} className="mb-2 h-1.5" />
                <div className="text-muted-foreground text-xs">Curriculum updates rollout</div>
              </div>
              <Link href="/mycountry#government">
                <Button variant="outline" size="sm" className="mt-2 w-full">
                  View Full Agenda
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick Executive Actions */}
        <Card className="glass-hierarchy-child border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-yellow-500" />
              Quick Executive Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <Link href="/mycountry/meetings">
                <Button variant="outline" className="flex w-full items-center justify-start gap-2">
                  <Clock className="h-4 w-4" />
                  Schedule
                </Button>
              </Link>
              <Link href="/mycountry#government">
                <Button variant="outline" className="flex w-full items-center justify-start gap-2">
                  <FileText className="h-4 w-4" />
                  Policies
                </Button>
              </Link>
              <Link href="/mycountry#defense">
                <Button variant="outline" className="flex w-full items-center justify-start gap-2">
                  <Shield className="h-4 w-4" />
                  Security
                </Button>
              </Link>
              <Link href="/mycountry#intelligence">
                <Button variant="outline" className="flex w-full items-center justify-start gap-2">
                  <Activity className="h-4 w-4" />
                  Intelligence
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
