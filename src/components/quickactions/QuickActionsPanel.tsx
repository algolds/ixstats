// src/components/quickactions/QuickActionsPanel.tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Zap,
  Calendar,
  FileText,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { MeetingScheduler } from "./MeetingScheduler";
import { PolicyCreator } from "./PolicyCreator";
import { MeetingDecisionsModal } from "./MeetingDecisionsModal";
import { toast } from "sonner";

interface QuickActionsPanelProps {
  countryId: string;
  userId: string;
  variant?: "compact" | "full";
  className?: string;
}

export function QuickActionsPanel({
  countryId,
  userId,
  variant = "compact",
  className,
}: QuickActionsPanelProps) {
  const [showMeetingScheduler, setShowMeetingScheduler] = useState(false);
  const [showPolicyCreator, setShowPolicyCreator] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<{ id: string; title: string } | null>(
    null
  );

  // Get dashboard overview
  const {
    data: overview,
    isLoading,
    refetch,
  } = api.quickActions.getDashboardOverview.useQuery({
    countryId,
    userId,
  });

  // Get policy recommendations count
  const { data: recommendations } = api.quickActions.getPolicyRecommendations.useQuery(
    {
      countryId,
      limit: 5,
    },
    {
      enabled: !!countryId,
    }
  );

  const handleMeetingClick = (meeting: any) => {
    if (meeting.status === "completed") {
      toast.info("Meeting already completed. View decisions in meeting history.");
    } else if (meeting.status === "scheduled") {
      toast.info("Meeting scheduled. Complete it to record decisions.");
    }
  };

  const suitableRecommendations = recommendations?.filter((r) => r.meetsRequirements) ?? [];

  if (isLoading) {
    return (
      <Card className={`glass-hierarchy-parent ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 animate-pulse text-purple-600" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-muted/50 h-20 animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`glass-hierarchy-parent ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Quick Actions
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {overview?.stats.totalMeetingsThisWeek || 0} meetings
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {overview?.stats.activePoliciesCount || 0} policies
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto flex-col items-start p-4 hover:bg-blue-50 dark:hover:bg-blue-950/20"
            onClick={() => setShowMeetingScheduler(true)}
          >
            <Calendar className="mb-2 h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold">Schedule Meeting</span>
            <span className="text-muted-foreground text-xs">Cabinet & officials</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col items-start p-4 hover:bg-green-50 dark:hover:bg-green-950/20"
            onClick={() => setShowPolicyCreator(true)}
          >
            <FileText className="mb-2 h-5 w-5 text-green-600" />
            <span className="text-sm font-semibold">Create Policy</span>
            <span className="text-muted-foreground text-xs">Domestic affairs</span>
          </Button>
        </div>

        {variant === "full" && (
          <>
            <Separator />

            {/* Policy Recommendations */}
            {suitableRecommendations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    Recommended Policies
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {suitableRecommendations.length} available
                  </Badge>
                </div>

                <div className="space-y-2">
                  {suitableRecommendations.slice(0, 3).map((rec, index) => (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-card hover:bg-accent/50 cursor-pointer rounded-lg border p-3 transition-colors"
                      onClick={() => setShowPolicyCreator(true)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h4 className="truncate text-sm font-medium">{rec.name}</h4>
                            <Badge
                              variant={
                                rec.priority === "critical"
                                  ? "destructive"
                                  : rec.priority === "high"
                                    ? "default"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {rec.priority}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground line-clamp-2 text-xs">
                            {rec.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Match:</span>
                            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-green-500"
                                style={{ width: `${rec.suitabilityScore}%` }}
                              />
                            </div>
                            <span className="font-medium">{rec.suitabilityScore}%</span>
                          </div>
                        </div>
                        <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Upcoming Meetings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Upcoming Meetings
                </h3>
                <Badge variant="outline" className="text-xs">
                  Next 7 days
                </Badge>
              </div>

              {overview?.upcomingMeetings && overview.upcomingMeetings.length > 0 ? (
                <div className="space-y-2">
                  {overview.upcomingMeetings.map((meeting: any) => {
                    // Use IxTime if available, otherwise convert from scheduledDate
                    const ixTime =
                      meeting.scheduledIxTime ??
                      IxTime.convertToIxTime(new Date(meeting.scheduledDate).getTime());
                    const ixDate = new Date(ixTime);

                    return (
                      <div
                        key={meeting.id}
                        className="bg-card hover:bg-accent/50 cursor-pointer rounded-lg border p-3 transition-colors"
                        onClick={() => handleMeetingClick(meeting)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <Clock className="h-3 w-3 text-blue-600" />
                              <span className="text-xs font-medium text-blue-600">
                                {format(ixDate, "MMM d, h:mm a")} ILT
                              </span>
                            </div>
                            <h4 className="truncate text-sm font-medium">{meeting.title}</h4>
                            {meeting.attendances && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                {meeting.attendances.length} attendees
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={meeting.status === "scheduled" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {meeting.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  <Calendar className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No upcoming meetings</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Active Policies */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-green-600" />
                  Active Policies
                </h3>
                <Badge variant="outline" className="text-xs">
                  {overview?.stats.activePoliciesCount || 0}
                </Badge>
              </div>

              {overview?.activePolicies && overview.activePolicies.length > 0 ? (
                <div className="space-y-2">
                  {overview.activePolicies.slice(0, 3).map((policy: any) => (
                    <div key={policy.id} className="bg-card rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-medium">{policy.name}</h4>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {policy.policyType}
                            </Badge>
                            <Badge
                              variant={
                                policy.priority === "critical"
                                  ? "destructive"
                                  : policy.priority === "high"
                                    ? "default"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {policy.priority}
                            </Badge>
                          </div>
                          {policy.effectiveDate && (
                            <p className="text-muted-foreground mt-1 text-xs">
                              Since {format(new Date(policy.effectiveDate), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No active policies</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Upcoming Activities */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  Upcoming Activities
                </h3>
                <Badge variant="outline" className="text-xs">
                  {overview?.stats.upcomingActivitiesCount || 0}
                </Badge>
              </div>

              {overview?.upcomingActivities && overview.upcomingActivities.length > 0 ? (
                <div className="space-y-1">
                  {overview.upcomingActivities.slice(0, 5).map((activity: any) => (
                    <div
                      key={activity.id}
                      className="hover:bg-accent/50 flex items-center justify-between rounded-md p-2 transition-colors"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${
                            activity.priority === "urgent"
                              ? "bg-red-500"
                              : activity.priority === "high"
                                ? "bg-orange-500"
                                : "bg-blue-500"
                          }`}
                        />
                        <span className="truncate text-sm">{activity.title}</span>
                      </div>
                      <span className="text-muted-foreground flex-shrink-0 text-xs">
                        {format(new Date(activity.scheduledDate), "MMM d")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No upcoming activities</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick Stats for Compact View */}
        {variant === "compact" && (
          <>
            <Separator />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-blue-600">
                  {overview?.stats.totalMeetingsThisWeek || 0}
                </div>
                <div className="text-muted-foreground text-xs">Meetings</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {overview?.stats.activePoliciesCount || 0}
                </div>
                <div className="text-muted-foreground text-xs">Policies</div>
              </div>
              <div>
                <div className="text-lg font-bold text-purple-600">
                  {overview?.stats.upcomingActivitiesCount || 0}
                </div>
                <div className="text-muted-foreground text-xs">Activities</div>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* Modals */}
      <MeetingScheduler
        countryId={countryId}
        open={showMeetingScheduler}
        onOpenChange={setShowMeetingScheduler}
      />

      <PolicyCreator
        countryId={countryId}
        open={showPolicyCreator}
        onOpenChange={setShowPolicyCreator}
        onSuccess={() => {
          void refetch();
        }}
      />

      {selectedMeeting && (
        <MeetingDecisionsModal
          meetingId={selectedMeeting.id}
          meetingTitle={selectedMeeting.title}
          open={!!selectedMeeting}
          onOpenChange={(open) => {
            if (!open) setSelectedMeeting(null);
          }}
          onComplete={() => {
            void refetch();
          }}
        />
      )}
    </Card>
  );
}
